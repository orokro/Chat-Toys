/*
	fruitmachine.test.mjs
	---------------------
	Fruit Machine rules (misc/sample-plugins/fruitmachine/src/slots.js):
	paytable math, scoring, bet parsing.

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
const FILE = path.resolve(HERE, '../../misc/sample-plugins/fruitmachine/src/slots.js');
const skip = fs.existsSync(FILE) ? false : 'misc/sample-plugins/fruitmachine not present';
const S = skip ? null : require(FILE);


test('default paytable: ~92.6% return, ~1 in 5 spins win', { skip }, () => {
	const r = S.rtp(S.paytable({}));
	assert.ok(Math.abs(r.rtp - 0.926) < 0.001, `rtp ${r.rtp}`);
	assert.ok(r.hitRate > 0.18 && r.hitRate < 0.2, `hit rate ${r.hitRate}`);
});

test('rtp() follows the settings (and ignores junk values)', { skip }, () => {
	const base = S.rtp(S.paytable({})).rtp;
	assert.ok(S.rtp(S.paytable({ payTwoCherries: 4 })).rtp > base);
	assert.ok(S.rtp(S.paytable({ pay3seven: 0 })).rtp < base);
	assert.equal(S.rtp(S.paytable({ pay3seven: 'lots', payTwoCherries: -3 })).rtp, base);
});

test('scoring', { skip }, () => {
	const pays = S.paytable({});
	assert.deepEqual(S.evaluate(['seven', 'seven', 'seven'], pays), { multiplier: 200, label: 'Three Sevens', kind: 'three', symbol: 'seven' });
	assert.equal(S.evaluate(['cherries', 'cherries', 'cherries'], pays).multiplier, 10);
	assert.equal(S.evaluate(['cherries', 'lemon', 'cherries'], pays).multiplier, 3);
	assert.equal(S.evaluate(['cherries', 'lemon', 'bell'], pays).multiplier, 0);
	assert.equal(S.evaluate(['bell', 'bell', 'seven'], pays).kind, 'none');
});

test('the reel draw follows the weights', { skip }, () => {
	// a fixed sweep over [0, 1) hits each symbol in proportion to its weight
	const counts = {};
	const N = 26000;
	for (let i = 0; i < N; i++) {
		const sym = S.drawSymbol(() => (i + 0.5) / N);
		counts[sym] = (counts[sym] || 0) + 1;
	}
	const total = Object.values(S.WEIGHTS).reduce((a, b) => a + b, 0);
	for (const sym of S.SYMBOLS)
		assert.equal(counts[sym], (N * S.WEIGHTS[sym]) / total, sym);
	assert.equal(S.drawSymbol(() => 0), 'cherries');
	assert.equal(S.drawSymbol(() => 0.99999), 'seven');
});

test('bet parsing', { skip }, () => {
	const lim = { minBet: 10, maxBet: 5000, balance: 1200 };
	assert.deepEqual(S.parseBet('250', lim), { amount: 250 });
	assert.deepEqual(S.parseBet(' 1,000 ', lim), { amount: 1000 });
	assert.deepEqual(S.parseBet('1.2k', lim), { amount: 1200 });
	assert.deepEqual(S.parseBet('MIN', lim), { amount: 10 });
	assert.deepEqual(S.parseBet('max', lim), { amount: 1200 });
	assert.deepEqual(S.parseBet('all', lim), { amount: 1200 });
	assert.deepEqual(S.parseBet('max', { ...lim, balance: 99999 }), { amount: 5000 });
	assert.match(S.parseBet('', lim).error, /Bet some points/);
	assert.match(S.parseBet(undefined, lim).error, /Bet some points/);
	assert.match(S.parseBet('lots', lim).error, /isn't a bet/);
	assert.match(S.parseBet('-50', lim).error, /isn't a bet/);
	assert.match(S.parseBet('5', lim).error, /minimum bet is 10/);
	assert.match(S.parseBet('6000', { ...lim, balance: 9999 }).error, /maximum bet is 5000/);
	assert.match(S.parseBet('2000', lim).error, /only have 1200/);
	assert.match(S.parseBet('all', { ...lim, balance: 0 }).error, /no points/);
	assert.match(S.parseBet('all', { ...lim, balance: 5000 * 3 }).error, /maximum bet/);
});
