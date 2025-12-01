// pfpCache.js
// Bounded cache for profile pictures using IndexedDB + in-memory map.

const DB_NAME = 'pfp-image-cache';
const STORE_NAME = 'pfp-images';
const DB_VERSION = 1;

// Hard cap for how many PFPs we store persistently
const MAX_PFP_ENTRIES = 500;

// In-memory map: key => { status, blobUrl }
const memory = new Map();
// Avoid scheduling cleanup too often
let cleanupScheduled = false;

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'key' });
			}
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function getEntry(key) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const req = store.get(key);

		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
	});
}

async function putEntry(entry) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.put(entry);

		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

async function touchEntry(entry) {
	entry.lastAccess = Date.now();
	entry.accessCount = (entry.accessCount || 0) + 1;

	try {
		await putEntry(entry);
	} catch (err) {
		console.error('[pfpCache] touchEntry error', err);
	}
}

async function cleanup() {
	try {
		const db = await openDB();
		await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			const req = store.getAll();

			req.onsuccess = () => {
				const entries = req.result || [];
				if (entries.length <= MAX_PFP_ENTRIES) {
					resolve();
					return;
				}

				// Sort by accessCount ASC, then lastAccess ASC (least-used & oldest first)
				entries.sort((a, b) => {
					const ac = (a.accessCount || 0) - (b.accessCount || 0);
					if (ac !== 0) return ac;
					const la = (a.lastAccess || 0) - (b.lastAccess || 0);
					return la;
				});

				const toDeleteCount = entries.length - MAX_PFP_ENTRIES;
				const toDelete = entries.slice(0, toDeleteCount);

				for (const entry of toDelete) {
					store.delete(entry.key);

					// Also clear from memory map and revoke blob URL if any
					const mem = memory.get(entry.key);
					if (mem && mem.blobUrl) {
						try {
							URL.revokeObjectURL(mem.blobUrl);
						} catch (_) {}
					}
					memory.delete(entry.key);
				}

				resolve();
			};

			req.onerror = () => reject(req.error);
		});
	} catch (err) {
		console.error('[pfpCache] cleanup error', err);
	}
}

function scheduleCleanup() {
	if (cleanupScheduled) return;
	cleanupScheduled = true;
	setTimeout(() => {
		cleanup()
			.catch(err => console.error('[pfpCache] cleanup scheduled error', err))
			.finally(() => {
				cleanupScheduled = false;
			});
	}, 1000);
}

async function fetchAndStore(key, url) {
	const mem = memory.get(key);
	if (mem && (mem.status === 'loading' || mem.status === 'ready')) {
		return;
	}

	memory.set(key, { status: 'loading', blobUrl: null });

	try {
		const res = await fetch(url, {
			referrer: 'no-referrer',
			referrerPolicy: 'no-referrer'
		});

		if (!res.ok) {
			throw new Error(`PFP fetch failed: ${res.status}`);
		}

		const blob = await res.blob();
		const entry = {
			key,
			blob,
			lastAccess: Date.now(),
			accessCount: 1
		};

		await putEntry(entry);

		const blobUrl = URL.createObjectURL(blob);
		memory.set(key, {
			status: 'ready',
			blobUrl
		});

		scheduleCleanup();
	} catch (err) {
		console.error('[pfpCache] fetchAndStore error', err);
		memory.set(key, {
			status: 'error',
			blobUrl: null
		});
	}
}

/**
 * Get a usable src for a PFP image.
 *
 * @param {string} url - Original image URL (e.g. YouTube avatar)
 * @param {Object} options
 * @param {boolean} options.cacheEnabled - Whether caching is enabled
 * @returns {Promise<{ src: string, fromCache: boolean }>}
 */
export async function getPfpSource(url, { cacheEnabled = true } = {}) {
	if (!url) {
		return { src: '', fromCache: false };
	}

	// If caching disabled, just use raw URL
	if (!cacheEnabled) {
		return { src: url, fromCache: false };
	}

	const key = url;

	// 1) In-memory hit
	const mem = memory.get(key);
	if (mem && mem.status === 'ready' && mem.blobUrl) {
		return {
			src: mem.blobUrl,
			fromCache: true
		};
	}

	// 2) IndexedDB hit
	try {
		const entry = await getEntry(key);
		if (entry && entry.blob) {
			const blobUrl = URL.createObjectURL(entry.blob);
			memory.set(key, {
				status: 'ready',
				blobUrl
			});

			// Update usage metadata in the background
			touchEntry(entry).catch(() => {});

			return {
				src: blobUrl,
				fromCache: true
			};
		}
	} catch (err) {
		console.error('[pfpCache] getEntry error', err);
	}

	// 3) Miss: use raw URL now, and fetch+store in background for next time
	fetchAndStore(key, url).catch(() => {});

	return {
		src: url,
		fromCache: false
	};
}
