/*
	MainWindow.js
	-------------

	We'll put the code for creating the MainWindow neatly in this file.
*/

// Electron
import { BrowserWindow } from 'electron';
import { join } from 'path';

/**
 * Creates the main window for the app.
 * @returns {BrowserWindow} - The main window for the app.
 */
function createMainWindow() {

	// true if we're in dev mode
	const isDev = process.env.NODE_ENV === 'development';

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
	if (isDev) {
		const rendererPort = process.argv[2];
		mainWindow.loadURL(`http://localhost:${rendererPort}`);
	}

	// otherwise, 
	else {
		mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'));
	}

	/*
		Right, so...
		While the main app state probably(?) should be managed int he main process,
		(i.e. here, in the electron main process), I don't really feel like
		dealing with IPC for controlling the main state via the UI.

		As such, the main app state will be managed in the renderer process.

		We never want the main window to be closed, unless the user is actually
		quitting the app. So, we'll just hide it when the user tries to close it.

		Note that, because it would be annoying to have to goto the system tray
		every time we close the app in Dev, we'll disable this feature in Dev.
	*/
	if(isDev==false){
		mainWindow.on('close', (event) => {
			event.preventDefault();
			mainWindow.hide();
		});
	}

	return mainWindow;
}

// stupid dumb module.exports
module.exports = { createMainWindow };
