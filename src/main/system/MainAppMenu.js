/*
	MainAppMenu.js
	--------------

	This file will provide a function that creates the main app menu for the app.
*/

// Electron
const { app, Menu, shell, ipcMain, BrowserWindow } = require('electron');
const Store = require('electron-store');
const store = new Store();

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
			label: 'Misc',
			submenu: [
				{
					// Mirrors ctApp.demoMode (a socketShallowRef) in the renderer.
					// Electron auto-toggles `checked` before this click fires, so we
					// just forward the new value; the renderer pushes its value back
					// (on boot + on every change) via the 'menu-set-demo-mode' IPC
					// handler below, which keeps this checkmark in sync when the
					// toggle is flipped from the OBS Settings page instead.
					id: 'widgetDemoMode',
					label: 'Widget Demo Mode',
					type: 'checkbox',
					checked: false,
					click: (menuItem) => {
						mainWindow.webContents.send('set-demo-mode', menuItem.checked);
					}
				},
				// {
				// 	label: 'Open Chat Tester',
				// 	click: () => {
				// 		chatTesterWindow.show();
				// 	}
				// }
			]
		},
		{
			label: 'Help',
			submenu: [
				{
					label: 'View Help',
					click: () => {
						mainWindow.webContents.send('show-help', 'helpDocs');
					}
				},
				{
					label: 'View Video Help',
					click: () => {
						mainWindow.webContents.send('show-help', 'help_videos');
					}
				},
				{ type: 'separator' },
				{
					label: 'Website',
					click: () => {
						shell.openExternal('http://chattoys.pro/');
					}
				},
				{
					label: 'GitHub',
					click: () => {
						shell.openExternal('https://github.com/orokro/Chat-Toys');
					}
				},
				{ type: 'separator' },
				{
					label: 'Contact',
					click: () => {
						mainWindow.webContents.send('show-help', 'help_contact');
					}
				},
				{
					label: 'Credits',
					click: () => {
						mainWindow.webContents.send('show-help', 'credits');
					}
				},
			]
		}
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

	// Keep the "Widget Demo Mode" checkmark in sync with the renderer's
	// ctApp.demoMode. The renderer calls this on boot (to seed the correct
	// initial state) and whenever the toggle changes from the OBS Settings
	// page, so the menu always reflects the real value.
	ipcMain.removeHandler('menu-set-demo-mode');
	ipcMain.handle('menu-set-demo-mode', (event, value) => {
		const appMenu = Menu.getApplicationMenu();
		const item = appMenu && appMenu.getMenuItemById('widgetDemoMode');
		if (item)
			item.checked = !!value;
		return true;
	});
}

// stupid dumb module.exports 
module.exports = { createAppMenu };
