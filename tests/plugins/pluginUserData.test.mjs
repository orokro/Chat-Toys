/*
	pluginUserData.test.mjs
	-----------------------

	Per-viewer, per-plugin saved data (src/main/system/pluginUserData.js),
	against a real SQLite (node:sqlite; the app uses better-sqlite3 with the
	same calls).

	Run: npm test   (skipped on Node versions without node:sqlite)
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { PluginUserDataStore, LIMITS } = require(path.resolve(HERE, '../../src/main/system/pluginUserData.js'));

let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { /* older Node */ }
const skip = DatabaseSync ? false : 'node:sqlite not available in this Node version';


function makeDb(file = ':memory:') {
	const db = new DatabaseSync(file);
	db.exec(`CREATE TABLE IF NOT EXISTS users (youtube_id TEXT PRIMARY KEY, display_name TEXT)`);
	return db;
}

// a store with a fake clock and a manual flush timer
function makeStore(db = makeDb()) {
	const clock = { t: 1_000_000 };
	const timers = [];
	const store = new PluginUserDataStore(db, {
		now: () => clock.t,
		setTimer: (fn) => { timers.push(fn); return timers.length; },
	});
	const runTimers = () => { while (timers.length) timers.shift()(); };
	return { db, store, clock, runTimers };
}

const onDisk = (db, pluginId, userId) => db.prepare('SELECT data FROM plugin_user_data WHERE plugin_id = ? AND user_id = ?').get(pluginId, userId);


test('set / get / update / delete, reads see writes before they are flushed', { skip }, () => {
	const { db, store, runTimers } = makeStore();
	assert.equal(store.get('game', 'u1'), null);

	store.set('game', 'u1', { v: 1, highScore: 10 });
	assert.deepEqual(store.get('game', 'u1'), { v: 1, highScore: 10 });
	assert.equal(onDisk(db, 'game', 'u1'), undefined, 'batched, not written yet');

	runTimers();
	assert.deepEqual(JSON.parse(onDisk(db, 'game', 'u1').data), { v: 1, highScore: 10 });

	assert.deepEqual(store.update('game', 'u1', { highScore: 12, streak: 3 }), { v: 1, highScore: 12, streak: 3 });
	assert.deepEqual(store.update('game', 'u1', { streak: null }), { v: 1, highScore: 12 }, 'null removes a field');

	assert.equal(store.remove('game', 'u1'), true);
	assert.equal(store.get('game', 'u1'), null);
	runTimers();
	assert.equal(onDisk(db, 'game', 'u1'), undefined);
	assert.equal(store.remove('game', 'u1'), false);
});

test('plugins are isolated from each other', { skip }, () => {
	const { store } = makeStore();
	store.set('a', 'u1', { x: 1 });
	store.set('b', 'u1', { x: 2 });
	assert.deepEqual(store.get('a', 'u1'), { x: 1 });
	assert.deepEqual(store.get('b', 'u1'), { x: 2 });
	store.clear('a');
	assert.equal(store.get('a', 'u1'), null);
	assert.deepEqual(store.get('b', 'u1'), { x: 2 });
});

test('only plain JSON objects are accepted', { skip }, () => {
	const { store } = makeStore();
	const bad = [
		[[1, 2], /plain object/],
		['str', /plain object/],
		[null, /plain object/],
		[new Date(), /plain object/],
		[{ f() {} }, /not JSON data/],
		[{ n: NaN }, /not a finite number/],
		[{ n: Infinity }, /not a finite number/],
		[{ d: new Date() }, /not JSON data/],
		[{ a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } }, /nested deeper/],
	];
	for (const [data, re] of bad)
		assert.throws(() => store.set('p', 'u', data), re, JSON.stringify(String(data)));
	assert.throws(() => store.set('p', '', { a: 1 }), /bad user id/);
	assert.throws(() => store.set('p', 'x'.repeat(300), { a: 1 }), /bad user id/);
	// nested arrays / objects within the depth limit are fine
	store.set('p', 'u', { v: 1, items: [{ id: 1, tags: ['a'] }], nothing: null });
	assert.deepEqual(store.get('p', 'u').items[0].tags, ['a']);
});

test('per-viewer size limit: rejected, not truncated, old value kept', { skip }, () => {
	const { store } = makeStore();
	store.set('p', 'u', { ok: true });
	const big = { blob: 'x'.repeat(LIMITS.bytesPerUser) };
	assert.throws(() => store.set('p', 'u', big), /over the 4096-byte limit/);
	assert.deepEqual(store.get('p', 'u'), { ok: true });
	// just under the limit is fine
	store.set('p', 'u', { blob: 'x'.repeat(LIMITS.bytesPerUser - 20) });
});

