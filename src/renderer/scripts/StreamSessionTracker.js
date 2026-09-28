/*
	StreamSessionTracker.js
	-----------------------

	Pure logic for "who chatted during THIS stream". No Vue, no sockets, no
	window - everything external (clock, storage, points lookups) is injected,
	so it can be unit-tested in Node. StreamSession.js wires it into the app.

	The hard part is deciding where one stream ends and the next begins, fully
	automatically, when no single signal can be relied on:

	  - OBS live state is only known if the streamer connected obs-websocket, or
	    has at least one Chat Toys widget loaded in OBS (the obsStatus heartbeat).
	  - YouTube chat messages carry the live video id; Twitch ones don't.
	  - Some streamers have none of the above.

	So we use every signal that happens to be available and never CLEAR data
	eagerly. A session simply keeps accumulating until something proves a NEW
	stream has started; only then is it replaced. That means the credits always
	have the most recent stream's list, even hours after it ended.

	A new session starts when activity arrives and any of these is true:

	  1. there is no session yet;
	  2. idle gap: nothing (no chat, no live signal) for IDLE_GAP_MS;
	  3. went live: the stream goes live after the session had already been
	     live and then offline for longer than LIVE_GRACE_MS (a crash/restart
	     shorter than that is the same stream);
	  4. YouTube stream changed: chat arrives with a new live video id while
	     every id already in the session has been quiet for LIVE_GRACE_MS.

	Pre-stream "waiting room" chat counts toward the upcoming stream: a session
	that has never been live simply adopts the stream when it goes live, and when
	rule 3 replaces a session, chatters who talked in the minutes right before
	going live are carried over into the new one.
*/

/** An offline stretch shorter than this is the same stream (crash / restart). */
export const LIVE_GRACE_MS = 20 * 60 * 1000;

/** No chat and no live signal for this long means the next activity is a new stream. */
export const IDLE_GAP_MS = 3 * 60 * 60 * 1000;

/** Hard cap on chatters tracked per session (keeps storage + credits sane). */
export const MAX_CHATTERS = 5000;

/** Chat within this long after going offline is treated as old-stream stragglers. */
const STRAGGLER_MS = 2 * 60 * 1000;


/**
 * Stable per-platform identity for a chat message's author.
 *
 * @param {Object} msg - formatted chat message (ChatProcessor shape)
 * @returns {?{ key:string, id:string, platform:string }}
 */
export function chatterIdentity(msg) {
	if (!msg || msg.syslogger)
		return null;
	const id = msg.authorUniqueID;
	if (id === undefined || id === null || id === '')
		return null;
	const platform = msg.youtube ? 'youtube' : (msg.twitch ? 'twitch' : 'other');
	return { key: `${platform}:${id}`, id: String(id), platform };
}


export class StreamSessionTracker {

	/**
	 * @param {Object} [deps]
	 * @param {Function} [deps.now] - () => ms timestamp
	 * @param {Function} [deps.load] - () => persisted session object | null
	 * @param {Function} [deps.save] - (session) => void
	 * @param {Function} [deps.getPoints] - (ids:string[]) => { [id]: points } (current balances)
	 * @param {Function} [deps.log] - (text) => void
	 */
	constructor(deps = {}) {
		this.now = deps.now || (() => Date.now());
		this._save = deps.save || (() => {});
		this.getPoints = deps.getPoints || null;
		this.log = deps.log || (() => {});

		this.listeners = new Set();

		// live-signal bookkeeping (not persisted: re-derived from signals)
		this.liveKnown = false;
		this.live = false;

		this.session = null;
		try {
			const loaded = deps.load ? deps.load() : null;
			if (loaded && loaded.id && loaded.chatters)
				this.session = loaded;
		} catch (_) { /* corrupt storage -> start fresh on next activity */ }

		// a restored session can't be "currently live" until a signal says so
		if (this.session)
			this.session.liveSince = null;
	}


