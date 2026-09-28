/*
	pluginUserData.js
	-----------------

	Per-chatter, per-plugin saved data ("remember this player's high score").
	Backs the plugin SDK's CT.userData.* (permission 'userdata:store').

	One shared table for every plugin - no per-plugin columns or tables:

		plugin_user_data (plugin_id, user_id, data JSON, bytes, updated_at)

	Keyed by the plugin's permanent manifest `id` (not its slug), so a
	reinstall or slug change keeps the data. Uninstalling a plugin does NOT
	delete it (reinstalling brings scores back); the plugin's settings page
	has a "delete saved data" button that calls clear().

	The app never looks inside `data`: its shape belongs to the plugin (which
	should keep a version number in it if the shape may change).

	Limits (a plugin is someday third-party code):
	  - data must be a plain JSON object (top level), nested at most
	    MAX_DEPTH deep, finite numbers only, no binary
	  - MAX_BYTES_PER_USER per chatter per plugin (as UTF-8 JSON)
	  - MAX_BYTES_PER_PLUGIN across all of a plugin's chatters
	  - writes are rate limited per plugin (token bucket), then batched: they
	    land in memory immediately (reads see them) and are flushed to SQLite
	    in one transaction every FLUSH_MS, so a busy game can't stall the UI
	    with a disk commit per point scored
	Over a limit -> the call throws a clear error; nothing is truncated.

	Uses only prepare().run/get/all + exec, so it works with better-sqlite3
	(the app) and node:sqlite (the tests).
*/

const MAX_BYTES_PER_USER = 4 * 1024;
const MAX_BYTES_PER_PLUGIN = 10 * 1024 * 1024;
const MAX_DEPTH = 8;
const MAX_ID_LENGTH = 200;
const MAX_TOP_LIMIT = 100;
const FLUSH_MS = 500;

// token bucket: sustained writes/sec per plugin, and the burst allowed
const RATE_PER_SEC = 20;
const RATE_BURST = 200;

const LIMITS = Object.freeze({
	bytesPerUser: MAX_BYTES_PER_USER,
	bytesPerPlugin: MAX_BYTES_PER_PLUGIN,
	maxDepth: MAX_DEPTH,
	writesPerSecond: RATE_PER_SEC,
	writeBurst: RATE_BURST,
	topLimit: MAX_TOP_LIMIT,
});


/**
 * A user-facing error from this store (limits / bad input).
 */
class PluginUserDataError extends Error {}


/**
 * @param {*} v
 * @returns {boolean}
 */
