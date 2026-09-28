/*
	StreamSession.js
	----------------

	Core system: keeps track of who chatted during the current stream, fully
	automatically, so features like the Credits plugin can show "everyone who
	showed up this stream". Exposed to plugins through the `session:read`
	permission (CT.session.*).

	All the boundary logic lives in StreamSessionTracker.js (pure + tested).
	This file just wires it to the app:

	  - chat:        ChatProcessor.onNewChats (registered BEFORE the command
	                 processor and toys, so a chatter's points baseline is read
	                 before anything awards them points for that message)
	  - live state:  whatever is available, never required:
	                   * obs-websocket (if the streamer connected it)
	                   * the `obsStatus` heartbeat every Chat Toys widget inside
	                     OBS writes about once a second (keepAliveSocket.js)
	                 YouTube live video ids come in on the chat messages.
	  - points:      window.ytctDB.getUsers (batched) for baselines / snapshots
	  - persistence: localStorage, debounced, so an app restart mid-stream
	                 keeps the list

	Only the primary (dashboard) window tracks; other windows get an inert
	instance that returns null snapshots.
*/

// vue
import { shallowRef, watch } from 'vue';
import { socketShallowRefReadOnly } from '@scripts/sockets';

// logic
import { StreamSessionTracker } from './StreamSessionTracker';

const LS_KEY = 'stream-session';

/** Re-evaluate live signals this often (also keeps a live session "active"). */
const TICK_MS = 5000;

/** The OBS heartbeat counts as a live signal only while this fresh. */
const HEARTBEAT_FRESH_MS = 5000;

/** Write the session to storage at most this often. */
const SAVE_DEBOUNCE_MS = 10 * 1000;

/** Max ids per SQLite IN (...) query. */
const POINTS_CHUNK = 500;


export class StreamSession {

	/**
	 * @param {import('./ChatToysApp').default} app
	 */
	constructor(app) {

		this.app = app;
		this.enabled = typeof window !== 'undefined' && !!window.isPrimaryWindow;

		/** Reactive summary for UI: { id, chatterCount, live } | null */
		this.summary = shallowRef(null);

		this._saveTimer = null;
		this._pendingSave = null;

		this.tracker = new StreamSessionTracker({
			load: () => this.enabled ? this._load() : null,
			save: (s) => this._scheduleSave(s),
			getPoints: (ids) => this._getPoints(ids),
			log: (line) => console.info(`[StreamSession] ${line}`),
		});

		if (!this.enabled)
			return;

		this.tracker.onChange((d) => { this.summary.value = d; });
		this.summary.value = this.tracker.session
			? { id: this.tracker.session.id, chatterCount: this.tracker.session.chatterCount, live: false }
			: null;

		// chat
		this._onChats = (msgs) => this.tracker.handleChats(msgs);
		app.chatProcessor.onNewChats(this._onChats);

		// live signals
		this._obsStatus = socketShallowRefReadOnly('obsStatus', '0:false');
		const obs = app.obsConnMgr;
		this._stopWatch = watch(
			[() => obs?.isConnected?.value, () => obs?.isStreaming?.value, this._obsStatus],
			() => this._evaluateLive()
		);

		const setIntervalFn = window.setElectronInterval || window.setInterval.bind(window);
		this._tick = setIntervalFn(() => this._evaluateLive(), TICK_MS);

		// don't lose the last few seconds on quit
		window.addEventListener('beforeunload', () => this._flushSave());
	}


	// ------------------------------------------------------------------
	// public API
	// ------------------------------------------------------------------

	/**
	 * @param {Object} [opts]
	 * @param {boolean} [opts.withPoints=false]
	 * @returns {?Object} see StreamSessionTracker.snapshot
	 */
	getSnapshot(opts) {
		return this.enabled ? this.tracker.snapshot(opts) : null;
	}


	/**
	 * @param {Function} fn - called with { id, chatterCount, live } on changes
	 * @returns {Function} unsubscribe
	 */
	onChange(fn) {
		return this.tracker.onChange(fn);
	}


	// ------------------------------------------------------------------
	// live signals
	// ------------------------------------------------------------------

	_evaluateLive() {

		const now = Date.now();
		const obs = this.app.obsConnMgr;

		const wsKnown = !!obs?.isConnected?.value;
		const wsLive = wsKnown && !!obs?.isStreaming?.value;

		// heartbeat format (keepAliveSocket.js): "<timestamp>:<true|false>"
		let hbKnown = false;
		let hbLive = false;
		const raw = String(this._obsStatus.value || '');
		const sep = raw.indexOf(':');
		if (sep > 0) {
			const ts = parseInt(raw.slice(0, sep), 10);
			if (ts && now - ts < HEARTBEAT_FRESH_MS) {
				hbKnown = true;
				hbLive = raw.slice(sep + 1) === 'true';
			}
		}

		this.tracker.updateLive({ known: wsKnown || hbKnown, live: wsLive || hbLive });
	}


	// ------------------------------------------------------------------
	// points
	// ------------------------------------------------------------------

	_getPoints(ids) {
		const db = window.ytctDB;
		if (!db || typeof db.getUsers !== 'function')
			return null;
		const out = {};
		for (let i = 0; i < ids.length; i += POINTS_CHUNK) {
			const rows = db.getUsers(ids.slice(i, i + POINTS_CHUNK)) || [];
			for (const r of rows)
				out[r.youtube_id] = r.points ?? 0;
		}
		return out;
	}


	// ------------------------------------------------------------------
	// persistence
	// ------------------------------------------------------------------

	_load() {
		try {
			const raw = localStorage.getItem(LS_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (_) {
			return null;
		}
	}

	_scheduleSave(session) {
		this._pendingSave = session;
		if (this._saveTimer)
			return;
		this._saveTimer = setTimeout(() => {
			this._saveTimer = null;
			this._flushSave();
		}, SAVE_DEBOUNCE_MS);
	}

	_flushSave() {
		if (!this._pendingSave)
			return;
		try { localStorage.setItem(LS_KEY, JSON.stringify(this._pendingSave)); }
		catch (e) { console.warn('[StreamSession] could not save session', e); }
		this._pendingSave = null;
	}
}
