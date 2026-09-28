/*
	End-to-end: the Fruit Machine plugin (misc/sample-plugins/fruitmachine)
	on the stand-in dashboard (tests/plugins/harness): its real headless brain
	and widget, the real PluginToy / SDK / Omni toy, points in memory.

	Covers: bet validation and rejections, taking the stake, forced wins
	paying the right amount, the spin showing / hiding in the widget, the
	queue badge, waiting its turn in an Omni group, demo mode's return
	figure, custom settings reaching the widget, and screenshots.

	Prerequisites (run from the repo root):
	  1. a build:  node scripts/build.js   (needs build/main)
	  2. a browser for Playwright, once:  npm i --no-save playwright-core && npx playwright-core install chromium
	  3. nothing else listening on port 3001 (quit Chat Toys)
	Run:  node tests/plugins/fruitmachine.e2e.cjs  [--shots <dir>]
*/
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const { execSync } = require('child_process');
const express = require('express'), WS = require('ws');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..', '..');
const PLUGIN = path.join(ROOT, 'misc', 'sample-plugins', 'fruitmachine');
const HARNESS_OUT = path.join(os.tmpdir(), 'ct-plugin-runtime-harness');
const { SocketServer } = require(path.join(ROOT, 'build/main/system/sockets/SocketServer.js'));
const { PluginManager } = require(path.join(ROOT, 'build/main/system/PluginManager.js'));
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  (' + detail + ')' : ''}`); };

