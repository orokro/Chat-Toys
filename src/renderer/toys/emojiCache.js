// emojiCache.js
// Caches emojis in IndexedDB and serves blob URLs on later requests.

const DB_NAME = 'yt-emoji-cache';
const STORE_NAME = 'emojis';
const DB_VERSION = 1;

// In-memory map so we don't hammer IndexedDB or refetch
// key: original URL, value: { blobUrl?: string, status: 'idle'|'loading'|'ready'|'error' }
const memory = new Map();

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
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

// Fire-and-forget: fetch from YouTube and store in IndexedDB for future use
async function fetchAndStore(url) {
	let entry = memory.get(url);
	if (entry && (entry.status === 'loading' || entry.status === 'ready')) {
		return; // already doing it / done
	}

	entry = { status: 'loading', blobUrl: null };
	memory.set(url, entry);

	try {
		const res = await fetch(url, {
			referrer: 'no-referrer',
			referrerPolicy: 'no-referrer'
		});

		if (!res.ok) {
			throw new Error(`Emoji fetch failed: ${res.status}`);
		}

		const blob = await res.blob();
		await putBlob(url, blob);

		const blobUrl = URL.createObjectURL(blob);
		entry.status = 'ready';
		entry.blobUrl = blobUrl;
	} catch (err) {
		console.error('[emojiCache] fetchAndStore error', err);
		entry.status = 'error';
	}
}

// This is what the component will call
export async function getEmojiSource(url) {
	// 1. Check in-memory first
	const mem = memory.get(url);
	if (mem && mem.status === 'ready' && mem.blobUrl) {
		return {
			src: mem.blobUrl,
			fromCache: true
		};
	}

	// 2. Try IndexedDB (persisted cache)
	try {
		const blob = await getBlob(url);
		if (blob) {
			const blobUrl = URL.createObjectURL(blob);
			memory.set(url, {
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

	// 3. No cache yet: start background fetch for NEXT time,
	//    but for THIS render we return the raw URL so user sees something immediately.
	fetchAndStore(url).catch(err => {
		console.error('[emojiCache] background fetch error', err);
	});

	return {
		src: url,
		fromCache: false
	};
}
