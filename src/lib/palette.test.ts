import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTES } from './palette.svelte.js';

const css = readFileSync(new URL('../routes/layout.css', import.meta.url), 'utf8');
const cssIds = [...css.matchAll(/\[data-palette='([\w-]+)'\]/g)].map((m) => m[1]);

describe('palettes', () => {
	it('defines screen colours in layout.css for exactly the registered palettes', () => {
		expect([...new Set(cssIds)].sort()).toEqual(PALETTES.map((p) => p.id).sort());
	});
});