(async () => {
	if (!fs.existsSync(path.join(PLUGIN, 'manifest.json'))) {
		console.log('SKIP: misc/sample-plugins/fruitmachine not present');
		process.exit(0);
	}
	const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-fm-'));
	fs.cpSync(PLUGIN, path.join(userData, 'plugins', 'fruitmachine'), { recursive: true, dereference: true, filter: (p) => !p.endsWith('.zip') });
	const pm = new PluginManager({ getPath: () => userData, getAppPath: () => path.join(ROOT, 'src') }, { log: () => {} });
	await pm.ready();
	if (!fs.existsSync(path.join(HARNESS_OUT, 'dashboard.html')) || process.argv.includes('--rebuild')) {
		console.log('building the harness page...');
		execSync('npx vite build --config tests/plugins/harness/vite.config.mjs', { cwd: ROOT, stdio: 'inherit' });
	}

	const app = express(); pm.mountRoutes(app);
	app.use('/harness', express.static(HARNESS_OUT));
	const server = http.createServer(app); await new Promise((r) => server.listen(3001, r));
	const sockets = new SocketServer(); sockets.attach(server);
	const dash = new WS('ws://127.0.0.1:3001'); await new Promise((r) => dash.on('open', r));
	const put = (key, value) => dash.send(JSON.stringify({ type: 'update', key, value, timestamp: Date.now() }));

	const b = await chromium.launch();
	const d = await b.newPage({ viewport: { width: 900, height: 700 } });
	const errs = [];
	await d.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	d.on('pageerror', (e) => errs.push('page: ' + e.message));
	d.on('response', (r) => { if (r.status() >= 400 && !/\/assets\/(icons|bg_tiles)\//.test(r.url())) errs.push(r.status() + ' ' + r.url()); });

	const T = (fn, arg) => d.evaluate(fn, arg);
	try {
		await d.goto('http://localhost:3001/harness/dashboard.html?plugin=fruitmachine&w=420&h=420');
		await d.waitForFunction(() => document.getElementById('out').textContent === 'ready', null, { timeout: 15000 });
		check('plugin constructed', (await T(() => window.__t.errs)).length === 0, JSON.stringify(await T(() => window.__t.errs)));
		check('an Omni-compatible alert toy', await T(() => window.__t.Raffle.isAlertToy === true && window.__t.Raffle.alertWidgetSlug === 'machineWidget'));

		// frames: headless + widget
		let head = null, wid = null;
		for (let i = 0; i < 80 && !(head && wid); i++) {
			await wait(100);
			head = d.frames().find((f) => f.url().includes('/plugins/fruitmachine/src/headless.html'));
			wid = d.frames().find((f) => f.url().includes('/plugins/fruitmachine/src/widget.html'));
		}
		check('headless + widget pages loaded', !!(head && wid));
		await wid.waitForFunction(() => document.querySelector('.cell img') && document.querySelector('.cell img').src.includes('/plugins/fruitmachine/assets/'), null, { timeout: 5000 });
		check('the headless published the built-in symbol images', true);
		check('hidden while nobody plays', await wid.evaluate(() => document.getElementById('stage').classList.contains('hidden')));

		// ---- bets ----
		await T(() => { window.__t.setPoints('alice', 1000); window.__t.setPoints('bob', 5); });
		const cmd = (u, bet) => T(({ u, bet }) => window.__t.command('fruitmachine', u, bet === undefined ? {} : { bet }, u === 'alice' ? 'Alice' : 'Bob'), { u, bet });
		let r = await cmd('bob', '50');
		check('rejects a bet bigger than the balance', !r.accepted && /only have 5/.test(r.reason), r.reason);
		r = await cmd('bob', undefined);
		check('explains usage when the bet is missing', !r.accepted && /Bet some points, e.g. !fruitmachine 10/.test(r.reason), r.reason);
		r = await cmd('bob', 'lots');
		check("rejects a bet that isn't a number", !r.accepted && /isn't a bet/.test(r.reason), r.reason);
		r = await cmd('alice', '5');
		check('rejects under the minimum', !r.accepted && /minimum bet is 10/.test(r.reason), r.reason);

		// force three cherries (drawSymbol(0) = cherries) -> 10x
		await head.evaluate(() => { Math.random = () => 0; });
		r = await cmd('alice', '100');
		check('accepts a valid bet', r.accepted);
		await wait(150);
		const midBal = await T(() => window.__t.balances.get('alice'));
		check('took the stake and paid the forced 3x Cherries win (100 x 10)', midBal === 1000 - 100 + 1000, String(midBal));
		await wait(900);
		check('the machine is on screen while spinning', await wid.evaluate(() => document.getElementById('stage').classList.contains('shown')));
		check('shows who is playing and the bet', (await wid.evaluate(() => document.getElementById('name').textContent + '|' + document.getElementById('bet').textContent)) === 'Alice|bet 100');
		if (SHOTS) await d.locator('.widgetBox').screenshot({ path: path.join(SHOTS, 'fruit-spinning.png') });
		await wait(3000);
		const resText = await wid.evaluate(() => document.getElementById('result').textContent);
		check('result: Three Cherries! +1000', resText === 'Three Cherries! +1000', resText);
		check('the winning reels light up', (await wid.evaluate(() => document.querySelectorAll('.reel.win').length)) === 3);
		const shownSyms = await wid.evaluate(() => {
			// the symbol under the payline on each reel
			return Array.from(document.querySelectorAll('.reel')).map((reel) => {
				const rr = reel.getBoundingClientRect();
				const mid = rr.top + rr.height / 2;
				const c = Array.from(reel.querySelectorAll('.cell')).find((c) => { const b = c.getBoundingClientRect(); return b.top <= mid && b.bottom >= mid; });
				return c && c.dataset.sym;
			});
		});
		check('the reels stopped on the result', JSON.stringify(shownSyms) === '["cherries","cherries","cherries"]', JSON.stringify(shownSyms));
		if (SHOTS) await d.locator('.widgetBox').screenshot({ path: path.join(SHOTS, 'fruit-win.png') });
		const logs = await T(() => window.__t.logs.map((l) => l.join(': ')));
		check('announced the win on screen', logs.some((l) => /msg: .*Alice: Three Cherries! Won 1000 points \(bet 100\)/.test(l)), logs.slice(-2).join(' | '));
		await wait(4200);
		check('hides again after the result', await wid.evaluate(() => document.getElementById('stage').classList.contains('hidden')));

		// ---- a miss, and the queue ----
		// lemon, cherries, bell: no win
		await head.evaluate(() => { const seq = [0.35, 0.1, 0.9]; let i = 0; Math.random = () => seq[i++ % 3]; });
		const before = await T(() => window.__t.balances.get('alice'));
		r = await cmd('alice', '200');
		const r2 = await cmd('alice', '50');
		check('a second bet queues behind the first', r.accepted && r2.accepted);
		await wait(1000);
		check('the queue badge shows who is waiting', (await wid.evaluate(() => document.getElementById('queued').textContent)) === '+1 waiting', await wid.evaluate(() => document.getElementById('queued').textContent));
		await wait(3200);
		check('a miss shows "No win"', (await wid.evaluate(() => document.getElementById('result').textContent)) === 'No win');
		if (SHOTS) await d.locator('.widgetBox').screenshot({ path: path.join(SHOTS, 'fruit-miss.png') });
		await wait(12000);
		const after = await T(() => window.__t.balances.get('alice'));
		check('both stakes taken, nothing paid for misses', after === before - 250, `${before} -> ${after}`);
		check('both spins played, then hidden', await wid.evaluate(() => document.getElementById('stage').classList.contains('hidden')));

		// ---- Omni: waits while another alert in its group is showing ----
		await T(() => { window.__t.setGroups(['shout', 'fruitmachine']); window.__t.shoutShow(true); });
		await wait(100);
		r = await cmd('alice', '10');
		await wait(1500);
		check('in an Omni group it waits while Shout is showing', r.accepted && await wid.evaluate(() => document.getElementById('stage').classList.contains('hidden')));
		await T(() => window.__t.shoutShow(false));
		await wait(1200);
		check('...and plays once the slot is free', await wid.evaluate(() => document.getElementById('stage').classList.contains('shown')));
		check('...while it plays, Shout holds its fire', await T(() => window.__t.app.omniRegistry.isBlocking('shout')));
		await wait(8000);

		// ---- settings reach the widget ----
		await T(() => {
			const s = window.__t.toys.fruitmachine.settings;
			s.appearance.value = 'slideLeft';
			s.title.value = 'LUCKY 7s';
			s.accentColor.value = '#1E88E5';
		});
		await wait(1200);
		const look = await wid.evaluate(() => ({ a: document.getElementById('stage').dataset.appearance, t: document.getElementById('title').textContent, c: document.getElementById('stage').style.getPropertyValue('--accent') }));
		check('appearance, title and color follow the settings', look.a === 'slideLeft' && look.t === 'LUCKY 7s' && look.c === '#1E88E5', JSON.stringify(look));

		// ---- demo mode ----
		put('demoMode', true);
		await wait(2500);
		const rtp = await wid.evaluate(() => document.getElementById('rtp').textContent);
		check('demo mode shows a sample spin and the long-run return', /pays back 92\.6% · 1 in 5\.\d spins win/.test(rtp) && await wid.evaluate(() => document.getElementById('stage').classList.contains('shown')), rtp);
		await wait(2000);
		if (SHOTS) await d.locator('.widgetBox').screenshot({ path: path.join(SHOTS, 'fruit-demo.png') });
		put('demoMode', false);
	} catch (e) {
		check('run', false, e.stack);
	}
	check('no page errors', errs.length === 0, errs.join(' | '));
	await b.close(); dash.close(); server.close();
	fs.rmSync(userData, { recursive: true, force: true });
	const passed = results.filter(Boolean).length;
	console.log(`\n${passed}/${results.length} passed`);
	process.exit(passed === results.length ? 0 : 1);
})();
