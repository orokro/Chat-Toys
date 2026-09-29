/*
	dance.test.mjs
	--------------
	Emoji Fountain !dance: the dance data (dances.json / danceMeta.json built
	by scripts/dance/build_dances.py), playback, outfit colors and crew planning.

	Run: npm test
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../../src/renderer/toys/EmojiFountain/dances');
const doc = JSON.parse(fs.readFileSync(path.join(DIR, 'dances.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'danceMeta.json'), 'utf8'));
const { decodeDance, samplePose, J, JOINTS, DEPTH, poseTop } = await import(path.join(DIR, 'danceDraw.js'));
const { pickOutfit, fallbackOutfit, colorDistance } = await import(path.join(DIR, 'outfit.js'));
const { planCrew, matchDance, TOSS_IN, STAGGER } = await import(path.join(DIR, 'danceCrew.js'));

const STRIDE = JOINTS.length * 2 + DEPTH.length;
const dist = (p, a, b) => Math.hypot(p[J[a] * 2] - p[J[b] * 2], p[J[a] * 2 + 1] - p[J[b] * 2 + 1]);


// ---------------------------------------------------------------------------
// the data
// ---------------------------------------------------------------------------

test('dances.json and danceMeta.json agree', () => {
	assert.deepEqual(doc.joints, JOINTS);
	assert.deepEqual(doc.depth, DEPTH);
	assert.deepEqual(meta.order, doc.order);
	assert.ok(doc.order.length >= 15, `${doc.order.length} dances`);
	for (const id of doc.order) {
		const d = doc.dances[id];
		assert.equal(d.data.length, d.frames * STRIDE, id);
		assert.equal(meta.dances[id].name, d.name, id);
		assert.ok(Math.abs(meta.dances[id].duration - d.frames / doc.fps) < 0.001, id);
		assert.ok(d.data.every(Number.isInteger), `${id} packs integers`);
	}
	for (const id of ['floss', 'twerk', 'thriller', 'hiphop', 'macarena', 'moonwalk', 'ymca', 'gangnam', 'dab'])
		assert.ok(doc.dances[id], `has ${id}`);
});

test('every dance is a sane, seamless loop', () => {
	for (const id of doc.order) {
		const dance = decodeDance(doc, id);
		const poses = [];
		for (let f = 0; f < dance.frames; f++) poses.push(samplePose(dance, f / dance.fps));

		// bones keep (roughly) their length: the figure never stretches apart
		// (2D lengths shrink when a limb points at the camera, so check the max)
		for (const [a, b, max] of [['lHip', 'lKnee', 26], ['rKnee', 'rAnkle', 27], ['lShoulder', 'lElbow', 20], ['rElbow', 'rWrist', 16]]) {
			const longest = Math.max(...poses.map((p) => dist(p, a, b)));
			assert.ok(longest < max, `${id} ${a}-${b} ${longest.toFixed(1)}`);
		}
		// standing on the floor somewhere in the loop, never sunk through it
		const lowest = Math.min(...poses.map((p) => Math.min(p[J.lToe * 2 + 1], p[J.rToe * 2 + 1], p[J.lAnkle * 2 + 1], p[J.rAnkle * 2 + 1])));
		assert.ok(lowest > -3 && lowest < 4, `${id} lowest foot ${lowest}`);
		// head up top, dancer about 100 tall
		assert.ok(poses.every((p) => poseTop(p) < 130), `${id} too tall`);
		// the seam (last frame -> first) is no bigger a jump than the moves in the loop
		const step = (p, q) => Math.max(...Array.from({ length: JOINTS.length * 2 }, (_, k) => Math.abs(p[k] - q[k])));
		const steps = poses.map((p, f) => step(p, poses[(f + 1) % poses.length]));
		const seam = steps[steps.length - 1];
		const typical = steps.slice(0, -1).sort((x, y) => x - y)[Math.floor(steps.length * 0.9)];
		assert.ok(seam <= typical * 1.6 + 1, `${id} seam ${seam.toFixed(1)} vs ${typical.toFixed(1)}`);
	}
});

test('playback loops and blends between frames', () => {
	const d = decodeDance(doc, 'floss');
	const a = samplePose(d, 0), b = samplePose(d, d.duration), c = samplePose(d, d.duration * 3);
	assert.deepEqual(Array.from(a), Array.from(b));
	assert.deepEqual(Array.from(a), Array.from(c));
	const f0 = samplePose(d, 0), f1 = samplePose(d, 1 / d.fps), mid = samplePose(d, 0.5 / d.fps);
	for (let k = 0; k < f0.length; k++) assert.ok(Math.abs(mid[k] - (f0[k] + f1[k]) / 2) < 1e-4);
	assert.equal(decodeDance(doc, 'nope'), null);
	assert.ok(doc.dances.moonwalk.travel < 0, 'the moonwalk glides');
});


// ---------------------------------------------------------------------------
// outfit colors
// ---------------------------------------------------------------------------

/** A size x size RGBA image from a (x, y) -> [r, g, b, a] | null function. */
function image(size, fn) {
	const px = new Uint8ClampedArray(size * size * 4);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const c = fn(x, y) || [0, 0, 0, 0];
		px.set(c.length === 3 ? [...c, 255] : c, (y * size + x) * 4);
	}
	return px;
}

