/*
	imageProxy.js
	-------------

	Same-origin image proxies on the widget server.

	  /emote-proxy?url=...   emote CDNs that don't send CORS (e.g. BetterTTV) -
	                         so the Tosser can draw them into a WebGL texture.
	  /avatar-proxy?url=...  chatter avatars for plugin widgets. A plugin page is
	                         a sandboxed localhost page; a plain <img> of a
	                         YouTube avatar from there sends a localhost Referer,
	                         which YouTube's avatar CDN can reject, and a canvas
	                         can't use a cross-origin image at all. Fetching it
	                         here (no Referer) and serving it with CORS fixes both.

	Both only fetch from allow-listed hosts, so they can't be used as an open
	relay. /avatar-proxy REDIRECTS other hosts to the original URL instead of
	refusing them, so routing an avatar through it is never worse than using
	the raw URL.

	Caches are bounded (entries + bytes, least-recently-used out first). The old
	emote cache was an unbounded Map, which grows for as long as the app runs.
*/

import https from 'https';
import httpMod from 'http';


/** Emote CDNs /emote-proxy fetches from (exact host or subdomain). */
export const EMOTE_PROXY_HOSTS = [
	'cdn.betterttv.net',
	'cdn.frankerfacez.com',
	'cdn.7tv.app',
	'static-cdn.jtvnw.net',
	'yt3.ggpht.com',
	'lh3.googleusercontent.com',
];

/** Avatar CDNs /avatar-proxy fetches from (exact host or subdomain). */
export const AVATAR_PROXY_HOSTS = [
	'jtvnw.net',               // Twitch profile images (static-cdn.jtvnw.net)
	'ggpht.com',               // YouTube avatars (yt3.ggpht.com, yt4.ggpht.com)
	'googleusercontent.com',   // YouTube avatars (lh3.googleusercontent.com)
	'ytimg.com',
];

/** Refuse to buffer anything bigger than this. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;


/**
 * Fetch an image's bytes in the main process (no CORS in Node, and no Referer
 * is sent), following a few redirects.
 *
 * @param {string} url - absolute http(s) URL
 * @param {number} [redirectsLeft=3]
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
export function fetchImageBytes(url, redirectsLeft = 3) {
	return new Promise((resolve, reject) => {

		let parsed;
		try {
			parsed = new URL(url);
		} catch (e) {
			reject(e);
			return;
		}

		const lib = parsed.protocol === 'http:' ? httpMod : https;
		const req = lib.get(url, {
			headers: {
				// some CDNs 403 a missing UA; send a benign one
				'User-Agent': 'ChatToys/1.0',
				'Accept': 'image/*,*/*',
			},
		}, (res) => {

			const status = res.statusCode || 0;

			if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
				res.resume();
				const next = new URL(res.headers.location, url).toString();
				resolve(fetchImageBytes(next, redirectsLeft - 1));
				return;
			}

			if (status !== 200) {
				res.resume();
				reject(new Error(`upstream status ${status}`));
				return;
			}

			const chunks = [];
			let size = 0;
			res.on('data', (c) => {
				size += c.length;
				if (size > MAX_IMAGE_BYTES) {
					req.destroy(new Error('image too large'));
					return;
				}
				chunks.push(c);
			});
			res.on('end', () => {
				resolve({
					buffer: Buffer.concat(chunks),
					contentType: res.headers['content-type'] || 'image/png',
				});
			});
		});

		req.on('error', reject);
		req.setTimeout(8000, () => {
			req.destroy(new Error('timeout'));
		});
	});
}


/**
 * Small LRU cache bounded by entry count and total bytes, with a TTL.
 */
export class BoundedImageCache {

	/**
	 * @param {Object} opts
	 * @param {number} opts.maxEntries
	 * @param {number} opts.maxBytes
	 * @param {number} opts.ttlMs
	 */
	constructor({ maxEntries, maxBytes, ttlMs }) {
		this.maxEntries = maxEntries;
		this.maxBytes = maxBytes;
		this.ttlMs = ttlMs;
		this.map = new Map(); // url -> { buf, type, at }
		this.bytes = 0;
	}

	get(key) {
		const e = this.map.get(key);
		if (!e)
			return null;
		if (Date.now() - e.at > this.ttlMs) {
			this._delete(key);
			return null;
		}
		// most-recently-used goes to the back
		this.map.delete(key);
		this.map.set(key, e);
		return e;
	}

	set(key, buf, type) {
		if (buf.length > this.maxBytes)
			return;
		this._delete(key);
		this.map.set(key, { buf, type, at: Date.now() });
		this.bytes += buf.length;
		while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
			const oldest = this.map.keys().next().value;
			this._delete(oldest);
		}
	}

	_delete(key) {
		const e = this.map.get(key);
		if (!e)
			return;
		this.bytes -= e.buf.length;
		this.map.delete(key);
	}
}


/**
 * Mount one image proxy route.
 *
 * @param {import('express').Express} expressApp
 * @param {string} route - e.g. '/avatar-proxy'
 * @param {Object} opts
 * @param {string[]} opts.hosts - allow-listed hosts (exact or parent domain)
 * @param {boolean} [opts.redirectOthers=false] - 302 non-allow-listed hosts to
 *   the original URL instead of refusing them
 * @param {BoundedImageCache} opts.cache
 * @param {Function} [opts.log] - (msg) => void
 */
export function mountImageProxy(expressApp, route, { hosts, redirectOthers = false, cache, log = () => {} }) {

	expressApp.get(route, (req, res) => {

		const raw = req.query.url;
		if (typeof raw !== 'string' || !raw) {
			res.status(400).send('missing url');
			return;
		}

		let parsed;
		try {
			parsed = new URL(raw);
		} catch (e) {
			res.status(400).send('bad url');
			return;
		}

		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			res.status(400).send('bad protocol');
			return;
		}

		const host = parsed.hostname.toLowerCase();
		const hostOk = hosts.some((h) => host === h || host.endsWith('.' + h));
		if (!hostOk) {
			if (redirectOthers)
				res.redirect(302, raw);
			else
				res.status(403).send('host not allowed');
			return;
		}

		const cached = cache.get(raw);
		if (cached) {
			res.set('Content-Type', cached.type);
			res.set('Cache-Control', 'public, max-age=3600');
			res.send(cached.buf);
			return;
		}

		fetchImageBytes(raw)
			.then(({ buffer, contentType }) => {
				cache.set(raw, buffer, contentType);
				res.set('Content-Type', contentType);
				res.set('Cache-Control', 'public, max-age=3600');
				res.send(buffer);
			})
			.catch((err) => {
				log(`[${route}] failed for ${raw}: ${err.message}`);
				// avatars: let the browser try the original rather than show nothing
				if (redirectOthers)
					res.redirect(302, raw);
				else
					res.status(502).send('proxy fetch failed');
			});
	});
}
