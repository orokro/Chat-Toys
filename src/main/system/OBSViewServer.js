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
const { socketRefServer } = require('socket-ref/server');
const serveIndex = require('serve-index');
const Store = require('electron-store');
const store = new Store();
import { createHttpTerminator } from 'http-terminator';
  

/**
 * Class to set up the servers for the live page.
 */
class OBSViewServer {

	/**
	 * Create a new OBSViewServer.
	 * 
	 * @param {BrowserWindow} mainWindow - The main window for the app.
	 */
	constructor(mainWindow) {

		// save ref to our main window
		this.mainWindow = mainWindow;

		// set up our IPC communication
		this.initializeIPC();

		// start our servers
		this.startServers();
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
	 * Restarts the servers.
	 */
	async restartServers() {

		console.log('Restarting OBSViewServer...');

		// Close HTTP server first (since WebSockets depend on it)
		// await close(this.server, 'HTTP server');
		await this.terminatorHTTP.terminate();
		this.server = null;

		// Try closing WebSocket interface if it's separate (for safety)
		await this.terminatorWS.terminate();
		this.wss = null;

		// Allow port to be released
		await new Promise((res) => setTimeout(res, 300));

		this.startServers();

		console.log('🚀 OBSViewServer restarted');
	}

	
	/**
	 * Starts both the http and websocket servers.
	 */
	startServers() {

		// get default port
		const port = store.get('port', 3001);
		console.log('Found OBSViewServer port in storage: ' + port);

		// try to start the servers
		try {

			// set up a basic express server and a WebSocket server
			const expressApp = express();
			this.server = http.createServer(expressApp);

			// using our socket-ref server, that syncs socketRefs
			this.wss = socketRefServer({ server: this.server, port });
			this.startEchoServer();

			this.terminatorHTTP = createHttpTerminator({ server: this.server });
			this.terminatorWS = createHttpTerminator({ server: this.wss });

			// 👇 Allow CORS for Vite dev server ONLY in development
			if (true || process.env.NODE_ENV === 'development') {
				expressApp.use(cors({
					origin: 'http://localhost:8080',
					methods: ['GET', 'POST'],
					credentials: true
				}));
			}

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

				// Serve static assets, but disable default index.html serving
				expressApp.use('/live', express.static(rendererPath, {
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
			});

		} catch (e) {
			console.error(e);
		}
	}

}

// stupid dumb module.exports
module.exports = { OBSViewServer };
