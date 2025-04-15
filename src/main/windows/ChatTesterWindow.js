/*
	ChatTesterWindow.js
	-------------------

	This will be a window that lets the user type in chat commands to test
	the system / see how they look in chat.
*/

// Electron
import { app, BrowserWindow } from 'electron';
import { join } from 'path';

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
