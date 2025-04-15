/*
	ChatTesterWindow.js
	-------------------

	This will be a window that lets the user type in chat commands to test
	the system / see how they look in chat.
*/

// Electron
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';

const contentScript = `
	// Flag to mark script injection
	window.YTCTEnabled = true; // default to enabled on initial load

	// WebSocket connection
	let socket;
	function connectSocket() {

		// Don't connect if not enabled or already connected
		if (!window.YTCTEnabled) return;
		if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

		// Connect to the WebSocket server in Electron
		socket = new WebSocket('ws://localhost:3001');

		// when we first connect, send welcome message
		socket.addEventListener('open', () => {
			console.log('WebSocket connected');
			socket.send(JSON.stringify({
				type: 'chat',
				data: { msg: 'connected' }
			}));
		});

		// if we closed, try to reconnect (if enabled)
		socket.addEventListener('close', () => {

			console.warn('[YTCT] Socket closed. Will attempt reconnect if enabled.');

			// Try reconnecting every 2.5s if still enabled
			if (window.YTCTEnabled)
				setTimeout(connectSocket, 2500);

		});

		socket.addEventListener('error', (err) => {
			console.warn('[YTCT] Socket error:', err);
		});
	}
	connectSocket();

	// save original fetch function
	const fetchFallback = window.fetch;
	window.fetchFallback = fetchFallback;

	// override fetch function to intercept chat messages
	window.fetch = async (...args) => {

		console.log('fetch', args);
		
		// get the request URL
		const request = args[0];
		const url = (typeof request === 'string') ? request : request.url;
		const result = await fetchFallback(...args);

		// check if the URL is a YouTube chat API endpoint
		const currentDomain = location.protocol + '//' + location.host;
		const ytApi = (end) => currentDomain + '/youtubei/v1/live_chat' + end;
		const isReceiving = url.startsWith(ytApi('/get_live_chat'));
		const isSending = url.startsWith(ytApi('/send_message'));

		// if the URL is a chat API endpoint, parse the JSON and forward it to the main process
		if (window.YTCTEnabled && (isReceiving || isSending)) {
			try {
				const cloned = result.clone();
				const json = await cloned.json();
				const response = JSON.stringify(json);

				window.dispatchEvent(new CustomEvent(
					isReceiving ? 'messageReceive' : 'messageSent',
					{ detail: response }
				));

				if (isReceiving && socket && socket.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify({
						type: 'chat',
						data: response
					}));
				}
			} catch (e) {
				console.warn('[fetch override] Failed to parse JSON:', e);
			}
		}

		return result;
	};
`;


/**
 * Creates the main window for the app.
 * @returns {BrowserWindow} - The main window for the app.
 */
function createChatTesterWindow() {

	// true if we're in dev mode
	const isDev = process.env.NODE_ENV === 'development';

	// Create the browser window.
	const chatTesterWindow = new BrowserWindow({
		width: 500,
		height: 700,
		webPreferences: {
			preload: join(__dirname, 'chatPreload.js'),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false
		},
		show: false,
		autoHideMenuBar: true,
	});

	// always hide the window when closed
	chatTesterWindow.on('close', (event) => {
		event.preventDefault();
		chatTesterWindow.hide();
	});

	// load content script when the page changes.
	chatTesterWindow.webContents.on('did-finish-load', () => {
		chatTesterWindow.webContents.executeJavaScript(contentScript)
			.then(() => console.log('Script injected!'))
			.catch(err => console.error('Script injection failed:', err));
	});

	// set up a way to forward chats from another window in the app
	ipcMain.handle('set-chat-url', async (e, ...args) => {

		const url = args[0];

		// chat gpt: complete this line
		chatTesterWindow.loadURL(url);
	});

	// if we're in dev, we'll connect to the localhost vite server
	if (isDev) {
		const rendererPort = process.argv[2];
		chatTesterWindow.loadURL(`http://localhost:${rendererPort}/chatTester.html`);
	}

	// otherwise, 
	else {
		chatTesterWindow.loadFile(join(app.getAppPath(), 'renderer', 'chatTester.html'));
	}

	// hide instead of close
	if(isDev==false){
		chatTesterWindow.on('close', (event) => {
			event.preventDefault();
			chatTesterWindow.hide();
		});
	}

	return chatTesterWindow;
}

// stupid dumb module.exports
module.exports = { createChatTesterWindow };
