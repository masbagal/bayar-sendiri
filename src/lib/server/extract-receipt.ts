import { z } from 'zod';
import { isBalanced, reconcile } from '../bill.js';
import { parseAmount } from '../parse-amount.js';
import type { Charge, MenuItem, ReceiptData } from '../types.js';

const Printed = z
	.string()
	.describe(
		'Amount exactly as printed, separators and sign included, e.g. "21.363,64" or "-16.500"'
	);

const Extraction = z.object({
	isReceipt: z.boolean().describe('False if the image is not a restaurant/shop receipt or bill'),
	rejectReason: z.string().nullable().describe('Why the image was rejected, null otherwise'),
	currency: z.string().describe('ISO 4217 code, e.g. IDR, USD, SGD'),
	items: z.array(
		z.object({
			name: z.string(),
			quantity: z.string().describe('Quantity as printed, "1" if none'),
			unitPrice: Printed.nullable().describe('Unit price if printed, else null'),
			lineTotal: Printed.nullable().describe(
				'Line amount (for the whole quantity) if printed, else null'
			)
		})
	),
	subtotal: Printed.nullable().describe('Printed subtotal, null if not printed'),
	fees: z
		.array(z.object({ label: z.string(), amount: Printed }))
		.describe('Charges added on top of the items: tax, service, rounding'),
	discounts: z.array(z.object({ label: z.string(), amount: Printed })),
	grandTotal: Printed.describe('Final amount due as printed')
});
type Extraction = z.infer<typeof Extraction>;

const responseFormat = {
	type: 'json_schema',
	json_schema: { name: 'receipt', strict: true, schema: z.toJSONSchema(Extraction) }
};

const PROMPT = `Transcribe a restaurant receipt for bill splitting. Copy every amount character-for-character as printed (keep "." and "," exactly, keep minus signs). Never calculate or reformat a number.

- items: every purchased line with its quantity, its unit price if printed and its line amount if printed. When a line shows "qty x price ... amount", the last number is the line amount.
- Indented modifier/option lines (e.g. "- Extra cheese (+Rp5,000)") are part of their parent item. Only list one as its own item when it has its own amount in the amount column. Skip zero-priced lines.
- fees: only charges ADDED on top of the item lines (tax, PB1, PPN, service charge, biaya layanan, tip, packaging, rounding/pembulatan). If tax is noted as included in prices, it is not a fee.
- discounts: promo, diskon, voucher, member discount lines.
- subtotal and grandTotal as printed. grandTotal is the amount due, not cash tendered (tunai) or change (kembali).
- If the image is not a receipt, set isReceipt false and explain in rejectReason. If it is a receipt but you cannot read the amounts, also set isReceipt false and ask for a clearer photo.`;

export class ExtractionError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

export interface ExtractOptions {
	apiKey: string;
	model: string;
	/** Model for the corrective second attempt; defaults to `model`. */
	fallbackModel?: string;
}

export interface ExtractResult {
	receipt: ReceiptData;
	attempts: { model: string; receipt: ReceiptData | null; costUsd: number; ms: number }[];
}

const MODEL_TIMEOUT_MS = 45_000;

type Message = { role: 'user' | 'assistant'; content: unknown };

async function callModel(apiKey: string, model: string, messages: Message[]) {
	const started = Date.now();
	let body: { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
	try {
		const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			// A stalled provider would otherwise leave the user on the loading screen forever.
			signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
			headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages,
				response_format: responseFormat,
				provider: { require_parameters: true },
				usage: { include: true }
			})
		});
		if (!res.ok) {
			throw new ExtractionError(
				`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`,
				502
			);
		}
		body = await res.json();
	} catch (err) {
		if (err instanceof ExtractionError) throw err;
		throw new ExtractionError(`OpenRouter request failed: ${String(err)}`, 504);
	}
	const raw: string = body.choices?.[0]?.message?.content ?? '';
	return {
		raw,
		costUsd: body.usage?.cost ?? 0,
		ms: Date.now() - started,
		...interpret(raw)
	};
}

class Unreadable extends Error {}

const amount = (raw: string, what: string) => {
	const n = parseAmount(raw);
	if (n === null) throw new Unreadable(`Could not parse ${what} "${raw}"`);
	return n;
};

/** Parse the transcribed strings into the integer-minor-unit domain model. */
export function toReceiptData(e: Extraction): ReceiptData {
	const lines = e.items.map((item) => {
		const quantity = amount(item.quantity || '1', `quantity of ${item.name}`) || 1;
		const lineTotal =
			item.lineTotal !== null
				? amount(item.lineTotal, `amount of ${item.name}`)
				: item.unitPrice !== null
					? amount(item.unitPrice, `price of ${item.name}`) * quantity
					: null;
		if (lineTotal === null) throw new Unreadable(`No amount for ${item.name}`);
		return { name: item.name, quantity, lineTotal };
	});
	const fees = e.fees.map((f) => ({ label: f.label, amount: amount(f.amount, f.label) }));
	const discounts = e.discounts.map((d) => ({
		label: d.label,
		amount: Math.abs(amount(d.amount, d.label))
	}));
	const subtotal = e.subtotal === null ? null : amount(e.subtotal, 'subtotal');
	const grandTotal = amount(e.grandTotal, 'grand total');

	const all = [
		...lines.map((l) => l.lineTotal),
		...fees.map((f) => f.amount),
		...discounts.map((d) => d.amount),
		grandTotal,
		subtotal ?? 0
	];
	const decimals = all.every((n) => Number.isInteger(n)) ? 0 : 2;
	const toMinor = (n: number) => Math.round(n * 10 ** decimals);
	const id = () => crypto.randomUUID();

	const items: MenuItem[] = [];
	const discountCharges: Charge[] = discounts.map((d) => ({
		id: id(),
		label: d.label,
		amount: toMinor(d.amount)
	}));
	for (const line of lines) {
		const lineTotal = toMinor(line.lineTotal);
		if (lineTotal === 0) continue;
		if (lineTotal < 0) {
			// Some receipts print discounts as negative item lines.
			discountCharges.push({ id: id(), label: line.name, amount: -lineTotal });
			continue;
		}
		items.push({
			id: id(),
			name: line.name,
			quantity: Math.max(1, Math.round(line.quantity)),
			lineTotal
		});
	}
	const feeCharges: Charge[] = fees
		.filter((f) => f.amount !== 0)
		.map((f) => ({ id: id(), label: f.label, amount: toMinor(f.amount) }));
	const printedSubtotal = subtotal === null ? null : toMinor(subtotal);
	const printedTotal = toMinor(grandTotal);

	return {
		currency: e.currency.toUpperCase(),
		decimals,
		items,
		fees: feeCharges,
		discounts: discountCharges,
		printedSubtotal,
		printedTotal,
		reconciliation: reconcile(items, feeCharges, discountCharges, printedSubtotal, printedTotal)
	};
}

