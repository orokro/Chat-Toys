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

		// quick rough filter to avoid reading every file in full when
		// most don't contain anything interesting
		let src;
		try {
			src = fs.readFileSync(file, 'utf8');
		} catch (e) {
			continue;
		}
		if (!src.includes(`with`)) continue;
		if (!PATTERN.test(src)) continue;
		PATTERN.lastIndex = 0;

		const next = src.replace(PATTERN, REPLACEMENT);
		if (next !== src) {
			fs.writeFileSync(file, next, 'utf8');
			patched++;
			const rel = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
			console.log(`[patch-deps] patched ${rel}`);
		}
	}
}

console.log(`[patch-deps] scanned ${scanned} file(s), patched ${patched}.`);
