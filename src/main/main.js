/*
	main.ts
	-------

	Main file for kicking off & setting up the Electron side of things.
*/
 
// node/electron imports
import { app, BrowserWindow, ipcMain, session } from 'electron';

// local imports
import { createMainWindow } from './windows/MainWindow.js';
import { createChatTesterWindow } from './windows/ChatTesterWindow.js';
import { OBSViewServer } from './system/OBSViewServer.js';
import { createSystemTray } from './system/SystemTray.js';
import { createAppMenu } from './system/MainAppMenu.js';
import { chatForward } from './system/chatForward.js';

// global vars
let mainWindow = null;
let chatTesterWindow = null;
let obsViewServer = null;
let tray = null;

// list of our spawned windows
let openedWindows = [];

// for debugging
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// function to destroy all windows
function destroyAllWindows() {
	openedWindows.forEach((win) => {
		win.destroy();
	});
	openedWindows = [];
}

// When the app is ready, create the window. 
app.whenReady().then(() => {

	// Create the window.
	mainWindow = createMainWindow();
	openedWindows.push(mainWindow);

	// build a chat tester window
	chatTesterWindow = createChatTesterWindow();
	openedWindows.push(chatTesterWindow);

	// Create the app menu.
	createAppMenu(mainWindow, chatTesterWindow, destroyAllWindows);
	
	// make system tray icon so our main window can be hidden and shown
	tray = createSystemTray(mainWindow, destroyAllWindows);

	// Create the OBSViewServer.
	obsViewServer = new OBSViewServer(mainWindow);

	chatForward(obsViewServer.wss, mainWindow);
	
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
