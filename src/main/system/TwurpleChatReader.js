/*
	TwurpleChatReader.js
	--------------------

	The Twurple-based chat reader. Replaces TMI/TwitchChatReader.js in the
	new flow, while emitting messages on the SAME `chat-message` IPC
	channel with the SAME JSON shape - so downstream consumers
	(ChatProcessor, the command processor, every Toy, emote parsing,
	avatar lookup, bits handling) don't know anything changed.

	The shape compatibility is critical and is enforced by
	_buildTMIShapedMessage() below. Any field the existing
	src/renderer/scripts/ChatProcessor.js reads off `data.data.tags`
	(display-name, username, bits, emotes) is populated here from
	Twurple's ChatMessage object.

	Lifecycle:
	  - Constructed by TwurpleManager once auth + ApiClient are ready
	  - connect() opens the Twurple ChatClient against the user's channel
	  - onMessage forwards each message through _forwardChat()
	  - disconnect() / restart() mirror the TMI reader's interface
*/

const { ChatClient } = require('@twurple/chat');

/**
 * Reads Twitch chat via Twurple's ChatClient and forwards each message
 * to the renderer on the same `chat-message` IPC channel that
 * TwitchChatReader (TMI) uses.
 */
class TwurpleChatReader {

	/**
	 * @param {Electron.BrowserWindow} mainWindow - main window to send IPC messages to
	 * @param {import('@twurple/auth').RefreshingAuthProvider} authProvider - auth provider from TwurpleManager
	 * @param {string} channelLogin - Twitch channel login to join (e.g. 'orokro'); typically the broadcaster themselves
	 * @param {string} userId - Twitch userId of the authenticated user (for self-message filtering)
	 */
	constructor(mainWindow, authProvider, channelLogin, userId) {

		this.mainWindow = mainWindow;
		this.authProvider = authProvider;
		this.channelLogin = channelLogin;
		this.userId = userId;

		/** @type {ChatClient|null} */
		this.client = null;

		/** @type {boolean} */
		this.connected = false;
	}


	/* ====================================================================== */
	/*                            Lifecycle                                   */
	/* ====================================================================== */


	/**
	 * Open the Twurple chat client and join the configured channel.
	 * Idempotent: no-op if already connected.
	 */
	async connect() {

		if (this.connected) {
			console.log('[TwurpleChatReader] Already connected; skipping reconnect.');
			return;
		}

		if (!this.authProvider) {
			console.warn('[TwurpleChatReader] Cannot connect - no authProvider.');
			return;
		}

		console.log(`[TwurpleChatReader] Connecting via Twurple as "${this.channelLogin}" -> #${this.channelLogin}`);

		this.client = new ChatClient({
			authProvider: this.authProvider,
			channels: [this.channelLogin],
		});

		this._bindEvents();

		try {
			await this.client.connect();
		} catch (err) {
			console.error('[TwurpleChatReader] ❌ Connection error:', err);
		}
	}


	/**
	 * Cleanly tear down the chat client.
	 */
	async disconnect() {

		if (!this.client) return;

		try {
			this.client.quit();
			console.log('[TwurpleChatReader] 🔌 Disconnected from Twurple chat.');
		} catch (err) {
			console.warn('[TwurpleChatReader] Disconnect error:', err);
		}

		this.client = null;
		this.connected = false;
		this._notifyRenderer();
	}


	/**
	 * Disconnect + reconnect. Useful after auth changes.
	 */
	async restart() {

		console.log('[TwurpleChatReader] Restarting connection...');
		await this.disconnect();
		await this.connect();
	}


	/* ====================================================================== */
	/*                            Event Binding                               */
	/* ====================================================================== */


	/**
	 * Wire ChatClient events to our forwarding logic.
	 *
	 * @private
	 */
	_bindEvents() {

		if (!this.client) return;

		this.client.onConnect(() => {
			this.connected = true;
			console.log('[TwurpleChatReader] ✅ Connected to Twurple chat');
			this._notifyRenderer();
		});

		this.client.onDisconnect((manually, reason) => {
			this.connected = false;
			console.log(`[TwurpleChatReader] ⚠️ Disconnected (manual=${manually}):`, reason || '');
			this._notifyRenderer();
		});

		this.client.onJoin((channel, user) => {
			// `user` here is whoever joined; only log when it's us
			if (user?.toLowerCase() === this.channelLogin?.toLowerCase())
				console.log(`[TwurpleChatReader] Joined channel: ${channel}`);
		});

		this.client.onMessage((channel, user, text, msg) => {

			// NOTE on self-filtering: the legacy TMI reader has
			//   if (self) return;
			// where `self` is tmi.js's flag meaning "this message was sent
			// THROUGH my own chat client via client.say()". It does NOT
			// mean "authored by the same user as I'm connected as". Since
			// ChatToys never calls .say(), TMI's `self` is effectively
			// always false - the filter is a no-op in practice. We must
			// match that no-op behavior here; otherwise the broadcaster's
			// own test messages (typed in the Twitch web UI) get silently
			// dropped because msg.userInfo.userId === this.userId for them.
			console.log('[TwurpleChatReader] 💬 onMessage', { user, text });
			this._forwardChat(channel, user, text, msg);
		});
	}


