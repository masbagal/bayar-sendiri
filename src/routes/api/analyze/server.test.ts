import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { OPENROUTER_API_KEY: 'sk-test' } }));

const { POST } = await import('./+server.js');

const KEY_LIMIT_402 = JSON.stringify({
	error: {
		code: 402,
		message: 'This request requires more credits.',
		metadata: { limit_source: 'openrouter_key_limit' }
	}
});

const call = (image: string) =>
	POST({
		request: new Request('http://x/api/analyze', {
			method: 'POST',
			body: JSON.stringify({ image })
		})
	} as Parameters<typeof POST>[0]);

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/analyze when the daily budget is spent', () => {
	it('answers 429 with the reset time and a Retry-After header', async () => {
		const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('/key')
					? Response.json({ data: { effective_budget: { resets_at: resetsAt } } })
					: new Response(KEY_LIMIT_402, { status: 402 })
			)
		);

		const res = await call('data:image/jpeg;base64,AAAA');

		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({
			message: "Today's receipt-scanning budget is used up.",
			resetsAt
		});
		expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(3500);
	});
});
