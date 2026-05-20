/*
	repair-assets-db.js
	-------------------

	Direct DB repair tool for the asset_paths virtual filesystem.
	NEVER touches uuids (custom_assets.uuid stays stable so toys keep
	resolving their stored asset references). Only fixes:

	  1. Built-in asset_paths rows whose basename doesn't match the
	     filename the asset_ref points at. These show "broken image"
	     in vuefinder because the preview endpoint streams the file
	     identified by asset_ref + the bundled built-in's actual name,
	     but vuefinder requests by the row's path/basename which has
	     drifted. We rename the basename + path to match the bundled
	     filename. asset_ref stays the same so toys still resolve.

	  2. Asset_paths rows pointing at a custom_asset uuid that no
	     longer exists. These show "broken" forever and waste tree
	     space. Reported but NOT auto-deleted - the user has to confirm.

	  3. Custom_assets uuids that no asset_paths row references
	     ("orphaned"). Reported only.

	Usage:
		node scripts/repair-assets-db.js               # dry run / report only
		node scripts/repair-assets-db.js --apply       # apply auto-fixable changes
		node scripts/repair-assets-db.js --apply --delete-broken-paths
													   # also remove asset_paths rows for dead uuids
*/

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// better-sqlite3 ships a native binding compiled for Electron's Node ABI
// (because electron-rebuild builds it at install time). Running this
// script under the system Node would crash on dlopen. If we detect we
// AREN'T already inside Electron's node-mode, re-spawn ourselves through
// `electron --ELECTRON_RUN_AS_NODE=1` so the binding loads correctly.
if (!process.versions.electron) {
	const cp = require('child_process');
	// require('electron') returns the absolute path to the electron
	// executable. More reliable than guessing .bin/.cmd wrapper paths
	// across Win/macOS/Linux and stdio-pipe quirks of Windows .cmd
	// shims.
	const electronBin = require('electron');
	const result = cp.spawnSync(electronBin, [__filename, ...process.argv.slice(2)], {
		env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
		stdio: 'inherit',
	});
	process.exit(result.status == null ? 1 : result.status);
}

const Database = require('better-sqlite3');

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const APPLY = args.has('--apply');
const DELETE_BROKEN = args.has('--delete-broken-paths');

// Optional explicit DB path override: --db /path/to/ytct.db
const dbOverrideIdx = rawArgs.indexOf('--db');
const dbOverride = (dbOverrideIdx >= 0 && rawArgs[dbOverrideIdx + 1]) ? rawArgs[dbOverrideIdx + 1] : null;

// Same `app.getPath('userData')` resolution Electron uses. We don't
// have the Electron API outside an electron context, so we resolve it
// manually per-platform. Falls back to APPDATA on Windows.
function resolveUserData(appName) {
	if (process.platform === 'win32') {
		return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
	}
	if (process.platform === 'darwin') {
		return path.join(os.homedir(), 'Library', 'Application Support', appName);
	}
	return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), appName);
}

// Electron's `app.getName()` returns the package.json `name` ("Chat-Toys")
// in packaged builds but the literal string "Electron" in dev. Try both.
// Caller can override entirely with --db.
const pkgName = (() => {
	try {
		return require(path.join(__dirname, '..', 'package.json')).name || 'Chat-Toys';
	} catch (e) { return 'Chat-Toys'; }
})();

/**
 * Locate the SQLite file. Order:
 *   1. --db <path> override (absolute path expected)
 *   2. %APPDATA%/<pkgName>/ytct.db        (packaged build location)
 *   3. %APPDATA%/Electron/ytct.db         (dev mode default)
 *
 * @returns {{ dbPath:string, userDataDir:string }}
 */
