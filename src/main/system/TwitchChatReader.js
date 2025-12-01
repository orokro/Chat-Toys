/*
	TwitchChatReader.js
	-------------------

	Listens to Twitch chat for the authenticated user and forwards
	messages to the renderer in the same format as YouTube (JSON string).

	- Automatically connects if stored credentials exist.
	- Disconnects cleanly on logout.
	- Reconnects after login.
*/

const tmi = require('tmi.js');
const Store = require('electron-store');
const { ipcMain } = require('electron');
const store = new Store();

/**
 * @class TwitchChatReader
 * @classdesc Handles connecting to Twitch IRC (via tmi.js), reading messages,
 * and forwarding them as JSON strings to the renderer (same as YouTube).
 */
class TwitchChatReader {
	
	constructor(mainWindow) {
		this.mainWindow = mainWindow;
		this.client = null;
		this.connected = false;
		this.username = null;
		this.channel = null;

		this._registerIPC();

		// Auto-connect if credentials exist
		const creds = store.get('twitch');
		if (creds?.accessToken && creds?.user?.login) {
			console.log('[TwitchChatReader] Found saved credentials — auto-connecting.');
			this.connect();
		} else {
			console.log('[TwitchChatReader] No saved credentials; idle until login.');
		}
	}

	/* ---------------------------------------------------------------------- */
	/* --------------------------- Connection ------------------------------- */
	/* ---------------------------------------------------------------------- */

	/**
	 * Connects to Twitch chat using stored OAuth token.
	 */
	async connect() {
		if (this.connected) {
			console.log('[TwitchChatReader] Already connected; skipping reconnect.');
			return;
		}

		const creds = store.get('twitch');
		if (!creds?.accessToken || !creds?.user?.login) {
			console.warn('[TwitchChatReader] Cannot connect — no valid credentials in store.');
			return;
		}

		this.username = creds.user.login;
		this.channel = creds.user.login;

		console.log(`[TwitchChatReader] Connecting as "${this.username}" to #${this.channel}`);

		this.client = new tmi.Client({
			options: { debug: true },
			identity: {
				username: this.username,
				password: `oauth:${creds.accessToken}`,
			},
			channels: [this.channel],
		});

		this._bindEvents();

		try {
			await this.client.connect();
		} catch (err) {
			console.error('[TwitchChatReader] ❌ Connection error:', err);
		}
	}

	/**
	 * Disconnects from Twitch chat.
	 */
	async disconnect() {
		if (!this.client) return;
		try {
			await this.client.disconnect();
			console.log('[TwitchChatReader] 🔌 Disconnected from Twitch chat.');
		} catch (err) {
			console.warn('[TwitchChatReader] Disconnect error:', err);
		}
		this.client = null;
		this.connected = false;
		this._notifyRenderer();
	}

	/**
	 * Reconnects (used after login/logout).
	 */
	async restart() {
		console.log('[TwitchChatReader] Restarting connection...');
		await this.disconnect();
		await this.connect();
	}

	/* ---------------------------------------------------------------------- */
	/* -------------------------- Event Binding ----------------------------- */
	/* ---------------------------------------------------------------------- */

	/**
	 * Sets up Twitch chat event listeners.
	 * @private
	 */
	_bindEvents() {
		if (!this.client) return;

		this.client.on('connected', (addr, port) => {
			this.connected = true;
			console.log(`[TwitchChatReader] ✅ Connected to Twitch chat at ${addr}:${port}`);
			this._notifyRenderer();
		});

		this.client.on('disconnected', (reason) => {
			this.connected = false;
			console.log(`[TwitchChatReader] ⚠️ Disconnected from Twitch chat: ${reason || 'unknown'}`);
			this._notifyRenderer();
		});

		this.client.on('join', (channel, username, self) => {
			if (self) console.log(`[TwitchChatReader] Joined channel: ${channel}`);
		});

		this.client.on('message', (channel, tags, message, self) => {
			
			if (self)
				return;

			const chatMsg = {
				id: `${channel}-${tags['user-id'] || 'anon'}-${Date.now()}`,
				author: tags['display-name'] || tags.username,
				message: message,
				isMember: !!tags.subscriber,
				twitch: true,
				data: {
					channel,
					tags,
					message,
					self,
				}
			};

			console.log('[TwitchChatReader] 💬 Parsed message:', chatMsg);
			this._forwardChat(chatMsg);
		});

		this.client.on('notice', (channel, msgid, message) => {
			console.log(`[TwitchChatReader] 📢 Notice from ${channel}: ${msgid} - ${message}`);
		});

		this.client.on('error', (err) => {
			console.error('[TwitchChatReader] ⚠️ Client error:', err);
		});
	}

	/* ---------------------------------------------------------------------- */
	/* ------------------------- Message Forwarding ------------------------- */
	/* ---------------------------------------------------------------------- */

	/**
	 * Forwards chat messages as JSON strings (like YouTube).
	 * @param {Object} msg - Chat message object.
	 * @private
	 */
	_forwardChat(msg) {
		try {
			const json = JSON.stringify(msg);

			console.log('[TwitchChatReader] ↗️ Forwarding message (stringified):', json);

			if (this.mainWindow?.webContents) {
				this.mainWindow.webContents.send('chat-message', json);
				console.log('[TwitchChatReader] ✅ Sent to renderer process.');
			} else {
				console.warn('[TwitchChatReader] ⚠️ No mainWindow.webContents to send.');
			}
		} catch (err) {
			console.error('[TwitchChatReader] ❌ Failed to forward chat message:', err);
		}
	}

	/**
	 * Notifies renderer of Twitch chat connection status.
	 * @private
	 */
	_notifyRenderer() {
		if (this.mainWindow?.webContents) {
			const data = { connected: this.connected, channel: this.channel };
			this.mainWindow.webContents.send('twitch-chat-status', data);
			console.log('[TwitchChatReader] 🔁 Sent status update to renderer:', data);
		}
	}

	/* ---------------------------------------------------------------------- */
	/* --------------------------- IPC Handlers ----------------------------- */
	/* ---------------------------------------------------------------------- */

	/**
	 * Registers IPC handlers for manual Twitch chat control.
	 * @private
	 */
	_registerIPC() {
		ipcMain.handle('twitch-chat-connect', async () => {
			await this.connect();
			return { connected: this.connected };
		});
		ipcMain.handle('twitch-chat-disconnect', async () => {
			await this.disconnect();
			return { connected: this.connected };
		});
		ipcMain.handle('twitch-chat-status', async () => ({
			connected: this.connected,
			channel: this.channel,
		}));
	}
}

module.exports = TwitchChatReader;
