/**
 * Renders synthetic receipts with known ground truth into fixtures/ using headless Chrome,
 * degraded to look like a phone photo (small, rotated, blurred, JPEG).
 * Run: pnpm tsx scripts/bakeoff/make-synthetic.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = join(import.meta.dirname, 'fixtures');

type Fmt = (n: number) => string;
const idr: Fmt = (n) => n.toLocaleString('id-ID'); // 45.000
const idrDecimals: Fmt = (n) =>
	n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // 45,454.55
const usd: Fmt = (n) => '$' + n.toFixed(2);

interface Line {
	name: string;
	qty: number;
	unit: number;
	sub?: string[];
}
interface Spec {
	name: string;
	currency: string;
	fmt: Fmt;
	header: string;
	lines: Line[];
	showUnit: boolean;
	fees: { label: string; rate?: number; amount?: number }[];
	discounts: { label: string; amount: number }[];
	/** Discount printed as a negative item line instead of in the totals block. */
	discountAsItem?: boolean;
	taxIncludedNote?: string;
	rotate: number;
	blur: number;
	width: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function render(spec: Spec) {
	const lineTotals = spec.lines.map((l) => round2(l.qty * l.unit));
	const subtotal = round2(lineTotals.reduce((a, b) => a + b, 0));
	const discountSum = spec.discounts.reduce((a, d) => a + d.amount, 0);
	const base = subtotal - discountSum;
	const fees = spec.fees.map((f) => ({
		label: f.label,
		amount:
			f.amount ??
			(lineTotals.every(Number.isInteger) && spec.currency !== 'USD'
				? Math.round(base * f.rate!)
				: round2(base * f.rate!))
	}));
	const grandTotal = round2(base + fees.reduce((a, f) => a + f.amount, 0));
	const f = spec.fmt;

	const itemRows = spec.lines
		.map((l, i) => {
			const subs = (l.sub ?? []).map((s) => `<div class="sub">${s}</div>`).join('');
			const left = spec.showUnit ? `${l.qty} x ${f(l.unit)}` : `${l.qty}`;
			return `<div class="row"><span>${l.name}</span></div>${subs}<div class="row"><span>&nbsp;&nbsp;${left}</span><span>${f(lineTotals[i])}</span></div>`;
		})
		.join('');
	const discountItemRows = spec.discountAsItem
		? spec.discounts
				.map((d) => `<div class="row"><span>${d.label}</span><span>-${f(d.amount)}</span></div>`)
				.join('')
		: '';
	const discountRows = spec.discountAsItem
		? ''
		: spec.discounts
				.map((d) => `<div class="row"><span>${d.label}</span><span>-${f(d.amount)}</span></div>`)
				.join('');
	const feeRows = fees
		.map((x) => `<div class="row"><span>${x.label}</span><span>${f(x.amount)}</span></div>`)
		.join('');

	const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#3a3631;display:flex;justify-content:center;padding:30px 0}
.r{width:340px;background:#f4f1ea;padding:22px;font:15px/1.35 "Courier New",monospace;color:#2b2b2b;
transform:rotate(${spec.rotate}deg);filter:blur(${spec.blur}px) contrast(.92);box-shadow:0 6px 18px #0008}
.row{display:flex;justify-content:space-between}.sub{padding-left:14px;font-size:13px}
.c{text-align:center}hr{border:0;border-top:1px dashed #555}b{font-size:17px}
</style></head><body><div class="r">
<div class="c">${spec.header}</div><hr>
${itemRows}${discountItemRows}<hr>
<div class="row"><span>SUBTOTAL</span><span>${f(spec.discountAsItem ? base : subtotal)}</span></div>
${discountRows}${feeRows}<hr>
<div class="row"><b>TOTAL</b><b>${f(grandTotal)}</b></div>
${spec.taxIncludedNote ? `<div class="c" style="margin-top:8px">${spec.taxIncludedNote}</div>` : ''}
<div class="row"><span>TUNAI</span><span>${f(Math.ceil(grandTotal / 50000) * 50000 || grandTotal)}</span></div>
<hr><div class="c">Terima kasih</div></div></body></html>`;

	const dir = mkdtempSync(join(tmpdir(), 'receipt-'));
	const htmlPath = join(dir, 'r.html');
	const png = join(dir, 'r.png');
	writeFileSync(htmlPath, html);
	const height =
		260 +
		(spec.lines.length * 2 + spec.lines.reduce((a, l) => a + (l.sub?.length ?? 0), 0)) * 21 +
		(fees.length + spec.discounts.length) * 21;
	execFileSync(
		CHROME,
		[
			'--headless',
			'--disable-gpu',
			'--hide-scrollbars',
			`--screenshot=${png}`,
			`--window-size=440,${height}`,
			`file://${htmlPath}`
		],
		{ stdio: 'ignore' }
	);
	const jpg = join(OUT, `${spec.name}.jpg`);
	execFileSync(
		'sips',
		[
			'-s',
			'format',
			'jpeg',
			'-s',
			'formatOptions',
			'55',
			'--resampleWidth',
			String(spec.width),
			png,
			'--out',
			jpg
		],
		{ stdio: 'ignore' }
	);

	const truthLines = spec.discountAsItem ? lineTotals : lineTotals;
	writeFileSync(
		join(OUT, `${spec.name}.json`),
		JSON.stringify(
			{
				currency: spec.currency,
				lineTotals: truthLines,
				subtotal: spec.discountAsItem ? base : subtotal,
				fees: fees.map((x) => x.amount),
				discounts: spec.discounts.map((d) => d.amount),
				grandTotal
			},
			null,
			'\t'
		) + '\n'
	);
}