	// ------------------------------------------------------------------
	// inputs
	// ------------------------------------------------------------------

	/**
	 * Feed a batch of formatted chat messages.
	 *
	 * @param {Array<Object>} messages
	 */
	handleChats(messages) {

		const now = this.now();
		let changed = false;

		for (const msg of messages || []) {

			const who = chatterIdentity(msg);
			if (!who)
				continue;

			this._beforeActivity(now, msg.youtube ? msg.streamID : null);
			const s = this.session;
			s.lastActivityAt = now;

			if (msg.youtube && typeof msg.streamID === 'string' && msg.streamID)
				s.youtube[msg.streamID] = now;

			let c = s.chatters[who.key];
			if (!c) {
				if (s.chatterCount >= MAX_CHATTERS) {
					s.droppedChatters = (s.droppedChatters || 0) + 1;
					continue;
				}
				c = {
					key: who.key,
					id: who.id,
					platform: who.platform,
					name: msg.author || who.id,
					avatar: msg.authorPFPUrl || null,
					isMember: !!msg.isMember,
					firstSeen: now,
					lastSeen: now,
					messages: 0,
					pointsBaseline: this._baselineFor(who.id),
				};
				s.chatters[who.key] = c;
				s.chatterCount++;
				changed = true;
			}

			c.messages++;
			c.lastSeen = now;
			if (msg.author) c.name = msg.author;
			if (msg.authorPFPUrl) c.avatar = msg.authorPFPUrl;
			if (msg.isMember && !c.isMember) {
				c.isMember = true;
				changed = true;
			}
		}

		this._persist();
		if (changed)
			this._notify();
	}


	/**
	 * Report the combined live state from whatever signals are available.
	 * Call whenever a signal changes, and periodically (tick) while live.
	 *
	 * @param {Object} state
	 * @param {boolean} state.known - at least one live signal is available
	 * @param {boolean} state.live - some available signal says we're streaming
	 */
	updateLive({ known, live }) {

		const now = this.now();
		const wasLive = this.live;
		this.liveKnown = !!known;
		this.live = !!(known && live);

		if (this.live) {

			// rising edge: maybe a new stream
			if (!wasLive)
				this._beforeLiveEdge(now);

			const s = this.session;
			if (s.liveSince === null)
				s.liveSince = now;
			s.everLive = true;
			s.lastLiveAt = now;
			s.lastActivityAt = now;
			this._persist();
			if (!wasLive)
				this._notify();
			return;
		}

		// not live (known offline, or signal lost): note it, keep the data.
		// We were live right up to this moment (don't rely on tick frequency -
		// a hidden window's timers can be throttled).
		if (this.session && wasLive)
			this.session.lastLiveAt = now;
		if (this.session && this.session.liveSince !== null) {
			this.session.liveSince = null;
			this._persist();
			this._notify();
		}
	}


	// ------------------------------------------------------------------
	// boundary rules
	// ------------------------------------------------------------------

	_beforeActivity(now, youtubeId) {

		const s = this.session;
		if (!s) {
			this._startNew(now, 'first-activity');
			return;
		}

		if (now - s.lastActivityAt > IDLE_GAP_MS) {
			this._startNew(now, 'idle-gap');
			return;
		}

		if (youtubeId && !(youtubeId in s.youtube)) {
			const ids = Object.keys(s.youtube);
			if (ids.length > 0) {
				const newest = Math.max(...ids.map((k) => s.youtube[k]));
				if (now - newest > LIVE_GRACE_MS)
					this._startNew(now, 'youtube-stream-changed');
			}
		}
	}


