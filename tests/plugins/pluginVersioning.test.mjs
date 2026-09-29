/*
	pluginVersioning.test.mjs
	-------------------------

	Plugin API versioning end to end, without Electron:
	  - pluginCompat: apiVersion parsing + choosing the newest runnable version
	    from a remote index (v2 and legacy formats)
	  - scripts/plugin-server/update_plugins.js: publishes every version to
	    index.v2.json and only API-1 builds to the legacy index.json
	  - main PluginManager: skips installed plugins built for a newer API and
	    refuses to import them (without touching the working version)

	Run: npm test
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const compat = require(path.join(REPO, 'src/main/system/pluginCompat.js'));
const { PluginManager } = require(path.join(REPO, 'src/main/system/PluginManager.js'));
const GENERATOR = path.join(REPO, 'scripts/plugin-server/update_plugins.js');


// ---------------------------------------------------------------------
// helpers: a tiny "stored" (uncompressed) zip writer
// ---------------------------------------------------------------------

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {Object<string, string|Buffer>} files - name -> content
 * @param {boolean} [deflate=false] - deflate entries (method 8) instead of storing
 * @returns {Buffer}
 */
function makeZip(files, deflate = false) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const [name, content] of Object.entries(files)) {
		const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
		const body = deflate ? zlib.deflateRawSync(data) : data;
		const nameBuf = Buffer.from(name);
		const crc = crc32(data);

		const lh = Buffer.alloc(30);
		lh.writeUInt32LE(0x04034b50, 0);
		lh.writeUInt16LE(20, 4);
		lh.writeUInt16LE(deflate ? 8 : 0, 8);
		lh.writeUInt32LE(crc, 14);
		lh.writeUInt32LE(body.length, 18);
		lh.writeUInt32LE(data.length, 22);
		lh.writeUInt16LE(nameBuf.length, 26);
		locals.push(lh, nameBuf, body);

		const ch = Buffer.alloc(46);
		ch.writeUInt32LE(0x02014b50, 0);
		ch.writeUInt16LE(20, 4);
		ch.writeUInt16LE(20, 6);
		ch.writeUInt16LE(deflate ? 8 : 0, 10);
		ch.writeUInt32LE(crc, 16);
		ch.writeUInt32LE(body.length, 20);
		ch.writeUInt32LE(data.length, 24);
		ch.writeUInt16LE(nameBuf.length, 28);
		ch.writeUInt32LE(offset, 42);
		centrals.push(ch, nameBuf);

		offset += 30 + nameBuf.length + body.length;
	}
	const cd = Buffer.concat(centrals);
	const count = Object.keys(files).length;
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(count, 8);
	eocd.writeUInt16LE(count, 10);
	eocd.writeUInt32LE(cd.length, 12);
	eocd.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, cd, eocd]);
}

function manifest(over = {}) {
	return {
		id: 'test.example.widget',
		slug: 'widget',
		name: 'Test Widget',
		version: '1.0.0',
		icon: 'icon.png',
		widgets: [],
		...over,
	};
}

function pluginZip(m, { iconBytes = 'PNG-' + m.version, folder = '' } = {}) {
	return makeZip({
		[`${folder}manifest.json`]: JSON.stringify(m),
		[`${folder}icon.png`]: iconBytes,
		[`${folder}index.html`]: '<!doctype html><title>x</title>',
	}, true);
}

function tmpDir(tag) {
	return fs.mkdtempSync(path.join(os.tmpdir(), `ct-ver-${tag}-`));
}

function runGenerator(root) {
	return execFileSync(process.execPath, [GENERATOR, '--root', root], { encoding: 'utf8' });
}

function readJson(p) {
	return JSON.parse(fs.readFileSync(p, 'utf8'));
}


// ---------------------------------------------------------------------
// pluginCompat
// ---------------------------------------------------------------------