function isPlainObject(v) {
	return !!v && typeof v === 'object' && !Array.isArray(v)
		&& (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}


/**
 * Throw unless `v` is JSON-safe: plain objects / arrays / strings / finite
 * numbers / booleans / null, nested at most MAX_DEPTH.
 *
 * @param {*} v
 * @param {number} depth
 * @param {string} where - path, for the error message
 */
function assertJsonSafe(v, depth, where) {
	if (depth > MAX_DEPTH)
		throw new PluginUserDataError(`userData: nested deeper than ${MAX_DEPTH} levels at ${where}`);
	if (v === null || typeof v === 'string' || typeof v === 'boolean')
		return;
	if (typeof v === 'number') {
		if (!Number.isFinite(v))
			throw new PluginUserDataError(`userData: ${where} is not a finite number`);
		return;
	}
	if (Array.isArray(v)) {
		v.forEach((x, i) => assertJsonSafe(x, depth + 1, `${where}[${i}]`));
		return;
	}
	if (isPlainObject(v)) {
		for (const k of Object.keys(v))
			assertJsonSafe(v[k], depth + 1, `${where}.${k}`);
		return;
	}
	throw new PluginUserDataError(`userData: ${where} is not JSON data (${typeof v})`);
}


/**
 * @param {*} id
 * @param {string} what
 * @returns {string}
 */
function checkId(id, what) {
	if (typeof id !== 'string' || !id || id.length > MAX_ID_LENGTH)
		throw new PluginUserDataError(`userData: bad ${what}`);
	return id;
}


class PluginUserDataStore {

	/**
	 * @param {Object} db - a better-sqlite3 / node:sqlite database
	 * @param {Object} [opts]
	 * @param {Function} [opts.now] - clock (ms), for tests
	 * @param {Function} [opts.setTimer] - (fn, ms) => handle, for tests
	 * @param {number} [opts.flushMs]
	 */
	constructor(db, opts = {}) {
		this.db = db;
		this.now = opts.now || (() => Date.now());
		this.setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
		this.flushMs = opts.flushMs ?? FLUSH_MS;

		this.ensureSchema();

		this._get = db.prepare('SELECT data FROM plugin_user_data WHERE plugin_id = ? AND user_id = ?');
		this._bytes = db.prepare('SELECT bytes FROM plugin_user_data WHERE plugin_id = ? AND user_id = ?');
		this._upsert = db.prepare(`
			INSERT INTO plugin_user_data (plugin_id, user_id, data, bytes, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(plugin_id, user_id) DO UPDATE SET
				data = excluded.data, bytes = excluded.bytes, updated_at = excluded.updated_at
		`);
		this._delete = db.prepare('DELETE FROM plugin_user_data WHERE plugin_id = ? AND user_id = ?');
		this._clear = db.prepare('DELETE FROM plugin_user_data WHERE plugin_id = ?');
		this._stats = db.prepare('SELECT COUNT(*) AS users, COALESCE(SUM(bytes), 0) AS bytes FROM plugin_user_data WHERE plugin_id = ?');

		// "<plugin>\n<user>" -> { pluginId, userId, json, bytes } | { deleted }
		this.pending = new Map();
		this.flushHandle = null;

		// pluginId -> total bytes on disk + pending (lazily loaded)
		this.totals = new Map();

		// pluginId -> { tokens, at }
		this.buckets = new Map();
	}


	ensureSchema() {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS plugin_user_data (
				plugin_id TEXT NOT NULL,
				user_id TEXT NOT NULL,
				data TEXT NOT NULL,
				bytes INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				PRIMARY KEY (plugin_id, user_id)
			)
		`);
	}


	// -----------------------------------------------------------------
	// reads
	// -----------------------------------------------------------------

	/**
	 * @param {string} pluginId
	 * @param {string} userId
	 * @returns {?Object} the saved object, or null
	 */
	get(pluginId, userId) {
		checkId(pluginId, 'plugin id');
		checkId(userId, 'user id');
		const p = this.pending.get(`${pluginId}\n${userId}`);
		if (p)
			return p.deleted ? null : JSON.parse(p.json);
		const row = this._get.get(pluginId, userId);
		return row ? JSON.parse(row.data) : null;
	}


	/**
	 * @param {string} pluginId
	 * @param {Array<string>} userIds - at most 500
	 * @returns {Object<string, ?Object>} userId -> data (null if none)
	 */
	getMany(pluginId, userIds) {
		if (!Array.isArray(userIds) || userIds.length > 500)
			throw new PluginUserDataError('userData.getMany: pass an array of at most 500 user ids');
		const out = {};
		for (const id of userIds)
			out[id] = this.get(pluginId, id);
		return out;
	}


	/**
	 * Leaderboard: chatters sorted by one numeric field of their data.
	 *
	 * @param {string} pluginId
	 * @param {string} field - top-level or dotted path, e.g. 'highScore' or 'stats.wins'
	 * @param {Object} [opts]
	 * @param {number} [opts.limit=10] - at most MAX_TOP_LIMIT
	 * @param {'desc'|'asc'} [opts.order='desc']
	 * @returns {Array<{userId: string, name: ?string, value: number, data: Object}>}
	 */
	top(pluginId, field, { limit = 10, order = 'desc' } = {}) {
		checkId(pluginId, 'plugin id');
		if (typeof field !== 'string' || !/^[A-Za-z0-9_]{1,64}(\.[A-Za-z0-9_]{1,64}){0,4}$/.test(field))
			throw new PluginUserDataError('userData.top: field must look like "score" or "stats.wins"');
		const n = Math.max(1, Math.min(MAX_TOP_LIMIT, Math.floor(Number(limit) || 10)));
		const dir = order === 'asc' ? 'ASC' : 'DESC';

		// make the leaderboard include writes that haven't hit the disk yet
		this.flush();

		const path = '$.' + field;
		const rows = this.db.prepare(`
			SELECT d.user_id AS userId, u.display_name AS name,
				json_extract(d.data, ?) AS value, d.data AS data
			FROM plugin_user_data d
			LEFT JOIN users u ON u.youtube_id = d.user_id
			WHERE d.plugin_id = ? AND typeof(json_extract(d.data, ?)) IN ('integer', 'real')
			ORDER BY value ${dir}, d.updated_at ASC
			LIMIT ?
		`).all(path, pluginId, path, n);

		return rows.map((r) => ({ userId: r.userId, name: r.name ?? null, value: r.value, data: JSON.parse(r.data) }));
	}


	/**
	 * @param {string} pluginId
	 * @returns {{users: number, bytes: number}}
	 */
	stats(pluginId) {
		checkId(pluginId, 'plugin id');
		this.flush();
		const r = this._stats.get(pluginId);
		return { users: Number(r.users) || 0, bytes: Number(r.bytes) || 0 };
	}


	// -----------------------------------------------------------------
	// writes
	// -----------------------------------------------------------------

	/**
	 * Replace a chatter's data.
	 *
	 * @param {string} pluginId
	 * @param {string} userId
	 * @param {Object} data - plain JSON object
	 * @returns {Object} the saved data (a copy)
	 */
	set(pluginId, userId, data) {
		checkId(pluginId, 'plugin id');
		checkId(userId, 'user id');
		if (!isPlainObject(data))
			throw new PluginUserDataError('userData.set: data must be a plain object, e.g. { highScore: 10 }');
		assertJsonSafe(data, 1, 'data');

		const json = JSON.stringify(data);
		const bytes = Buffer.byteLength(json, 'utf8');
		if (bytes > MAX_BYTES_PER_USER)
			throw new PluginUserDataError(`userData: ${bytes} bytes for one chatter is over the ${MAX_BYTES_PER_USER}-byte limit`);

		const prev = this._currentBytes(pluginId, userId);
		const total = this._total(pluginId) - prev + bytes;
		if (total > MAX_BYTES_PER_PLUGIN)
			throw new PluginUserDataError(`userData: this plugin's saved data would exceed ${MAX_BYTES_PER_PLUGIN} bytes`);

		this._spendToken(pluginId);

		this.totals.set(pluginId, total);
		this.pending.set(`${pluginId}\n${userId}`, { pluginId, userId, json, bytes });
		this._scheduleFlush();
		return JSON.parse(json);
	}


	/**
	 * Merge top-level fields into a chatter's data. A field set to null is
	 * removed.
	 *
	 * @param {string} pluginId
	 * @param {string} userId
	 * @param {Object} patch
	 * @returns {Object} the saved data
	 */
	update(pluginId, userId, patch) {
		if (!isPlainObject(patch))
			throw new PluginUserDataError('userData.update: patch must be a plain object');
		const next = { ...(this.get(pluginId, userId) || {}) };
		for (const k of Object.keys(patch)) {
			if (patch[k] === null) delete next[k];
			else next[k] = patch[k];
		}
		return this.set(pluginId, userId, next);
	}


	/**
	 * @param {string} pluginId
	 * @param {string} userId
	 * @returns {boolean} true if something was deleted
	 */
	remove(pluginId, userId) {
		checkId(pluginId, 'plugin id');
		checkId(userId, 'user id');
		const prev = this._currentBytes(pluginId, userId);
		if (!prev && !this.pending.has(`${pluginId}\n${userId}`) && !this._get.get(pluginId, userId))
			return false;
		this._spendToken(pluginId);
		this.totals.set(pluginId, Math.max(0, this._total(pluginId) - prev));
		this.pending.set(`${pluginId}\n${userId}`, { pluginId, userId, deleted: true });
		this._scheduleFlush();
		return true;
	}


	/**
	 * Delete everything a plugin saved (the settings page's button).
	 *
	 * @param {string} pluginId
	 * @returns {number} chatters removed
	 */
	clear(pluginId) {
		checkId(pluginId, 'plugin id');
		for (const k of Array.from(this.pending.keys()))
			if (k.startsWith(pluginId + '\n')) this.pending.delete(k);
		const r = this._clear.run(pluginId);
		this.totals.set(pluginId, 0);
		return Number(r.changes) || 0;
	}


	/**
	 * Write pending changes to SQLite now (one transaction).
	 */
	flush() {
		this.flushHandle = null;
		if (this.pending.size === 0)
			return;
		const batch = Array.from(this.pending.values());
		this.pending.clear();
		const at = this.now();
		this.db.exec('BEGIN');
		try {
			for (const p of batch) {
				if (p.deleted) this._delete.run(p.pluginId, p.userId);
				else this._upsert.run(p.pluginId, p.userId, p.json, p.bytes, at);
			}
			this.db.exec('COMMIT');
		} catch (e) {
			try { this.db.exec('ROLLBACK'); } catch (_) { /* noop */ }
			throw e;
		}
	}


	// -----------------------------------------------------------------
	// internals
	// -----------------------------------------------------------------

	_scheduleFlush() {
		if (this.flushHandle) return;
		this.flushHandle = this.setTimer(() => {
			try { this.flush(); }
			catch (e) { console.error('[pluginUserData] flush failed:', e); }
		}, this.flushMs);
	}

	_currentBytes(pluginId, userId) {
		const p = this.pending.get(`${pluginId}\n${userId}`);
		if (p) return p.deleted ? 0 : p.bytes;
		const row = this._bytes.get(pluginId, userId);
		return row ? Number(row.bytes) || 0 : 0;
	}

	_total(pluginId) {
		if (!this.totals.has(pluginId)) {
			const r = this._stats.get(pluginId);
			let total = Number(r.bytes) || 0;
			// account for pending writes not yet on disk
			for (const p of this.pending.values()) {
				if (p.pluginId !== pluginId) continue;
				const row = this._bytes.get(p.pluginId, p.userId);
				total += (p.deleted ? 0 : p.bytes) - (row ? Number(row.bytes) || 0 : 0);
			}
			this.totals.set(pluginId, total);
		}
		return this.totals.get(pluginId);
	}

	_spendToken(pluginId) {
		const now = this.now();
		const b = this.buckets.get(pluginId) || { tokens: RATE_BURST, at: now };
		b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.at) / 1000) * RATE_PER_SEC);
		b.at = now;
		if (b.tokens < 1) {
			this.buckets.set(pluginId, b);
			throw new PluginUserDataError(`userData: too many writes (limit ${RATE_PER_SEC}/s, bursts up to ${RATE_BURST}); batch them`);
		}
		b.tokens -= 1;
		this.buckets.set(pluginId, b);
	}
}


module.exports = { PluginUserDataStore, PluginUserDataError, LIMITS };
