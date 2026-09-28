/*
	patch-deps.js
	-------------

	Postinstall patcher: walks node_modules under known-affected scopes
	and rewrites the new ECMAScript import-attributes syntax
	(`import ... with { type: 'json' }`) into the older `assert { type:
	'json' }` form, which the older esbuild bundled inside Vite 4.5
	(0.18.x) can parse.

	Why this exists: vuefinder@4.x depends on a constellation of @uppy/*
	packages, several of which use the newer `with` syntax. Vite 4.5
	chokes during dependency pre-bundling because its internal esbuild
	predates that syntax. We attempted a package.json `overrides` block
	to force a newer esbuild into Vite's nested copy; npm didn't honor
	it. Patching the source files at install time is the durable fix
	and survives `npm ci` / `npm install` because it runs in postinstall.

	The `assert { type: 'json' }` form is semantically identical for
	our purposes and is supported by esbuild 0.17+.

	Idempotent - already-patched files contain `assert` and the regex
	doesn't match.

	Scope: we walk node_modules/@uppy/* and node_modules/vuefinder/.
	If a future dep brings the same issue we can add it to ROOTS below.
*/

const fs   = require('fs');
const path = require('path');

// Vuefinder is patched at the source level (the move/copy validator's
// over-eager parent-check clause). The patch is regex-pinned to the
// minified output of 4.1.2 - other versions could parse differently
// and the patch may either no-op or do the wrong thing. We pin the
// package version in package.json (no caret) AND verify at patch time
// so a surprise upgrade screams instead of silently breaking moves.
const EXPECTED_VUEFINDER_VERSION = '4.1.2';
try {
	const installedVuefinder = require(path.join(__dirname, '..', 'node_modules', 'vuefinder', 'package.json'));
	if (installedVuefinder.version !== EXPECTED_VUEFINDER_VERSION) {
		console.warn(`\n[patch-deps] !!! vuefinder version mismatch !!!`);
		console.warn(`  expected: ${EXPECTED_VUEFINDER_VERSION}`);
		console.warn(`  found:    ${installedVuefinder.version}`);
		console.warn(`  The bundled regex patch is tuned to ${EXPECTED_VUEFINDER_VERSION}'s minified output.`);
		console.warn(`  It may no-op silently against other versions, leaving the validator broken.`);
		console.warn(`  Either pin back to ${EXPECTED_VUEFINDER_VERSION} or re-derive the patch pattern.\n`);
	}
} catch (e) {
	// vuefinder not installed - npm install hasn't completed yet, skip
}

// Directories to scan for the offending syntax. We deliberately keep
// this narrow (not the whole node_modules tree) to keep the postinstall
// step fast and to make it obvious which deps are being touched.
const ROOTS = [
	'node_modules/@uppy',
	'node_modules/vuefinder',
];