function resolveDb() {
	if (dbOverride) {
		const p = path.resolve(dbOverride);
		return { dbPath: p, userDataDir: path.dirname(p) };
	}
	const candidates = [pkgName, 'Electron'];
	for (const name of candidates) {
		const dir = resolveUserData(name);
		const file = path.join(dir, 'ytct.db');
		if (fs.existsSync(file)) return { dbPath: file, userDataDir: dir };
	}
	return { dbPath: path.join(resolveUserData(pkgName), 'ytct.db'), userDataDir: resolveUserData(pkgName) };
}

const { dbPath, userDataDir } = resolveDb();
const customAssetsDir = path.join(userDataDir, 'custom_assets');

console.log(`[repair] DB:     ${dbPath}`);
console.log(`[repair] Assets: ${customAssetsDir}`);
if (!fs.existsSync(dbPath)) {
	console.error(`[repair] DB file not found. Pass --db <full-path-to-ytct.db> if it's somewhere else.`);
	process.exit(1);
}

// Load the bundled built-in catalog so we can cross-check rows.
const builtInAssets = require(path.join(__dirname, '..', 'src', 'shared', 'builtInAssets.json'));
const builtInById = new Map(builtInAssets.map(a => [String(a.id), a]));

const db = new Database(dbPath);

console.log('');
console.log('=== inspecting asset_paths ===');
console.log('');

// ---------------------------------------------------------------------------
// 0. Path-format normalization (3-slash legacy -> 2-slash canonical)
// ---------------------------------------------------------------------------
// Rows that escaped the v2 migration (or were created later with a
// stale code path) can still have `assets:///` instead of `assets://`.
// Vuefinder's un-patched validator triggers a false "parent/child"
// guard against these because `startsWith` finds the extra slash to
// match. We replace the prefix in both `path` and `parent_path`.

const malformedPath = db.prepare(`
	SELECT COUNT(*) AS c FROM asset_paths WHERE path LIKE 'assets:///%'
`).get().c;
const malformedParent = db.prepare(`
	SELECT COUNT(*) AS c FROM asset_paths WHERE parent_path LIKE 'assets:///%'
`).get().c;

console.log(`rows with malformed 3-slash path:       ${malformedPath}`);
console.log(`rows with malformed 3-slash parent_path: ${malformedParent}`);

// ---------------------------------------------------------------------------
// 1. Built-in basename / path drift
// ---------------------------------------------------------------------------

const builtinRows = db.prepare(`
	SELECT path, parent_path, basename, asset_ref
	FROM asset_paths
	WHERE is_internal = 1 AND is_folder = 0
`).all();

const builtinDrift = [];
for (const r of builtinRows) {
	const meta = builtInById.get(String(r.asset_ref));
	if (!meta) continue; // covered by section 2 below
	if (r.basename !== meta.name) {
		builtinDrift.push({ row: r, expected: meta.name });
	}
}

console.log(`built-in rows: ${builtinRows.length}`);
console.log(`built-in basename drift: ${builtinDrift.length}`);
for (const { row, expected } of builtinDrift) {
	console.log(`  - "${row.basename}" (path: ${row.path}) -> should be "${expected}"`);
}

// ---------------------------------------------------------------------------
// 2. Rows pointing at missing custom_assets uuids
// ---------------------------------------------------------------------------

const customUuids = new Set(
	db.prepare(`SELECT uuid FROM custom_assets`).all().map(r => r.uuid)
);

const userRows = db.prepare(`
	SELECT path, asset_ref, basename
	FROM asset_paths
	WHERE is_internal = 0 AND is_folder = 0 AND asset_ref IS NOT NULL
`).all();

const brokenUserPaths = [];
const validUserUuids = new Set();
for (const r of userRows) {
	if (!customUuids.has(r.asset_ref)) {
		brokenUserPaths.push(r);
	} else {
		validUserUuids.add(r.asset_ref);
	}
}

console.log('');
console.log(`user-asset rows: ${userRows.length}`);
console.log(`user-asset rows with missing custom_assets uuid: ${brokenUserPaths.length}`);
for (const r of brokenUserPaths) {
	console.log(`  - ${r.path} (asset_ref ${r.asset_ref})`);
}

