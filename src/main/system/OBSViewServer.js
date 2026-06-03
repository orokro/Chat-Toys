/*
	Server.js
	---------

	When the main Electron process starts, we want to set up two Servers:
	- one for http requests for the live page to show in OBS
	- one for WebSocket connections to the live page

	This file will export a class we can initialize in main.js to set up these servers,
	and provide some logic for interacting with the UI via IPC.
*/

// node imports
import { app, ipcMain } from 'electron';
import { join } from 'path';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { createHttpTerminator } from 'http-terminator';
const { socketRefServer } = require('socket-ref/server');
const serveIndex = require('serve-index');
const Store = require('electron-store');
const { mountAssetFsAPI } = require('./assetFsAPI');

const store = new Store();
const fs = require('fs');
const https = require('https');
const httpMod = require('http');


/**
 * Emote-image CDNs the /emote-proxy route is allowed to fetch from. Keeping a
 * strict allow-list avoids turning the proxy into an open relay (SSRF).
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
 * Fetch the raw bytes of an emote image in the main process (Node has no CORS),
 * following a few redirects. Used by the /emote-proxy route so CDNs that don't
 * send CORS headers (e.g. BetterTTV) can still be drawn into a WebGL texture by
 * the Tosser widget.
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
			headers: {
				// some CDNs 403 a missing UA; send a benign one
				'User-Agent': 'ChatToys/1.0',
				'Accept': 'image/*,*/*',
			},
		}, (res) => {

			const status = res.statusCode || 0;

			// follow redirects
			if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
				res.resume(); // drain
				const next = new URL(res.headers.location, url).toString();
				resolve(fetchEmoteBytes(next, redirectsLeft - 1));
				return;
			}

			if (status !== 200) {
				res.resume();
				reject(new Error(`upstream status ${status}`));
				return;
			}

			const chunks = [];
			res.on('data', (c) => chunks.push(c));
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
 * Class to set up the servers for the live page.
 */
class OBSViewServer {

	/**
	 * Create a new OBSViewServer.
	 *
	 * @param {BrowserWindow} mainWindow - The main window for the app.
	 * @param {Object} [options]
	 * @param {Object} [options.db] - Optional DatabaseManager instance used
	 *   by the asset-filesystem API (vuefinder backend). When supplied, the
	 *   `/api/files` route is mounted on the widget server. When omitted,
	 *   asset-FS calls 404 (acceptable for legacy windows that don't need it).
	 */
	constructor(mainWindow, options = {}) {

		// save ref to our main window
		this.mainWindow = mainWindow;

		// optional database handle for the asset filesystem endpoint.
		// Kept on `this` so startServers() (and a future restartServers)
		// can re-mount on each express app boot.
		this.db = options.db || null;

		// set up our IPC communication
		this.initializeIPC();

		// true when app is closing
		this.closing = false;

		// kill servers when main window is closed
		this.mainWindow.on('close', () => {

			this.closing = true;

			// kill our servers
			this.killServers();

			setInterval(()=>{
				console.log('kill');
				process.exit(0);
			}, 1000)
		});
	}


	/**
	 * Initializes the IPC handlers for the server.
	 */
	initializeIPC() {

		// listen for the 'get-server-port' event
		ipcMain.handle('get-server-port', () => {
			return store.get('port', 3001);
		});

		// listen for the 'set-server-port' event
		ipcMain.handle('set-server-port', (event, port) => {
			store.set('port', port);
			console.log('Set OBSViewServer port to: ' + port);
			return true;
		});

		// listen for the 'restart-servers' event
		ipcMain.handle('restart-servers', () => {
			this.restartServers();
			return true;
		});
	}


	/**
	 * Starts the echo server.
	 */
	startEchoServer() {

		// do not allow servers to start if we're closing
		if(this.closing == true){
			console.log('skipping startServers, closing');
			return;
		}

		// note that, WSS comes from the socket-ref server
		// and is already set up to handle incoming messages
		this.wss.on('connection', (socket) => {

			// when we get a message, parse it and forward it to the renderer
			socket.on('message', (data) => {
				let msg;

				try {
					msg = JSON.parse(data);
				} catch (err) {
					return; // ignore non-JSON messages
				}

				if (msg.type === 'echo' && msg.data !== undefined) {
					socket.send(`Echo: ${msg.data}`);
				}
			});
		});
	}