// Recognize:
//   `with { type: 'json' }`
//   `with { type: "json" }`
//   any whitespace mix
const PATTERN = /\bwith\s*\{\s*type\s*:\s*(['"])json\1\s*\}/g;
const REPLACEMENT = `assert { type: "json" }`;

// vuefinder 4.x ships a Move/Copy modal whose destination validator
// has an over-eager "parent" check that blocks the perfectly valid
// case of moving a file UP to its containing directory's parent.
// The validation appears in two adjacent computeds (g and f) in the
// modal setup() function, each with a slightly different minified
// iterator var name (E in one, T in the other), e.g.:
//
//   S ? a.value.some((E) => !!(S.path === E.path || E.path.startsWith(S.path + "/") || E.type === "dir" && S.path.startsWith(E.path + "/"))) : !0
//   S ? a.value.find((T) => T.path === S.path ...)
//
// Three clauses inside each:
//   1. source === destination               (correct - self)
//   2. source starts with destination + "/" (BROKEN - blocks every "move up")
//   3. dest descends from source folder     (correct - loop)
//
// We strip clause 2 from both. Capture groups:
//   $1 = the destination variable name (S in the minified code)
//   $2 = the iterator variable name (E or T depending on the closure)
// Clause structure (note who's calling .startsWith on what):
//   1. S.path === E.path                            (self)
//   2. E.path.startsWith(S.path + "/")              ← BROKEN; remove
//   3. E.type === "dir" && S.path.startsWith(E.path + "/") (loop)
const VUEFINDER_GUARD_PATTERN = /(\w+)\.path === (\w+)\.path \|\| \2\.path\.startsWith\(\1\.path \+ "\/"\) \|\| \2\.type === "dir" && \1\.path\.startsWith\(\2\.path \+ "\/"\)/g;
const VUEFINDER_GUARD_REPLACEMENT = '$1.path === $2.path || $2.type === "dir" && $1.path.startsWith($2.path + "/")';

// File extensions worth scanning. We avoid .json / .ts / .map etc.
const EXTS = new Set(['.js', '.mjs', '.cjs']);


/**
 * Recursively walk a directory yielding every file path matching EXTS.
 * Skips nested node_modules to keep scope bounded.
 *
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch (e) {
		return; // missing dir is fine
	}
	for (const ent of entries) {
		if (ent.name === 'node_modules') continue;
		const full = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			yield* walk(full);
		} else if (ent.isFile() && EXTS.has(path.extname(ent.name))) {
			yield full;
		}
	}
}


let scanned = 0;
let patched = 0;

for (const rootRel of ROOTS) {
	const root = path.resolve(__dirname, '..', rootRel);
	if (!fs.existsSync(root)) continue;

	for (const file of walk(root)) {
		scanned++;

		let src;
		try {
			src = fs.readFileSync(file, 'utf8');
		} catch (e) {
			continue;
		}

		let next = src;
		let touched = false;

		// 1) @uppy: import-attributes -> assert-attributes
		if (next.includes('with')) {
			PATTERN.lastIndex = 0;
			if (PATTERN.test(next)) {
				PATTERN.lastIndex = 0;
				const after = next.replace(PATTERN, REPLACEMENT);
				if (after !== next) { next = after; touched = true; }
			}
		}

		// 2) vuefinder: strip the over-eager "source is child of dest"
		// clause from the Move/Copy modal validator.
		VUEFINDER_GUARD_PATTERN.lastIndex = 0;
		if (VUEFINDER_GUARD_PATTERN.test(next)) {
			VUEFINDER_GUARD_PATTERN.lastIndex = 0;
			const after = next.replace(VUEFINDER_GUARD_PATTERN, VUEFINDER_GUARD_REPLACEMENT);
			if (after !== next) { next = after; touched = true; }
		}

		if (touched) {
			fs.writeFileSync(file, next, 'utf8');
			patched++;
			const rel = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
			console.log(`[patch-deps] patched ${rel}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Targeted source patches for two first-party libs whose fixes must survive
// `npm install`. Each is idempotent (guarded by a marker that exists only in
// the patched output) and each from-block matches the pinned upstream source
// exactly, so a surprise version bump warns loudly instead of silently
// dropping the fix.
// ---------------------------------------------------------------------------

/**
 * Apply ordered [from,to] string replacements to a file, only if `marker` is
 * absent. Warns (does not throw) if a from-block is missing.
 *
 * @param {string} relFile
 * @param {string} marker
 * @param {Array<[string,string]>} pairs
 */
function applyBlockPatches(relFile, marker, pairs) {
	const abs = path.resolve(__dirname, '..', relFile);
	let src;
	try {
		src = fs.readFileSync(abs, 'utf8');
	} catch (e) {
		console.warn(`[patch-deps] ${relFile} not found - skipping`);
		return;
	}
	if (src.includes(marker)) return; // already patched
	let next = src;
	for (const [from, to] of pairs) {
		if (!next.includes(from)) {
			console.warn(`[patch-deps] !!! ${relFile}: expected block not found; fix NOT applied. Re-derive the patch.`);
			return;
		}
		next = next.replace(from, to);
	}
	if (next !== src) {
		fs.writeFileSync(abs, next, 'utf8');
		patched++;
		console.log(`[patch-deps] patched ${relFile}`);
	}
}

// electron-interval-system: guard webContents.send against destroyed
// renderers + auto-clear intervals/timeouts on 'destroyed'.
applyBlockPatches('node_modules/electron-interval-system/main.js', 'isDestroyed', [
		["\t\tconst interval = setInterval(() => {\n\t\t\twebContents.send('eis:tick', uuid);\n\t\t}, rate);\n\n\t\t// save the interval in the registry with the specified uuid so we can clear via uuid, later\n\t\tintervalRegistry.set(uuid, interval);\n",
		 "\t\tconst interval = setInterval(() => {\n\t\t\t// the renderer that requested this interval may have been destroyed\n\t\t\t// (window closed, OBS source reloaded, navigation) without clearing it;\n\t\t\t// sending to a dead webContents throws \"Object has been destroyed\".\n\t\t\t// Guard, and self-clear so a stray interval can't leak or spam errors.\n\t\t\tif (webContents.isDestroyed()) {\n\t\t\t\tclearInterval(interval);\n\t\t\t\tintervalRegistry.delete(uuid);\n\t\t\t\treturn;\n\t\t\t}\n\t\t\twebContents.send('eis:tick', uuid);\n\t\t}, rate);\n\n\t\t// save the interval in the registry with the specified uuid so we can clear via uuid, later\n\t\tintervalRegistry.set(uuid, interval);\n\n\t\t// also clear automatically the moment the webContents is gone\n\t\twebContents.once('destroyed', () => {\n\t\t\tclearInterval(interval);\n\t\t\tintervalRegistry.delete(uuid);\n\t\t});\n"],
		["\t\tconst timeOut = setTimeout(() => {\n\n\t\t\t// set the timeout to send a message to the renderer process\n\t\t\twebContents.send('eis:timeout', uuid);\n\n\t\t\t// clear the timeout and remove it from the registry\n\t\t\ttimeOutRegistry.delete(uuid);\n\t\t\tclearTimeout(timeOut);\n\n\t\t}, length);\n\n\t\t// save the timeOut in the registry with the specified uuid so we can clear via uuid, later\n\t\ttimeOutRegistry.set(uuid, timeOut);\n",
		 "\t\tconst timeOut = setTimeout(() => {\n\n\t\t\t// guard: the requesting renderer may be gone by the time this fires\n\t\t\tif (!webContents.isDestroyed())\n\t\t\t\twebContents.send('eis:timeout', uuid);\n\n\t\t\t// clear the timeout and remove it from the registry\n\t\t\ttimeOutRegistry.delete(uuid);\n\t\t\tclearTimeout(timeOut);\n\n\t\t}, length);\n\n\t\t// save the timeOut in the registry with the specified uuid so we can clear via uuid, later\n\t\ttimeOutRegistry.set(uuid, timeOut);\n\n\t\t// clear automatically if the webContents is destroyed before it fires\n\t\twebContents.once('destroyed', () => {\n\t\t\tclearTimeout(timeOut);\n\t\t\ttimeOutRegistry.delete(uuid);\n\t\t});\n"],
]);

// socket-ref: backpressure/coalesce in the server broadcast so a slow client
// can't build an unbounded send-buffer backlog (gradual chat-lag fix).
applyBlockPatches('node_modules/socket-ref/socketRefServer.js', 'BACKPRESSURE_BYTES', [
		["\tconst keyStateMap = new Map(); // key => { value, timestamp }\n",
		 "\tconst keyStateMap = new Map(); // key => { value, timestamp }\n\n\t// Backpressure: if a client's WebSocket send buffer exceeds this many\n\t// bytes, stop piling on full-value updates and instead coalesce to the\n\t// LATEST value per key, flushing once the buffer drains. socket-ref values\n\t// are latest-state, so dropping superseded intermediates is lossless - and\n\t// this is what stops a slow client (e.g. a busy OBS scene) from building an\n\t// unbounded server-side backlog that surfaces as gradual chat lag.\n\tconst BACKPRESSURE_BYTES = 1 << 20; // 1 MB\n\tconst PENDING_FLUSH_MS = 50;\n"],
		["\tfunction broadcast(key, value, timestamp, excludeSocket = null) {\n\n\t\tconst message = JSON.stringify({ key, value, timestamp });\n\t\tfor (const client of wss.clients) {\n\t\t\tif (client !== excludeSocket && client.readyState === client.OPEN) {\n\t\t\t\tclient.send(message);\n\t\t\t}\n\t\t}// next client\n\t}\n",
		 "\tfunction sendOrQueue(client, key, message) {\n\n\t\t// buffer backed up? coalesce - remember only the LATEST message for\n\t\t// this key and let the drain pump flush it later.\n\t\tif (client.bufferedAmount > BACKPRESSURE_BYTES) {\n\t\t\tif (!client._srPending) client._srPending = new Map();\n\t\t\tclient._srPending.set(key, message);\n\t\t\treturn;\n\t\t}\n\n\t\t// healthy: send now, and drop any now-stale pending value for this key\n\t\tif (client._srPending) client._srPending.delete(key);\n\t\ttry { client.send(message); } catch (e) { /* client going away */ }\n\t}\n\n\tfunction broadcast(key, value, timestamp, excludeSocket = null) {\n\n\t\tconst message = JSON.stringify({ key, value, timestamp });\n\t\tfor (const client of wss.clients) {\n\t\t\tif (client !== excludeSocket && client.readyState === client.OPEN) {\n\t\t\t\tsendOrQueue(client, key, message);\n\t\t\t}\n\t\t}// next client\n\t}\n\n\t// Drain pump: periodically flush each client's coalesced pending updates\n\t// once its send buffer has room. Bounded, single timer for the server.\n\tconst _drainPump = setInterval(() => {\n\t\tfor (const client of wss.clients) {\n\t\t\tconst pending = client._srPending;\n\t\t\tif (!pending || pending.size === 0) continue;\n\t\t\tif (client.readyState !== client.OPEN) { pending.clear(); continue; }\n\t\t\tfor (const [key, message] of pending) {\n\t\t\t\tif (client.bufferedAmount > BACKPRESSURE_BYTES) break; // re-saturated; keep the rest\n\t\t\t\ttry { client.send(message); } catch (e) { /* ignore */ }\n\t\t\t\tpending.delete(key);\n\t\t\t}\n\t\t}\n\t}, PENDING_FLUSH_MS);\n\tif (typeof _drainPump.unref === 'function') _drainPump.unref();\n\twss.on('close', () => clearInterval(_drainPump));\n"],
]);

console.log(`[patch-deps] scanned ${scanned} file(s), patched ${patched}.`);
