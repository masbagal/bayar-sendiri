import { json, error } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import { GoogleGenAI, Type } from '@google/genai';
import type { RequestHandler } from './$types.js';
import type { MenuItem } from '$lib/types.js';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const prompt = `Analyze the provided image and extract menu items from a restaurant receipt/bill for bill splitting.

STEPS:
1. Verify the image is a restaurant receipt. If not, set "error" to true with a reason.
2. Extract each menu item with its name, unit price, and quantity.
3. Extract any explicitly labeled fees (tax, service charge, PPN, pajak, biaya layanan, tip, etc.).
4. Extract any discounts (diskon, promo, voucher, etc.) as positive amounts.
5. Validate totals before responding.

RULES:
- All monetary values are integers (no decimals)
- Only include fees that are explicitly labeled on the receipt
- Do NOT infer or calculate fees from unexplained price differences
- If no fees exist, return empty fees array
- If no discounts exist, return empty discounts array
- Validation: sum(unitPrice × quantity) should approximate subtotal
- Small rounding differences (< 1% of subtotal) are acceptable`;

const responseSchema = {
	type: Type.OBJECT,
	properties: {
		error: { type: Type.BOOLEAN, description: 'True if the image is not a restaurant receipt' },
		reason: {
			type: Type.STRING,
			description: 'Why the image was rejected (only if error is true)'
		},
		currency: { type: Type.STRING, description: 'e.g. IDR, USD' },
		items: {
			type: Type.ARRAY,
			items: {
				type: Type.OBJECT,
				properties: {
					name: { type: Type.STRING },
					unitPrice: { type: Type.INTEGER },
					quantity: { type: Type.INTEGER }
				},
				required: ['name', 'unitPrice', 'quantity']
			}
		},
		subtotal: { type: Type.INTEGER },
		fees: {
			type: Type.ARRAY,
			items: {
				type: Type.OBJECT,
				properties: {
					label: { type: Type.STRING },
					amount: { type: Type.INTEGER }
				},
				required: ['label', 'amount']
			}
		},
		discounts: {
			type: Type.ARRAY,
			items: {
				type: Type.OBJECT,
				properties: {
					label: { type: Type.STRING },
					amount: { type: Type.INTEGER }
				},
				required: ['label', 'amount']
			}
		},
		grandTotal: { type: Type.INTEGER }
	},
	required: ['error']
};

export const POST: RequestHandler = async ({ request }) => {
	const { image } = await request.json();

	if (!image || typeof image !== 'string') {
		error(400, 'Missing or invalid image data');
	}

	const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
	const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
	const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [
				{
					role: 'user',
					parts: [
						{ text: prompt },
						{
							inlineData: {
								mimeType,
								data: base64Data
							}
						}
					]
				}
			],
			config: {
				responseMimeType: 'application/json',
				responseSchema
			}
		});

		const parsed = JSON.parse(response.text ?? '{}');

		if (parsed.error) {
			error(422, parsed.reason ?? 'Not a restaurant receipt');
		}

		const items: MenuItem[] = parsed.items.map(
			(item: { name: string; unitPrice: number; quantity: number }) => ({
				id: crypto.randomUUID(),
				name: item.name,
				unitPrice: item.unitPrice,
				quantity: item.quantity ?? 1
			})
		);

		return json({
			currency: parsed.currency,
			items,
			subtotal: parsed.subtotal,
			fees: parsed.fees ?? [],
			discounts: parsed.discounts ?? [],
			grandTotal: parsed.grandTotal
		});
	} catch (err) {
		console.error('Gemini API error:', err);
		error(500, 'Failed to analyze receipt');
	}
};
