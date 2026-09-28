// emojiCache.js
// Caches emojis in IndexedDB and serves blob URLs on later requests.
//
// Three-tier cache, cheapest first:
//   1. in-memory LRU pool of the most-recently-used emotes (holds the live
//      blob: URLs so repeat renders are instant);
//   2. IndexedDB on disk (under %appdata%/<app>/IndexedDB) - the DURABLE tier.
//      Everything ever fetched lives here, so an emote evicted from the memory
//      pool is re-served from disk WITHOUT touching the network;
//   3. the origin CDN - hit only when both caches miss, then stored to disk
//      immediately so we never fetch it again.
//
// The whole point is to touch YouTube / Twitch / BTTV / FFZ / 7TV as little as
// possible (rate limits, and 404s showing as broken images). The memory tier
// is therefore a bounded POOL, not the source of truth: it caps how much we
// hold resident and revokes evicted blob: URLs so memory can't climb forever
// (this was the leak behind the RADAR_PRE_LEAK_64 / OOM crash on emote-heavy
// chat), while the disk tier guarantees an eviction never costs a refetch.

const DB_NAME = 'yt-emoji-cache';
const STORE_NAME = 'emojis';
const DB_VERSION = 1;

// How many emotes to hold RESIDENT in memory (each pins one blob: URL / decoded
// image). This is a pool cap, not a total cap - evicted emotes stay on disk and
// re-serve for free. A busy stream's working set of distinct emotes sits well
// under this, so evictions are rare and, when they happen, cost only a fast
// local IndexedDB read on the emote's next appearance.
const MAX_MEMORY_ENTRIES = 500;

// After a fetch fails (a 404, or a CORS block when a widget is opened in a
// plain browser tab without the emote proxy), don't re-hit the same URL on
// every later appearance - wait at least this long before trying again.
const ERROR_COOLDOWN_MS = 5 * 60 * 1000;

// In-memory LRU. Map iteration order is insertion order, so we emulate LRU by
// deleting + re-inserting a key on access (moves it to the "newest" end) and
// evicting from the "oldest" front when over cap.
// key: original URL, value: { blobUrl?: string, status: 'loading'|'ready'|'error' }
const memory = new Map();


/**
 * Revoke a memory entry's blob: URL (if it holds one), so the underlying Blob
 * can be garbage-collected. Safe to call on any entry shape.
 *
 * @param {Object} entry
 */
function revokeEntry(entry) {
	if (entry && entry.blobUrl) {
		try {
			URL.revokeObjectURL(entry.blobUrl);
		} catch (_) { /* already revoked / invalid - ignore */ }
	}
}


/**
 * Mark a key as most-recently-used by moving it to the end of the Map, and
 * evict the least-recently-used entries (revoking their blob: URLs) until the
 * pool is back within MAX_MEMORY_ENTRIES. The disk (IndexedDB) copy is left
 * intact, so an evicted emote is re-served from disk on its next use.
 *
 * @param {String} key
 * @param {Object} entry
 */
function memorySet(key, entry) {

	// re-insert at the newest end
	if (memory.has(key))
		memory.delete(key);
	memory.set(key, entry);

	// evict oldest until within cap
	while (memory.size > MAX_MEMORY_ENTRIES) {

		// oldest key is the first one Map yields
		const oldestKey = memory.keys().next().value;
		if (oldestKey === undefined)
			break;

		// never evict the entry we just touched (guards a cap of ~0)
		if (oldestKey === key)
			break;

		const victim = memory.get(oldestKey);
		revokeEntry(victim);
		memory.delete(oldestKey);
	}
}


// Single shared IndexedDB connection, opened once and reused. Opening a fresh
// connection per get/put (the old behavior) leaked connections - they were
// never closed - which on a long stream added up alongside the blob leak.
let dbPromise = null;

function openDB() {

	if (dbPromise)
		return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};

		req.onsuccess = () => {
			const db = req.result;

			// if the connection is ever closed / lost, drop the cached promise
			// so the next call transparently reopens it.
			db.onclose = () => { dbPromise = null; };
			db.onerror = (e) => { console.error('[emojiCache] db error', e); };

			resolve(db);
		};

		req.onerror = () => {
			dbPromise = null; // allow a retry on the next call
			reject(req.error);
		};
	});

	return dbPromise;
}

async function getBlob(key) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const req = store.get(key);

		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

async function putBlob(key, blob) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.put(blob, key);

		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

// Fire-and-forget: fetch from the origin CDN and store in IndexedDB for future
// use. Only reached when both the memory pool and disk cache missed.
async function fetchAndStore(url) {
	const existing = memory.get(url);
	if (existing) {
		if (existing.status === 'loading' || existing.status === 'ready')
			return; // already doing it / done
		// recently failed - back off instead of re-hitting the URL every time
		if (existing.status === 'error' && (Date.now() - (existing.erroredAt || 0)) < ERROR_COOLDOWN_MS)
			return;
	}

	memorySet(url, { status: 'loading', blobUrl: null });

	try {
		const res = await fetch(url, {
			referrer: 'no-referrer',
			referrerPolicy: 'no-referrer'
		});

		if (!res.ok) {
			throw new Error(`Emoji fetch failed: ${res.status}`);
		}

		const blob = await res.blob();

		// Guard against caching non-image responses (e.g. an HTML error page or
		// SPA fallback served with a 200). Storing those would poison the cache
		// and make later texture loads fail to decode.
		if (!blob.type || !blob.type.startsWith('image/')) {
			throw new Error(`Emoji fetch returned non-image (${blob.type || 'unknown type'})`);
		}

		await putBlob(url, blob);

		const blobUrl = URL.createObjectURL(blob);
		memorySet(url, { status: 'ready', blobUrl });

	} catch (err) {
		console.error('[emojiCache] fetchAndStore error', err);
		memorySet(url, { status: 'error', blobUrl: null, erroredAt: Date.now() });
	}
}

// This is what the component will call
export async function getEmojiSource(url) {

	// 1. Check in-memory first (and mark it most-recently-used)
	const mem = memory.get(url);
	if (mem && mem.status === 'ready' && mem.blobUrl) {
		memorySet(url, mem); // touch -> newest
		return {
			src: mem.blobUrl,
			fromCache: true
		};
	}

	// 2. Try IndexedDB (persisted disk cache). Ignore (and let it be
	//    overwritten) any cached blob that isn't an image - this self-heals
	//    entries poisoned by an earlier non-image response (e.g. an HTML
	//    fallback). A hit here mints a fresh blob: URL and pools it; no
	//    network is touched.
	try {
		const blob = await getBlob(url);
		if (blob && typeof blob.type === 'string' && blob.type.startsWith('image/')) {
			const blobUrl = URL.createObjectURL(blob);
			memorySet(url, {
				status: 'ready',
				blobUrl
			});
			return {
				src: blobUrl,
				fromCache: true
			};
		}
	} catch (err) {
		console.error('[emojiCache] getBlob error', err);
		// fallthrough to raw URL
	}

	// 3. No cache yet: start background fetch for NEXT time, but for THIS
	//    render return the raw URL so the user sees something immediately.
	fetchAndStore(url).catch(err => {
		console.error('[emojiCache] background fetch error', err);
	});

	return {
		src: url,
		fromCache: false
	};
}