	_beforeLiveEdge(now) {

		const s = this.session;
		if (!s) {
			this._startNew(now, 'went-live');
			return;
		}

		if (now - s.lastActivityAt > IDLE_GAP_MS) {
			this._startNew(now, 'went-live-after-idle');
			return;
		}

		// a session that has never been live (pre-stream chat) adopts the stream
		if (!s.everLive)
			return;

		// same stream if we were only offline briefly
		const offlineFor = now - (s.lastLiveAt || 0);
		if (offlineFor <= LIVE_GRACE_MS)
			return;

		// new stream: carry over the waiting-room chatters (talked in the
		// window right before going live, and not just old-stream stragglers)
		const carryFrom = Math.max(now - LIVE_GRACE_MS, (s.lastLiveAt || 0) + STRAGGLER_MS);
		const carried = Object.values(s.chatters).filter((c) => c.lastSeen >= carryFrom);
		this._startNew(now, 'went-live', carried);
	}


	_startNew(now, reason, carried = []) {
		const prev = this.session;
		this.session = {
			id: `ses_${now.toString(36)}`,
			startedAt: now,
			reason,
			lastActivityAt: now,
			everLive: false,
			liveSince: null,
			lastLiveAt: null,
			youtube: {},
			chatters: {},
			chatterCount: 0,
			droppedChatters: 0,
		};
		for (const c of carried) {
			this.session.chatters[c.key] = { ...c };
			this.session.chatterCount++;
		}
		// replaced mid-stream (e.g. YouTube stream switch): we're live already
		if (this.live) {
			this.session.everLive = true;
			this.session.liveSince = now;
			this.session.lastLiveAt = now;
		}
		this.log(`new stream session (${reason})` + (prev ? `, replacing one with ${prev.chatterCount} chatters` : '') + (carried.length ? `, carried ${carried.length} waiting-room chatters` : ''));
		this._notify();
	}


	_baselineFor(id) {
		if (!this.getPoints)
			return null;
		try {
			const pts = this.getPoints([id]);
			return (pts && typeof pts[id] === 'number') ? pts[id] : 0;
		} catch (_) {
			return null;
		}
	}


	// ------------------------------------------------------------------
	// outputs
	// ------------------------------------------------------------------

	/**
	 * Snapshot of the current session for display.
	 *
	 * @param {Object} [opts]
	 * @param {boolean} [opts.withPoints=false] - include current points + points gained this stream
	 * @returns {?Object}
	 */
	snapshot({ withPoints = false } = {}) {

		const s = this.session;
		if (!s)
			return null;

		const list = Object.values(s.chatters).sort((a, b) => a.firstSeen - b.firstSeen);

		let points = null;
		if (withPoints && this.getPoints && list.length) {
			try { points = this.getPoints(list.map((c) => c.id)) || {}; }
			catch (_) { points = null; }
		}

		return {
			id: s.id,
			startedAt: s.startedAt,
			lastActivityAt: s.lastActivityAt,
			live: this.live,
			liveKnown: this.liveKnown,
			everLive: !!s.everLive,
			chatterCount: s.chatterCount,
			chatters: list.map((c) => {
				const out = {
					id: c.id,
					name: c.name,
					platform: c.platform,
					avatar: c.avatar,
					isMember: !!c.isMember,
					messages: c.messages,
					firstSeen: c.firstSeen,
				};
				if (points) {
					const cur = typeof points[c.id] === 'number' ? points[c.id] : 0;
					out.points = cur;
					out.pointsThisStream = (typeof c.pointsBaseline === 'number') ? cur - c.pointsBaseline : null;
				}
				return out;
			}),
		};
	}


	/**
	 * @param {Function} fn - called with { id, chatterCount, live } on changes
	 * @returns {Function} unsubscribe
	 */
	onChange(fn) {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}


	_notify() {
		const s = this.session;
		const detail = s ? { id: s.id, chatterCount: s.chatterCount, live: this.live } : null;
		for (const fn of this.listeners) {
			try { fn(detail); } catch (e) { /* listener errors never break tracking */ }
		}
	}


	_persist() {
		try { this._save(this.session); } catch (_) { /* storage full etc. */ }
	}
}
