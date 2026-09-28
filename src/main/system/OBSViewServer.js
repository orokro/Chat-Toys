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
import { SocketServer } from './sockets/SocketServer.js';
const serveIndex = require('serve-index');
const Store = require('electron-store');
const { mountAssetFsAPI } = require('./assetFsAPI');

const store = new Store();
const fs = require('fs');
const https = require('https');
const httpMod = require('http');


// emote + avatar image proxies (hosts, fetch, bounded cache)
import { mountImageProxy, BoundedImageCache, EMOTE_PROXY_HOSTS, AVATAR_PROXY_HOSTS } from './imageProxy.js';


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

		// socket-ref sync server + typed message bus (chat, plugin-rpc, ...).
		// Created once and re-attached on every (re)start so stored values
		// and registered handlers survive a server restart / port change.
		this.socketServer = new SocketServer();

		// bounded image caches for the /emote-proxy and /avatar-proxy routes
		this.emoteProxyCache = new BoundedImageCache({ maxEntries: 1000, maxBytes: 64 * 1024 * 1024, ttlMs: 60 * 60 * 1000 });
		this.avatarProxyCache = new BoundedImageCache({ maxEntries: 2000, maxBytes: 64 * 1024 * 1024, ttlMs: 6 * 60 * 60 * 1000 });

		// optional database handle for the asset filesystem endpoint.
		// Kept on `this` so startServers() (and a future restartServers)
		// can re-mount on each express app boot.
		this.db = options.db || null;

		// optional PluginManager whose /plugins/* routes (installed.json, the
		// SDK, and per-plugin file serving with SDK injection) get mounted on
		// each express app boot. Omitted in legacy/test windows.
		this.pluginManager = options.pluginManager || null;

		// optional ChatThemeManager whose /chat-themes/* routes (the imported
		// Streamlabs themes + their generated harness pages) get mounted on
		// each express app boot. Omitted in legacy/test windows.
		this.chatThemeManager = options.chatThemeManager || null;

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

		// messages are parsed once by the SocketServer and routed by type
		if (this._echoRegistered)
			return;
		this._echoRegistered = true;
		this.socketServer.onMessage('echo', (msg, socket) => {
			if (msg.data !== undefined)
				socket.send(`Echo: ${msg.data}`);
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

		// drop socket connections + timers; stored values and handlers are
		// kept on this.socketServer for the next startServers()
		this.socketServer.detach();

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
			// widget. We fetch the bytes in the main process and serve them from
			// this server (which already sends permissive CORS headers).
			// Restricted to known emote CDNs. See imageProxy.js.
			mountImageProxy(expressApp, '/emote-proxy', {
				hosts: EMOTE_PROXY_HOSTS,
				cache: this.emoteProxyCache,
				log: (m) => this.logToFE(m),
			});

			// ---- Avatar proxy (plugins) ----
			// Plugin widgets get chatter avatars through here: fetched with no
			// Referer (YouTube's avatar CDN can reject a localhost Referer),
			// cached, and CORS-clean for canvas use. Unknown hosts redirect to
			// the original URL. See PluginToy._avatarUrl.
			mountImageProxy(expressApp, '/avatar-proxy', {
				hosts: AVATAR_PROXY_HOSTS,
				redirectOthers: true,
				cache: this.avatarProxyCache,
				log: (m) => this.logToFE(m),
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

			// Mount the plugin routes (/plugins/installed.json, /plugins/_sdk/
			// ct-api.js, and /plugins/<slug>/<file> with SDK injection). Before
			// the /live block so plugin paths resolve first.
			if (this.pluginManager) {
					this.pluginManager.mountRoutes(expressApp);
				}

			// Mount the chat-theme routes (/chat-themes/installed.json and
			// /chat-themes/<id>/index.html + assets) for Streamlabs compat mode.
			if (this.chatThemeManager) {
					this.chatThemeManager.mountRoutes(expressApp);
				}

			this.server = http.createServer(expressApp);

			// socket-ref sync server (routes each key only to its subscribers)
			this.wss = this.socketServer.attach(this.server);

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