test('shared constant is loaded and is an integer >= 2', () => {
	assert.ok(Number.isInteger(compat.PLUGIN_API_VERSION));
	assert.ok(compat.PLUGIN_API_VERSION >= 2);
});

test('manifestApiVersion: missing / bad values mean 1', () => {
	const v = compat.manifestApiVersion;
	assert.equal(v({}), 1);
	assert.equal(v(null), 1);
	assert.equal(v({ apiVersion: 2 }), 2);
	assert.equal(v({ apiVersion: '3' }), 3);
	assert.equal(v({ apiVersion: 0 }), 1);
	assert.equal(v({ apiVersion: -4 }), 1);
	assert.equal(v({ apiVersion: 1.5 }), 1);
	assert.equal(v({ apiVersion: 'two' }), 1);
	assert.equal(compat.isApiCompatible({ apiVersion: 2 }, 2), true);
	assert.equal(compat.isApiCompatible({ apiVersion: 3 }, 2), false);
	assert.equal(compat.isApiCompatible({}, 1), true);
});

test('selectRemotePlugins (v2): newest runnable version wins; newer ones flagged', () => {
	const data = {
		schemaVersion: 2,
		plugins: [{
			id: 'a', slug: 'a', name: 'A', icon: 'icons/a.png', thumbnails: ['icons/a-thumb0.png'],
			versions: [
				{ version: '1.0.0', apiVersion: 1, zip: 'source/a-1.0.0.zip', zipHash: 'h1', name: 'A', permissions: [] },
				{ version: '1.10.0', apiVersion: 2, zip: 'source/a-1.10.0.zip', zipHash: 'h110', name: 'A', permissions: ['session:read'] },
				{ version: '2.0.0', apiVersion: 3, zip: 'source/a-2.0.0.zip', zipHash: 'h2', name: 'A 2', permissions: [] },
			],
		}],
	};
	const base = 'https://host.example/chattoys/plugins/index.v2.json';

	const [on2] = compat.selectRemotePlugins(data, { baseUrl: base, apiVersion: 2 });
	assert.equal(on2.version, '1.10.0', 'semver, not string, ordering');
	assert.equal(on2.compatible, true);
	assert.equal(on2.zip, 'https://host.example/chattoys/plugins/source/a-1.10.0.zip');
	assert.equal(on2.zipHash, 'h110');
	assert.deepEqual(on2.permissions, ['session:read']);
	assert.equal(on2.icon, 'https://host.example/chattoys/plugins/icons/a.png');
	assert.deepEqual(on2.thumbnails, ['https://host.example/chattoys/plugins/icons/a-thumb0.png']);
	assert.equal(on2.newestVersion, '2.0.0');
	assert.equal(on2.newerNeedsAppUpdate, true);
	assert.equal(on2.versions, undefined);

	const [on1] = compat.selectRemotePlugins(data, { baseUrl: base, apiVersion: 1 });
	assert.equal(on1.version, '1.0.0');

	const [on3] = compat.selectRemotePlugins(data, { baseUrl: base, apiVersion: 3 });
	assert.equal(on3.version, '2.0.0');
	assert.equal(on3.name, 'A 2');
	assert.equal(on3.newerNeedsAppUpdate, false);
});

test('selectRemotePlugins (v2): nothing runnable -> listed, not installable', () => {
	const data = {
		schemaVersion: 2,
		plugins: [{
			id: 'b', slug: 'b', name: 'B', icon: 'icons/b.png',
			versions: [
				{ version: '1.0.0', apiVersion: 4, zip: 'source/b-1.zip' },
				{ version: '0.9.0', apiVersion: 3, zip: 'source/b-0.9.zip' },
			],
		}],
	};
	const [b] = compat.selectRemotePlugins(data, { baseUrl: 'https://h/x/index.v2.json', apiVersion: 2 });
	assert.equal(b.compatible, false);
	assert.equal(b.zip, null);
	assert.equal(b.version, '1.0.0', 'shows the newest for display');
	assert.equal(b.requiredApiVersion, 3, 'the lowest level on offer');
	assert.equal(b.icon, 'https://h/x/icons/b.png');
});

