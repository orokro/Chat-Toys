/*
	SystemTray.js
	-------------

	In this file we'll encapsulate the logic for creating the system tray icon
*/

// node imports
import { app, Menu, Tray } from 'electron';
import { join } from 'path';

/**
 * Class to create the system tray icon.
 * 
 * @param {BrowserWindow} mainWindow - The main window for the app.
 */
function createSystemTray(mainWindow) {

	// create the tray
	const tray = new Tray(join(__dirname, '..', 'static', 'icon_128.png'));

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
				mainWindow.destroy();
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
