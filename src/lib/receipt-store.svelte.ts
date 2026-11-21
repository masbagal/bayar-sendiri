import { reconcile } from './bill.js';
import type { Minor, ReceiptData } from './types.js';

let capturedImage = $state<string>('');
let receiptData = $state<ReceiptData | null>(null);

export function setCapturedImage(base64: string) {
	capturedImage = base64;
}

export function getCapturedImage(): string {
	return capturedImage;
}

export function setReceiptData(data: ReceiptData) {
	receiptData = data;
}

export function getReceiptData(): ReceiptData | null {
	return receiptData;
}

// ─── Corrections ───
// Every edit goes through `edit`, so the reconciliation always matches the lines.

export type LineKind = 'items' | 'fees' | 'discounts';

function edit(change: (r: ReceiptData) => void) {
	if (!receiptData) return;
	change(receiptData);
	const r = receiptData;
	r.reconciliation = reconcile(r.items, r.fees, r.discounts, r.printedSubtotal, r.printedTotal);
}

/** Switch a whole-unit receipt to cents when someone types an amount with cents. */
function ensureDecimals(r: ReceiptData, value: number) {
	if (Number.isInteger(value * 10 ** r.decimals) || r.decimals >= 2) return;
	const factor = 10 ** (2 - r.decimals);
	for (const line of r.items) line.lineTotal *= factor;
	for (const line of [...r.fees, ...r.discounts]) line.amount *= factor;
	if (r.printedSubtotal !== null) r.printedSubtotal *= factor;
	r.printedTotal *= factor;
	r.decimals = 2;
}

const toMinor = (r: ReceiptData, value: number): Minor => Math.round(value * 10 ** r.decimals);

/** Update the line with `id`, or add a new one when `id` is null. `value` is in major units. */
export function saveLine(kind: LineKind, id: string | null, label: string, value: number) {
	edit((r) => {
		ensureDecimals(r, value);
		const amount = toMinor(r, value);
		if (kind === 'items') {
			const item = r.items.find((i) => i.id === id);
			if (item) Object.assign(item, { name: label, lineTotal: amount });
			else r.items.push({ id: crypto.randomUUID(), name: label, quantity: 1, lineTotal: amount });
			return;
		}
		const charge = r[kind].find((c) => c.id === id);
		if (charge) Object.assign(charge, { label, amount });
		else r[kind].push({ id: crypto.randomUUID(), label, amount });
	});
}

export function removeLine(kind: LineKind, id: string) {
	edit((r) => {
		if (kind === 'items') r.items = r.items.filter((i) => i.id !== id);
		else r[kind] = r[kind].filter((c) => c.id !== id);
	});
}

export function setPrintedTotal(value: number) {
	edit((r) => {
		ensureDecimals(r, value);
		r.printedTotal = toMinor(r, value);
	});
}