test('selectRemotePlugins (legacy index.json): entries without apiVersion are API 1', () => {
	const data = {
		schemaVersion: 1,
		plugins: [
			{ id: 'c', slug: 'c', name: 'C', version: '1.2.0', zip: 'source/c.zip', icon: 'icons/c.png' },
			{ id: 'd', slug: 'd', name: 'D', version: '1.0.0', apiVersion: 2, zip: 'source/d.zip' },
			{ slug: '', version: '1' },   // junk is ignored
		],
	};
	const out = compat.selectRemotePlugins(data, { baseUrl: 'https://h/p/index.json', apiVersion: 1 });
	assert.equal(out.length, 2);
	const c = out.find((x) => x.slug === 'c');
	const d = out.find((x) => x.slug === 'd');
	assert.equal(c.compatible, true);
	assert.equal(c.apiVersion, 1);
	assert.equal(c.zip, 'https://h/p/source/c.zip');
	assert.equal(d.compatible, false);
	assert.equal(d.zip, null);
});


// ---------------------------------------------------------------------
// the generator
// ---------------------------------------------------------------------

test('generator: every version in index.v2.json, only API-1 builds in index.json', () => {

	const root = tmpDir('gen');
	const src = path.join(root, 'source');
	fs.mkdirSync(src);

	// "a": an API-1 release, a newer API-2 release, and a future API-3 one
	fs.writeFileSync(path.join(src, 'a-1.0.0.zip'), pluginZip(manifest({ id: 'x.a', slug: 'a', name: 'Alpha', version: '1.0.0' })));
	fs.writeFileSync(path.join(src, 'a-1.1.0.zip'), pluginZip(manifest({ id: 'x.a', slug: 'a', name: 'Alpha', version: '1.1.0', apiVersion: 2 })));
	fs.writeFileSync(path.join(src, 'a-2.0.0.zip'), pluginZip(manifest({ id: 'x.a', slug: 'a', name: 'Alpha', version: '2.0.0', apiVersion: 3 }), { iconBytes: 'NEWEST-ICON' }));
	// "b": API-2 only (e.g. Stream Credits) - must not reach old apps
	fs.writeFileSync(path.join(src, 'b-1.0.0.zip'), pluginZip(manifest({ id: 'x.b', slug: 'b', name: 'Bravo', version: '1.0.0', apiVersion: 2 }), { folder: 'b/' }));
	// a duplicate id+version under another name is skipped, not doubled
	fs.writeFileSync(path.join(src, 'zz-dupe-a-1.0.0.zip'), pluginZip(manifest({ id: 'x.a', slug: 'a', name: 'Alpha', version: '1.0.0' })));
	// junk
	fs.writeFileSync(path.join(src, 'broken.zip'), 'not a zip');

	const log = runGenerator(root);
	assert.match(log, /index\.v2\.json/);

	const v2 = readJson(path.join(root, 'index.v2.json'));
	assert.equal(v2.schemaVersion, 2);
	assert.deepEqual(v2.plugins.map((p) => p.slug), ['a', 'b']);
	const a = v2.plugins[0];
	assert.deepEqual(a.versions.map((v) => [v.version, v.apiVersion]), [['2.0.0', 3], ['1.1.0', 2], ['1.0.0', 1]]);
	assert.equal(a.versions[2].zip, 'source/a-1.0.0.zip', 'first zip by name wins a duplicate');
	assert.equal(a.icon, 'icons/a.png');
	assert.equal(fs.readFileSync(path.join(root, 'icons', 'a.png'), 'utf8'), 'NEWEST-ICON', 'icon comes from the newest version');
	assert.ok(a.versions.every((v) => /^[0-9a-f]{64}$/.test(v.zipHash) && v.zipSize > 0));
	assert.ok(a.versions.every((v) => !('_iconPath' in v) && !('_thumbPaths' in v)), 'internal fields stripped');
	assert.equal(v2.plugins[1].icon, 'icons/b.png', 'icon found under a wrapping folder');

	// legacy: same shape as before versioning, API-1 builds only
	const legacy = readJson(path.join(root, 'index.json'));
	assert.equal(legacy.schemaVersion, 1);
	assert.deepEqual(legacy.plugins.map((p) => `${p.slug}@${p.version}`), ['a@1.0.0']);
	assert.equal(legacy.plugins[0].zip, 'source/a-1.0.0.zip');
	assert.equal(legacy.plugins[0].icon, 'icons/a.png');
	assert.equal(legacy.plugins[0].versions, undefined);

	// what each kind of app would be offered
	const pick = (api) => compat.selectRemotePlugins(v2, { baseUrl: 'https://h/p/index.v2.json', apiVersion: api })
		.map((p) => `${p.slug}@${p.version}:${p.compatible ? 'ok' : 'needs-app'}`);
	assert.deepEqual(pick(1), ['a@1.0.0:ok', 'b@1.0.0:needs-app']);
	assert.deepEqual(pick(2), ['a@1.1.0:ok', 'b@1.0.0:ok']);
	assert.deepEqual(pick(3), ['a@2.0.0:ok', 'b@1.0.0:ok']);

	// re-run: served from the cache, identical output (minus the timestamp)
	const strip = (j) => ({ ...j, generatedAt: null });
	runGenerator(root);
	assert.deepEqual(strip(readJson(path.join(root, 'index.v2.json'))), strip(v2));
	const cache = readJson(path.join(root, '.cache.json'));
	assert.equal(cache.format, 2);

	// removing the only plugin with a thumbnail/icon prunes its icon
	fs.unlinkSync(path.join(src, 'b-1.0.0.zip'));
	runGenerator(root);
	assert.equal(fs.existsSync(path.join(root, 'icons', 'b.png')), false);

	fs.rmSync(root, { recursive: true, force: true });
});