/** Validate and parse a model reply; returns the receipt or a message to feed back. */
function interpret(raw: string): {
	extraction: Extraction | null;
	receipt: ReceiptData | null;
	problem: string | null;
} {
	let json: unknown;
	try {
		json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
	} catch {
		return { extraction: null, receipt: null, problem: 'Your answer was not valid JSON.' };
	}
	const parsed = Extraction.safeParse(json);
	if (!parsed.success) {
		return {
			extraction: null,
			receipt: null,
			problem: `Your answer did not match the schema: ${parsed.error.message.slice(0, 300)}`
		};
	}
	if (!parsed.data.isReceipt) return { extraction: parsed.data, receipt: null, problem: null };
	try {
		return { extraction: parsed.data, receipt: toReceiptData(parsed.data), problem: null };
	} catch (err) {
		if (err instanceof Unreadable)
			return { extraction: parsed.data, receipt: null, problem: err.message + '.' };
		throw err;
	}
}

function describeGaps(r: ReceiptData): string {
	const unit = 10 ** r.decimals;
	const fmt = (n: number) => String(n / unit);
	const lines = [
		`Item lines add up to ${fmt(r.reconciliation.itemsTotal)}.`,
		`Items + fees − discounts = ${fmt(r.reconciliation.computedTotal)}, but grandTotal is ${fmt(r.printedTotal)}.`
	];
	if (r.reconciliation.subtotalGap) {
		lines.splice(1, 0, `The printed subtotal is ${fmt(r.printedSubtotal!)}.`);
	}
	return lines.join(' ');
}

const severity = (r: ReceiptData) =>
	Math.abs(r.reconciliation.totalGap) + Math.abs(r.reconciliation.subtotalGap ?? 0);

/**
 * Extract with `model`; if the result fails to parse or does not add up, retry once with
 * `fallbackModel`, telling it exactly which totals disagree. Returns the best attempt.
 */
export async function extractReceipt(
	imageDataUrl: string,
	opts: ExtractOptions
): Promise<ExtractResult> {
	const userTurn: Message = {
		role: 'user',
		content: [
			{ type: 'text', text: PROMPT },
			{ type: 'image_url', image_url: { url: imageDataUrl } }
		]
	};
	const attempts: ExtractResult['attempts'] = [];

	const first = await callModel(opts.apiKey, opts.model, [userTurn]);
	attempts.push({
		model: opts.model,
		receipt: first.receipt,
		costUsd: first.costUsd,
		ms: first.ms
	});
	if (first.extraction && !first.extraction.isReceipt) {
		throw new ExtractionError(first.extraction.rejectReason ?? 'Not a restaurant receipt', 422);
	}
	if (first.receipt && isBalanced(first.receipt.reconciliation)) {
		return { receipt: first.receipt, attempts };
	}

	const feedback = first.receipt
		? `Your transcription does not add up. ${describeGaps(first.receipt)} Re-read the receipt line by line: look for missed or duplicated items, misread digits, a modifier listed separately although its price is inside the parent item, or tax listed as a fee although it is included in prices. Do not change numbers to force a match; transcribe what is printed. Return the corrected JSON.`
		: `${first.problem} Return the transcription again.`;
	const retryModel = opts.fallbackModel ?? opts.model;
	let second: Awaited<ReturnType<typeof callModel>>;
	try {
		second = await callModel(opts.apiKey, retryModel, [
			userTurn,
			{ role: 'assistant', content: first.raw || '{}' },
			{ role: 'user', content: feedback }
		]);
	} catch (err) {
		// The retry is a second opinion; a failed retry should not discard a usable first read.
		if (first.receipt) return { receipt: first.receipt, attempts };
		throw err;
	}
	attempts.push({
		model: retryModel,
		receipt: second.receipt,
		costUsd: second.costUsd,
		ms: second.ms
	});
	if (!first.receipt && second.extraction && !second.extraction.isReceipt) {
		throw new ExtractionError(second.extraction.rejectReason ?? 'Not a restaurant receipt', 422);
	}

	const candidates = [first.receipt, second.receipt].filter((r): r is ReceiptData => r !== null);
	if (candidates.length === 0) throw new ExtractionError('Could not read the receipt', 502);
	candidates.sort((a, b) => severity(a) - severity(b));
	return { receipt: candidates[0], attempts };
}
