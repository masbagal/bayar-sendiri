import { beforeEach, describe, expect, it } from 'vitest';
import { formatEditable, isBalanced, reconcile } from './bill.js';
import { parseAmount } from './parse-amount.js';
import {
	getReceiptData,
	removeLine,
	saveLine,
	setPrintedTotal,
	setReceiptData
} from './receipt-store.svelte.js';
import type { ReceiptData } from './types.js';

function load(partial: Omit<ReceiptData, 'reconciliation'>) {
	const r = partial;
	setReceiptData({
		...r,
		reconciliation: reconcile(r.items, r.fees, r.discounts, r.printedSubtotal, r.printedTotal)
	});
	return getReceiptData()!;
}

describe('receipt corrections', () => {
	beforeEach(() => {
		// Pizza receipt where the model added the included modifier as its own item.
		load({
			currency: 'IDR',
			decimals: 0,
			items: [
				{ id: 'pizza', name: 'BOGO Pizza', quantity: 1, lineTotal: 104546 },
				{ id: 'mod', name: 'CB/R Super Supreme', quantity: 1, lineTotal: 21000 },
				{ id: 'wedges', name: 'Potato Wedges', quantity: 1, lineTotal: 2000 }
			],
			fees: [{ id: 'tax', label: 'Restaurant tax', amount: 12655 }],
			discounts: [],
			printedSubtotal: 126546,
			printedTotal: 139201
		});
	});

	it('clears the warning once the misread lines are fixed', () => {
		expect(isBalanced(getReceiptData()!.reconciliation)).toBe(false);

		removeLine('items', 'mod');
		saveLine('items', 'wedges', 'Potato Wedges', parseAmount('22.000')!);

		const r = getReceiptData()!;
		expect(r.items.map((i) => i.lineTotal)).toEqual([104546, 22000]);
		expect(r.reconciliation.totalGap).toBe(0);
		expect(isBalanced(r.reconciliation)).toBe(true);
	});

	it('adds a missed item and fee', () => {
		saveLine('items', null, 'Es Teh', 8000);
		saveLine('fees', null, 'Service', 5000);
		const r = getReceiptData()!;
		expect(r.items.at(-1)).toMatchObject({ name: 'Es Teh', quantity: 1, lineTotal: 8000 });
		expect(r.reconciliation.computedTotal).toBe(104546 + 21000 + 2000 + 8000 + 12655 + 5000);
	});

	it('fixes a misread printed total', () => {
		setPrintedTotal(127546 + 12655);
		expect(getReceiptData()!.reconciliation.totalGap).toBe(0);
	});
});

describe('amounts with cents', () => {
	it('keeps POS cents when an edit field is saved unchanged', () => {
		const r = load({
			currency: 'IDR',
			decimals: 2,
			items: [{ id: 'a', name: 'Klappertaart', quantity: 1, lineTotal: 2136364 }],
			fees: [],
			discounts: [],
			printedSubtotal: null,
			printedTotal: 2136364
		});
		const text = formatEditable(2136364, r);
		expect(text).toBe('21.363,64');
		saveLine('items', 'a', 'Klappertaart', parseAmount(text)!);
		expect(getReceiptData()!.items[0].lineTotal).toBe(2136364);
	});

	it('switches a whole-unit receipt to cents when cents are typed', () => {
		load({
			currency: 'USD',
			decimals: 0,
			items: [{ id: 'burger', name: 'Burger', quantity: 1, lineTotal: 14 }],
			fees: [{ id: 'tip', label: 'Tip', amount: 3 }],
			discounts: [],
			printedSubtotal: 14,
			printedTotal: 21
		});
		saveLine('items', null, 'Fries', parseAmount('4.75')!);
		const r = getReceiptData()!;
		expect(r.decimals).toBe(2);
		expect(r.items.map((i) => i.lineTotal)).toEqual([1400, 475]);
		expect(r.fees[0].amount).toBe(300);
		expect(r.printedTotal).toBe(2100);
		expect(r.reconciliation.totalGap).toBe(2100 - (1400 + 475 + 300));
	});
});
