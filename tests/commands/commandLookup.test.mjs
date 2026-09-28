/*
	commandLookup.test.mjs
	----------------------

	Which toy answers a typed command when words are shared
	(src/renderer/scripts/commandLookup.js).

	Run: npm test
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lib = await import(pathToFileURL(path.resolve(HERE, '../../src/renderer/scripts/commandLookup.js')).href);
const { buildCommandLookup, takenCommandWords, pickFreeCommandWord, commandWordsForToy, toySlugOf, commandKeyOf, assignPluginCommandWords, commandWordsSocketKey } = lib;


const cmd = (slug, command, extra = {}) => ({ slug, command, enabled: true, ...extra });

// a saved command list like a real install: StreamBuddies was tried once
// (its commands are still saved), Horse Racing is running, and a plugin game
// also uses !join
const saved = () => ({
	'streamBuddies__join': cmd('streamBuddies__join', 'join'),
	'streamBuddies__leave': cmd('streamBuddies__leave', 'leave'),
	'horseRacing__joinrace': cmd('horseRacing__joinrace', 'joinrace'),
	'horseRacing__horsebet': cmd('horseRacing__horsebet', 'horsebet'),
	'raffle__join': cmd('raffle__join', 'join'),
});


test('slug helpers', () => {
	assert.equal(toySlugOf({ slug: 'horseRacing__joinrace' }), 'horseRacing');
	assert.equal(commandKeyOf({ slug: 'horseRacing__joinrace' }), 'joinrace');
	assert.equal(commandKeyOf({ slug: 'media__3' }), '3');
	assert.equal(toySlugOf({}), '');
});

test('a removed toy neither answers nor blocks its saved words', () => {
	// StreamBuddies saved last would have won the old last-write-wins map
	const commands = { 'raffle__join': cmd('raffle__join', 'join'), 'streamBuddies__join': cmd('streamBuddies__join', 'join') };
	const l = buildCommandLookup(commands, ['raffle']);
	assert.equal(l.map.join.slug, 'raffle__join');
	assert.deepEqual(l.conflicts, {});
	assert.equal(l.bySlug['streamBuddies__join'], undefined, 'not running -> no standing');
	assert.equal(l.bySlug['raffle__join'].active, true);
});

test('two running toys: the one added first answers, the clash is reported', () => {
	const l = buildCommandLookup(saved(), ['horseRacing', 'raffle', 'streamBuddies']);
	assert.equal(l.map.join.slug, 'raffle__join');
	assert.deepEqual(l.conflicts, { join: ['raffle__join', 'streamBuddies__join'] });
	assert.deepEqual(l.bySlug['raffle__join'], { word: 'join', active: true, winner: 'raffle__join', others: ['streamBuddies__join'] });
	assert.deepEqual(l.bySlug['streamBuddies__join'], { word: 'join', active: false, winner: 'raffle__join', others: ['raffle__join'] });
	assert.deepEqual(l.bySlug['horseRacing__joinrace'].others, []);

	// the other order flips it
	const l2 = buildCommandLookup(saved(), ['streamBuddies', 'raffle']);
	assert.equal(l2.map.join.slug, 'streamBuddies__join');
});

test('an enabled command beats a disabled one; that is not a clash', () => {
	const commands = saved();
	commands['raffle__join'].enabled = false;
	const l = buildCommandLookup(commands, ['raffle', 'streamBuddies']);
	assert.equal(l.map.join.slug, 'streamBuddies__join');
	assert.deepEqual(l.conflicts, {});
	assert.equal(l.bySlug['raffle__join'].active, false);
	assert.deepEqual(l.bySlug['streamBuddies__join'].others, []);
});

test('all disabled: the word still maps (so the processor can refund / log), nothing is active', () => {
	const commands = { 'a__x': cmd('a__x', 'x', { enabled: false }) };
	const l = buildCommandLookup(commands, ['a']);
	assert.equal(l.map.x.slug, 'a__x');
	assert.equal(l.bySlug['a__x'].active, false);
});

test('junk records are ignored', () => {
	const l = buildCommandLookup({ a: null, b: { slug: 'x__y' }, c: { command: 'z' } }, ['x']);
	assert.deepEqual(l.map, {});
});

test('takenCommandWords: running toys only, with exceptions', () => {
	const running = ['horseRacing', 'raffle'];
	assert.deepEqual([...takenCommandWords(saved(), running)].sort(), ['horsebet', 'join', 'joinrace']);
	// renaming raffle's join: its own word is allowed
	assert.deepEqual([...takenCommandWords(saved(), running, { exceptSlug: 'raffle__join' })].sort(), ['horsebet', 'joinrace']);
	// a plugin being set up doesn't collide with its own saved commands
	assert.deepEqual([...takenCommandWords(saved(), running, { exceptToy: 'raffle' })].sort(), ['horsebet', 'joinrace']);
	// editing a toy that isn't running still respects its own other words
	assert.ok(takenCommandWords(saved(), running, { includeToy: 'streamBuddies' }).has('leave'));
});

test('pickFreeCommandWord', () => {
	const taken = new Set(['join', 'join2']);
	assert.equal(pickFreeCommandWord('join', taken), 'join3');
	assert.ok(taken.has('join3'));
	assert.equal(pickFreeCommandWord('flip', taken), 'flip');
	assert.equal(pickFreeCommandWord('Join', new Set(['join'])), 'Join2');
});

test('commandWordsForToy reports the real word and whether it answers', () => {
	const commands = saved();
	commands['raffle__join'].command = 'join2';
	const l = buildCommandLookup(commands, ['streamBuddies', 'raffle']);
	assert.deepEqual(commandWordsForToy(commands, 'raffle', l), { join: { command: 'join2', enabled: true, active: true } });

	commands['raffle__join'].command = 'join';
	const l2 = buildCommandLookup(commands, ['streamBuddies', 'raffle']);
	assert.deepEqual(commandWordsForToy(commands, 'raffle', l2), { join: { command: 'join', enabled: true, active: false } });
	assert.deepEqual(commandWordsForToy(commands, 'horseRacing', null).joinrace, { command: 'joinrace', enabled: true, active: false });
});

test('assignPluginCommandWords: only running toys push a plugin to join2', () => {
	const manifestCmds = [{ key: 'join', default: 'join' }, { key: 'leave', default: 'leave' }];
	const fresh = saved();
	delete fresh['raffle__join']; // the plugin is being added for the first time

	// Stream Buddies saved but NOT running: the plugin keeps its defaults
	assert.deepEqual(assignPluginCommandWords(manifestCmds, 'raffle', fresh, ['horseRacing', 'raffle']), { join: 'join', leave: 'leave' });

	// Stream Buddies running: free words
	assert.deepEqual(assignPluginCommandWords(manifestCmds, 'raffle', fresh, ['streamBuddies', 'raffle']), { join: 'join2', leave: 'leave2' });
});

test('assignPluginCommandWords: saved (possibly renamed) words win and are reserved', () => {
	const s = saved();
	s['raffle__join'] = cmd('raffle__join', 'enter');
	// a new command defaulting to the plugin's own saved word gets a free one
	const out = assignPluginCommandWords([{ key: 'join', default: 'join' }, { key: 'again', default: 'enter' }], 'raffle', s, ['raffle']);
	assert.deepEqual(out, { join: 'enter', again: 'enter2' });
	// two new commands with the same default don't collide with each other
	assert.deepEqual(assignPluginCommandWords([{ key: 'a', default: 'go' }, { key: 'b', default: 'go' }], 'p', {}, ['p']), { a: 'go', b: 'go2' });
});

test('commandWordsSocketKey mirrors the settings key convention', () => {
	assert.equal(commandWordsSocketKey('horseRacing'), 'horse-racing-commands');
	assert.equal(commandWordsSocketKey('credits'), 'credits-commands');
});