	/* ====================================================================== */
	/*                          Message Forwarding                            */
	/* ====================================================================== */


	/**
	 * Build the TMI-shaped JSON payload and ship it to the renderer over
	 * the existing `chat-message` IPC channel.
	 *
	 * @param {string} channel
	 * @param {string} user
	 * @param {string} text
	 * @param {import('@twurple/chat').ChatMessage} msg
	 * @private
	 */
	_forwardChat(channel, user, text, msg) {

		try {
			const chatMsg = this._buildTMIShapedMessage(channel, user, text, msg);
			const json = JSON.stringify(chatMsg);

			if (this.mainWindow?.webContents) {
				this.mainWindow.webContents.send('chat-message', json);
			} else {
				console.warn('[TwurpleChatReader] ⚠️ No mainWindow.webContents to send.');
			}
		} catch (err) {
			console.error('[TwurpleChatReader] ❌ Failed to forward chat message:', err);
		}
	}


	/**
	 * Translate Twurple's ChatMessage into the JSON shape the legacy
	 * TwitchChatReader emits. Field-for-field parity with the existing
	 * structure so ChatProcessor (which reads `data.data.tags.emotes`,
	 * `display-name`, `username`, `bits`) doesn't notice the swap.
	 *
	 * Mapping reference:
	 *   tags.emotes         <- Object.fromEntries(msg.emoteOffsets)
	 *   tags['display-name'] <- msg.userInfo.displayName
	 *   tags.username       <- msg.userInfo.userName
	 *   tags['user-id']     <- msg.userInfo.userId
	 *   tags.subscriber     <- msg.userInfo.isSubscriber
	 *   tags.bits           <- String(msg.bits) when isCheer, else undefined
	 *   tags.mod            <- msg.userInfo.isMod
	 *   tags.color          <- msg.userInfo.color
	 *
	 * @param {string} channel
	 * @param {string} user
	 * @param {string} text
	 * @param {import('@twurple/chat').ChatMessage} msg
	 * @returns {object} the TMI-shaped chat payload
	 * @private
	 */
	_buildTMIShapedMessage(channel, user, text, msg) {

		const info = msg?.userInfo || {};

		// Twurple exposes emote ranges as a Map<emoteId, string[]> where
		// the inner array entries look like "0-4" / "12-16" - the SAME
		// format tmi.js puts on tags.emotes. Object.fromEntries gives us
		// the plain-object shape ChatProcessor._parseTwitchEmojis expects.
		const emotes = msg?.emoteOffsets
			? Object.fromEntries(msg.emoteOffsets)
			: {};

		// TMI gives tags.bits as a string of the bit count (when it's a
		// cheer); ChatProcessor does parseInt on it. We stringify the
		// Twurple number for parity. `isCheer` is the Twurple guard so
		// we don't accidentally emit `bits: "0"` for non-cheer messages.
		const bitsTag = msg?.isCheer ? String(msg.bits ?? 0) : undefined;

		const tags = {
			'display-name': info.displayName || user,
			'username': info.userName || user,
			'user-id': info.userId || '',
			'subscriber': !!info.isSubscriber,
			'mod': !!info.isMod,
			'color': info.color || null,
			'emotes': emotes,
		};
		if (bitsTag !== undefined) tags.bits = bitsTag;

		return {
			id: `${channel}-${info.userId || 'anon'}-${Date.now()}`,
			author: info.displayName || info.userName || user,
			message: text,
			isMember: !!info.isSubscriber,
			twitch: true,
			data: {
				channel,
				tags,
				message: text,
				self: false,
			},
		};
	}


	/**
	 * Mirror the legacy reader's renderer status notification so the
	 * existing twitch-chat-status listeners (if any) keep working.
	 *
	 * @private
	 */
	_notifyRenderer() {

		if (!this.mainWindow?.webContents) return;

		const data = { connected: this.connected, channel: this.channelLogin };
		this.mainWindow.webContents.send('twitch-chat-status', data);
		console.log('[TwurpleChatReader] 🔁 Sent status update to renderer:', data);
	}

}


module.exports = TwurpleChatReader;
