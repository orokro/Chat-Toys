#!/usr/bin/env node
/*
	update_plugins.js
	-----------------

	Chat-Toys plugin index generator. Runs on the plugin host (e.g. an Apache
	box) with nothing but Node — no npm install, no API, no database.

	Workflow:
	  1. SFTP your built plugin .zip files into  ./source/
	  2. run:  node update_plugins.js
	  3. it reads each zip's manifest.json IN MEMORY (built-in zip reader, no
	     dependencies), extracts icons/thumbnails into ./icons/, and writes the
	     catalogs Chat-Toys fetches.

	Versioning — just keep tossing zips in:
	  - Every zip is published. Plugins are grouped by manifest `id`, and each
	    version lists the plugin API level it needs (manifest "apiVersion",
	    missing = 1). Each app installs the newest version it can run, and
	    shows plugins it can't run greyed out ("Needs a newer Chat Toys").
	  - Leave older zips in source/ for as long as older apps are around: an
	    app too old for v2.0 of a plugin still gets v1.x from here.
	  - The same id + version in two zips: the first by filename wins (warned).

	Outputs:
	  index.v2.json  every version of every plugin (Chat Toys with plugin
	                 versioning reads this)
	  index.json     the original flat format for apps from before versioning
	                 (Chat Toys 0.5.9 and older): one entry per plugin, the
	                 newest version with apiVersion <= LEGACY_API_MAX. A plugin
	                 with no such version is simply left out, so old apps never
	                 offer something they can't run.
	  icons/         icon + thumbnails per plugin (from its newest version)
	  .cache.json    parsed-manifest cache keyed by zip hash

	Paths in the indexes are RELATIVE to the index, so the client resolves them
	against wherever this folder is served. You don't configure a URL.

	Layout:
	  chattoys/plugins/
	    update_plugins.js
	    source/   plugin-1.0.0.zip      -> "zip": "source/plugin-1.0.0.zip"
	    icons/    <generated>            -> "icon": "icons/<slug>.png"
	    index.json, index.v2.json, .cache.json  <generated>

	Limitations: classic zips only (no ZIP64); deflate + stored entries.

	The canonical copy lives in the app repo at scripts/plugin-server/ and is
	covered by tests/plugins/pluginVersioning.test.mjs.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// ---- config: paths default to this script's directory; override with
// --root <dir> (used by the tests) ----
const argRoot = (() => {
	const i = process.argv.indexOf('--root');
	return i > 0 ? process.argv[i + 1] : null;
})();
const ROOT = path.resolve(argRoot || __dirname);
const SOURCE_DIR = path.join(ROOT, 'source');
const ICONS_DIR = path.join(ROOT, 'icons');
const INDEX_FILE = path.join(ROOT, 'index.json');
const INDEX_V2_FILE = path.join(ROOT, 'index.v2.json');
const CACHE_FILE = path.join(ROOT, '.cache.json');
const CACHE_FORMAT = 2;

// the plugin API level apps that only read index.json support. Never raise it:
// those apps are already out there.
const LEGACY_API_MAX = 1;


// =====================================================================
// Minimal zip reader (central directory + per-entry inflate)
// =====================================================================

/**
 * Parse a zip buffer's central directory into a name -> entry map.
 *
 * @param {Buffer} buf
 * @returns {Map<string, {method:number, compSize:number, uncompSize:number, localOffset:number}>}
 */
function readCentralDirectory(buf) {

	// find End Of Central Directory record (sig 0x06054b50), scanning back
	// past any trailing comment.
	let eocd = -1;
	const minPos = Math.max(0, buf.length - 22 - 0xffff);
	for (let i = buf.length - 22; i >= minPos; i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
	}
	if (eocd < 0)
		throw new Error('not a zip (no EOCD)');

	const count = buf.readUInt16LE(eocd + 10);
	let ptr = buf.readUInt32LE(eocd + 16); // central dir offset

	const entries = new Map();
	for (let n = 0; n < count; n++) {
		if (buf.readUInt32LE(ptr) !== 0x02014b50)
			throw new Error('bad central directory entry');

		const method = buf.readUInt16LE(ptr + 10);
		const compSize = buf.readUInt32LE(ptr + 20);
		const uncompSize = buf.readUInt32LE(ptr + 24);
		const nameLen = buf.readUInt16LE(ptr + 28);
		const extraLen = buf.readUInt16LE(ptr + 30);
		const commentLen = buf.readUInt16LE(ptr + 32);
		const localOffset = buf.readUInt32LE(ptr + 42);
		const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);

		entries.set(name, { method, compSize, uncompSize, localOffset });
		ptr += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}


