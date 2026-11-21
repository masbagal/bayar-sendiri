import { describe, expect, it } from 'vitest';
import { parseAmount } from './parse-amount.js';

describe('parseAmount', () => {
	it.each([
		['45.000', 45000],
		['45,000', 45000],
		['Rp104,546', 104546],
		['Rp 2.500.000', 2500000],
		['2,500,000', 2500000],
		['21.363,64', 21363.64],
		['21,363.64', 21363.64],
		['180.909,09', 180909.09],
		['$12.50', 12.5],
		['12,5', 12.5],
		['1,00', 1],
		['100', 100],
		['-16.500', -16500],
		['(16.500)', -16500],
		['16.500-', -16500],
		['-15', -15],
		['IDR 1.234.567,8', 1234567.8],
		['  0  ', 0]
	])('%s → %d', (raw, expected) => {
		expect(parseAmount(raw)).toBe(expected);
	});

	it.each(['', 'abc', '1.2.3,4,5'])('rejects %j', (raw) => {
		expect(parseAmount(raw)).toBeNull();
	});
});
