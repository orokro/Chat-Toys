/*
	chatForward.js
	--------------
	
	Listens for WebSocket "chat" messages and forwards them to the renderer via IPC.
*/

// electron
import { ipcMain } from 'electron';

/**
 * Listens for WebSocket "chat" messages and forwards them to the renderer via IPC.
 *
 * @param {import('./sockets/SocketServer.js').SocketServer} socketServer - widget server's socket bus
 * @param {BrowserWindow} mainWindow - The main Electron window to forward messages to
 */
export function chatForward(socketServer, mainWindow) {

	// the SocketServer parses each frame once and routes it by type; the
	// handler survives server restarts (it lives on socketServer, not on a
	// particular ws.WebSocketServer instance)
	socketServer.onMessage('chat', (msg) => {
		if (msg.data === undefined)
			return;
		if (!mainWindow || mainWindow.isDestroyed())
			return;
		mainWindow.webContents.send('chat-message', msg.data);
	});

	// set up a way to forward chats from another window in the app
	ipcMain.handle('local-chat-forward', async (e, ...args) => {

		// get the message from the args
		let msg = args[0];
		console.log('chat-forward', msg);

		// if the main window is closed, we can't send messages
		if (!mainWindow || mainWindow.isDestroyed())
			return;

		// forward the message to the renderer
		// msg = JSON.parse(msg);
		mainWindow.webContents.send('chat-message', msg);
		return true;
	});

}
