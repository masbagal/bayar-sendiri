/**
 * Parse an amount exactly as printed on a receipt. Indonesian receipts mix "." and "," for
 * both thousands and decimals, so the last separator decides: followed by exactly 3 digits it
 * groups thousands, followed by 1–2 digits it is the decimal point.
 * Negative forms: "-16.500", "(16.500)", "16.500-". Returns null when unparseable.
 */
export function parseAmount(raw: string): number | null {
	let s = raw.trim();
	const negative = /^\(.*\)$/.test(s) || s.includes('-');
	s = s.replace(/[^\d.,]/g, '');
	if (!/\d/.test(s)) return null;

	const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
	let intPart = s;
	let fracPart = '';
	if (lastSep !== -1) {
		const tail = s.slice(lastSep + 1);
		if (tail.length !== 3) {
			intPart = s.slice(0, lastSep);
			fracPart = tail;
		}
	}
	// Every remaining separator must group exactly 3 digits.
	if (intPart && !/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(intPart)) return null;
	if (!/^\d*$/.test(fracPart)) return null;

	const value = Number(`${intPart.replace(/[.,]/g, '') || '0'}.${fracPart || '0'}`);
	return negative && value !== 0 ? -value : value;
}
