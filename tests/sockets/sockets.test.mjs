/*
	Behaviour tests for the new socket transport (server + muxed client),
	including interop with the legacy socket-ref client.

	Each "page" is a fresh instance of the client module (imported with a
	unique query string), mirroring separate OBS sources / iframes / tabs.
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket as WsClient } from 'ws';
import { nextTick } from 'vue';
import { SocketServer } from '../../src/main/system/sockets/SocketServer.js';

let pageSeq = 0;
async function newPage(port) {
	const mod = await import(`../../src/renderer/scripts/sockets/socketRef.js?page=${++pageSeq}`);
	mod.setGlobalSocketRefPort(port);
	return mod;
}
async function legacyPage(port) {
	const mod = await import(`./fixtures/legacySocketRefClient.js?page=${++pageSeq}`);
	mod.setGlobalSocketRefPort(port);
	return mod;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(fn, label = 'condition', timeout = 3000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		try { if (await fn()) return; } catch (_) { /* keep waiting */ }
		await wait(10);
	}
	throw new Error(`timed out waiting for ${label}`);
}

async function startServer() {
	const httpServer = http.createServer();
	await new Promise(r => httpServer.listen(0, '127.0.0.1', r));
	const server = new SocketServer();
	server.attach(httpServer);
	return { server, httpServer, port: httpServer.address().port };
}
async function stopServer({ server, httpServer }) {
	server.detach();
	await new Promise(r => httpServer.close(r));
}

// raw ws client that records frames (for protocol-level assertions)
async function rawClient(port) {
	const ws = new WsClient(`ws://127.0.0.1:${port}`);
	const frames = [];
	ws.on('message', (data, isBinary) => frames.push({ msg: JSON.parse(data.toString()), isBinary }));
	await new Promise(r => ws.on('open', r));
	return { ws, frames, send: (o) => ws.send(JSON.stringify(o)) };
}

let S;
before(async () => { S = await startServer(); });
after(async () => { await stopServer(S); });


// ---------------------------------------------------------------- server

test('server routes a key only to its subscribers, never back to the writer', async () => {
	const a = await rawClient(S.port);
	const b = await rawClient(S.port);
	const w = await rawClient(S.port);
	a.send({ type: 'init', key: 'route-k1' });
	b.send({ type: 'init', key: 'route-k2' });
	w.send({ type: 'init', key: 'route-k1' });
	await waitFor(() => a.frames.length && b.frames.length && w.frames.length, 'init replies');

	w.send({ type: 'update', key: 'route-k1', value: 'hello', timestamp: Date.now() });
	await waitFor(() => a.frames.some(f => f.msg.value === 'hello'), 'a receives');
	await wait(50);
	assert.equal(b.frames.filter(f => f.msg.key === 'route-k1').length, 0, 'b is not subscribed to k1');
	assert.equal(w.frames.filter(f => f.msg.value === 'hello').length, 0, 'writer not echoed');
	// relayed as a TEXT frame so browsers get a string, not a Blob
	assert.equal(a.frames.find(f => f.msg.value === 'hello').isBinary, false);
	[a, b, w].forEach(c => c.ws.close());
});

test('server rejects stale and equal timestamps', async () => {
	const w = await rawClient(S.port);
	const r = await rawClient(S.port);
	r.send({ type: 'init', key: 'stale-k' });
	await waitFor(() => r.frames.length, 'init');
	w.send({ type: 'update', key: 'stale-k', value: 1, timestamp: 1000 });
	w.send({ type: 'update', key: 'stale-k', value: 2, timestamp: 1000 });
	w.send({ type: 'update', key: 'stale-k', value: 3, timestamp: 999 });
	w.send({ type: 'update', key: 'stale-k', value: 4, timestamp: 1001 });
	await waitFor(() => r.frames.some(f => f.msg.value === 4), 'newest');
	assert.deepEqual(r.frames.slice(1).map(f => f.msg.value), [1, 4]);
	[w, r].forEach(c => c.ws.close());
});