	/**
	 * Kills the servers.
	 */
	async killServers(){

		console.log('attempting to kill servers');

		// Close HTTP server first (since WebSockets depend on it)
		// await close(this.server, 'HTTP server');
		await this.terminatorHTTP.terminate();
		this.server = null;

		// Try closing WebSocket interface if it's separate (for safety)
		await this.terminatorWS.terminate();
		this.wss = null;

		console.log('server kill attempt complete');
	}


	/**
	 * Restarts the servers.
	 */
	async restartServers() {

		console.log('Restarting OBSViewServer...');
		this.logToFE('Restarting OBSViewServer...');

		// kill the servers
		await this.killServers();		

		// Allow port to be released
		await new Promise((res) => setTimeout(res, 300));

		this.startServers();

		console.log('🚀 OBSViewServer restarted');
		this.logToFE('🚀 OBSViewServer restarted');
	}


	/**
	 * Sends server log to Frontend
	 * 
	 * @param {String} msg - message
	 */
	logToFE(msg) {

		// if we are closing, skip logging
		if(this.closing == true){
			console.log('skipping logToFE, closing');
			console.log(msg);
			return;
		}

		// set to the FE
		const mainWindow = this.mainWindow;
		if (mainWindow && !mainWindow.isDestroyed()) {

			const webContents = mainWindow.webContents;
			if (webContents && !webContents.isDestroyed())
				mainWindow.webContents.send('server-log', msg);
		}
	}