// a yellow smiley: black outline ring, black eyes, a white shine, round
const smiley = image(32, (x, y) => {
	const d = Math.hypot(x - 15.5, y - 15.5);
	if (d > 15) return null;
	if (d > 13.5) return [20, 20, 20];
	if ((Math.hypot(x - 11, y - 12) < 2) || (Math.hypot(x - 20, y - 12) < 2)) return [15, 15, 15];
	if (Math.hypot(x - 9, y - 8) < 1.5) return [255, 255, 255];
	return [250, 204, 40];
});

test('outfit: the main color wins over outline, eyes and shine', () => {
	const o = pickOutfit(smiley);
	assert.ok(colorDistance(o.shirtRgb, [250, 204, 40]) < 20, o.shirt);
	// no other real color -> pants are a darker shade of the shirt
	assert.ok(o.pantsRgb.every((v, i) => v < o.shirtRgb[i] || v === 0), o.pants);
});

test('outfit: two colors -> shirt and pants', () => {
	const flag = image(32, (x, y) => (y < 20 ? [220, 30, 40] : [30, 60, 200]));
	const o = pickOutfit(flag);
	assert.ok(colorDistance(o.shirtRgb, [220, 30, 40]) < 20, o.shirt);
	assert.ok(colorDistance(o.pantsRgb, [30, 60, 200]) < 20, o.pants);
});

test('outfit: a speck of another color is ignored; saturated beats grey', () => {
	const speck = image(32, (x, y) => (x < 2 && y < 2 ? [0, 200, 0] : [240, 120, 20]));
	assert.ok(colorDistance(pickOutfit(speck).pantsRgb, [0, 200, 0]) > 100);
	// 55% grey, 45% vivid purple: purple is the shirt
	const grey = image(32, (x, y) => (x < 18 ? [128, 128, 128] : [140, 30, 200]));
	assert.ok(colorDistance(pickOutfit(grey).shirtRgb, [140, 30, 200]) < 20);
});

