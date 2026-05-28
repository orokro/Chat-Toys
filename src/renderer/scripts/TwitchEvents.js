/*
	TwitchEvents.js
	---------------

	Renderer-side event bus for Twitch events that arrive via Twurple's
	EventSub WebSocket listener (in the main process). The main process
	forwards each event over the `twurple-event` IPC channel via
	window.twurpleAPI.onEvent; this module receives them and dispatches
	to subscribed toys.

	Why a separate bus instead of toys subscribing to IPC directly:
	  1. Decouples toys from preload / IPC plumbing
	  2. Centralizes per-toy cleanup so we don't leak subscribers when
	     toys are disabled / re-enabled at runtime
	  3. Adds a hook point if/when we want to mock events for testing
	     (Phase 3's fake-redeem debug button injects directly here)

	Subscription model:
	  - on(type, cb, toySlug?) -> returns an unsubscribe function
	  - off(type, cb) -> explicit removal (when you didn't keep the unsub)
	  - removeAllByToy(slug) -> nuclear cleanup, called by Toy.end()
	  - emit(type, payload) -> primarily used internally + by the
	    fake-redeem debug button to inject test events

	Event types currently emitted (more land in Phase 5):
	  - 'redemption' : a Twitch channel point redeem fired
*/


/**
 * @typedef {Object} TwitchEventSubscription
 * @property {Function} cb       - the user-provided handler
 * @property {string}   [toySlug] - optional tag for bulk cleanup
 */


/**
 * Renderer-side Twitch event bus. Created by ChatToysApp.
 */
export class TwitchEvents {

	/**
	 * @param {import('./ChatToysApp').default} chatToysApp - parent app reference (for logging / future hooks)
	 */
	constructor(chatToysApp) {

		this.chatToysApp = chatToysApp;

		/**
		 * Map of event-type -> set of active subscriptions.
		 *
		 * @type {Map<string, Set<TwitchEventSubscription>>}
		 */
		this._subs = new Map();

		// Hook into the IPC bridge exposed by preload.js. If the bridge
		// isn't present (e.g. running outside Electron during a test),
		// we still work for in-process emit() - just no real events.
		if (typeof window !== 'undefined' && window.twurpleAPI?.onEvent) {
			window.twurpleAPI.onEvent((data) => {
				if (data?.type && data?.payload)
					this._dispatch(data.type, data.payload);
				else
					console.warn('[TwitchEvents] Got malformed twurple-event:', data);
			});
		} else {
			console.warn('[TwitchEvents] window.twurpleAPI.onEvent unavailable; bus running detached.');
		}
	}


	/* ====================================================================== */
	/*                          Subscription API                              */
	/* ====================================================================== */


	/**
	 * Subscribe to a Twitch event type.
	 *
	 * @param {string} type - event type (e.g. 'redemption')
	 * @param {Function} cb - handler called with the event payload
	 * @param {string} [toySlug] - optional toy slug for bulk teardown via removeAllByToy
	 * @returns {Function} unsubscribe function (call to detach this single handler)
	 */
	on(type, cb, toySlug = undefined) {

		if (typeof cb !== 'function') {
			console.warn('[TwitchEvents] on() called with non-function callback for', type);
			return () => {};
		}

		let set = this._subs.get(type);
		if (!set) {
			set = new Set();
			this._subs.set(type, set);
		}

		const sub = { cb, toySlug };
		set.add(sub);

		// Return a closure the caller can hold onto for fine-grained
		// cleanup. Idempotent - calling unsub() twice is safe.
		return () => {
			const s = this._subs.get(type);
			if (s) s.delete(sub);
		};
	}


	/**
	 * Remove a previously-registered handler by reference. Use this when
	 * you didn't capture the unsubscribe function returned by on().
	 *
	 * @param {string} type
	 * @param {Function} cb
	 */
	off(type, cb) {

		const set = this._subs.get(type);
		if (!set) return;

		for (const sub of set) {
			if (sub.cb === cb) {
				set.delete(sub);
				return;
			}
		}
	}


	/**
	 * Remove ALL subscriptions tagged with a given toySlug. Intended to
	 * be called from Toy.end() so toys can register multiple event
	 * handlers without having to track unsubscribe functions individually.
	 *
	 * @param {string} toySlug
	 * @returns {number} count of subscriptions removed
	 */
	removeAllByToy(toySlug) {

		if (!toySlug) return 0;

		let removed = 0;
		for (const set of this._subs.values()) {
			for (const sub of [...set]) {
				if (sub.toySlug === toySlug) {
					set.delete(sub);
					removed++;
				}
			}
		}
		return removed;
	}


	/**
	 * Emit an event manually. Primarily used by:
	 *   1. _dispatch() when an IPC event arrives from the main process
	 *   2. The Phase 3 fake-redeem debug button (injects 'redemption'
	 *      events directly here to test the downstream pipeline without
	 *      going through Twurple)
	 *
	 * @param {string} type
	 * @param {object} payload
	 */
	emit(type, payload) {
		this._dispatch(type, payload);
	}


	/* ====================================================================== */
	/*                             Internal                                   */
	/* ====================================================================== */


	/**
	 * Fan out an event to every subscriber. Each handler runs in a
	 * try/catch so one buggy toy can't break dispatch for the others.
	 *
	 * @param {string} type
	 * @param {object} payload
	 * @private
	 */
	_dispatch(type, payload) {

		const set = this._subs.get(type);
		if (!set || set.size === 0) {
			// Not necessarily a problem - many events fire even before
			// the relevant toy is enabled. Quiet by default.
			return;
		}

		for (const sub of set) {
			try {
				sub.cb(payload);
			} catch (err) {
				console.error(`[TwitchEvents] handler for '${type}' threw:`, err);
			}
		}
	}

}


export default TwitchEvents;
