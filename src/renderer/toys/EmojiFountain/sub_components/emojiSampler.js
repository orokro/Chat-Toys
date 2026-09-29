/*
	emojiSampler.js
	---------------
	Loading an emoji (image emote or unicode glyph) so its pixels can be read,
	shared by the firework burst (FireworkCanvas) and the dancers' outfit
	colors (DanceCanvas).

	- Image emotes load through the local cache (blob URLs keep the canvas
	  CORS-clean), and hosts known to send no CORS headers go through the
	  app's same-origin /emote-proxy first.
	- rasterize() draws the emoji into a small offscreen canvas and returns its
	  ImageData, or null if the read is blocked (tainted) or nothing loaded.
*/

import { getEmojiSource } from '../../emojiCache.js';

export const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

// Emote-image hosts whose CDN doesn't send CORS headers. A plain <img> can
// display them fine, but drawing one into a canvas to read its pixels taints
// the canvas and getImageData throws. For these we route the load through the
// app's own /emote-proxy (same-origin, CORS-clean), exactly like the Tosser.
// BetterTTV is the known offender; the list is easy to extend.
const PROXY_EMOTE_HOSTS = ['betterttv.net'];


/**
 * Rewrite an emote image URL to load through the local /emote-proxy when its
 * host is known to lack CORS headers; otherwise return it unchanged.
 *
 * @param {string} url - the original emote image URL
 * @returns {string}
 */
export function emoteLoadUrl(url) {
	try {
		const u = new URL(url, window.location.href);
		const needsProxy = (u.protocol === 'http:' || u.protocol === 'https:') &&
			PROXY_EMOTE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
		if (needsProxy)
			return '/emote-proxy?url=' + encodeURIComponent(url);
	} catch (e) {
		/* not a parseable URL — fall through and use as-is */
	}
	return url;
}


/**
 * Promise wrapper around Image loading (CORS-anonymous so blob/CDN images can
 * be drawn into a readable canvas where the host allows it).
 *
 * @param {string} src - image source URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}


/**
 * Load an emote image the pixel-readable way: proxied if needed, preferring
 * the cached (blob) source, falling back to the (proxied) URL.
 *
 * @param {string} url - emote image URL
 * @returns {Promise<?HTMLImageElement>} null if it couldn't load
 */
export function loadEmojiImage(url) {
	const loadUrl = emoteLoadUrl(url);
	return getEmojiSource(loadUrl)
		.then(({ src }) => loadImage(src))
		.catch(() => loadImage(loadUrl))
		.catch(() => null);
}


// one small reusable offscreen canvas per resolution
const canvases = new Map();

function sampleCtx(res) {
	let c = canvases.get(res);
	if (!c) {
		const canvas = document.createElement('canvas');
		canvas.width = res;
		canvas.height = res;
		c = canvas.getContext('2d', { willReadFrequently: true });
		canvases.set(res, c);
	}
	return c;
}


/**
 * Draw an emoji into a res x res canvas and read it back.
 *
 * @param {{img?: ?HTMLImageElement, char?: ?string}} src
 * @param {number} res
 * @returns {?ImageData} null if there's nothing to draw or the read is blocked
 */
export function rasterize(src, res) {
	const ctx = sampleCtx(res);
	ctx.clearRect(0, 0, res, res);
	try {
		if (src.img) {
			ctx.drawImage(src.img, 0, 0, res, res);
		} else if (src.char) {
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#000';
			ctx.font = `${Math.floor(res * 0.82)}px ${EMOJI_FONT}`;
			ctx.fillText(src.char, res / 2, res / 2);
		} else {
			return null;
		}
		return ctx.getImageData(0, 0, res, res);
	}
	catch (e) {
		// tainted canvas (CORS) or read failure
		return null;
	}
}
