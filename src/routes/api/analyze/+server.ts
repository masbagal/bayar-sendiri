import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { extractReceipt, ExtractionError } from '$lib/server/extract-receipt.js';
import type { RequestHandler } from './$types.js';

// Chosen by scripts/bakeoff (see REPORT.md): cheapest model with no silent misreads, plus a
// different vendor for the corrective retry so the two models' mistakes don't line up.
const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';
const DEFAULT_FALLBACK_MODEL = 'google/gemini-3.5-flash-lite';

export const POST: RequestHandler = async ({ request }) => {
	const { image } = await request.json().catch(() => ({}));
	if (typeof image !== 'string' || !/^data:image\/[\w.+-]+;base64,/.test(image)) {
		error(400, 'Missing or invalid image data');
	}
	if (!env.OPENROUTER_API_KEY) error(500, 'OPENROUTER_API_KEY is not set');

	try {
		const { receipt, attempts } = await extractReceipt(image, {
			apiKey: env.OPENROUTER_API_KEY,
			model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
			fallbackModel: env.OPENROUTER_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL
		});
		console.info(
			'receipt extracted',
			attempts.map((a) => ({
				model: a.model,
				gap: a.receipt?.reconciliation.totalGap,
				costUsd: a.costUsd,
				ms: a.ms
			}))
		);
		return json(receipt);
	} catch (err) {
		if (err instanceof ExtractionError) {
			console.error('Receipt extraction failed:', err.message);
			if (!err.userMessage) error(err.status, 'Failed to analyze receipt');
			const retryAfter = err.resetsAt
				? Math.max(0, Math.ceil((Date.parse(err.resetsAt) - Date.now()) / 1000))
				: null;
			return json(
				{ message: err.userMessage, resetsAt: err.resetsAt },
				{
					status: err.status,
					headers: retryAfter === null ? {} : { 'Retry-After': String(retryAfter) }
				}
			);
		}
		throw err;
	}
};