	/**
	 * Starts both the http and websocket servers.
	 */
	startServers() {

		// do not allow servers to start if we're closing
		if(this.closing == true){
			console.log('skipping startServers, closing');
			return;
		}

		// get default port
		const port = store.get('port', 3001);
		this.logToFE('Found OBSViewServer port in storage: ' + port);

		// try to start the servers
		try {

			// set up a basic express server and a WebSocket server
			const expressApp = express();

			// If TwitchManager (or other systems) provided a setup hook, call it before listening
			if (typeof this.setupTwitch === 'function') {
				console.log('[OBSViewServer] Calling setupTwitch hook before starting server...');
				this.setupTwitch(expressApp);
			}

			// Same hook for the new TwurpleManager (lives side-by-side with TwitchManager during the Phase 1 migration).
			if (typeof this.setupTwurple === 'function') {
				console.log('[OBSViewServer] Calling setupTwurple hook before starting server...');
				this.setupTwurple(expressApp);
			}

			// log every request to Frontend
			expressApp.use((req, res, next) => {
				this.logToFE(`[HTTP] ${req.method} ${req.url}`);
				next();
			});

			// CORS must be registered BEFORE any route handlers so the
			// middleware actually sees those routes' requests. Express
			// runs middleware/routes in registration order; putting cors
			// after mountAssetFsAPI was the cause of "No 'Access-Control-
			// Allow-Origin' header is present" errors from the renderer.
			// Permissive on origin because the server only binds to
			// 127.0.0.1, so reflecting the request origin is safe.
			expressApp.use(cors({
				origin: true,
				methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				credentials: true,
			}));
			// Preflight handler for any non-simple request shapes (vuefinder
			// sends POST + JSON Content-Type, which triggers preflight).
			expressApp.options('*', cors({ origin: true, credentials: true }));

			// ---- Emote image proxy ----
			// Some emote CDNs (notably BetterTTV) don't send CORS headers, so
			// their images can't be uploaded into a WebGL texture by the Tosser
			// widget (a plain <img> in chat is fine; a canvas/WebGL texture is
			// not). We fetch the bytes here in the main process (no CORS in
			// Node) and serve them back through this server, which already
			// attaches permissive CORS headers — making the image same-origin
			// and clean for the widget. Restricted to known emote CDNs.
			const emoteProxyCache = new Map(); // raw url -> { buf, type, at }
			const EMOTE_PROXY_TTL = 1000 * 60 * 60; // 1h
			expressApp.get('/emote-proxy', (req, res) => {

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

				const hostOk = EMOTE_PROXY_HOSTS.some(
					(h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
				);
				if (!hostOk) {
					res.status(403).send('host not allowed');
					return;
				}

				// serve from cache when fresh
				const cached = emoteProxyCache.get(raw);
				if (cached && (Date.now() - cached.at) < EMOTE_PROXY_TTL) {
					res.set('Content-Type', cached.type);
					res.send(cached.buf);
					return;
				}

				fetchEmoteBytes(raw)
					.then(({ buffer, contentType }) => {
						emoteProxyCache.set(raw, { buf: buffer, type: contentType, at: Date.now() });
						res.set('Content-Type', contentType);
						res.send(buffer);
					})
					.catch((err) => {
						this.logToFE(`[emote-proxy] failed for ${raw}: ${err.message}`);
						res.status(502).send('proxy fetch failed');
					});
			});

			// Mount the vuefinder-backed asset filesystem API. The renderer
			// uses this to drive the new AssetBrowser UI (browse, upload,
			// rename, move, delete, search across the virtual asset_paths
			// tree). 404s without a db handle, which is fine in test windows.
			if (this.db) {
				mountAssetFsAPI(expressApp, {
					db: this.db,
					log: (m) => this.logToFE(m),
				});
			}

			this.server = http.createServer(expressApp);

			// using our socket-ref server, that syncs socketRefs
			this.wss = socketRefServer({ server: this.server, port });

			// web socket server logging
			this.wss.on('connection', (ws, req) => {
				const ip = req.socket.remoteAddress;
				this.logToFE(`[WS] New connection from ${ip}`);

				// ws.on('message', (message) => {
				// 	this.logToFE(`[WS] Message from ${ip}: ${message}`);
				// });

				ws.on('close', () => {
					this.logToFE(`[WS] Connection closed from ${ip}`);
				});
			});

			// for debug, disabled for now
			// this.startEchoServer();

			// set up the terminators so we can close the servers cleanly
			this.terminatorHTTP = createHttpTerminator({ server: this.server });
			this.terminatorWS = createHttpTerminator({ server: this.wss });

			// (CORS middleware moved up - see the block right after the
			// request-logging middleware, before mountAssetFsAPI. Middleware
			// has to be registered before the route handlers it covers.)

			// Serve /live.html in production
			if (true || process.env.NODE_ENV !== 'development') {

				// path to our electron renderer folder where BOTH the electron UI lives,
				// but ALSO the live page we're about to server to OBS via express
				const rendererPath = join(app.getAppPath(), 'renderer');

				// Block direct access to index.html
				expressApp.use('/live/index.html', (req, res) => {
					console.warn(`Blocked attempt to access: ${req.url}`);
					res.status(403).send('Access to this file is forbidden');
				});

				// Serve live.html manually when accessing /live/
				expressApp.get('/live/', (req, res) => {
					res.sendFile('live.html', { root: rendererPath });
				});

				// Redirect pretty URL to actual file to keep relative asset paths working
				expressApp.get('/live/queue-manager/', (req, res) => {
					res.redirect('/live/queue-manager.html');
				});

				expressApp.get('/live/queue-manager.html', (req, res) => {
					res.sendFile('queue-manager.html', { root: rendererPath });
				});

				// Serve static assets, but disable default index.html serving
				expressApp.use('/live', express.static(rendererPath, {
					index: false,
				}));

				// Serve obsTestPage.html manually when accessing /obsTestPage/
				expressApp.get('/obsTestPage/', (req, res) => {
					res.redirect('/live/obsTestPage.html');
				});

				// Serve static assets, but disable default index.html serving
				expressApp.use('/obsTestPage', express.static(rendererPath, {
					index: false,
				}));

				// our custom imported user-assets folder needs to statically serve as well
				const assetFolder = join(app.getPath('userData'), 'custom_assets');
				expressApp.use('/live/custom_assets',
					express.static(assetFolder),
					serveIndex(assetFolder, { icons: true })
				);
			}

			this.server.listen(port, () => {
				console.log(`Server listening at http://127.0.0.1:${port}`);
				this.logToFE(`Server listening at http://127.0.0.1:${port}`);
			});

		} catch (e) {
			console.error(e);
			this.logToFE(`Error ${e.message}`);
		}
	}

}

// stupid dumb module.exports
module.exports = { OBSViewServer };
