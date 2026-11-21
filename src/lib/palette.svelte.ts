/**
 * Screen colours live in src/routes/layout.css under [data-palette]. This registry holds what CSS
 * can't: display names and the colours baked into avatar SVGs (so a shared PNG matches the screen).
 */
export const PALETTES = [
	{
		id: 'icecream',
		name: 'Ice Cream',
		avatar: { ink: '69364b', dark: 'eb6b6f', light: 'f9a875', paper: 'fff6d3' }
	},
	{
		id: 'kirokaze',
		name: 'Kirokaze',
		avatar: { ink: '363a59', dark: '46878f', light: 'a9dc80', paper: 'e2f3e4' }
	},
	{
		id: 'mist',
		name: 'Mist',
		avatar: { ink: '27372c', dark: '508b87', light: '94d7b6', paper: 'c4f0c2' }
	},
	{
		id: 'demichrome',
		name: 'Demichrome',
		avatar: { ink: '36343d', dark: '555568', light: 'a0a08b', paper: 'dee3dd' }
	}
] as const;

export type Palette = (typeof PALETTES)[number];
export type PaletteId = Palette['id'];

const STORAGE_KEY = 'palette';

const isPaletteId = (value: unknown): value is PaletteId =>
	PALETTES.some((palette) => palette.id === value);

// Starts at the default on both server and client so hydration matches; syncPalette() then
// adopts the choice app.html already applied to <html> before first paint.
let current = $state<PaletteId>(PALETTES[0].id);

export function getPalette(): Palette {
	return PALETTES.find((palette) => palette.id === current)!;
}

const matchThemeColor = () =>
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute('content', getComputedStyle(document.body).backgroundColor);

export function syncPalette(): void {
	const applied = document.documentElement.dataset.palette;
	if (isPaletteId(applied)) current = applied;
	matchThemeColor();
}

export function setPalette(id: PaletteId): void {
	current = id;
	document.documentElement.dataset.palette = id;
	try {
		localStorage.setItem(STORAGE_KEY, id);
	} catch {
		// Private mode or blocked storage: the choice lasts for this page only.
	}
	matchThemeColor();
}

export function cyclePalette(): void {
	const index = PALETTES.findIndex((palette) => palette.id === current);
	setPalette(PALETTES[(index + 1) % PALETTES.length].id);
}
