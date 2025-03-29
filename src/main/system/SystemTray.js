/*
	SystemTray.js
	-------------

	In this file we'll encapsulate the logic for creating the system tray icon
*/

// node imports
import { app, Menu, Tray } from 'electron';
import { join, resolve, dirname } from 'path'; // ✅ added resolve here
import { fileURLToPath } from 'url';

// true if we're in dev mode
const isDev = !app.isPackaged;

/**
 * Class to create the system tray icon.
 * 
 * @param {BrowserWindow} mainWindow - The main window for the app.
 * @param {function} destroyAllWindows - Function to destroy all windows.
 */
function createSystemTray(mainWindow, destroyAllWindows) {

	// pick the icon path based on if we're in dev mode
	const trayIconPath = isDev
	? resolve(__dirname, '../../../src/main/main_assets/icon_128.png')
	: join(process.resourcesPath, 'main_assets', 'icon_128.png');


	// create the tray
	const tray = new Tray(trayIconPath);

	// create the context menu
	const contextMenu = Menu.buildFromTemplate([
		{
			label: 'Show App',
			click: () => {
				mainWindow.show();
			}
		},
		{
			label: 'Quit',
			click: () => {
				destroyAllWindows();
				app.quit();
			}
		}
	]);

	// set the context menu
	tray.setContextMenu(contextMenu);

	// return the tray
	return tray;
}

// stupid dumb module.exports
module.exports = { createSystemTray };