test('outfit: a black emote gets dark clothes with visible legs; transparent -> null', () => {
	const dark = image(32, () => [25, 25, 30]);
	const o = pickOutfit(dark);
	assert.ok(colorDistance(o.shirtRgb, [25, 25, 30]) < 10);
	assert.ok(o.pantsRgb[0] > o.shirtRgb[0], 'pants lighter than a near-black shirt');
	assert.equal(pickOutfit(image(8, () => null)), null);
	const f = fallbackOutfit('https://x/emote.png');
	assert.deepEqual(f, fallbackOutfit('https://x/emote.png'));
	assert.match(f.shirt, /^#[0-9a-f]{6}$/);
});


// ---------------------------------------------------------------------------
// crews
// ---------------------------------------------------------------------------

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const emo = (n) => Array.from({ length: n }, (_, i) => ({ char: String.fromCodePoint(0x1f600 + i) }));

test('crew: one dancer per emoji, same dance in sync by default', () => {
	const p = planCrew({ emojis: emo(3), meta, allowed: meta.order, rng: seq(0.3, 0.7, 0.1) });
	assert.equal(p.dancers.length, 3);
	assert.equal(new Set(p.dancers.map((d) => d.dance)).size, 1);
	assert.equal(new Set(p.dancers.map((d) => d.danceStart)).size, 1, 'start together');
	assert.equal(new Set(p.dancers.map((d) => d.flip)).size, 1, 'mirrored together');
	const last = Math.max(...p.dancers.map((d) => d.delay)) + TOSS_IN;
	for (const d of p.dancers) {
		assert.ok(d.delay < d.danceStart && d.danceStart >= last && d.exitAt > d.danceStart + d.danceSecs - 1e-9 && d.duration > d.exitAt);
		assert.ok(d.x > 0 && d.x < 100);
		// whole loops, about 8 s
		const clip = meta.dances[d.dance].duration;
		assert.ok(Math.abs(d.danceSecs / clip - Math.round(d.danceSecs / clip)) < 1e-9);
		assert.ok(Math.abs(d.danceSecs - 8) <= clip / 2 + 1e-9);
	}
	const xs = p.dancers.map((d) => d.x);
	assert.ok(xs[1] > xs[0] && xs[2] > xs[1], 'side by side');
	assert.equal(Math.min(...p.dancers.map((d) => d.delay)), 0);
	assert.ok(p.dancers.every((d) => d.delay <= 2 * STAGGER + 1e-9));
});

test('crew: mixed mode gives each dancer its own dance and clock', () => {
	const p = planCrew({ emojis: emo(4), meta, allowed: meta.order, sync: 'mixed' });
	assert.equal(new Set(p.dancers.map((d) => d.dance)).size, 4);
	for (const d of p.dancers) assert.ok(Math.abs(d.danceStart - (d.delay + TOSS_IN + 0.3)) < 1e-9);
});

test('crew: a new crew avoids the dances and the spot of crews already dancing', () => {
	for (let k = 0; k < 20; k++) {
		const p = planCrew({ emojis: emo(2), meta, allowed: ['floss', 'twerk', 'dab'], active: [{ left: 0, right: 50, dances: ['floss', 'twerk'] }] });
		assert.equal(p.dancers[0].dance, 'dab');
		assert.ok(p.crew.left >= 49, `left ${p.crew.left}`);
	}
	// every dance busy -> still dances
	const p = planCrew({ emojis: emo(1), meta, allowed: ['floss'], active: [{ left: 0, right: 10, dances: ['floss'] }] });
	assert.equal(p.dancers[0].dance, 'floss');
});

test('crew: a named dance wins; big crews squeeze onto the screen; errors', () => {
	const p = planCrew({ emojis: emo(10), meta, allowed: meta.order, request: 'ymca', height: 0.6, aspect: 1 });
	assert.ok(p.dancers.every((d) => d.dance === 'ymca'));
	assert.ok(p.crew.left >= 0 && p.crew.right <= 100);
	assert.match(planCrew({ emojis: emo(1), meta, allowed: [] }).error, /turned on/);
	// a disabled dance can't be requested
	const q = planCrew({ emojis: emo(1), meta, allowed: ['dab'], request: 'floss' });
	assert.equal(q.dancers[0].dance, 'dab');
});

test('matchDance finds dances named in chat', () => {
	const all = meta.order;
	assert.equal(matchDance('!dance 😎 floss', meta, all), 'floss');
	assert.equal(matchDance('!dance 🎃🎃 the TWIST please', meta, all), 'twist');
	assert.equal(matchDance('!dance 😎 Gangnam Style', meta, all), 'gangnam');
	assert.equal(matchDance('!dance 😎 hip-hop', meta, all), 'hiphop');
	assert.equal(matchDance('!dance 😎 running man', meta, all), 'runningman');
	assert.equal(matchDance('!dance 🤖 bboy', meta, all), 'toprock');
	assert.equal(matchDance('!dance 😎 YMCA!', meta, all), 'ymca');
	assert.equal(matchDance('!dance 😎', meta, all), null);
	assert.equal(matchDance('!dance 😎 floss', meta, ['dab']), null, 'only allowed dances');
});
