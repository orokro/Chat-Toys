/*
	End-to-end: Emoji Fountain !dance, with the real toy and the real widget
	on a stand-in page (tests/emojiFountain/harness) over the real socket
	server.

	Covers: nothing loads or animates until someone dances (idle = no
	animation frames, dance data not fetched), !dance without an emoji is
	turned away, a crew tossed in / dancing / hopping off, outfit colors from
	a known emote, a dance named in chat, two crews at once (different dances,
	different spots), the floor filling up, turned-off dances, going idle
	again afterwards, demo mode, and screenshots.

	Prerequisites (run from the repo root):
	  1. a build:  node scripts/build.js   (needs build/main)
	  2. a browser for Playwright, once:  npm i --no-save playwright-core && npx playwright-core install chromium
	  3. nothing else listening on port 3001 (quit Chat Toys)
	Run:  node tests/emojiFountain/dance.e2e.cjs  [--shots <dir>] [--rebuild]
*/
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const { execSync } = require('child_process');
const express = require('express'), WS = require('ws');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(os.tmpdir(), 'ct-emoji-dance-harness');
const { SocketServer } = require(path.join(ROOT, 'build/main/system/sockets/SocketServer.js'));
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  (' + detail + ')' : ''}`); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (a, b, tol = 30) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

(async () => {
	if (!fs.existsSync(path.join(OUT, 'dance.html')) || process.argv.includes('--rebuild')) {
		console.log('building the harness page...');
		execSync('npx vite build --config tests/emojiFountain/harness/vite.config.mjs', { cwd: ROOT, stdio: 'inherit' });
	}
	const app = express();
	app.get('/test-emote.png', (req, res) => res.sendFile(path.join(__dirname, 'test-emote.png')));
	app.use('/harness', express.static(OUT));
	const server = http.createServer(app); await new Promise((r) => server.listen(3001, r));
	const sockets = new SocketServer(); sockets.attach(server);
	const dash = new WS('ws://127.0.0.1:3001'); await new Promise((r) => dash.on('open', r));
	const put = (key, value) => dash.send(JSON.stringify({ type: 'update', key, value, timestamp: Date.now() }));

	const b = await chromium.launch();
	const d = await b.newPage({ viewport: { width: 1300, height: 760 } });
	const errs = [], fetched = [];
	await d.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	d.on('pageerror', (e) => errs.push('page: ' + e.message));
	d.on('request', (r) => fetched.push(r.url()));
	d.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });

	const T = (fn, arg) => d.evaluate(fn, arg);
	const cmd = (text, emojis) => T(({ text, emojis }) => window.__t.command('dance', text, emojis), { text, emojis });
	const dancers = () => T(() => (window.__emojiDance ? window.__emojiDance.dancers() : []));
	const running = () => T(() => window.__emojiDance.running());
	const rafs = () => T(() => window.__t.rafCalls());
	const set = (k, v) => T(({ k, v }) => { window.__t.settings()[k].value = v; }, { k, v });
	const shot = (name) => SHOTS ? d.locator('.widgetBox').screenshot({ path: path.join(SHOTS, name) }) : null;
	const danceChunk = () => fetched.some((u) => /dances-[\w-]+\.js$|dances\.json/.test(u));

	try {
		await d.goto('http://localhost:3001/harness/dance.html');
		await d.waitForFunction(() => document.getElementById('out').textContent === 'ready', null, { timeout: 15000 });
		check('toy constructed', (await T(() => window.__t.errs)).length === 0, JSON.stringify(await T(() => window.__t.errs)));
		await wait(1500);

		// ---- idle costs nothing ----
		let r0 = await rafs(); await wait(2000); let r1 = await rafs();
		check('idle: no animation frames at all', r1 === r0, `${r1 - r0} frames in 2s`);
		check("idle: the dance data isn't loaded", !danceChunk() && !(await T(() => window.__emojiDance.loaded())));

		// ---- no emoji ----
		let r = await cmd('!dance please', []);
		check('!dance without an emoji is turned away', !r.accepted && /emoji/.test(r.reason), r.reason);

		// ---- a crew: one unicode emoji + a known two-color emote ----
		r = await cmd('!dance 😎 floss', [{ url: 'http://localhost:3001/test-emote.png', code: 'TestEmote', pos: [[0, 0]] }]);
		check('!dance accepted', r.accepted, r.reason);
		let parts = (await T(() => window.__t.particles())).filter((p) => p.type === 'dance');
		check('one dancer per emoji, one crew, the named dance', parts.length === 2 && new Set(parts.map((p) => p.crew)).size === 1 && parts.every((p) => p.dance === 'floss'), JSON.stringify(parts.map((p) => [p.dance, p.url || p.char])));
		check('same dance starts in sync', new Set(parts.map((p) => p.danceStart)).size === 1);
		await wait(450);
		await shot('dance-tossed-in.png');
		await wait(900);
		let ds = await dancers();
		check('both dancers are live', ds.length === 2, JSON.stringify(ds));
		check('the dance data loaded on first use', danceChunk());
		check('animating while they dance', await running());
		const emote = ds.find((x) => x.id === parts.find((p) => p.url).id);
		check('outfit from the emote: red shirt, blue pants', emote && near(hex(emote.shirt), [230, 30, 60]) && near(hex(emote.pants), [40, 90, 220]), emote && `${emote.shirt} / ${emote.pants}`);
		const cool = ds.find((x) => x !== emote);
		check('outfit from 😎: a yellow shirt', cool && hex(cool.shirt)[0] > 180 && hex(cool.shirt)[1] > 130 && hex(cool.shirt)[2] < 110, cool && cool.shirt);
		await wait(1200);
		await shot('dance-floss.png');

		// ---- a second crew at once ----
		r = await cmd('!dance 🎃🐸🤖', []);
		check('a second crew joins', r.accepted, r.reason);
		parts = (await T(() => window.__t.particles())).filter((p) => p.type === 'dance');
		const crews = [...new Set(parts.map((p) => p.crew))].map((c) => parts.filter((p) => p.crew === c));
		check('two crews on the floor', crews.length === 2 && crews[1].length === 3);
		check('...dancing a different dance', crews[1][0].dance !== 'floss', crews[1][0].dance);
		const [a1, a2] = crews.map((c) => [c[0].crewLeft, c[0].crewRight]);
		check('...in a different spot', Math.min(a1[1], a2[1]) - Math.max(a1[0], a2[0]) <= 1, JSON.stringify([a1, a2]));
		await wait(2400);
		await shot('dance-two-crews.png');

		// ---- the floor fills up ----
		await set('danceMaxOnScreen', 6);
		r = await cmd('!dance 👻👻👻', []);
		check('a crew is trimmed to the room left', r.accepted && (await T(() => window.__t.particles())).filter((p) => p.type === 'dance').length === 6);
		r = await cmd('!dance 👻', []);
		check('a full floor turns !dance away', !r.accepted && /full/.test(r.reason), r.reason);

		// ---- turned-off dances ----
		const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/renderer/toys/EmojiFountain/dances/danceMeta.json'), 'utf8'));
		await set('danceMaxOnScreen', 30);
		await set('danceDisabled', meta.order.filter((id) => id !== 'ymca'));
		r = await cmd('!dance 🦄 floss', []);
		parts = (await T(() => window.__t.particles())).filter((p) => p.type === 'dance');
		check('only turned-on dances are picked (even if named)', r.accepted && parts[parts.length - 1].dance === 'ymca', parts[parts.length - 1].dance);
		await set('danceDisabled', meta.order);
		r = await cmd('!dance 🦄', []);
		check('everything turned off -> !dance turned away', !r.accepted, r.reason);
		await set('danceDisabled', []);

		// ---- hop off, then idle again ----
		await wait(5200);
		await shot('dance-hop-off.png');
		const longest = Math.max(...(await T(() => window.__t.particles())).filter((p) => p.type === 'dance').map((p) => p.createdAt + p.duration * 1000));
		await wait(Math.max(0, longest - Date.now()) + 600);
		check('everyone hopped off', (await dancers()).length === 0);
		check('the animation loop stopped', !(await running()));
		r0 = await rafs(); await wait(1500); r1 = await rafs();
		check('idle again: no animation frames', r1 === r0, `${r1 - r0} frames in 1.5s`);

		// ---- fireworks still burst (they share the emoji sampler) ----
		r = await T(() => new Promise((resolve) => window.__t.toys.emojiFountain.onCommand('firework', { messageText: '!firework', emojis: [{ url: 'http://localhost:3001/test-emote.png', pos: [[0, 0]] }] }, {}, {},
			{ accept: () => resolve({ accepted: true }), reject: (reason) => resolve({ accepted: false, reason }) })));
		await wait(3200);
		const sparks = await T(() => {
			const c = document.querySelector('.firework-canvas-wrap canvas');
			const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
			let red = 0, blue = 0;
			for (let i = 0; i < px.length; i += 4) {
				if (px[i + 3] < 200) continue;
				if (px[i] > 180 && px[i + 1] < 90 && px[i + 2] < 110) red++;
				if (px[i + 2] > 170 && px[i] < 90) blue++;
			}
			return { red, blue };
		});
		check('fireworks still burst in the emote\'s colors', r.accepted && sparks.red > 50 && sparks.blue > 50, JSON.stringify(sparks));
		await shot('firework.png');
		await wait(1500);

		// ---- demo mode ----
		put('demoMode', true);
		await wait(2600);
		ds = await dancers();
		check('demo mode: a demo crew dances', ds.length === 2, JSON.stringify(ds.map((x) => x.dance)));
		await shot('dance-demo.png');
		put('demoMode', false);
	} catch (e) {
		check('run', false, e.stack);
	}
	check('no page errors', errs.length === 0, errs.join(' | '));
	await b.close(); dash.close(); server.close();
	const passed = results.filter(Boolean).length;
	console.log(`\n${passed}/${results.length} passed`);
	process.exit(passed === results.length ? 0 : 1);
})();