test('unsub stops delivery', async () => {
	const w = await rawClient(S.port);
	const r = await rawClient(S.port);
	r.send({ type: 'init', key: 'unsub-k' });
	await waitFor(() => r.frames.length === 1, 'init');
	r.send({ type: 'unsub', key: 'unsub-k' });
	await wait(30);
	w.send({ type: 'update', key: 'unsub-k', value: 'x', timestamp: Date.now() });
	await wait(80);
	assert.equal(r.frames.length, 1);
	[w, r].forEach(c => c.ws.close());
});

test('typed messages are parsed once and dispatched; socket-ref frames are not', async () => {
	const seen = [];
	const off = S.server.onMessage('chat', (msg) => seen.push(msg.data));
	const c = await rawClient(S.port);
	c.send({ type: 'chat', data: { text: 'hi' } });
	c.send({ type: 'init', key: 'typed-k' });
	c.send({ type: 'nobody-listens', data: 1 });
	c.ws.send('not json');
	await waitFor(() => seen.length === 1, 'chat handler');
	await wait(30);
	assert.deepEqual(seen, [{ text: 'hi' }]);
	off();
	c.ws.close();
});

test('handlers and stored values survive a server restart', async () => {
	const T = await startServer();
	const seen = [];
	T.server.onMessage('chat', (m) => seen.push(m.data));
	const w = await rawClient(T.port);
	w.send({ type: 'update', key: 'persist-k', value: 'kept', timestamp: Date.now() });
	await waitFor(() => T.server.store.has('persist-k'), 'stored');

	// restart on the same port, same SocketServer instance
	T.server.detach();
	await new Promise(r => T.httpServer.close(r));
	const httpServer2 = http.createServer();
	await new Promise(r => httpServer2.listen(T.port, '127.0.0.1', r));
	T.server.attach(httpServer2);

	const c = await rawClient(T.port);
	c.send({ type: 'chat', data: 'after-restart' });
	c.send({ type: 'init', key: 'persist-k' });
	await waitFor(() => seen.includes('after-restart'), 'chat after restart');
	await waitFor(() => c.frames.some(f => f.msg.type === 'init' && f.msg.value === 'kept'), 'value kept');
	c.ws.close();
	T.server.detach();
	await new Promise(r => httpServer2.close(r));
});


// ---------------------------------------------------------------- client

test('a page multiplexes all its refs over ONE socket', async () => {
	const before = S.server.stats().clients;
	const page = await newPage(S.port);
	const refs = [];
	for (let i = 0; i < 25; i++)
		refs.push(page.socketShallowRef(`mux-${i}`, i));
	await waitFor(() => page.getSocketStats()[0]?.keys.every(k => k.ready), 'all ready');
	assert.equal(S.server.stats().clients - before, 1);
	assert.equal(page.getSocketStats()[0].channels, 25);
});

test('writes reach other pages; readers never see keys they did not ask for', async () => {
	const app = await newPage(S.port);
	const widget = await newPage(S.port);
	const other = await newPage(S.port);

	const log = app.socketShallowRef('fan-chatLog', []);
	const view = widget.socketShallowRefReadOnly('fan-chatLog', []);
	other.socketShallowRef('fan-somethingElse', 0);
	await waitFor(() => widget.getSocketStats()[0].keys.every(k => k.ready), 'widget ready');
	await waitFor(() => app.getSocketStats()[0].keys.every(k => k.ready), 'app ready');

	const otherMsgsBefore = other.getSocketStats()[0].msgsIn;
	log.value = [{ text: 'a' }, { text: 'b' }];
	await waitFor(() => view.value.length === 2, 'widget got chat');
	await wait(50);
	assert.equal(other.getSocketStats()[0].msgsIn, otherMsgsBefore, 'unrelated page received nothing');
});