/**
 * Read + decompress one entry's bytes.
 *
 * @param {Buffer} buf
 * @param {{method:number, compSize:number, localOffset:number}} entry
 * @returns {Buffer}
 */
function readEntry(buf, entry) {

	const o = entry.localOffset;
	if (buf.readUInt32LE(o) !== 0x04034b50)
		throw new Error('bad local file header');

	const nameLen = buf.readUInt16LE(o + 26);
	const extraLen = buf.readUInt16LE(o + 28);
	const start = o + 30 + nameLen + extraLen;
	const comp = buf.subarray(start, start + entry.compSize);

	if (entry.method === 0) return Buffer.from(comp);          // stored
	if (entry.method === 8) return zlib.inflateRawSync(comp);   // deflate
	throw new Error(`unsupported compression method ${entry.method}`);
}


/**
 * Find the manifest entry (root or one folder deep) and return it plus the
 * path prefix its siblings (icon, thumbnails) live under.
 *
 * @param {Map<string, Object>} entries
 * @returns {?{entry:Object, prefix:string}}
 */
function findManifest(entries) {
	let best = null;
	for (const name of entries.keys()) {
		if (name === 'manifest.json' || /^[^/]+\/manifest\.json$/.test(name)) {
			if (!best || name.length < best.length) best = name;
		}
	}
	if (!best) return null;
	const prefix = best.slice(0, best.length - 'manifest.json'.length); // '' or 'folder/'
	return { entry: entries.get(best), prefix };
}


// =====================================================================
// Helpers
// =====================================================================

/**
 * @param {Buffer} buf
 * @returns {string} sha256 hex
 */
function sha256(buf) {
	return crypto.createHash('sha256').update(buf).digest('hex');
}


/**
 * Compare two semver-ish strings numerically (ignores pre-release tags).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} >0 if a>b, <0 if a<b, 0 if equal
 */
function semverCmp(a, b) {
	const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
	const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
	for (let i = 0; i < 3; i++) {
		if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
	}
	return 0;
}


/**
 * The plugin API level a manifest needs (missing / bad = 1).
 *
 * @param {Object} m
 * @returns {number}
 */
function apiVersionOf(m) {
	const n = Number(m && m.apiVersion);
	return Number.isInteger(n) && n >= 1 ? n : 1;
}


function loadCache() {
	try {
		const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
		return (c && c.format === CACHE_FORMAT && c.entries) ? c.entries : {};
	} catch (e) {
		return {};
	}
}


// =====================================================================
// Main
// =====================================================================

function main() {

	if (!fs.existsSync(SOURCE_DIR)) {
		fs.mkdirSync(SOURCE_DIR, { recursive: true });
		console.log(`Created ${SOURCE_DIR} — drop plugin .zip files there and re-run.`);
		return;
	}
	fs.mkdirSync(ICONS_DIR, { recursive: true });

	const cache = loadCache();
	const nextCache = {};
	const zips = fs.readdirSync(SOURCE_DIR)
		.filter((f) => f.toLowerCase().endsWith('.zip'))
		.sort();

	// id -> Map(version -> meta)
	const byId = new Map();

	for (const zipName of zips) {

		const buf = fs.readFileSync(path.join(SOURCE_DIR, zipName));
		const hash = sha256(buf);

		// unchanged zip: reuse the parsed manifest
		const parsed = cache[hash] || parseZip(buf, zipName);
		if (!parsed) continue;
		nextCache[hash] = parsed;

		const meta = {
			...parsed,
			zip: `source/${zipName}`,
			zipHash: hash,
			zipSize: buf.length,
		};

		let versions = byId.get(meta.id);
		if (!versions) byId.set(meta.id, versions = new Map());
		const dup = versions.get(meta.version);
		if (dup) {
			console.warn(`! ${zipName}: ${meta.id} v${meta.version} is already published by ${dup.zip}; skipping`);
			continue;
		}
		versions.set(meta.version, meta);
	}

	const keepIcons = new Set();
	const v2Plugins = [];
	const legacyPlugins = [];

	for (const versionsMap of byId.values()) {

		const versions = Array.from(versionsMap.values()).sort((a, b) => semverCmp(b.version, a.version));
		const newest = versions[0];

		// icon + thumbnails come from the newest version
		const assets = extractAssets(path.join(ROOT, newest.zip), newest, keepIcons);

		const publicVersion = (m) => {
			const out = { ...m };
			delete out._iconPath;
			delete out._thumbPaths;
			return out;
		};

		v2Plugins.push({
			id: newest.id,
			slug: newest.slug,
			name: newest.name,
			icon: assets.icon,
			thumbnails: assets.thumbnails,
			versions: versions.map(publicVersion),
		});

		const legacy = versions.find((v) => v.apiVersion <= LEGACY_API_MAX);
		if (legacy)
			legacyPlugins.push({ ...publicVersion(legacy), icon: assets.icon, thumbnails: assets.thumbnails });
	}

	const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
	v2Plugins.sort(byName);
	legacyPlugins.sort(byName);

	const generatedAt = new Date().toISOString();
	fs.writeFileSync(INDEX_V2_FILE, JSON.stringify({ schemaVersion: 2, generatedAt, plugins: v2Plugins }, null, 2));
	fs.writeFileSync(INDEX_FILE, JSON.stringify({ schemaVersion: 1, generatedAt, plugins: legacyPlugins }, null, 2));
	fs.writeFileSync(CACHE_FILE, JSON.stringify({ format: CACHE_FORMAT, entries: nextCache }, null, 2));

	// prune orphaned icons (from removed plugins)
	for (const f of fs.readdirSync(ICONS_DIR)) {
		if (!keepIcons.has(f)) {
			try { fs.unlinkSync(path.join(ICONS_DIR, f)); } catch (e) { /* noop */ }
		}
	}

	console.log(`index.v2.json: ${v2Plugins.map((p) => `${p.slug} [${p.versions.map((v) => `${v.version} (api ${v.apiVersion})`).join(', ')}]`).join('; ') || '(none)'}`);
	console.log(`index.json (legacy, api <= ${LEGACY_API_MAX}): ${legacyPlugins.map((p) => `${p.slug}@${p.version}`).join(', ') || '(none)'}`);
}


