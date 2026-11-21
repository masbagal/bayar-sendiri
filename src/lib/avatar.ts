import { createAvatar } from '@dicebear/core';
import { pixelArt } from '@dicebear/collection';
import { getPalette } from './palette.svelte.js';

const cache = new Map<string, string>();

/** A 16×16 pixel-art portrait in the active palette's four shades, stable per name. */
export function avatarUri(name: string): string {
	const { id, avatar } = getPalette();
	const key = `${id}:${name}`;
	let uri = cache.get(key);
	if (!uri) {
		const { ink, dark, light, paper } = avatar;
		uri = createAvatar(pixelArt, {
			seed: name,
			skinColor: [paper],
			hairColor: [ink, dark],
			eyesColor: [ink],
			mouthColor: [ink],
			glassesColor: [ink, dark],
			hatColor: [ink, dark],
			clothingColor: [dark, ink],
			accessoriesColor: [ink],
			backgroundColor: [light]
		}).toDataUri();
		cache.set(key, uri);
	}
	return uri;
}
