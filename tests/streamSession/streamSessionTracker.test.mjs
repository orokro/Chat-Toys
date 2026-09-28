/*
	Scenario tests for automatic stream boundaries + chatter tracking.
	Run: node --test tests/streamSession/streamSessionTracker.test.mjs
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	StreamSessionTracker, LIVE_GRACE_MS, IDLE_GAP_MS, MAX_CHATTERS,
} from '../../src/renderer/scripts/StreamSessionTracker.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function rig({ points = {}, stored = null } = {}) {
	let t = Date.UTC(2026, 8, 28, 18, 0, 0);
	let saved = stored;
	const logs = [];
	const tracker = new StreamSessionTracker({
		now: () => t,
		load: () => saved && JSON.parse(JSON.stringify(saved)),
		save: (s) => { saved = JSON.parse(JSON.stringify(s)); },
		getPoints: (ids) => Object.fromEntries(ids.map((id) => [id, points[id] ?? 0])),
		log: (l) => logs.push(l),
	});
	return {
		tracker, logs, points,
		advance: (ms) => { t += ms; },
		saved: () => saved,
		yt: (id, name, extra = {}) => ({ youtube: true, authorUniqueID: id, author: name, authorPFPUrl: `https://yt3.ggpht.com/${id}`, streamID: 'vidA', ...extra }),
		tw: (id, extra = {}) => ({ twitch: true, authorUniqueID: id, author: id, ...extra }),
		names: () => tracker.snapshot().chatters.map((c) => c.name),
		sid: () => tracker.snapshot().id,
	};
}

test('tracks unique chatters in first-seen order and ignores system messages', () => {
	const r = rig();
	r.tracker.handleChats([r.yt('a', 'Alice'), r.tw('bob'), r.yt('a', 'Alice'), { syslogger: true, authorUniqueID: 'Chat Toys', author: 'Chat Toys' }]);
	r.advance(MIN);
	r.tracker.handleChats([r.yt('c', 'Cara', { isMember: true }), r.tw('bob')]);
	const s = r.tracker.snapshot();
	assert.deepEqual(r.names(), ['Alice', 'bob', 'Cara']);
	assert.equal(s.chatters.find((c) => c.name === 'bob').messages, 2);
	assert.equal(s.chatters.find((c) => c.name === 'Cara').isMember, true);
	assert.equal(s.chatters.find((c) => c.name === 'bob').platform, 'twitch');
});

test('the list survives after the stream ends, until a NEW stream starts', () => {
	const r = rig();
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('a', 'Alice'), r.yt('b', 'Ben')]);
	r.advance(2 * HOUR);
	r.tracker.updateLive({ known: true, live: false });        // stream ends
	r.advance(10 * MIN);                                        // end screen showing, credits read
	assert.deepEqual(r.names(), ['Alice', 'Ben']);
	r.advance(5 * HOUR);                                        // hours later, nothing happens
	assert.deepEqual(r.names(), ['Alice', 'Ben'], 'no eager clearing');
});

test('a crash/restart shorter than the grace period is the same stream', () => {
	const r = rig();
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('a', 'Alice')]);
	const id = r.sid();
	r.advance(HOUR);
	r.tracker.updateLive({ known: true, live: false });
	r.advance(LIVE_GRACE_MS - MIN);
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('b', 'Ben')]);
	assert.equal(r.sid(), id);
	assert.deepEqual(r.names(), ['Alice', 'Ben']);
});

test('going live again after a longer break starts a new stream and carries waiting-room chat', () => {
	const r = rig();
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('a', 'Alice')]);
	r.advance(2 * HOUR);
	r.tracker.updateLive({ known: true, live: false });
	r.tracker.handleChats([r.yt('s', 'Straggler')]);              // "gg" right after it ended
	r.advance(90 * MIN);                                          // break (under the 3h idle gap)
	r.tracker.handleChats([r.yt('w', 'Waiter')]);                 // waiting-room chat
	r.advance(5 * MIN);
	const old = r.sid();
	r.tracker.updateLive({ known: true, live: true });            // next stream
	assert.notEqual(r.sid(), old);
	assert.deepEqual(r.names(), ['Waiter'], 'waiting-room chatter carried, old stream + straggler not');
});

test('pre-stream chat on a fresh day belongs to the upcoming stream', () => {
	const r = rig();
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('y', 'Yesterday')]);
	r.advance(HOUR);
	r.tracker.updateLive({ known: true, live: false });
	r.advance(20 * HOUR);                                         // next day
	r.tracker.handleChats([r.yt('e', 'Early')]);                  // before OBS goes live
	r.advance(10 * MIN);
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('l', 'Later')]);
	assert.deepEqual(r.names(), ['Early', 'Later']);
});

test('no live signal at all: a 3h+ gap starts a new stream, shorter gaps do not', () => {
	const r = rig();
	r.tracker.handleChats([r.tw('a')]);
	r.advance(IDLE_GAP_MS - MIN);
	r.tracker.handleChats([r.tw('b')]);
	assert.deepEqual(r.names(), ['a', 'b']);
	r.advance(IDLE_GAP_MS + MIN);
	r.tracker.handleChats([r.tw('c')]);
	assert.deepEqual(r.names(), ['c']);
});

test('a quiet chat does not split a stream that is still live', () => {
	const r = rig();
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.tw('a')]);
	for (let i = 0; i < 4 * 60; i++) {                           // 4 hours of ticks, no chat
		r.advance(MIN);
		r.tracker.updateLive({ known: true, live: true });
	}
	r.tracker.handleChats([r.tw('b')]);
	assert.deepEqual(r.names(), ['a', 'b']);
});

test('YouTube: a new live id after the old one went quiet is a new stream (drops test-source chat)', () => {
	const r = rig();
	r.tracker.handleChats([r.yt('lofi1', 'LofiRandom', { streamID: 'lofiGirl' })]);   // test source
	r.advance(45 * MIN);
	r.tracker.updateLive({ known: true, live: true });                                  // real stream
	r.tracker.handleChats([r.yt('fan', 'RealFan', { streamID: 'myStream' })]);
	assert.deepEqual(r.names(), ['RealFan']);
	assert.equal(r.tracker.snapshot().everLive, true, 'new session inherits live state');
});

test('YouTube: two chat sources active at once do not split the stream', () => {
	const r = rig();
	r.tracker.handleChats([r.yt('a', 'A', { streamID: 'mine' })]);
	r.advance(MIN);
	r.tracker.handleChats([r.yt('b', 'B', { streamID: 'collab' })]);
	r.advance(MIN);
	r.tracker.handleChats([r.yt('c', 'C', { streamID: 'mine' })]);
	assert.deepEqual(r.names(), ['A', 'B', 'C']);
});

test('points: current balance and net change this stream (only when asked)', () => {
	const r = rig({ points: { a: 100, b: 0 } });
	r.tracker.handleChats([r.yt('a', 'Alice'), r.yt('b', 'Ben')]);   // baselines 100 and 0
	r.points.a = 250;                                                 // earned 150
	r.points.b = 500;                                                 // first-time bonus etc.
	const withPts = r.tracker.snapshot({ withPoints: true });
	assert.deepEqual(withPts.chatters.map((c) => [c.name, c.points, c.pointsThisStream]), [['Alice', 250, 150], ['Ben', 500, 500]]);
	const plain = r.tracker.snapshot();
	assert.equal('points' in plain.chatters[0], false, 'no points without asking');
});

test('persists and restores across an app restart (same stream continues)', () => {
	const r = rig();
	r.tracker.updateLive({ known: true, live: true });
	r.tracker.handleChats([r.yt('a', 'Alice')]);
	const r2 = rig({ stored: r.saved() });
	assert.equal(r2.tracker.snapshot().live, false, 'not live until a signal says so');
	r2.tracker.handleChats([r2.yt('b', 'Ben')]);
	assert.deepEqual(r2.names(), ['Alice', 'Ben']);
});

test('caps chatters per session', () => {
	const r = rig();
	const batch = [];
	for (let i = 0; i < MAX_CHATTERS + 10; i++) batch.push(r.tw('u' + i));
	r.tracker.handleChats(batch);
	const s = r.tracker.snapshot();
	assert.equal(s.chatterCount, MAX_CHATTERS);
	assert.equal(r.saved().droppedChatters, 10);
});

test('notifies on new chatters and new sessions, not on every repeat message', () => {
	const r = rig();
	const events = [];
	r.tracker.onChange((d) => events.push(d.chatterCount));
	r.tracker.handleChats([r.tw('a')]);
	r.tracker.handleChats([r.tw('a'), r.tw('a')]);
	r.tracker.handleChats([r.tw('b')]);
	assert.deepEqual(events.filter((n) => n > 0), [1, 2]);
});
