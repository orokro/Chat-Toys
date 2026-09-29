/*
	End-to-end: the Artillery plugin (misc/sample-plugins/artillery) on the
	stand-in dashboard (tests/plugins/harness): its real headless brain and
	widget, the real PluginToy / SDK, points in memory.

	Covers: joining, wait timers turning commands away, bad arguments,
	driving, an aimed direct hit (found with the plugin's own physics),
	craters, damage, destroying a tank (kill message + points), leaving,
	a new map once the field is empty, demo mode, and screenshots.

	Prerequisites (run from the repo root):
	  1. a build:  node scripts/build.js   (needs build/main)
	  2. a browser for Playwright, once:  npm i --no-save playwright-core && npx playwright-core install chromium
	  3. nothing else listening on port 3001 (quit Chat Toys)
	Run:  node tests/plugins/artillery.e2e.cjs  [--shots <dir>] [--rebuild]
*/
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const { execSync } = require('child_process');
const express = require('express'), WS = require('ws');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..', '..');
const PLUGIN = path.join(ROOT, 'misc', 'sample-plugins', 'artillery');
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
		console.log('SKIP: misc/sample-plugins/artillery not present');
		process.exit(0);
	}
	const G = require(path.join(PLUGIN, 'src', 'game.js'));
	const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-art-'));
	fs.cpSync(PLUGIN, path.join(userData, 'plugins', 'artillery'), { recursive: true, dereference: true, filter: (p) => !p.endsWith('.zip') });
	const pm = new PluginManager({ getPath: () => userData, getAppPath: () => path.join(ROOT, 'src') }, { log: () => {} });
	await pm.ready();
	if (!fs.existsSync(path.join(HARNESS_OUT, 'dashboard.html')) || process.argv.includes('--rebuild')) {
		console.log('building the harness page...');
		execSync('npx vite build --config tests/plugins/harness/vite.config.mjs', { cwd: ROOT, stdio: 'inherit' });
	}

	const app = express(); pm.mountRoutes(app);
	// stand-in for the widget server's avatar proxy: everyone gets the plugin icon
	app.get('/avatar-proxy', (req, res) => res.sendFile(path.join(PLUGIN, 'icon.png')));
	app.use('/harness', express.static(HARNESS_OUT));
	const server = http.createServer(app); await new Promise((r) => server.listen(3001, r));
	const sockets = new SocketServer(); sockets.attach(server);
	const dash = new WS('ws://127.0.0.1:3001'); await new Promise((r) => dash.on('open', r));
	const put = (key, value) => dash.send(JSON.stringify({ type: 'update', key, value, timestamp: Date.now() }));

	const b = await chromium.launch();
	const d = await b.newPage({ viewport: { width: 1300, height: 800 } });
	const errs = [];
	await d.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	d.on('pageerror', (e) => errs.push('page: ' + e.message));
	d.on('response', (r) => { if (r.status() >= 400 && !/\/assets\/(icons|bg_tiles)\//.test(r.url())) errs.push(r.status() + ' ' + r.url()); });

	const T = (fn, arg) => d.evaluate(fn, arg);
	const st = (k) => T((k) => window.__t.state(k), k);
	const cmd = (key, u, args) => T(({ key, u, args }) => window.__t.command(key, u, args == null ? {} : { args }, u[0].toUpperCase() + u.slice(1), u === 'alice' ? 'https://yt3.ggpht.com/alice.jpg' : null), { key, u, args });
	const shot = (name) => SHOTS ? d.locator('.widgetBox').screenshot({ path: path.join(SHOTS, name) }) : null;

	try {
		await d.goto('http://localhost:3001/harness/dashboard.html?plugin=artillery&w=1280&h=720');
		await d.waitForFunction(() => document.getElementById('out').textContent === 'ready', null, { timeout: 15000 });
		check('plugin constructed', (await T(() => window.__t.errs)).length === 0, JSON.stringify(await T(() => window.__t.errs)));
		await T(() => { window.__t.toys.artillery.settings.waitSeconds.value = 2; });

		let world = null;
		for (let i = 0; i < 60 && !(world && world.terrain); i++) { await wait(100); world = await st('world'); }
		check('a map was generated', world && world.terrain.length === G.COLS, world ? `seed ${world.seed}` : 'none');
		check('...the same one the plugin physics would make from its seed', JSON.stringify(world.terrain) === JSON.stringify(G.generateTerrain(world.seed, { maxHeight: world.maxHeight })));
		check('...hills along the bottom (tallest 25% of the screen by default)', world.maxHeight === 25 && Math.max(...world.terrain) <= G.H * 0.25 + 1, `max ${Math.max(...world.terrain)}`);
		await wait(500);
		await shot('artillery-empty.png');

		// ---- joining ----
		let r = await cmd('join', 'alice'); const r2 = await cmd('join', 'bob');
		check('two tanks join', r.accepted && r2.accepted);
		r = await cmd('join', 'alice');
		check('a second !join is turned away', !r.accepted && /already have a tank/.test(r.reason), r.reason);
		await wait(200);
		let tanks = await st('tanks');
		check('each tank gets its own color', new Set(tanks.map((t) => t.color)).size === 2);
		check("the player's avatar (proxied) rides in the turret", /\/avatar-proxy\?url=/.test(tanks.find((t) => t.id === 'alice').avatar || ''), tanks.find((t) => t.id === 'alice').avatar);
		check('tanks sit on the ground with a wait timer', tanks.length === 2 && tanks.every((t) => Math.abs(t.y - G.heightAt(world.terrain, t.x)) < 1 && t.readyAt > Date.now()), JSON.stringify(tanks.map((t) => [t.name, t.x, t.y])));
		r = await cmd('fire', 'alice', '45');
		check('commands during the wait are turned away', !r.accepted && /isn't ready yet: \ds to go/.test(r.reason), r.reason);
		r = await cmd('fire', 'carl', '45');
		check('no tank -> told to !join', !r.accepted && /type !join to get a tank first/.test(r.reason), r.reason);
		await wait(600);
		await shot('artillery-joined.png');
		await wait(1600);

		// ---- bad arguments ----
		r = await cmd('fire', 'alice', 'high');
		check('!fire without an angle explains itself', !r.accepted && /Aim with an angle/.test(r.reason), r.reason);
		r = await cmd('move', 'alice', 'up');
		check("!move with a bad direction explains itself", !r.accepted && /isn't a direction/.test(r.reason), r.reason);

		// ---- driving ----
		tanks = await st('tanks');
		const a0 = tanks.find((t) => t.id === 'alice');
		const dir = a0.x < 640 ? 'right' : 'left';
		r = await cmd('move', 'alice', `${dir} 40`);
		check('!move accepted when ready', r.accepted, r.reason);
		await wait(900);
		tanks = await st('tanks');
		const a1 = tanks.find((t) => t.id === 'alice');
		check('the tank drove 40 along the ground', Math.abs(Math.abs(a1.x - a0.x) - 40) < 0.5 && Math.abs(a1.y - G.heightAt(world.terrain, a1.x)) < 1, `${a0.x} -> ${a1.x}`);
		check('...and must wait again', a1.readyAt > Date.now());
		await wait(2200);

		// ---- an aimed direct hit (searched with the plugin's own physics) ----
		async function aimAt(shooterId, targetId) {
			const w = await st('world');
			const tk = await st('tanks');
			const s = tk.find((t) => t.id === shooterId), tg = tk.find((t) => t.id === targetId);
			for (let power = 40; power <= 100; power += 2) {
				for (let angle = 10; angle <= 170; angle += 1) {
					const rad = G.launchRadians(angle, s.facing);
					const f = G.fly({ terrain: w.terrain, tanks: tk.map((t) => ({ ...t, alive: true })), from: G.muzzle(s, rad), rad, power, shooterId });
					if (f.hitTank === targetId) return { angle, power, duration: f.duration, target: tg, world: w };
				}
			}
			return null;
		}
		const aim = await aimAt('alice', 'bob');
		check('found a firing solution', !!aim, aim ? `${aim.angle}° power ${aim.power}` : 'none');
		const bal0 = await T(() => window.__t.balances.get('alice') || 0);
		r = await cmd('fire', 'alice', `${aim.angle} ${aim.power}`);
		check('!fire accepted', r.accepted, r.reason);
		await wait(Math.min(800, aim.duration / 2));
		await shot('artillery-shell.png');
		await wait(aim.duration - Math.min(800, aim.duration / 2) + 250);
		await shot('artillery-boom.png');
		tanks = await st('tanks');
		const w2 = await st('world');
		check('direct hit: 40 damage', tanks.find((t) => t.id === 'bob').hp === 60, JSON.stringify(tanks.map((t) => [t.id, t.hp])));
		check('the shell left a crater', w2.version > aim.world.version && w2.terrain.some((h, i) => h < aim.world.terrain[i]));
		const fx = (await st('fx')).items;
		check('the flight and the explosion were published', fx.some((f) => f.kind === 'shot') && fx.some((f) => f.kind === 'boom' && f.hits.some((h) => h.id === 'bob' && h.direct)));

		// two more direct hits destroy bob
		for (let k = 0; k < 2; k++) {
			await wait(2300);
			const a = await aimAt('alice', 'bob');
			if (!a) break;
			await cmd('fire', 'alice', `${a.angle} ${a.power}`);
			await wait(a.duration + 300);
		}
		await wait(300);
		tanks = await st('tanks');
		check('three direct hits destroy a tank', !tanks.some((t) => t.id === 'bob'), JSON.stringify(tanks.map((t) => [t.id, t.hp])));
		const logs = await T(() => window.__t.logs.map((l) => l.join(': ')));
		check('the kill is announced', logs.some((l) => /Alice destroyed Bob's tank/.test(l)), logs.slice(-3).join(' | '));
		check('the killer earns the kill reward', (await T(() => window.__t.balances.get('alice') || 0)) === bal0 + 25);
		check('kills are counted', tanks.find((t) => t.id === 'alice').kills === 1);
		await wait(400);
		await shot('artillery-destroyed.png');

		// ---- leaving + new map ----
		const seed = (await st('world')).seed;
		r = await cmd('leave', 'alice');
		check('!leave removes the tank', r.accepted && (await st('tanks')).length === 0);
		await wait(4600);
		check('an empty battlefield gets a fresh map', (await st('world')).seed !== seed);

		// ---- the tallest-hills setting ----
		await T(() => { window.__t.toys.artillery.settings.maxHeight.value = 55; });
		await wait(800);
		const tall = await st('world');
		check('changing the hill height on an empty field redraws the map', tall.maxHeight === 55 && Math.max(...tall.terrain) > G.H * 0.5 && JSON.stringify(tall.terrain) === JSON.stringify(G.generateTerrain(tall.seed, { maxHeight: 55 })), `max ${Math.max(...tall.terrain)}`);
		await shot('artillery-tall-hills.png');
		await T(() => { window.__t.toys.artillery.settings.maxHeight.value = 25; });
		await wait(800);

		// ---- demo mode ----
		put('demoMode', true);
		await wait(2600);
		await shot('artillery-demo.png');
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
