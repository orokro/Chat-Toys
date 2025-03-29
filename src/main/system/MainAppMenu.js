/*
	MainAppMenu.js
	--------------

	This file will provide a function that creates the main app menu for the app.
*/

// Electron
const { app, Menu, shell, ipcMain, BrowserWindow } = require('electron');

/**
 * Builds our main menus for the app
 * @param {BrowserWindow} mainWindow - main application window
 * @param {BrowserWindow} chatTesterWindow - chat tester window
 * @param {function} destroyAllWindows - function to destroy all windows
 */
function createAppMenu(mainWindow, chatTesterWindow, destroyAllWindows) {

	// true if we're in dev mode
	const isDev = process.env.NODE_ENV === 'development';

	// our main menu template
	const template = [
		{
			label: 'File',
			submenu: [
				{
					label: 'Quit',
					click: () => {
						destroyAllWindows();
						app.quit();
					}
				}
			]
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'selectAll' }
			]
		},
		...((true || isDev) ? [{
			label: 'View',
			submenu: [
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'toggleDevTools' },
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' }
			]
		}] : []),
		{
			label: 'Window',
			submenu: [
				{
					label: 'Show Live Window',
					click: () => {
						const url = isDev
							? 'http://localhost:8080/live.html'
							: 'http://localhost:3001/live/';
						shell.openExternal(url);
					}
				},
				{
					label: 'Open Chat Tester',
					click: () => {
						chatTesterWindow.show();
					}
				}
			]
		},
		{
			label: 'Help',
			submenu: [
				{
					label: 'View Help',
					click: () => {
						mainWindow.webContents.send('show-help');
					}
				},
				{
					label: 'Website',
					click: () => {
						shell.openExternal('https://orokro.github.io/YouTube-Chat-Toys/');
					}
				},
				{
					label: 'GitHub',
					click: () => {
						shell.openExternal('https://github.com/orokro/YouTube-Chat-Toys');
					}
				}
			]
		}
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

// stupid dumb module.exports 
module.exports = { createAppMenu };
