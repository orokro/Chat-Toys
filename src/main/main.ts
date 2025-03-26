/*
	main.ts
	-------

	Main file for kicking off & setting up the Electron side of things.
*/

// node/electron imports
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'ws';


/**
 * Start a server on port 3001 that listens for WebSocket connections.
 */
function startServer() {

	// set up a basic express server and a WebSocket server
	const expressApp = express();
	const server = http.createServer(expressApp);
	const wss = new Server({ server });

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
	}

	// Example WebSocket echo
	wss.on('connection', (socket) => {
		console.log('WebSocket connected');
		socket.on('message', (msg) => {
			console.log('Received:', msg);
			socket.send(`Echo: ${msg}`);
		});
	});

	server.listen(3001, () => {
		console.log('Server listening at http://127.0.0.1:3001');
	});
}


/**
 * Create the main window for the application.
 */
function createWindow() {

	// Start an express and web socket server
	startServer();
	
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 1750,
		height: 1000,
		webPreferences: {
			preload: join(__dirname, 'preload.js'),
			nodeIntegration: false,
			contextIsolation: true,
		}
	});

	// if we're in dev, we'll connect to the localhost vite server
	if (process.env.NODE_ENV === 'development') {
		const rendererPort = process.argv[2];
		mainWindow.loadURL(`http://localhost:${rendererPort}`);
	}

	// otherwise, 
	else {
		mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'));
	}
}


// When the app is ready, create the window. 
app.whenReady().then(() => {

	// Create the window.
	createWindow();

	// Set up the CSP for the window.
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				'Content-Security-Policy': ['script-src \'self\'']
			}
		})
	})

	// Set up the CSP for the window.
	app.on('activate', function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});


// Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
});


// Handle IPC messages
ipcMain.on('message', (event, message) => {
	console.log(message);
});