// ---------------------------------------------------------------------
// main PluginManager: installed plugins + import
// ---------------------------------------------------------------------

function fakeApp(userData) {
	return {
		getPath: () => userData,
		getAppPath: () => path.join(REPO, 'src'),
	};
}

test('PluginManager: an installed plugin built for a newer API is skipped; an older zip of it still loads', async () => {

	const userData = tmpDir('pm');
	const plugins = path.join(userData, 'plugins');
	fs.mkdirSync(plugins, { recursive: true });

	const future = compat.PLUGIN_API_VERSION + 1;
	fs.writeFileSync(path.join(plugins, 'w-1.0.0.zip'), pluginZip(manifest({ version: '1.0.0' })));
	fs.writeFileSync(path.join(plugins, 'w-9.0.0.zip'), pluginZip(manifest({ version: '9.0.0', apiVersion: future })));
	fs.writeFileSync(path.join(plugins, 'solo.zip'), pluginZip(manifest({ id: 'x.solo', slug: 'solo', version: '1.0.0', apiVersion: future })));

	const pm = new PluginManager(fakeApp(userData));
	await pm.ready();

	const list = pm.getManifests().map((m) => `${m.slug}@${m.version}`);
	assert.deepEqual(list, ['widget@1.0.0']);
	assert.deepEqual(pm.incompatible.get('solo'), { version: '1.0.0', apiVersion: future });

	fs.rmSync(userData, { recursive: true, force: true });
});

