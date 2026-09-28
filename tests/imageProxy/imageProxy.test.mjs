/*
	/avatar-proxy + bounded cache tests.
	Run: node --experimental-detect-module --test tests/imageProxy/imageProxy.test.mjs
*/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { mountImageProxy, BoundedImageCache } from '../../src/main/system/imageProxy.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
let cdn, cdnPort, proxy, proxyPort, cdnHits = [];

before(async () => {
	// a fake avatar CDN that rejects hotlinks (403 when a Referer is sent)
	const c = express();
	c.get('/avatar.png', (req, res) => {
		cdnHits.push(req.get('referer') || null);
		if (req.get('referer')) return res.status(403).send('hotlink denied');
		res.type('image/png').send(PNG);
	});
	cdn = http.createServer(c);
	await new Promise((r) => cdn.listen(0, '127.0.0.1', r));
	cdnPort = cdn.address().port;

	const a = express();
	mountImageProxy(a, '/avatar-proxy', {
		hosts: ['127.0.0.1'],
		redirectOthers: true,
		cache: new BoundedImageCache({ maxEntries: 10, maxBytes: 1024 * 1024, ttlMs: 60000 }),
	});
	proxy = http.createServer(a);
	await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
	proxyPort = proxy.address().port;
});
after(() => { cdn.close(); proxy.close(); });

const via = (url, headers = {}) => fetch(`http://127.0.0.1:${proxyPort}/avatar-proxy?url=${encodeURIComponent(url)}`, { headers, redirect: 'manual' });

test('fetches allow-listed avatars without a Referer, even if the page sent one', async () => {
	cdnHits = [];
	const res = await via(`http://127.0.0.1:${cdnPort}/avatar.png`, { referer: 'http://localhost:3001/plugins/credits/src/credits.html' });
	assert.equal(res.status, 200);
	assert.equal(res.headers.get('content-type'), 'image/png');
	assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
	assert.deepEqual(cdnHits, [null], 'CDN saw no Referer');
});

test('serves repeats from cache', async () => {
	cdnHits = [];
	const url = `http://127.0.0.1:${cdnPort}/avatar.png?v=2`;
	await via(url); await via(url); await via(url);
	assert.equal(cdnHits.length, 1);
});

test('redirects hosts it does not cover to the original URL (never worse than raw)', async () => {
	const res = await via('https://example.com/some/avatar.png');
	assert.equal(res.status, 302);
	assert.equal(res.headers.get('location'), 'https://example.com/some/avatar.png');
});

test('rejects non-http schemes', async () => {
	assert.equal((await via('javascript:alert(1)')).status, 400);
	assert.equal((await via('file:///etc/passwd')).status, 400);
});

test('bounded cache evicts least-recently-used by count and by bytes', () => {
	const c = new BoundedImageCache({ maxEntries: 3, maxBytes: 100, ttlMs: 60000 });
	c.set('a', Buffer.alloc(10), 't'); c.set('b', Buffer.alloc(10), 't'); c.set('c', Buffer.alloc(10), 't');
	c.get('a');                               // a is now most recent
	c.set('d', Buffer.alloc(10), 't');        // evicts b (least recent)
	assert.deepEqual([...c.map.keys()], ['c', 'a', 'd']);
	c.set('big', Buffer.alloc(90), 't');      // over 100 bytes -> evicts until it fits
	assert.ok(c.bytes <= 100);
	assert.ok(c.map.has('big'));
	c.set('huge', Buffer.alloc(500), 't');    // bigger than the whole cache -> not stored
	assert.equal(c.map.has('huge'), false);
});
