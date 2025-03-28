/*
	main.ts
	-------

	Main file for kicking off & setting up the Electron side of things.
*/
 
// node/electron imports
import { app, BrowserWindow, ipcMain, session } from 'electron';

// local imports
import { createMainWindow } from './windows/MainWindow.js';
import { OBSViewServer } from './system/OBSViewServer.js';
import { createSystemTray } from './system/SystemTray.js';
import { createAppMenu } from './system/MainAppMenu.js';

// global vars
let mainWindow = null;
let obsViewServer = null;
let tray = null;

// for debugging
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// When the app is ready, create the window. 
app.whenReady().then(() => {

	// Create the window.
	mainWindow = createMainWindow();

	// Create the app menu.
	createAppMenu(mainWindow);
	
	// make system tray icon so our main window can be hidden and shown
	tray = createSystemTray(mainWindow);

	// Create the OBSViewServer.
	obsViewServer = new OBSViewServer(mainWindow);

	// Set up the CSP all windows
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				'Content-Security-Policy': ['script-src \'self\'']
			}
		})
	})

});


// handle the app activating
app.on('activate', function () {

	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createMainWindow();
	}
});


// Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
});


// Handle IPC messages
ipcMain.on('message', (event, message) => {
	console.log(message);
});
