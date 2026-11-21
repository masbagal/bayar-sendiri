import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterError } from './extract-receipt.js';

// Captured from a live request against a key with a $5 daily limit (identifiers removed).
const KEY_LIMIT_402 = JSON.stringify({
	error: {
		message:
			"This request requires more credits, or fewer max_tokens. You requested up to 400000 tokens, but can only afford 344216. To increase, visit https://openrouter.ai/settings/keys and adjust the key's daily limit",
		code: 402,
		metadata: {
			limit_source: 'openrouter_key_limit',
			remedy_hint: "Raise or remove this API key's usage limit.",
			provider_name: null
		}
	}
});

// Shape documented for budget blocks at https://openrouter.ai/docs/api-reference/errors
const BUDGET_403 = JSON.stringify({
	error: {
		code: 403,
		message: 'Key budget limit exceeded (daily limit). $1.00 of $1.00 used.',
		metadata: {
			limit_source: 'openrouter_key_limit',
			scope: 'key_limit',
			resets_at: '2026-11-22T00:00:00.000Z'
		}
	}
});

function stubKeyEndpoint(resetsAt: string | null) {
	const fetch = vi.fn(async () =>
		Response.json({ data: { effective_budget: resetsAt ? { resets_at: resetsAt } : null } })
	);
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('openRouterError', () => {
	it('turns a per-key limit 402 into a 429 with the reset time from /key', async () => {
		const fetch = stubKeyEndpoint('2026-11-22T00:00:00.000Z');
		const err = await openRouterError(402, KEY_LIMIT_402, null, 'sk-test');
		expect(err.status).toBe(429);
		expect(err.userMessage).toMatch(/budget is used up/);
		expect(err.resetsAt).toBe('2026-11-22T00:00:00.000Z');
		expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/key', expect.anything());
	});

	it('uses resets_at from a 403 budget body without calling /key', async () => {
		const fetch = stubKeyEndpoint(null);
		const err = await openRouterError(403, BUDGET_403, null, 'sk-test');
		expect(err.status).toBe(429);
		expect(err.resetsAt).toBe('2026-11-22T00:00:00.000Z');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('reports no reset time when the account itself is out of credits', async () => {
		const body = JSON.stringify({
			error: {
				code: 402,
				message: 'Insufficient credits',
				metadata: { limit_source: 'openrouter_credits' }
			}
		});
		const err = await openRouterError(402, body, null, 'sk-test');
		expect(err.status).toBe(429);
		expect(err.resetsAt).toBeNull();
	});

	it('treats the in-flight budget as a short wait, not an exhausted budget', async () => {
		const body = JSON.stringify({
			error: {
				code: 402,
				message: 'in flight',
				metadata: { limit_source: 'openrouter_in_flight_budget' }
			}
		});
		const err = await openRouterError(402, body, '3', 'sk-test');
		expect(err.status).toBe(503);
		expect(err.userMessage).toMatch(/Try again in a moment/);
	});

	it('keeps other errors generic and hidden from the user', async () => {
		const moderation = await openRouterError(
			403,
			'{"error":{"code":403,"message":"flagged"}}',
			null,
			'k'
		);
		expect(moderation.status).toBe(502);
		expect(moderation.userMessage).toBeNull();
		const html = await openRouterError(500, '<html>oops</html>', null, 'k');
		expect(html.status).toBe(502);
	});

	it('survives a failing /key lookup', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new Error('offline')))
		);
		const err = await openRouterError(402, KEY_LIMIT_402, null, 'sk-test');
		expect(err.status).toBe(429);
		expect(err.resetsAt).toBeNull();
	});
});