test('two refs on the same page share one subscription and update locally, as separate copies', async () => {
	const page = await newPage(S.port);
	const a = page.socketShallowRef('sib-k', { n: 0 });
	const b = page.socketShallowRef('sib-k', { n: 0 });
	await waitFor(() => page.getSocketStats()[0].keys.every(k => k.ready), 'ready');
	assert.equal(page.getSocketStats()[0].channels, 1);

	assert.notEqual(a.value, b.value, 'seeded siblings hold separate objects');

	a.value = { n: 5 };
	assert.equal(b.value.n, 5, 'sibling updated synchronously');
	assert.notEqual(a.value, b.value, 'sibling holds its own copy');

	const remote = await newPage(S.port);
	const r = remote.socketShallowRef('sib-k', null);
	await waitFor(() => r.value && r.value.n === 5, 'remote in sync');
	r.value = { n: 9 };
	await waitFor(() => a.value.n === 9 && b.value.n === 9, 'both siblings get network update');
	assert.notEqual(a.value, b.value, 'network value not shared between siblings');
});

test('first writer seeds its default when the server has no value', async () => {
	const app = await newPage(S.port);
	const reader = await newPage(S.port);
	app.socketShallowRef('seed-k', { mode: 'IDLE' });
	await waitFor(() => S.server.store.get('seed-k')?.value?.mode === 'IDLE', 'seeded on server');
	const r = reader.socketShallowRefReadOnly('seed-k', { mode: 'reader-default' });
	await waitFor(() => r.value.mode === 'IDLE', 'reader gets seeded value');
});

test('changes made before a ref is in sync are not sent (widget mount cannot clobber app state)', async () => {
	const app = await newPage(S.port);
	const appMode = app.socketShallowRef('clobber-k', 'GET');
	await waitFor(() => S.server.store.get('clobber-k')?.value === 'GET', 'app seeded');

	const widget = await newPage(S.port);
	const wMode = widget.socketShallowRef('clobber-k', 'widget-default');
	wMode.value = 'IDLE-set-during-mount'; // before init reply
	await waitFor(() => widget.getSocketStats()[0].keys.every(k => k.ready), 'widget ready');
	await nextTick();
	assert.equal(wMode.value, 'GET', 'server value wins');
	await wait(50);
	assert.equal(appMode.value, 'GET', 'app unaffected');
	assert.equal(S.server.store.get('clobber-k').value, 'GET');
});

test('whenSocketRefReady: an owner can republish after the server reply replaced its early write', async () => {
	// a previous run left a stale value on the server
	const old = await newPage(S.port);
	old.socketShallowRef('ready-k', { word: 'stale' });
	await waitFor(() => S.server.store.get('ready-k')?.value?.word === 'stale', 'stale seeded');

	const owner = await newPage(S.port);
	const r = owner.socketShallowRef('ready-k', { word: 'fresh' });
	r.value = { word: 'fresh' };           // before init: will be overwritten
	let fired = 0;
	owner.whenSocketRefReady(r, () => { fired++; r.value = { word: 'fresh' }; });
	await waitFor(() => S.server.store.get('ready-k')?.value?.word === 'fresh', 'republished after ready');
	assert.equal(fired, 1);

	// already ready: runs right away
	let now = 0;
	owner.whenSocketRefReady(r, () => { now++; });
	assert.equal(now, 1);
	// not a socket ref: no-op
	owner.whenSocketRefReady({ value: 1 }, () => { throw new Error('should not run'); });
});

test('async variants resolve once in sync, including when the key is already live on the page', async () => {
	const page = await newPage(S.port);
	const first = await page.socketShallowRefAsync('async-k', 'd');
	assert.equal(first.value, 'd');
	first.value = 'live';
	const second = await page.socketShallowRefAsync('async-k', 'other-default');
	assert.equal(second.value, 'live');
	const deep = await page.socketRefAsync('async-deep', { a: 1 });
	assert.equal(deep.value.a, 1);
});