test('PluginManager.importLocalZip: refuses a too-new plugin without touching the working one', async () => {

	const userData = tmpDir('imp');
	const plugins = path.join(userData, 'plugins');
	fs.mkdirSync(plugins, { recursive: true });
	fs.writeFileSync(path.join(plugins, 'widget.zip'), pluginZip(manifest({ version: '1.0.0' })));

	const pm = new PluginManager(fakeApp(userData));
	await pm.ready();

	const outside = tmpDir('src');

	// same filename as the installed one, but built for a future API
	const tooNew = path.join(outside, 'widget.zip');
	fs.writeFileSync(tooNew, pluginZip(manifest({ version: '2.0.0', apiVersion: compat.PLUGIN_API_VERSION + 1 })));
	const r1 = await pm.importLocalZip(tooNew);
	assert.match(r1.error, /needs a newer version of Chat Toys/);
	assert.equal(r1.slug, null);
	assert.deepEqual(pm.getManifests().map((m) => m.version), ['1.0.0']);
	assert.deepEqual(fs.readFileSync(path.join(plugins, 'widget.zip')), pluginZip(manifest({ version: '1.0.0' })), 'installed zip untouched');

	// not a plugin at all
	const junk = path.join(outside, 'junk.zip');
	fs.writeFileSync(junk, makeZip({ 'readme.txt': 'hi' }));
	const r2 = await pm.importLocalZip(junk);
	assert.match(r2.error, /isn't a Chat Toys plugin/);
	assert.equal(fs.existsSync(path.join(plugins, 'junk.zip')), false);

	// a runnable newer version replaces the old zip
	const ok = path.join(outside, 'widget-1.5.0.zip');
	fs.writeFileSync(ok, pluginZip(manifest({ version: '1.5.0', apiVersion: compat.PLUGIN_API_VERSION })));
	const r3 = await pm.importLocalZip(ok);
	assert.equal(r3.error, undefined);
	assert.equal(r3.slug, 'widget');
	assert.deepEqual(pm.getManifests().map((m) => m.version), ['1.5.0']);
	assert.deepEqual(fs.readdirSync(plugins).sort(), ['widget-1.5.0.zip']);

	fs.rmSync(userData, { recursive: true, force: true });
	fs.rmSync(outside, { recursive: true, force: true });
});

test('PluginManager: the served SDK reports this app\'s API level', () => {
	const userData = tmpDir('sdk');
	const pm = new PluginManager(fakeApp(userData));
	assert.ok(pm._sdkSource.includes(`Number('${compat.PLUGIN_API_VERSION}')`));
	assert.ok(!pm._sdkSource.includes('__CT_PLUGIN_API_VERSION__'));
	fs.rmSync(userData, { recursive: true, force: true });
});


// ---------------------------------------------------------------------
// main PluginManager: remote index + remote install (local HTTP server)
// ---------------------------------------------------------------------


function serve(files) {
	return new Promise((resolve) => {
		const srv = http.createServer((req, res) => {
			const body = files[req.url];
			if (body === undefined) { res.statusCode = 404; res.end('nope'); return; }
			res.end(body);
		});
		srv.listen(0, '127.0.0.1', () => resolve(srv));
	});
}

test('getRemoteIndex: prefers index.v2.json, falls back to the legacy index.json', async () => {

	const legacy = JSON.stringify({ schemaVersion: 1, plugins: [{ id: 'l', slug: 'l', name: 'L', version: '1.0.0', zip: 'source/l.zip' }] });
	const v2 = JSON.stringify({ schemaVersion: 2, plugins: [{ id: 'n', slug: 'n', name: 'N', versions: [{ version: '1.0.0', apiVersion: 2, zip: 'source/n.zip' }] }] });

	const userData = tmpDir('remote');
	const pm = new PluginManager(fakeApp(userData));
	await pm.ready();

	// only the legacy file on the server
	let srv = await serve({ '/p/index.json': legacy });
	pm.remoteIndexUrl = `http://127.0.0.1:${srv.address().port}/p/index.json`;
	let list = await pm.getRemoteIndex(true);
	assert.deepEqual(list.map((p) => [p.slug, p.compatible, p.zip]), [['l', true, `http://127.0.0.1:${srv.address().port}/p/source/l.zip`]]);
	srv.close();

	// both: v2 wins
	srv = await serve({ '/p/index.json': legacy, '/p/index.v2.json': v2 });
	pm.remoteIndexUrl = `http://127.0.0.1:${srv.address().port}/p/index.json`;
	list = await pm.getRemoteIndex(true);
	assert.deepEqual(list.map((p) => p.slug), ['n']);
	srv.close();

	// nothing reachable: empty, no throw
	pm.remoteIndexUrl = 'http://127.0.0.1:9/p/index.json';
	assert.deepEqual(await pm.getRemoteIndex(true), []);

	fs.rmSync(userData, { recursive: true, force: true });
});

test('installRemotePlugin: checks the hash and the API level before replacing anything', async () => {

	const good = pluginZip(manifest({ version: '1.2.0', apiVersion: compat.PLUGIN_API_VERSION }));
	const tooNew = pluginZip(manifest({ version: '3.0.0', apiVersion: compat.PLUGIN_API_VERSION + 1 }));
	const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

	const srv = await serve({ '/source/w-1.2.0.zip': good, '/source/w-3.0.0.zip': tooNew });
	const base = `http://127.0.0.1:${srv.address().port}`;

	const userData = tmpDir('rinst');
	const plugins = path.join(userData, 'plugins');
	fs.mkdirSync(plugins, { recursive: true });
	fs.writeFileSync(path.join(plugins, 'w-1.0.0.zip'), pluginZip(manifest({ version: '1.0.0' })));
	const pm = new PluginManager(fakeApp(userData));
	await pm.ready();

	await assert.rejects(pm.installRemotePlugin(`${base}/source/w-1.2.0.zip`, 'w-1.2.0.zip', 'f'.repeat(64)), /does not match/);
	await assert.rejects(pm.installRemotePlugin(`${base}/source/w-3.0.0.zip`, 'w-3.0.0.zip'), /needs a newer version/);
	assert.deepEqual(fs.readdirSync(plugins), ['w-1.0.0.zip'], 'failed installs leave the working version alone');

	const manifests = await pm.installRemotePlugin(`${base}/source/w-1.2.0.zip`, 'w-1.2.0.zip', sha(good));
	assert.deepEqual(manifests.map((m) => m.version), ['1.2.0']);
	assert.deepEqual(fs.readdirSync(plugins), ['w-1.2.0.zip']);

	srv.close();
	fs.rmSync(userData, { recursive: true, force: true });
});


test('PluginManager: running from the repo, the SDK comes from the source tree, not a stale build copy', async () => {

	// an old SDK left next to a built renderer (what `node scripts/build.js`
	// leaves in build/renderer) - it must not win over src/ in dev
	const appPath = tmpDir('app');
	fs.mkdirSync(path.join(appPath, 'renderer', 'plugins'), { recursive: true });
	fs.writeFileSync(path.join(appPath, 'renderer', 'plugins', 'ct-api.js'), '/* STALE SDK */');
	const userData = tmpDir('sdk');
	const serve = async (isPackaged) => {
		const pm = new PluginManager({ getPath: () => userData, getAppPath: () => appPath, isPackaged });
		await pm.ready();
		let handler = null;
		pm.mountRoutes({ get: (route, fn) => { if (route === '/plugins/_sdk/ct-api.js') handler = fn; } });
		let body = '';
		handler({}, { type() { return this; }, send(b) { body = b; } });
		return body;
	};

	const dev = await serve(false);
	assert.ok(dev.includes("request('omni.turn'"), 'dev serves the current SDK (with CT.omni)');
	assert.ok(!dev.includes('__CT_PLUGIN_API_VERSION__'), 'with the API level filled in');
	assert.equal(await serve(true), '/* STALE SDK */', 'packaged serves the copy shipped with the app');

	fs.rmSync(appPath, { recursive: true, force: true });
	fs.rmSync(userData, { recursive: true, force: true });
});
