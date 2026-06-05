/*
	PluginBridge.js  (dashboard side)
	---------------------------------

	The dashboard end of the plugin RPC transport. Lives only in the primary
	window (it needs the live PluginToy instances). Receives plugin-rpc messages
	that the main process relayed from live-page widgets, routes them to the
	matching PluginToy broker, and pushes broker events (command/chat/obs) back
	out to the live pages.

	Counterpart pieces:
	  - main:  pluginForward.js  (the pipe)
	  - live:  RemoteBrokerProxy.js  (the other end of this conversation)

	Message kinds handled here (all carry `slug`):
	  in : hello  -> start forwarding this plugin's broker events to live
	       req    -> call broker.request(reqType, payload), reply with res
	       ack    -> broker.resolveCommandAck(token, ok, reason)
	  out: res    -> reply to a req  { instanceId, reqId, result|error }
	       evt    -> a broker event   { name, detail }
*/

export class PluginBridge {

	/**
	 * @param {import('../scripts/ChatToysApp').default} app
	 */
	constructor(app) {

		this.app = app;

		// slug -> array of unsub fns for broker-event forwarding
		this._subscribed = new Map();

		// no preload bridge (e.g. some test window) -> nothing to do
		if (!window.electronAPI || typeof window.electronAPI.onPluginRpc !== 'function')
			return;

		window.electronAPI.onPluginRpc((msg) => this._handle(msg));
	}


	/**
	 * Send a message out to live pages via the main relay.
	 *
	 * @param {Object} msg
	 */
	_send(msg) {
		window.electronAPI.sendPluginRpc(msg);
	}


	/**
	 * Start forwarding a plugin's broker events to live pages, once. Idempotent.
	 *
	 * @param {string} slug
	 */
	_ensureSubscribed(slug) {

		if (this._subscribed.has(slug))
			return;

		const toy = this.app.toyManager.getToyBySlug(slug);
		if (!toy || typeof toy.onBroker !== 'function')
			return;

		const unsubs = [];
		for (const name of ['command', 'chat', 'obs']) {
			unsubs.push(toy.onBroker(name, (detail) => {
				this._send({ type: 'plugin-rpc', kind: 'evt', slug, name, detail });
			}));
		}
		this._subscribed.set(slug, unsubs);
	}


	/**
	 * Handle an inbound relayed message from a live-page widget.
	 *
	 * @param {Object} msg
	 */
	async _handle(msg) {

		if (!msg || msg.type !== 'plugin-rpc')
			return;

		const toy = this.app.toyManager.getToyBySlug(msg.slug);

		if (msg.kind === 'hello') {
			this._ensureSubscribed(msg.slug);
			return;
		}

		if (msg.kind === 'ack') {
			if (toy && typeof toy.resolveCommandAck === 'function')
				toy.resolveCommandAck(msg.token, !!msg.ok, msg.reason);
			return;
		}

		if (msg.kind === 'req') {

			// make sure events flow even if no hello preceded this
			this._ensureSubscribed(msg.slug);

			let result;
			let error;
			try {
				if (!toy || typeof toy.request !== 'function')
					throw new Error(`plugin "${msg.slug}" not active`);
				result = await toy.request(msg.reqType, msg.payload);
			} catch (e) {
				error = e.message || String(e);
			}

			this._send({
				type: 'plugin-rpc',
				kind: 'res',
				slug: msg.slug,
				instanceId: msg.instanceId,
				reqId: msg.reqId,
				result,
				error,
			});
			return;
		}
	}
}