test('a burst of writes in one tick goes out as a single update with the final value', async () => {
	const app = await newPage(S.port);
	const reader = await newPage(S.port);
	const w = app.socketShallowRef('burst-k', 0);
	const r = reader.socketShallowRefReadOnly('burst-k', 0);
	await waitFor(() => app.getSocketStats()[0].keys.every(k => k.ready) && reader.getSocketStats()[0].keys.every(k => k.ready), 'ready');

	const sentBefore = app.getSocketStats()[0].msgsOut;
	for (let i = 1; i <= 1000; i++) w.value = i;
	await waitFor(() => r.value === 1000, 'final value');
	assert.equal(app.getSocketStats()[0].msgsOut - sentBefore, 1);
});

test('sustained fast writes are capped but the latest value always arrives', async () => {
	const app = await newPage(S.port);
	const reader = await newPage(S.port);
	const w = app.socketShallowRef('rate-k', 0);
	const r = reader.socketShallowRefReadOnly('rate-k', 0);
	await waitFor(() => app.getSocketStats()[0].keys.every(k => k.ready) && reader.getSocketStats()[0].keys.every(k => k.ready), 'ready');

	const sentBefore = app.getSocketStats()[0].msgsOut;
	const start = Date.now();
	let i = 0;
	while (Date.now() - start < 300) {
		w.value = ++i;
		await new Promise(res => setImmediate(res));
	}
	await waitFor(() => r.value === i, 'latest value arrives');
	const sent = app.getSocketStats()[0].msgsOut - sentBefore;
	assert.ok(i > 200, `made ${i} writes`);
	assert.ok(sent <= 40, `sent ${sent} updates for ${i} writes in ~300ms (cap ~100/s)`);
});

test('same-millisecond writes from different refs are still ordered', async () => {
	const app = await newPage(S.port);
	const reader = await newPage(S.port);
	const w = app.socketShallowRef('ms-k', 'a');
	const r = reader.socketShallowRefReadOnly('ms-k', 'a');
	await waitFor(() => app.getSocketStats()[0].keys.every(k => k.ready) && reader.getSocketStats()[0].keys.every(k => k.ready), 'ready');
	w.value = 'b';
	await wait(20);
	w.value = 'c'; w.value = 'd';
	await waitFor(() => r.value === 'd', 'final value');
});

test('read-only refs never write', async () => {
	const page = await newPage(S.port);
	const ro = page.socketShallowRefReadOnly('ro-k', 'default');
	await waitFor(() => page.getSocketStats()[0].keys.every(k => k.ready), 'ready');
	assert.equal(S.server.store.has('ro-k'), false);
	const warn = console.warn; console.warn = () => {};
	try { ro.value = 'nope'; } catch (_) { /* some Vue builds throw */ }
	console.warn = warn;
	await wait(50);
	assert.equal(ro.value, 'default');
	assert.equal(S.server.store.has('ro-k'), false, 'nothing written');
});

test('disposeSocketRef releases the subscription (unsub on last ref)', async () => {
	const page = await newPage(S.port);
	const a = page.socketShallowRef('dispose-k', 1);
	const b = page.socketShallowRefReadOnly('dispose-k', 1);
	await waitFor(() => S.server.subscribers.get('dispose-k')?.size === 1, 'subscribed');
	page.disposeSocketRef(a);
	await wait(30);
	assert.equal(S.server.subscribers.get('dispose-k')?.size, 1, 'still one ref left');
	page.disposeSocketRef(b);
	await waitFor(() => !S.server.subscribers.has('dispose-k'), 'unsubscribed');
});

test('reconnect: resubscribes, publishes writes made while down, and does not reset to defaults', async () => {
	const T = await startServer();
	const app = await newPage(T.port);
	const widget = await newPage(T.port);
	const w = app.socketShallowRef('rc-k', 'default');
	const r = widget.socketShallowRefReadOnly('rc-k', 'default');
	await waitFor(() => app.getSocketStats()[0].keys.every(k => k.ready) && widget.getSocketStats()[0].keys.every(k => k.ready), 'ready');
	w.value = 'before';
	await waitFor(() => r.value === 'before', 'initial sync');

	// hard restart with a NEW SocketServer (old-style: state lost)
	T.server.detach();
	await new Promise(res => T.httpServer.close(res));
	await waitFor(() => !app.getSocketStats()[0].open && !widget.getSocketStats()[0].open, 'both see disconnect');

	w.value = 'while-down';

	const httpServer2 = http.createServer();
	await new Promise(res => httpServer2.listen(T.port, '127.0.0.1', res));
	const fresh = new SocketServer();
	fresh.attach(httpServer2);

	await waitFor(() => r.value === 'while-down', 'write made while down arrives after reconnect', 8000);
	assert.equal(w.value, 'while-down');
	assert.equal(fresh.store.get('rc-k').value, 'while-down');

	fresh.detach();
	await new Promise(res => httpServer2.close(res));
});