/**
 * Parse a zip's manifest into index metadata (no asset extraction).
 *
 * @param {Buffer} buf
 * @param {string} zipName
 * @returns {?Object}
 */
function parseZip(buf, zipName) {

	let entries;
	try { entries = readCentralDirectory(buf); }
	catch (e) { console.warn(`! ${zipName}: ${e.message}`); return null; }

	const found = findManifest(entries);
	if (!found) { console.warn(`! ${zipName}: no manifest.json`); return null; }

	let manifest;
	try { manifest = JSON.parse(readEntry(buf, found.entry).toString('utf8')); }
	catch (e) { console.warn(`! ${zipName}: bad manifest (${e.message})`); return null; }

	if (!manifest.id || !manifest.slug || !manifest.version) {
		console.warn(`! ${zipName}: manifest missing id/slug/version`);
		return null;
	}

	return {
		id: manifest.id,
		slug: manifest.slug,
		name: manifest.name || manifest.slug,
		version: manifest.version,
		apiVersion: apiVersionOf(manifest),
		class: manifest.class || 'toy',
		description: manifest.description || '',
		longDescription: manifest.longDescription || '',
		tags: manifest.tags || [],
		themeColor: manifest.themeColor || '#888888',
		author: manifest.author || null,
		permissions: manifest.permissions || [],
		minAppVersion: manifest.minAppVersion || null,
		// in-zip asset paths for extractAssets (internal, not published)
		_iconPath: manifest.icon ? found.prefix + manifest.icon : null,
		_thumbPaths: Array.isArray(manifest.thumbnails) ? manifest.thumbnails.map((t) => found.prefix + t) : [],
	};
}


/**
 * Extract a plugin's icon + thumbnails into icons/ and record the produced
 * filenames in `keep`.
 *
 * @param {string} zipPath
 * @param {Object} meta
 * @param {Set<string>} keep
 * @returns {{icon: ?string, thumbnails: string[]}} index-relative URLs
 */
function extractAssets(zipPath, meta, keep) {

	const out = { icon: null, thumbnails: [] };

	let buf, entries;
	try {
		buf = fs.readFileSync(zipPath);
		entries = readCentralDirectory(buf);
	} catch (e) {
		return out;
	}

	const write = (inZipPath, outName) => {
		const entry = entries.get(inZipPath);
		if (!entry) return null;
		try {
			fs.writeFileSync(path.join(ICONS_DIR, outName), readEntry(buf, entry));
			keep.add(outName);
			return `icons/${outName}`;
		} catch (e) { return null; }
	};

	if (meta._iconPath) {
		const ext = path.extname(meta._iconPath) || '.png';
		out.icon = write(meta._iconPath, `${meta.slug}${ext}`);
	}

	(meta._thumbPaths || []).forEach((tp, i) => {
		const ext = path.extname(tp) || '.png';
		const url = write(tp, `${meta.slug}-thumb${i}${ext}`);
		if (url) out.thumbnails.push(url);
	});

	return out;
}


main();