const specs: Spec[] = [
	{
		name: 'pos-decimals-en',
		currency: 'IDR',
		fmt: idrDecimals,
		header: 'SUSHI KAWAKI<br>Pakuwon Mall Surabaya',
		showUnit: true,
		lines: [
			{ name: 'Salmon Mentai Roll', qty: 1, unit: 59090.91 },
			{ name: 'Chicken Katsu Don', qty: 2, unit: 45454.55 },
			{ name: 'Ocha Refill', qty: 3, unit: 9090.91 },
			{ name: 'Tamago Sushi', qty: 2, unit: 16363.64 }
		],
		discounts: [],
		fees: [{ label: 'PB1 10%', rate: 0.1 }],
		rotate: -2,
		blur: 0.5,
		width: 300
	},
	{
		name: 'warung-service-tax-promo',
		currency: 'IDR',
		fmt: idr,
		header: 'WARUNG SEDAP<br>Jl. Kemang Raya 12',
		showUnit: true,
		lines: [
			{ name: 'Nasi Goreng Kampung', qty: 2, unit: 35000 },
			{ name: 'Ayam Bakar Madu', qty: 1, unit: 42000 },
			{ name: 'Es Teh Manis', qty: 3, unit: 8000 },
			{ name: 'Sate Ayam (10 tusuk)', qty: 1, unit: 38000 },
			{ name: 'Kerupuk', qty: 2, unit: 5000 }
		],
		discounts: [{ label: 'PROMO GAJIAN', amount: 20000 }],
		fees: [
			{ label: 'Service 5%', rate: 0.05 },
			{ label: 'PB1 10%', rate: 0.1 }
		],
		rotate: -3,
		blur: 0.5,
		width: 300
	},
	{
		name: 'diner-usd-tip',
		currency: 'USD',
		fmt: usd,
		header: "MEL'S DINER<br>Portland, OR",
		showUnit: false,
		lines: [
			{ name: 'Cheeseburger', qty: 2, unit: 13.95 },
			{ name: 'Caesar Salad', qty: 1, unit: 11.5 },
			{ name: 'Fries', qty: 1, unit: 4.75, sub: ['+ truffle oil'] },
			{ name: 'Iced Tea', qty: 3, unit: 3.25 }
		],
		discounts: [],
		fees: [
			{ label: 'Tax 8.5%', rate: 0.085 },
			{ label: 'Tip 18%', rate: 0.18 }
		],
		rotate: 2,
		blur: 0.6,
		width: 320
	},
	{
		name: 'kopi-tax-included',
		currency: 'IDR',
		fmt: idr,
		header: 'KOPI SENJA<br>Bandung',
		showUnit: false,
		lines: [
			{ name: 'Kopi Susu Aren', qty: 2, unit: 28000 },
			{ name: 'Croissant Butter', qty: 1, unit: 32000 },
			{ name: 'Americano Iced', qty: 1, unit: 25000, sub: ['- Oat milk (+5.000)'] }
		],
		discounts: [],
		fees: [],
		taxIncludedNote: 'Harga sudah termasuk PB1 10%<br>PB1: 10.272',
		rotate: 1.5,
		blur: 0.4,
		width: 280
	},
	{
		name: 'resto-rounding-member',
		currency: 'IDR',
		fmt: idr,
		header: 'RM PADANG SAIYO<br>Jakarta Selatan',
		showUnit: true,
		discountAsItem: true,
		lines: [
			{ name: 'Rendang', qty: 3, unit: 24500 },
			{ name: 'Gulai Tunjang', qty: 1, unit: 27500 },
			{ name: 'Nasi Putih', qty: 4, unit: 7000 },
			{ name: 'Teh Talua', qty: 2, unit: 18000 }
		],
		discounts: [{ label: 'Diskon Member 10%', amount: 16500 }],
		fees: [
			{ label: 'PPN 11%', rate: 0.11 },
			{ label: 'Pembulatan', amount: -15 }
		],
		rotate: -1.5,
		blur: 0.7,
		width: 300
	},
	{
		name: 'long-family-dinner',
		currency: 'IDR',
		fmt: idr,
		header: 'BAKMI JAYA 88<br>Medan',
		showUnit: false,
		lines: [
			{ name: 'Bakmi Ayam Jamur', qty: 3, unit: 32000 },
			{ name: 'Bakmi Babi Char Siu', qty: 2, unit: 38000 },
			{ name: 'Pangsit Goreng', qty: 2, unit: 26000 },
			{ name: 'Pangsit Kuah', qty: 1, unit: 24000 },
			{ name: 'Kailan Cah', qty: 1, unit: 35000 },
			{ name: 'Fu Yung Hai', qty: 1, unit: 48000 },
			{ name: 'Nasi Campur Medan', qty: 2, unit: 45000 },
			{ name: 'Lumpia Udang', qty: 1, unit: 33000 },
			{ name: 'Es Jeruk', qty: 4, unit: 15000 },
			{ name: 'Teh Tawar Panas', qty: 3, unit: 6000 },
			{ name: 'Air Mineral', qty: 2, unit: 8000 },
			{ name: 'Es Campur', qty: 2, unit: 28000 },
			{ name: 'Puding Mangga', qty: 1, unit: 22000 },
			{ name: 'Kerupuk Udang', qty: 3, unit: 7000 }
		],
		discounts: [],
		fees: [
			{ label: 'Service Charge 7%', rate: 0.07 },
			{ label: 'PB1 10%', rate: 0.1 }
		],
		rotate: 2.5,
		blur: 0.5,
		width: 330
	}
];

for (const spec of specs) {
	render(spec);
	console.log('wrote', spec.name);
}
