/*
	outfit.js
	---------
	Picks a dancer's shirt and pants colors from its emoji's pixels.

	- Only solid-ish pixels count (alpha > 50%).
	- Pixels are bucketed (3 bits per channel) and each bucket remembers its
	  average color. Saturated pixels weigh more, near-black and near-white
	  ones less, so an outline or a shine doesn't win over the actual color.
	- The heaviest bucket is the shirt. The pants are the next bucket that's
	  clearly a different color and not a speck (>= 8% of the weight);
	  otherwise a darker shade of the shirt (or a lighter one if the shirt is
	  already very dark, so the legs don't vanish into the outline).

	Pure functions over RGBA arrays, so it's unit tested in node.
*/

const MIN_ALPHA = 128;
const PANTS_MIN_SHARE = 0.08;
const PANTS_MIN_DIST = 90;      // "redmean" distance, 0..~765

const FALLBACKS = [
	['#f4c430', '#3b5bdb'], ['#e53935', '#263238'], ['#43a047', '#5d4037'],
	['#1e88e5', '#eceff1'], ['#8e24aa', '#212121'], ['#fb8c00', '#37474f'],
];


/**
 * Perceptual-ish distance between two [r, g, b] colors ("redmean").
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function colorDistance(a, b) {
	const rm = (a[0] + b[0]) / 2;
	const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
	return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const luminance = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

const mix = (c, to, t) => c.map((v, i) => Math.round(v + (to[i] - v) * t));

export const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');


/**
 * @param {Uint8ClampedArray|number[]} rgba - pixel data (4 per pixel)
 * @returns {?{shirt: string, pants: string, shirtRgb: number[], pantsRgb: number[]}} null if no solid pixels
 */
export function pickOutfit(rgba) {

	const buckets = new Map();
	let total = 0;

	for (let i = 0; i + 3 < rgba.length; i += 4) {
		const a = rgba[i + 3];
		if (a < MIN_ALPHA) continue;
		const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		const v = max / 255;
		const s = max === 0 ? 0 : (max - min) / max;
		let w = 1 + 2 * s;
		if (v < 0.18) w *= 0.3;                 // outlines / shadows
		else if (s < 0.12 && v > 0.88) w *= 0.4; // shine / highlights
		const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
		let bk = buckets.get(key);
		if (!bk) buckets.set(key, bk = { w: 0, r: 0, g: 0, b: 0 });
		bk.w += w;
		bk.r += r * w;
		bk.g += g * w;
		bk.b += b * w;
		total += w;
	}

	if (!buckets.size) return null;

	const list = Array.from(buckets.values())
		.map((bk) => ({ w: bk.w, c: [bk.r / bk.w, bk.g / bk.w, bk.b / bk.w] }))
		.sort((x, y) => y.w - x.w);

	// merge buckets that are really the same color (split by the grid) into
	// the heavier one, so a gradient doesn't count as two colors
	const merged = [];
	for (const it of list) {
		const home = merged.find((m) => colorDistance(m.c, it.c) < 40);
		if (home) home.w += it.w;
		else merged.push({ w: it.w, c: it.c });
	}
	merged.sort((x, y) => y.w - x.w);

	const shirt = merged[0].c.map(Math.round);
	const other = merged.find((m) => m.w / total >= PANTS_MIN_SHARE && colorDistance(m.c, shirt) >= PANTS_MIN_DIST);
	let pants;
	if (other) pants = other.c.map(Math.round);
	else if (luminance(shirt) < 0.22) pants = mix(shirt, [255, 255, 255], 0.3);
	else pants = mix(shirt, [0, 0, 0], 0.45);

	return { shirt: toHex(shirt), pants: toHex(pants), shirtRgb: shirt, pantsRgb: pants };
}


/**
 * A stable pair of colors for an emoji we couldn't read.
 *
 * @param {string} key - url or character
 * @returns {{shirt: string, pants: string}}
 */
export function fallbackOutfit(key) {
	let h = 0;
	for (const ch of String(key || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
	const [shirt, pants] = FALLBACKS[h % FALLBACKS.length];
	return { shirt, pants };
}