test('setGlobalSocketRefPort moves an existing page connection to the new port', async () => {
	const A = await startServer();
	const B = await startServer();
	const page = await newPage(A.port);
	const x = page.socketShallowRef('port-k', 'v1');
	await waitFor(() => A.server.store.get('port-k')?.value === 'v1', 'seeded on A');
	page.setGlobalSocketRefPort(B.port);
	await waitFor(() => B.server.subscribers.has('port-k'), 'resubscribed on B');
	await waitFor(() => B.server.store.get('port-k')?.value === 'v1', 'value re-seeded on B');
	x.value = 'v2';
	await waitFor(() => B.server.store.get('port-k')?.value === 'v2', 'writes go to B');
	await stopServer(A); await stopServer(B);
});


// ---------------------------------------------------------------- interop

test('legacy one-socket-per-ref clients interoperate with the new server and client', async () => {
	const legacy = await legacyPage(S.port);
	const modern = await newPage(S.port);

	// writers first: the OLD client has its own race where a read-only ref
	// that gets an empty init stamps itself "now" and then ignores a seed
	// written a few ms earlier. Not something the new transport can fix
	// for old pages, so sequence it.
	const lWrite = legacy.socketShallowRef('interop-a', 'l-default');
	const mWrite = modern.socketShallowRef('interop-b', 'm-default');
	await waitFor(() => S.server.store.has('interop-a') && S.server.store.has('interop-b'), 'both seeded');
	const mRead = modern.socketShallowRefReadOnly('interop-a', 'm-default');
	const lRead = legacy.socketShallowRefReadOnly('interop-b', 'l-default');

	await waitFor(() => mRead.value === 'l-default', 'modern reads legacy seed');
	await waitFor(() => lRead.value === 'm-default', 'legacy reads modern seed');

	lWrite.value = 'from-legacy';
	mWrite.value = 'from-modern';
	await waitFor(() => mRead.value === 'from-legacy', 'legacy -> modern');
	await waitFor(() => lRead.value === 'from-modern', 'modern -> legacy');
});

test('a garbage-collected ref releases its subscription', { skip: typeof global.gc !== 'function' && 'run with --expose-gc' }, async () => {
	const page = await newPage(S.port);
	(() => { page.socketShallowRefReadOnly('gc-k', 0); })();
	await waitFor(() => S.server.subscribers.get('gc-k')?.size === 1, 'subscribed');
	for (let i = 0; i < 20 && S.server.subscribers.has('gc-k'); i++) {
		global.gc();
		await wait(50);
	}
	assert.equal(S.server.subscribers.has('gc-k'), false, 'unsubscribed after GC');
});

test('a ref passed as the default is unwrapped, not aliased (keepAliveSocket pattern)', async () => {
	const page = await newPage(S.port);
	const writer = page.socketShallowRef('alias-k', 'Z_0');
	const view = page.socketShallowRefReadOnly('alias-k', writer);
	await waitFor(() => page.getSocketStats()[0].keys.every(k => k.ready), 'ready');
	assert.equal(view.value, 'Z_0');
	writer.value = 'O_123';
	assert.equal(view.value, 'O_123', 'read-only view follows the writer');
	const reader = await newPage(S.port);
	const remote = reader.socketShallowRefReadOnly('alias-k', 'U_0');
	await waitFor(() => remote.value === 'O_123', 'other page sees it');
});
