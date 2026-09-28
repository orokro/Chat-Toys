/*
	artillery.test.mjs
	------------------
	Artillery rules and physics (misc/sample-plugins/artillery/src/game.js).

	Run: npm test   (skipped when the plugin source isn't in misc/)
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '../../misc/sample-plugins/artillery/src/game.js');
const skip = fs.existsSync(FILE) ? false : 'misc/sample-plugins/artillery not present';
const G = skip ? null : require(FILE);

const flat = (h = 200) => new Array(G ? G.COLS : 0).fill(h);


test('terrain: seeded, same seed same hills, within bounds', { skip }, () => {
	const a = G.generateTerrain(42), b = G.generateTerrain(42), c = G.generateTerrain(43);
	assert.equal(a.length, G.COLS);
	assert.deepEqual(a, b);
	assert.notDeepEqual(a, c);
	for (const t of [a, c]) {
		assert.ok(Math.min(...t) >= G.H * 0.17 && Math.max(...t) <= G.H * 0.63, `${Math.min(...t)}..${Math.max(...t)}`);
	}
});

test('craters: round dip under the blast, nothing outside, never below the floor', { skip }, () => {
	const t = G.carve(flat(200), 640, 200, 40);
	assert.equal(G.heightAt(t, 640), 160);
	assert.ok(G.heightAt(t, 640 + 30) > 160 && G.heightAt(t, 640 + 30) < 200);
	assert.equal(G.heightAt(t, 640 + 45), 200);
	assert.equal(G.heightAt(t, 100), 200);
	// a blast in the air above the ground digs nothing
	assert.deepEqual(G.carve(flat(200), 640, 300, 40), flat(200));
	// repeated blasts reach the floor and stop there (a hole)
	let d = flat(60);
	for (let i = 0; i < 5; i++) d = G.carve(d, 640, G.heightAt(d, 640), 40);
	assert.equal(G.heightAt(d, 640), 0);
	assert.ok(d.every((h) => h >= 0));
});

test('angles are relative to facing; past vertical points backwards', { skip }, () => {
	const deg = (r) => Math.round((r * 180) / Math.PI);
	assert.equal(deg(G.launchRadians(45, 1)), 45);
	assert.equal(deg(G.launchRadians(45, -1)), 135);
	assert.equal(deg(G.launchRadians(90, -1)), 90);
	assert.equal(deg(G.launchRadians(150, 1)), 150);
	assert.equal(deg(G.launchRadians(150, -1)), 30);
});

test('a shell flies a parabola and lands on the ground', { skip }, () => {
	const terrain = flat(100);
	const tank = { id: 'a', x: 200, y: 100, alive: true };
	const r = G.fly({ terrain, tanks: [tank], from: G.muzzle(tank, G.launchRadians(45, 1)), rad: G.launchRadians(45, 1), power: 60, shooterId: 'a' });
	assert.ok(r.impact && !r.out && !r.hitTank);
	// range of a 45° shot at v = 540 with g = 400 is about v^2/g = 729 (from the muzzle height, a bit more)
	const range = r.impact.x - 200;
	assert.ok(range > 700 && range < 800, `range ${range}`);
	assert.ok(Math.abs(r.impact.y - 100) < 6);
	assert.ok(r.duration > 1500 && r.duration < 2500, `${r.duration}ms`);
	assert.deepEqual(r.path[0].slice(0, 2), [G.muzzle(tank, G.launchRadians(45, 1)).x, G.muzzle(tank, G.launchRadians(45, 1)).y]);
	// path is time-ordered
	for (let i = 1; i < r.path.length; i++) assert.ok(r.path[i][2] >= r.path[i - 1][2]);
});

test('a shell can hit a tank directly, and never its own tank on the way out', { skip }, () => {
	const terrain = flat(100);
	const a = { id: 'a', x: 200, y: 100, alive: true };
	const b = { id: 'b', x: 900, y: 100, alive: true };
	// sweep angles until one scores a direct hit on b
	let hit = null;
	for (let ang = 20; ang <= 70 && !hit; ang += 0.5) {
		const rad = G.launchRadians(ang, 1);
		const r = G.fly({ terrain, tanks: [a, b], from: G.muzzle(a, rad), rad, power: 60, shooterId: 'a' });
		if (r.hitTank === 'b') hit = ang;
	}
	assert.ok(hit, 'found a direct hit');
	// straight up comes back down on the shooter: allowed once it has left the barrel
	const up = G.fly({ terrain, tanks: [a], from: G.muzzle(a, G.launchRadians(90, 1)), rad: G.launchRadians(90, 1), power: 40, shooterId: 'a' });
	assert.equal(up.hitTank, 'a');
	// flying off the side
	const off = G.fly({ terrain, tanks: [a], from: G.muzzle(a, G.launchRadians(170, 1)), rad: G.launchRadians(170, 1), power: 100, shooterId: 'a' });
	assert.ok(off.out && !off.impact);
});

test('damage: direct hits vs splash falling off with distance', { skip }, () => {
	const tanks = [
		{ id: 'hit', x: 500, y: 100, alive: true },
		{ id: 'near', x: 530, y: 100, alive: true },
		{ id: 'far', x: 800, y: 100, alive: true },
		{ id: 'dead', x: 505, y: 100, alive: false },
	];
	const d = G.damage({ x: 500, y: 112 }, 'hit', tanks);
	const by = Object.fromEntries(d.map((x) => [x.id, x]));
	assert.equal(by.hit.dmg, 40);
	assert.ok(by.hit.direct);
	assert.ok(by.near.dmg > 0 && by.near.dmg < 30 && !by.near.direct);
	assert.equal(by.far, undefined);
	assert.equal(by.dead, undefined);
	// three direct hits destroy a full-health tank
	assert.ok(3 * G.DEFAULTS.directDamage >= G.DEFAULTS.maxHp && 2 * G.DEFAULTS.directDamage < G.DEFAULTS.maxHp);
});

test('driving follows the ground, stops at the edge, falls into holes', { skip }, () => {
	const t = flat(150);
	const m = G.drive(t, { x: 300 }, 80);
	assert.equal(m.x, 380);
	assert.equal(m.y, 150);
	assert.equal(m.fell, false);
	assert.equal(G.drive(t, { x: 40 }, -200).x, G.TANK.width / 2);
	const holed = t.slice();
	for (let i = 200; i < 210; i++) holed[i] = 0; // x 400..420
	const f = G.drive(holed, { x: 360 }, 100);
	assert.equal(f.fell, true);
	assert.ok(f.x >= 400 && f.x <= 404, `fell at ${f.x}`);
});

test('spawn spots are on the ground and spread out', { skip }, () => {
	const t = G.generateTerrain(7);
	const r = G.rng(1);
	const tanks = [];
	for (let i = 0; i < 6; i++) tanks.push({ x: G.spawnX(t, tanks, r) });
	const xs = tanks.map((k) => k.x).sort((a, b) => a - b);
	for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 60, xs.join(','));
	assert.ok(xs[0] >= 60 && xs[xs.length - 1] <= G.W - 60);
});

test('!move arguments', { skip }, () => {
	const m = (s) => G.parseMove(s);
	assert.deepEqual(m('left'), { dx: -60 });
	assert.deepEqual(m('right'), { dx: 60 });
	assert.deepEqual(m('left 100'), { dx: -100 });
	assert.deepEqual(m('Right 30'), { dx: 30 });
	assert.deepEqual(m('100 left'), { dx: -100 });
	assert.deepEqual(m('left -100'), { dx: -100 });
	assert.deepEqual(m('75'), { dx: 75 });
	assert.deepEqual(m('-75'), { dx: -75 });
	assert.deepEqual(m('r'), { dx: 60 });
	assert.deepEqual(m('9999'), { dx: 200 }, 'capped at maxMove');
	assert.deepEqual(m('-9999'), { dx: -200 });
	assert.match(m('').error, /Say which way/);
	assert.match(m('up').error, /isn't a direction/);
	assert.match(m('0').error, /more than 0/);
	assert.deepEqual(G.parseMove('left', { moveStep: 25 }), { dx: -25 });
});

test('!fire arguments', { skip }, () => {
	const f = (s) => G.parseFire(s);
	assert.deepEqual(f('45'), { angle: 45, power: 60 });
	assert.deepEqual(f('45 80'), { angle: 45, power: 80 });
	assert.deepEqual(f('120 30'), { angle: 120, power: 30 });
	assert.deepEqual(f('45° 80'), { angle: 45, power: 80 });
	assert.deepEqual(f('0'), { angle: 0, power: 60 });
	assert.deepEqual(f('180 100'), { angle: 180, power: 100 });
	assert.match(f('').error, /Aim with an angle/);
	assert.match(f('high').error, /Aim with an angle/);
	assert.match(f('200').error, /0 \(ahead\)/);
	assert.match(f('-5').error, /0 \(ahead\)/);
	assert.match(f('45 hard').error, /isn't a power/);
	assert.match(f('45 150').error, /1 to 100/);
	assert.deepEqual(G.parseFire('30', { defaultPower: 75 }), { angle: 30, power: 75 });
});
