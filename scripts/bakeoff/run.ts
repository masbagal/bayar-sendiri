/**
 * Scores vision models on fixtures/ (image + ground-truth JSON) through the real extraction
 * pipeline (first attempt + one corrective retry on the same model).
 *
 * Outcomes per run:
 *   correct       line totals, fee sum, discount sum and grand total all match the truth
 *   flagged       wrong, but totals don't reconcile so the app warns the user
 *   refused       model said the photo is unreadable (user is asked to retake)
 *   silent-wrong  wrong AND reconciles: the user gets a bad split with no warning
 *   error         transport/provider failure
 *
 * Run: OPENROUTER_API_KEY=... [FIXTURES=regex] [FALLBACK=model] pnpm tsx scripts/bakeoff/run.ts [runs=3] [model ...]
 */
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isBalanced } from '../../src/lib/bill.js';
import { extractReceipt, ExtractionError } from '../../src/lib/server/extract-receipt.js';
import type { ReceiptData } from '../../src/lib/types.js';

const DEFAULT_MODELS = [
	'google/gemini-2.5-flash',
	'google/gemini-3.1-flash-lite',
	'google/gemini-3.5-flash-lite',
	'anthropic/claude-haiku-5.5',
	'openai/gpt-6-luna',
	'bytedance-seed/seed-2.0-mini'
];

interface Truth {
	lineTotals: number[];
	fees: number[];
	discounts: number[];
	grandTotal: number;
}

const dir = join(import.meta.dirname, 'fixtures');
const filter = new RegExp(process.env.FIXTURES ?? '.');
const fixtures = readdirSync(dir)
	.filter((f) => f.endsWith('.json') && filter.test(f))
	.map((f) => {
		const name = f.replace(/\.json$/, '');
		const image = readdirSync(dir).find((x) => x.startsWith(name + '.') && !x.endsWith('.json'))!;
		const mime = image.endsWith('.png') ? 'image/png' : 'image/jpeg';
		return {
			name,
			truth: JSON.parse(readFileSync(join(dir, f), 'utf8')) as Truth,
			dataUrl: `data:${mime};base64,${readFileSync(join(dir, image)).toString('base64')}`
		};
	});

const cents = (n: number) => Math.round(n * 100);
const sumCents = (xs: number[]) => xs.reduce((a, x) => a + cents(x), 0);
const sorted = (xs: number[]) =>
	xs
		.map(cents)
		.sort((a, b) => a - b)
		.join(',');

function mismatches(r: ReceiptData, t: Truth): string[] {
	const major = (n: number) => n / 10 ** r.decimals;
	const problems = [];
	if (sorted(r.items.map((i) => major(i.lineTotal))) !== sorted(t.lineTotals))
		problems.push('items');
	if (sumCents(r.fees.map((f) => major(f.amount))) !== sumCents(t.fees)) problems.push('fees');
	if (sumCents(r.discounts.map((d) => major(d.amount))) !== sumCents(t.discounts))
		problems.push('discounts');
	if (cents(major(r.printedTotal)) !== cents(t.grandTotal)) problems.push('total');
	return problems;
}

const progressFile = join(import.meta.dirname, `results-${Date.now()}.jsonl`);
let done = 0;

async function pool<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
	const out: T[] = new Array(tasks.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: size }, async () => {
			while (next < tasks.length) {
				const i = next++;
				out[i] = await tasks[i]();
				appendFileSync(progressFile, JSON.stringify(out[i]) + '\n');
				process.stderr.write(`\r${++done}/${tasks.length}`);
			}
		})
	);
	return out;
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
const [runsArg, ...modelArgs] = process.argv.slice(2);
const runs = Number(runsArg ?? 3);
const models = modelArgs.length ? modelArgs : DEFAULT_MODELS;

type Outcome = 'correct' | 'flagged' | 'refused' | 'silent-wrong' | 'error';
type Row = {
	model: string;
	fixture: string;
	outcome: Outcome;
	firstCorrect: boolean;
	detail: string;
	costUsd: number;
	ms: number;
};

const tasks = models.flatMap((model) =>
	fixtures.flatMap((fx) =>
		Array.from({ length: runs }, () => async (): Promise<Row> => {
			const base = { model, fixture: fx.name, firstCorrect: false, costUsd: 0, ms: 0 };
			try {
				const { receipt, attempts } = await extractReceipt(fx.dataUrl, {
					apiKey,
					model,
					fallbackModel: process.env.FALLBACK || undefined
				});
				const wrong = mismatches(receipt, fx.truth);
				const first = attempts[0].receipt;
				return {
					...base,
					outcome:
						wrong.length === 0
							? 'correct'
							: isBalanced(receipt.reconciliation)
								? 'silent-wrong'
								: 'flagged',
					firstCorrect: first !== null && mismatches(first, fx.truth).length === 0,
					detail: wrong.join('+'),
					costUsd: attempts.reduce((a, x) => a + x.costUsd, 0),
					ms: attempts.reduce((a, x) => a + x.ms, 0)
				};
			} catch (e) {
				const refused = e instanceof ExtractionError && e.status === 422;
				return { ...base, outcome: refused ? 'refused' : 'error', detail: String(e).slice(0, 160) };
			}
		})
	)
);

const rows = await pool(tasks, 12);
writeFileSync(
	join(import.meta.dirname, `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
	JSON.stringify(rows, null, '\t')
);

const pct = (n: number, d: number) => `${d ? Math.round((100 * n) / d) : 0}%`.padStart(6);
console.log(`${fixtures.length} fixtures × ${runs} runs\n`);
console.log(
	'model'.padEnd(42),
	' first',
	'correct',
	'flagged',
	'refused',
	' SILENT',
	' error',
	'  $/receipt',
	' p50 s',
	'  silent-wrong cases'
);
for (const model of models) {
	const rs = rows.filter((r) => r.model === model);
	const n = rs.length;
	const count = (o: Outcome) => rs.filter((r) => r.outcome === o).length;
	const ok = rs.filter((r) => r.outcome !== 'error');
	const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
	const silent = [
		...new Set(
			rs.filter((r) => r.outcome === 'silent-wrong').map((r) => `${r.fixture}:${r.detail}`)
		)
	];
	console.log(
		model.padEnd(42),
		pct(rs.filter((r) => r.firstCorrect).length, n),
		pct(count('correct'), n).padStart(7),
		pct(count('flagged'), n).padStart(7),
		pct(count('refused'), n).padStart(7),
		pct(count('silent-wrong'), n).padStart(7),
		pct(count('error'), n),
		('$' + (ok.reduce((a, r) => a + r.costUsd, 0) / Math.max(ok.length, 1)).toFixed(5)).padStart(
			11
		),
		((ms[Math.floor(ms.length / 2)] ?? 0) / 1000).toFixed(1).padStart(6),
		' ',
		silent.join(' ').slice(0, 140)
	);
}
const errors = rows.filter((r) => r.outcome === 'error');
if (errors.length)
	console.log('\nerrors:', [...new Set(errors.map((e) => `${e.model}: ${e.detail}`))].slice(0, 12));
