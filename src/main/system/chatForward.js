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
 * @param {WebSocketServer} wss - The WebSocket server instance
 * @param {BrowserWindow} mainWindow - The main Electron window to forward messages to
 */
export function chatForward(wss, mainWindow) {

	// note that, WSS comes from the socket-ref server
	// and is already set up to handle incoming messages
	wss.on('connection', (socket) => {

		// when we get a message, parse it and forward it to the renderer
		socket.on('message', (data) => {
			let msg;

			try {
				msg = JSON.parse(data);
			} catch (err) {
				return; // ignore non-JSON messages
			}

			if (msg.type === 'chat' && msg.data !== undefined) {
				mainWindow.webContents.send('chat-message', msg.data);
			}
		});
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
