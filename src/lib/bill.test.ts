import { describe, expect, it } from 'vitest';
import { allocate, formatMoney, reconcile, splitBill } from './bill.js';
import type { Charge, MenuItem, ReceiptData } from './types.js';

const item = (id: string, lineTotal: number): MenuItem => ({
	id,
	name: id,
	quantity: 1,
	lineTotal
});
const charge = (amount: number): Charge => ({ id: crypto.randomUUID(), label: 'x', amount });

function receipt(
	items: MenuItem[],
	fees: Charge[],
	discounts: Charge[],
	{
		currency = 'IDR',
		decimals = 0,
		printedSubtotal = null as number | null,
		printedTotal = NaN
	} = {}
): ReceiptData {
	const r = reconcile(items, fees, discounts, printedSubtotal, 0);
	const total = Number.isNaN(printedTotal) ? r.computedTotal : printedTotal;
	return {
		currency,
		decimals,
		items,
		fees,
		discounts,
		printedSubtotal,
		printedTotal: total,
		reconciliation: reconcile(items, fees, discounts, printedSubtotal, total)
	};
}

const users = ['a', 'b', 'c'].map((id) => ({ id, fullName: id.toUpperCase() }));
const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('allocate', () => {
	it('splits evenly with the remainder going to the earliest parts', () => {
		expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
	});
	it('handles negative amounts and zero weights', () => {
		expect(allocate(-15, [1, 2])).toEqual([-5, -10]);
		expect(allocate(500, [0, 0])).toEqual([0, 0]);
	});
});

describe('splitBill', () => {
	it('person totals add up exactly to the bill even when nothing divides evenly', () => {
		const r = receipt(
			[item('nasi', 35000), item('teh', 8000), item('sate', 38000)],
			[charge(4050), charge(8505)],
			[charge(10000)]
		);
		const out = splitBill(r, users, { nasi: ['a', 'b', 'c'], teh: ['b'], sate: ['a', 'c'] });
		expect(sumOf(out.map((p) => p.total))).toBe(r.reconciliation.computedTotal);
		expect(sumOf(out.map((p) => p.feeShare))).toBe(12555);
		expect(sumOf(out.map((p) => p.discountShare))).toBe(10000);
	});

	it('spreads fees by item subtotal, not by the printed subtotal', () => {
		// Printed subtotal disagrees with the items; old code divided by it and lost tax.
		const r = receipt([item('x', 60000), item('y', 40000)], [charge(10000)], [], {
			printedSubtotal: 120000
		});
		const out = splitBill(r, users.slice(0, 2), { x: ['a'], y: ['b'] });
		expect(out.map((p) => p.feeShare)).toEqual([6000, 4000]);
	});

	it('settles IDR POS cents to whole rupiah without losing the bill total', () => {
		// klappertaart receipt: items with cents, total 199.000,00
		const lines = [2136364, 909091, 4909091, 2000000, 2772727, 2681818, 2681818];
		const r = receipt(
			lines.map((l, i) => item(`i${i}`, l)),
			[charge(1809091)],
			[],
			{ decimals: 2 }
		);
		const assignments = Object.fromEntries(
			lines.map((_, i) => [`i${i}`, i % 3 === 0 ? ['a', 'b', 'c'] : [users[i % 3].id]])
		);
		const out = splitBill(r, users, assignments);
		expect(out.every((p) => p.total % 100 === 0)).toBe(true);
		expect(sumOf(out.map((p) => p.total))).toBe(19900000);
		expect(formatMoney(19900000, r)).toBe('199.000');
	});

	it('keeps cents for USD', () => {
		const r = receipt([item('burger', 2790), item('tea', 975)], [charge(320)], [], {
			currency: 'USD',
			decimals: 2
		});
		const out = splitBill(r, users.slice(0, 2), { burger: ['a', 'b'], tea: ['b'] });
		expect(sumOf(out.map((p) => p.total))).toBe(4085);
		expect(formatMoney(4085, r)).toBe('40,85');
	});

	it('ignores assignments to removed users', () => {
		const r = receipt([item('x', 100)], [], []);
		const out = splitBill(r, users.slice(0, 1), { x: ['a', 'ghost'] });
		expect(out[0].total).toBe(100);
	});
});

describe('reconcile', () => {
	it('accepts a subtotal printed after discounts', () => {
		const r = reconcile([item('x', 148500 + 16500)], [], [charge(16500)], 148500, 148500);
		expect(r.subtotalGap).toBe(0);
		expect(r.totalGap).toBe(0);
	});
	it('reports the gap when an item was misread', () => {
		const r = reconcile([item('x', 10000)], [charge(1000)], [], 12000, 13200);
		expect(r.subtotalGap).toBe(2000);
		expect(r.totalGap).toBe(2200);
	});
});