// ---------------------------------------------------------------------------
// 3. Rows pointing at missing built-in ids
// ---------------------------------------------------------------------------

const brokenBuiltinPaths = builtinRows.filter(r => !builtInById.has(String(r.asset_ref)));
console.log('');
console.log(`built-in rows with unknown asset_ref: ${brokenBuiltinPaths.length}`);
for (const r of brokenBuiltinPaths) {
	console.log(`  - ${r.path} (asset_ref ${r.asset_ref})`);
}

// ---------------------------------------------------------------------------
// 4. Orphan custom_assets (uuid present but no asset_paths row)
// ---------------------------------------------------------------------------

const orphanCustomAssets = [];
for (const uuid of customUuids) {
	if (!validUserUuids.has(uuid)) orphanCustomAssets.push(uuid);
}
console.log('');
console.log(`orphan custom_assets uuids: ${orphanCustomAssets.length}`);
for (const u of orphanCustomAssets) console.log(`  - ${u}`);

// ---------------------------------------------------------------------------
// Apply repairs
// ---------------------------------------------------------------------------

console.log('');
if (!APPLY) {
	console.log('(dry run - pass --apply to actually change the database)');
	process.exit(0);
}

console.log('=== applying repairs ===');

let renamedCount = 0;
let deletedCount = 0;

const updateBasenameAndPath = db.prepare(`
	UPDATE asset_paths
	SET basename = ?,
	    path = ?
	WHERE path = ?
`);
const deletePath = db.prepare(`DELETE FROM asset_paths WHERE path = ?`);

let pathFixed = 0;
const tx = db.transaction(() => {

	// 0. Normalize 3-slash legacy paths back to canonical 2-slash form.
	// Run BEFORE the basename rename so basenames don't end up in a
	// row whose path we're about to rewrite.
	const r1 = db.prepare(`
		UPDATE asset_paths
		SET path = 'assets://' || SUBSTR(path, 11)
		WHERE path LIKE 'assets:///%'
	`).run();
	const r2 = db.prepare(`
		UPDATE asset_paths
		SET parent_path = 'assets://' || SUBSTR(parent_path, 11)
		WHERE parent_path LIKE 'assets:///%'
	`).run();
	pathFixed = (r1.changes || 0) + (r2.changes || 0);
	if (pathFixed > 0) console.log(`  normalized ${pathFixed} malformed path/parent_path column(s)`);

	// 1. Built-in basename drift: rename in place.
	for (const { row, expected } of builtinDrift) {
		// Reconstruct the path from parent_path + expected basename. Use
		// the same join logic the renderer uses: no extra slash if
		// parent IS the storage root.
		const newPath = row.parent_path === 'assets://'
			? `assets://${expected}`
			: `${row.parent_path}/${expected}`;
		// If a sibling already has that path, we'd violate the unique PK.
		// Bail loudly rather than silently corrupting state.
		const collide = db.prepare(`SELECT 1 FROM asset_paths WHERE path = ?`).get(newPath);
		if (collide) {
			console.warn(`  [skip] cannot rename ${row.path} -> ${newPath} (path already exists)`);
			continue;
		}
		updateBasenameAndPath.run(expected, newPath, row.path);
		renamedCount++;
		console.log(`  renamed ${row.path}  ->  ${newPath}`);
	}

	// 2. Optionally delete asset_paths rows for missing uuids / built-in ids.
	if (DELETE_BROKEN) {
		for (const r of brokenUserPaths) {
			deletePath.run(r.path);
			deletedCount++;
			console.log(`  deleted broken user-asset path ${r.path}`);
		}
		for (const r of brokenBuiltinPaths) {
			deletePath.run(r.path);
			deletedCount++;
			console.log(`  deleted broken built-in path ${r.path}`);
		}
	}
});

tx();

console.log('');
console.log(`done. path-format fixes: ${pathFixed}, renamed: ${renamedCount}, deleted: ${deletedCount}.`);
console.log('Restart the app for the changes to be visible.');
