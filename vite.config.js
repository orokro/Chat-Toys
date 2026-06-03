const Path = require('path');
const vuePlugin = require('@vitejs/plugin-vue');
const { defineConfig } = require('vite');
const https = require('https');
const httpMod = require('http');


/**
 * Emote-image CDNs the dev /emote-proxy is allowed to fetch from. Mirrors the
 * production allow-list in src/main/system/OBSViewServer.js.
 *
 * @type {Array<string>}
 */
const EMOTE_PROXY_HOSTS = [
	'cdn.betterttv.net',
	'cdn.frankerfacez.com',
	'cdn.7tv.app',
	'static-cdn.jtvnw.net',
	'yt3.ggpht.com',
	'lh3.googleusercontent.com',
];


/**
 * Fetch raw emote-image bytes in Node (no CORS), following a few redirects.
 *
 * @param {string} url - absolute http(s) URL
 * @param {number} [redirectsLeft=3] - max redirects to follow
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
function fetchEmoteBytes(url, redirectsLeft = 3) {
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
			headers: { 'User-Agent': 'ChatToys/1.0', 'Accept': 'image/*,*/*' },
		}, (res) => {
			const status = res.statusCode || 0;
			if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
				res.resume();
				resolve(fetchEmoteBytes(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
				return;
			}
			if (status !== 200) {
				res.resume();
				reject(new Error(`upstream status ${status}`));
				return;
			}
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve({
				buffer: Buffer.concat(chunks),
				contentType: res.headers['content-type'] || 'image/png',
			}));
		});
		req.on('error', reject);
		req.setTimeout(8000, () => req.destroy(new Error('timeout')));
	});
}


/**
 * Vite dev plugin: serve /emote-proxy directly from the dev server so the
 * Tosser can draw CORS-less emotes (BetterTTV etc.) into a WebGL texture
 * without needing the Electron/Express server running. Production uses the
 * matching Express route in OBSViewServer.js.
 *
 * @returns {import('vite').Plugin}
 */
function emoteProxyDevPlugin() {
	return {
		name: 'chat-toys-emote-proxy',
		configureServer(server) {
			// When mounted on a path, req.url is the remainder, e.g. "?url=..."
			server.middlewares.use('/emote-proxy', (req, res) => {

				let raw;
				try {
					raw = new URL(req.url, 'http://localhost').searchParams.get('url');
				} catch (e) {
					res.statusCode = 400;
					res.end('bad request');
					return;
				}
				if (!raw) {
					res.statusCode = 400;
					res.end('missing url');
					return;
				}

				let parsed;
				try {
					parsed = new URL(raw);
				} catch (e) {
					res.statusCode = 400;
					res.end('bad url');
					return;
				}

				const hostOk = EMOTE_PROXY_HOSTS.some(
					(h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
				);
				if (!hostOk) {
					res.statusCode = 403;
					res.end('host not allowed');
					return;
				}

				fetchEmoteBytes(raw)
					.then(({ buffer, contentType }) => {
						res.setHeader('Content-Type', contentType);
						res.setHeader('Access-Control-Allow-Origin', '*');
						res.setHeader('Cache-Control', 'public, max-age=3600');
						res.end(buffer);
					})
					.catch((err) => {
						res.statusCode = 502;
						res.end('proxy fetch failed: ' + err.message);
					});
			});
		},
	};
}

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
	// 👇 Add this alias block
	resolve: {
		alias: {
			'@components': Path.resolve(__dirname, 'src/renderer/components'),
			'@toys': Path.resolve(__dirname, 'src/renderer/toys'),
			'@scripts': Path.resolve(__dirname, 'src/renderer/scripts'),
			'@assets': Path.resolve(__dirname, 'src/renderer/assets'),
			// Cross-process catalogs (built-in asset list, etc.) shared by
			// both the renderer (imported as JSON, inlined by Vite at build
			// time) AND the main process (require'd at runtime from the
			// build/shared output, copied by scripts/build.js).
			'@shared': Path.resolve(__dirname, 'src/shared'),
		}
	},

	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern',
				silenceDeprecations: ["legacy-js-api"],
			}
		}
	},
	root: Path.join(__dirname, 'src', 'renderer'),
	publicDir: 'public',
	server: {
		port: 8080,
		fs: {
			// Default `fs.allow` is just the root (`src/renderer/`). When
			// we set this option, we REPLACE the defaults (which would
			// otherwise include node_modules via Vite's auto-detection).
			// So we have to list everything explicitly:
			//   - the whole project root so `src/shared/` resolves
			//   - node_modules for font files like material-icons.woff2
			//     and assorted library assets
			allow: [__dirname],
		},
	},
	open: false,
	build: {
		outDir: Path.join(__dirname, 'build', 'renderer'),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: Path.join(__dirname, 'src', 'renderer', 'index.html'),
				live: Path.join(__dirname, 'src', 'renderer', 'live.html'),
				test: Path.join(__dirname, 'src', 'renderer', 'obsTestPage.html'),
				queueManager: Path.join(__dirname, 'src', 'renderer', 'queue-manager.html'),
			},
		},
	},
	plugins: [vuePlugin(), emoteProxyDevPlugin()],

});

module.exports = config;
