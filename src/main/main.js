/*
	main.ts
	-------

	Main file for kicking off & setting up the Electron side of things.
*/

// node/electron imports
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';

// local imports
import { createMainWindow } from './windows/MainWindow.js';
import { createChatTesterWindow } from './windows/ChatTesterWindow.js';
import { OBSViewServer } from './system/OBSViewServer.js';
import { createSystemTray } from './system/SystemTray.js';
import { createAppMenu } from './system/MainAppMenu.js';
import { chatForward } from './system/chatForward.js';
import ChatSourceManager from './system/ChatSourceManager.js';
import { TwitchManager } from './system/TwitchManager.js';
import { TwurpleManager } from './system/TwurpleManager.js';
const { DatabaseManager } = require('./system/database');

// load our window tests
const { testURL } = require('./system/WindowTests');

// system to use backend for intervals
import 'electron-interval-system/main.js';

// global vars
let mainWindow = null;
let chatTesterWindow = null;
let obsViewServer = null;
let chatSourceMgr = null;
let twitchMgr = null;
let twurpleMgr = null;
let tray = null;

// Main-process SQLite connection used by the asset-filesystem express
// endpoint (vuefinder backend). better-sqlite3 with WAL mode handles
// multiple connections to the same file just fine; the renderer's
// preload also opens its own connection for direct queries.
let mainDb = null;

// list of our spawned windows
let openedWindows = [];

process.on('uncaughtException', (err) => {
	console.error('[uncaughtException]', err.stack || err);
  });

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
function destroyAllWindows_old() {
	openedWindows.forEach((win) => {
		win.destroy();
	});
	openedWindows = [];
}


// nuclear option: destroy all windows and kill the app cleanly
function destroyAllWindows() {
	try {
		// Get every BrowserWindow that exists (even if not tracked)
		const allWindows = BrowserWindow.getAllWindows();

		// Attempt to close/destroy each one forcibly
		for (const win of allWindows) {
			try {
				if (!win.isDestroyed()) {
					win.removeAllListeners(); // prevent reentry / crashes
					win.destroy(); // bypass close handlers
				}
			} catch (err) {
				console.error('Error destroying window:', err);
			}
		}

		// Extra safety: clear any references you’re tracking
		if (global.openedWindows && Array.isArray(global.openedWindows)) {
			global.openedWindows.length = 0;
		}

		// Give the event loop a tick to finish destruction, then quit
		setTimeout(() => {
			try {
				app.exit(0); // immediate exit, bypass graceful shutdown
			} catch {
				process.exit(0); // absolute fallback
			}
		}, 200);

	} catch (err) {
		console.error('Critical failure during destroyAllWindows:', err);
		// As a last resort, hard kill Node
		process.exit(1);
	}
}



// When the app is ready, create the window. 
app.whenReady().then(() => {

	// Create the window.
	mainWindow = createMainWindow();
	openedWindows.push(mainWindow);

	// Ensure new windows (like Karaoke Manager) have the correct preload and settings.
	// Also: deny any popup pointed at our own widget server / API. The vuefinder
	// download button triggers an anchor with a target that Electron interprets
	// as a window.open() - the file DOES download via Electron's native flow,
	// but a blank popup window appears alongside it. Denying these URLs as
	// popup targets stops the popup without breaking the download.
	mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
		if (frameName === 'KaraokeQueueManager') {
			const dbPath = join(app.getPath('userData'), 'ytct.db');
			return {
				action: 'allow',
				overrideBrowserWindowOptions: {
					width: 1000,
					height: 900,
					webPreferences: {
						preload: join(__dirname, 'windows', 'preload.js'),
						additionalArguments: [`--dbPath=${dbPath}`],
						nodeIntegration: false,
						contextIsolation: true,
						sandbox: false
					}
				}
			}
		}

		// Deny popups targeting localhost - these are our own widget-server
		// URLs (asset preview / download endpoints) and should never spawn
		// a new BrowserWindow.
		try {
			const u = new URL(url);
			if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
				return { action: 'deny' };
			}
		} catch (e) {
			// Non-URL targets (rare): fall through to default allow
		}

		return { action: 'allow' };
	});

	// build a chat tester window
	chatTesterWindow = createChatTesterWindow();
	openedWindows.push(chatTesterWindow);

	// Create the app menu.
	createAppMenu(mainWindow, chatTesterWindow, destroyAllWindows);

	// make system tray icon so our main window can be hidden and shown
	tray = createSystemTray(mainWindow, destroyAllWindows);

	// Open a main-process connection to the same SQLite DB the preload uses.
	// The constructor runs setupSchema() and the asset_paths migration -
	// idempotent on later boots. Path matches MainWindow.js's dbPath.
	const dbPath = join(app.getPath('userData'), 'ytct.db');
	mainDb = new DatabaseManager(dbPath);

	// Create the OBSViewServer with the db so the asset-filesystem API
	// can be mounted on the widget-server express app.
	obsViewServer = new OBSViewServer(mainWindow, { db: mainDb });


	// After creating your main window and OBSViewServer
	twitchMgr = new TwitchManager(mainWindow, obsViewServer);

	// Configure with your client ID and desired scopes
	twitchMgr.setClientConfig({
		clientId: 'x4po2in358dfq7c2jeuek5uh85qhoh',
		scopes: ['chat:read', 'chat:edit'],
	});

	// New Twurple-based manager (Phase 1 migration). Lives side-by-side
	// with the legacy TwitchManager during dev so we can A/B test before
	// cutting over. Pulls credentials from src/main/secrets.js. Hooks
	// its own /auth/twurple/callback route + twurple-* IPC channels.
	twurpleMgr = new TwurpleManager(mainWindow, obsViewServer);

	// start servers after twitch has added it's routes
	obsViewServer.startServers();

	// set up system to forward chat messages from websocket to the main window
	chatForward(obsViewServer.wss, mainWindow);
	
	// set up the chat source manager to manage list of chats to read
	chatSourceMgr = new ChatSourceManager(mainWindow, testURL);

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
