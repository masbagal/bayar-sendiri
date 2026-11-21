import type {
	Charge,
	ItemAssignments,
	MenuItem,
	Minor,
	Reconciliation,
	ReceiptData,
	User,
	UserBreakdown,
	UserItemShare
} from './types.js';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Split an integer amount proportionally to weights so the parts sum to exactly `amount`
 * (largest-remainder method). Ties go to the earlier index.
 */
export function allocate(amount: Minor, weights: number[]): Minor[] {
	const totalWeight = sum(weights);
	if (totalWeight <= 0) return weights.map(() => 0);

	const sign = amount < 0 ? -1 : 1;
	const abs = Math.abs(amount);
	const exact = weights.map((w) => (abs * w) / totalWeight);
	const parts = exact.map(Math.floor);
	let leftover = abs - sum(parts);

	const byRemainder = exact
		.map((value, index) => ({ index, remainder: value - parts[index] }))
		.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
	for (const { index } of byRemainder) {
		if (leftover <= 0) break;
		parts[index] += 1;
		leftover -= 1;
	}
	return parts.map((p) => sign * p);
}

export function reconcile(
	items: MenuItem[],
	fees: Charge[],
	discounts: Charge[],
	printedSubtotal: Minor | null,
	printedTotal: Minor
): Reconciliation {
	const itemsTotal = sum(items.map((i) => i.lineTotal));
	const discountTotal = sum(discounts.map((d) => d.amount));
	const computedTotal = itemsTotal + sum(fees.map((f) => f.amount)) - discountTotal;
	// Receipts print the subtotal either before or after discounts; accept whichever is closer.
	const subtotalGap =
		printedSubtotal === null
			? null
			: [printedSubtotal - itemsTotal, printedSubtotal - (itemsTotal - discountTotal)].sort(
					(a, b) => Math.abs(a) - Math.abs(b)
				)[0];
	return {
		itemsTotal,
		computedTotal,
		subtotalGap,
		totalGap: printedTotal - computedTotal
	};
}

export function isBalanced(r: Reconciliation): boolean {
	return r.totalGap === 0 && (r.subtotalGap === null || r.subtotalGap === 0);
}

/**
 * Per-person breakdown. Each item is split evenly among its assignees, then fees and
 * discounts are spread in proportion to each person's item subtotal. Every split uses
 * `allocate`, so the person totals sum exactly to the assigned share of the bill.
 */
export function splitBill(
	receipt: ReceiptData,
	users: User[],
	assignments: ItemAssignments
): UserBreakdown[] {
	const itemsByUser = new Map<string, UserItemShare[]>(users.map((u) => [u.id, []]));

	for (const item of receipt.items) {
		const assignees = (assignments[item.id] ?? []).filter((uid) => itemsByUser.has(uid));
		const shares = allocate(
			item.lineTotal,
			assignees.map(() => 1)
		);
		assignees.forEach((uid, i) => {
			itemsByUser.get(uid)!.push({
				itemId: item.id,
				itemName: item.name,
				lineTotal: item.lineTotal,
				sharedBy: assignees.length,
				userShare: shares[i]
			});
		});
	}

	const subtotals = users.map((u) => sum(itemsByUser.get(u.id)!.map((s) => s.userShare)));
	const feeShares = allocate(sum(receipt.fees.map((f) => f.amount)), subtotals);
	const discountShares = allocate(sum(receipt.discounts.map((d) => d.amount)), subtotals);

	const exactTotals = users.map((_, i) => subtotals[i] + feeShares[i] - discountShares[i]);
	const totals = toSettlement(exactTotals, settlementStep(receipt));

	return users.map((user, i) => ({
		userId: user.id,
		fullName: user.fullName,
		items: itemsByUser.get(user.id)!,
		itemsSubtotal: subtotals[i],
		feeShare: feeShares[i],
		discountShare: discountShares[i],
		total: totals[i]
	}));
}

/** Currencies paid in whole units even when the POS prints cents. */
const WHOLE_UNIT_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND']);

const displayDecimals = (r: Pick<ReceiptData, 'currency' | 'decimals'>) =>
	WHOLE_UNIT_CURRENCIES.has(r.currency) ? 0 : r.decimals;

/** Smallest payable amount in minor units: 1 rupiah when an IDR receipt carries POS cents. */
export const settlementStep = (r: Pick<ReceiptData, 'currency' | 'decimals'>) =>
	10 ** (r.decimals - displayDecimals(r));

/**
 * Round person totals to multiples of `step` while keeping their sum equal to the bill total
 * rounded to `step`, so nobody is short-changed by independent rounding.
 */
function toSettlement(exact: Minor[], step: number): Minor[] {
	if (step === 1 || exact.some((t) => t < 0)) return exact;
	const target = Math.round(sum(exact) / step);
	return allocate(target, exact).map((units) => units * step);
}

/** Full-precision text for an edit field; `parseAmount` reads it back to the same value. */
export function formatEditable(amount: Minor, receipt: Pick<ReceiptData, 'decimals'>) {
	return new Intl.NumberFormat('id-ID', { maximumFractionDigits: receipt.decimals }).format(
		amount / 10 ** receipt.decimals
	);
}

export function formatMoney(amount: Minor, receipt: Pick<ReceiptData, 'currency' | 'decimals'>) {
	const digits = displayDecimals(receipt);
	return new Intl.NumberFormat('id-ID', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(amount / 10 ** receipt.decimals);
}
