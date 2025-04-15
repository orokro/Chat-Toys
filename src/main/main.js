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

// system to use backend for intervals
import 'electron-interval-system/main.js';

// global vars
let mainWindow = null;
let chatTesterWindow = null;
let obsViewServer = null;
let tray = null;

// list of our spawned windows
let openedWindows = [];

console.error = (...args) => {
	if (
	  typeof args[0] === 'string' &&
	  args[0].includes("'Autofill.enable' wasn't found")
	) return;
	process.stderr.write(args.join(' ') + '\n');
  };

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

	// I had to turn off CSP because YouTube embeds don't work with it on, and every
	// permutation I tried didn't work. So, for now, it's off.

	// Set up the CSP all windows
	// session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
	// 	callback({
	// 		responseHeaders: {
	// 			...details.responseHeaders,
	// 			'Content-Security-Policy': [
	// 				"default-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
	// 				"script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
	// 				"frame-src youtube.com www.youtube.com; " +
	// 				"child-src https://www.youtube.com https://www.youtube-nocookie.com; " +
	// 				"style-src 'self' 'unsafe-inline'; " + // needed by some embeds
	// 				"img-src 'self' https://* data: blob:; " + // YouTube thumbnails etc.
	// 				"font-src 'self' https://fonts.gstatic.com;"
	// 			]
	// 		}
	// 	});
	// })

	// session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
	// 	callback({
	// 		responseHeaders: {
	// 			...details.responseHeaders,
	// 			'Content-Security-Policy': ["script-src 'self' 'https://youtube.com'; default-src * 'unsafe-inline' data: blob:;"]
	// 		}
	// 	});
	// });

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
