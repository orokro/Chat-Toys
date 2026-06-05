/*
	pluginForward.js
	----------------

	Relay for the plugin RPC bridge - the transport that lets a plugin widget
	running in the OBS / live page reach the dashboard's PluginToy broker.

	Topology (mirrors chatForward.js):

	  live page widget (RemoteBrokerProxy, a raw WS client)
	      |  { type:'plugin-rpc', kind:'req'|'ack'|'hello', ... }
	      v
	  socket-ref WS server  --(this module)-->  ipc 'plugin-rpc-from-live'  -->  dashboard renderer (PluginBridge)
	      ^                                                                              |
	      |  broadcast to plugin WS clients  <--  ipc 'plugin-rpc-to-live'  <------------/
	      |  { type:'plugin-rpc', kind:'res'|'evt', ... }

	The dashboard renderer is the trusted broker; this module is a dumb pipe. We
	track which sockets are plugin clients (they announce with a 'hello') so the
	renderer->live broadcast doesn't spray socket-ref-only connections.
*/

// electron
import { ipcMain } from 'electron';


/**
 * Wire up the plugin RPC relay on the widget server's WebSocket server.
 *
 * @param {import('ws').WebSocketServer} wss - socket-ref's WS server
 * @param {import('electron').BrowserWindow} mainWindow - dashboard window
 */
export function pluginForward(wss, mainWindow) {

	// sockets that have announced themselves as plugin RPC clients
	const clients = new Set();

	wss.on('connection', (socket) => {

		socket.on('message', (data) => {

			let msg;
			try { msg = JSON.parse(data); }
			catch (err) { return; } // not JSON - ignore (socket-ref traffic, etc.)

			if (!msg || msg.type !== 'plugin-rpc')
				return;

			// first message from a plugin client registers it for broadcasts
			if (msg.kind === 'hello')
				clients.add(socket);

			// forward everything (hello/req/ack) up to the dashboard renderer
			if (mainWindow && !mainWindow.isDestroyed())
				mainWindow.webContents.send('plugin-rpc-from-live', msg);
		});

		socket.on('close', () => clients.delete(socket));
		socket.on('error', () => clients.delete(socket));
	});

	// dashboard renderer -> live pages (responses + pushed events)
	ipcMain.on('plugin-rpc-to-live', (event, msg) => {

		let data;
		try { data = JSON.stringify(msg); }
		catch (err) { return; }

		for (const socket of clients) {
			try {
				if (socket.readyState === 1) // ws OPEN
					socket.send(data);
			} catch (err) {
				clients.delete(socket);
			}
		}
	});
}