test('per-plugin total limit (counts pending writes, frees on delete / overwrite)', { skip }, () => {
	const { store, clock, runTimers } = makeStore();
	const blob = 'x'.repeat(4000);
	let i = 0;
	let err = null;
	while (i < 5000) {
		clock.t += 1000; // keep the rate limiter out of it
		try { store.set('p', `u${i}`, { blob }); }
		catch (e) { err = e; break; }
		i++;
		if (i % 500 === 0) runTimers();
	}
	assert.ok(err && /exceed/.test(err.message), 'hit the plugin cap');
	assert.ok(i > 2000 && i < 2700, `about 10 MB of 4 KB rows (${i})`);

	// overwriting an existing viewer with the same size still works at the cap
	store.set('p', 'u0', { blob: blob.replace(/x$/, 'y') });
	// deleting frees room for a new viewer
	store.remove('p', 'u1');
	store.set('p', 'new', { blob });
	// another plugin is unaffected
	store.set('other', 'u', { blob });
	runTimers();
	assert.ok(store.stats('p').bytes <= LIMITS.bytesPerPlugin);
});

test('write rate limit: bursts allowed, sustained floods rejected, refills over time', { skip }, () => {
	const { store, clock } = makeStore();
	let ok = 0;
	try { for (let i = 0; i < 1000; i++) { store.set('p', 'u', { n: i }); ok++; } }
	catch (e) { assert.match(e.message, /too many writes/); }
	assert.equal(ok, LIMITS.writeBurst);
	clock.t += 1000;
	store.set('p', 'u', { n: 'after a second' });
	assert.equal(store.get('p', 'u').n, 'after a second');
	// reads are never limited
	for (let i = 0; i < 1000; i++) store.get('p', 'u');
});

test('top(): leaderboard by a numeric field, with names, pending writes included', { skip }, () => {
	const { db, store } = makeStore();
	db.prepare('INSERT INTO users (youtube_id, display_name) VALUES (?, ?)').run('UCa', 'Alice');
	db.prepare('INSERT INTO users (youtube_id, display_name) VALUES (?, ?)').run('UCb', 'Bob');
	store.set('game', 'UCa', { highScore: 50, stats: { wins: 1 } });
	store.set('game', 'UCb', { highScore: 90, stats: { wins: 7 } });
	store.set('game', 'twitch:9', { highScore: 70 });
	store.set('game', 'UCz', { highScore: 'lots' });   // not a number: left out
	store.set('game', 'UCy', { other: 1 });            // no field: left out
	store.set('elsewhere', 'UCa', { highScore: 1000 }); // another plugin

	const top = store.top('game', 'highScore');
	assert.deepEqual(top.map((r) => [r.userId, r.name, r.value]), [['UCb', 'Bob', 90], ['twitch:9', null, 70], ['UCa', 'Alice', 50]]);
	assert.deepEqual(top[0].data.stats, { wins: 7 });

	assert.deepEqual(store.top('game', 'highScore', { limit: 1, order: 'asc' }).map((r) => r.userId), ['UCa']);
	assert.deepEqual(store.top('game', 'stats.wins').map((r) => r.value), [7, 1]);
	assert.throws(() => store.top('game', "x'); DROP TABLE users; --"), /field must look like/);
	assert.equal(store.top('game', 'highScore', { limit: 10_000 }).length, 3, 'limit is capped, no error');
});

test('data survives reopening the database after a flush', { skip }, () => {
	const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-pud-')), 'db.sqlite');
	const a = makeStore(makeDb(file));
	a.store.set('game', 'u1', { highScore: 5 });
	a.store.flush();
	a.db.close();

	const b = makeStore(makeDb(file));
	assert.deepEqual(b.store.get('game', 'u1'), { highScore: 5 });
	assert.deepEqual(b.store.stats('game'), { users: 1, bytes: Buffer.byteLength('{"highScore":5}') });
	b.db.close();
});

test('getMany', { skip }, () => {
	const { store } = makeStore();
	store.set('p', 'a', { n: 1 });
	assert.deepEqual(store.getMany('p', ['a', 'b']), { a: { n: 1 }, b: null });
	assert.throws(() => store.getMany('p', new Array(501).fill('x')), /at most 500/);
});
