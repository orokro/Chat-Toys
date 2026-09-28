/*
	End-to-end: widgets show the REAL command word (renamed / join2), not a
	hard-coded one.

	  dashboard Toy.publishCommandWords  ->  '<slug-kebab>-commands' socket key
	    -> built-in widget via useCommandWords()          (Horse Racing)
	    -> plugin iframe via PluginWidgetHost -> CT.commands / CT.commandWord()

	A WebSocket client stands in for the dashboard and publishes the key the
	way Toy.publishCommandWords does.

	Prerequisites (run from the repo root):
	  1. a build:  node scripts/build.js   (needs build/renderer + build/main)
	  2. a browser for Playwright, once:  npm i --no-save playwright-core && npx playwright-core install chromium
	  3. nothing else listening on port 3001 (quit Chat Toys)
	Run:  node tests/plugins/commandWords.e2e.cjs
*/
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const express = require('express'), WS = require('ws');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..', '..');
const { SocketServer } = require(path.join(ROOT, 'build/main/system/sockets/SocketServer.js'));
const { PluginManager } = require(path.join(ROOT, 'build/main/system/PluginManager.js'));

const PORT = 3001;
const rendererPath = path.join(ROOT, 'build', 'renderer');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

// a tiny plugin with one command, whose widget prints its hint
const MANIFEST = {
	manifestVersion: 1,
	id: 'test.commandwords',
	slug: 'cmdwords',
	version: '1.0.0',
	apiVersion: 2,
	name: 'Command Words Test',
	class: 'game',
	permissions: [],
	commands: [{ key: 'join', default: 'join', description: 'Join the game' }],
	settings: [],
	widgets: [{ key: 'mainBox', slug: 'mainWidget', name: 'Main', entry: 'index.html', defaultBox: { x: 0, y: 0, width: 600, height: 200 } }],
};
const WIDGET = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="hint">loading</div><div id="active"></div>
<script>
	const render = () => {
		document.getElementById('hint').textContent = 'Type !' + CT.commandWord('join') + ' to play';
		document.getElementById('active').textContent = String(!!(CT.commands.join && CT.commands.join.active));
	};
	CT.onLoad(render);
	CT.onCommandsChange(render);
</script></body></html>`;

(async () => {
	const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-e2e-cmd-'));
	const pdir = path.join(userData, 'plugins', 'cmdwords');
	fs.mkdirSync(pdir, { recursive: true });
	fs.writeFileSync(path.join(pdir, 'manifest.json'), JSON.stringify(MANIFEST));
	fs.writeFileSync(path.join(pdir, 'index.html'), WIDGET);

	const pm = new PluginManager({ getPath: () => userData, getAppPath: () => path.join(ROOT, 'nowhere') }, { log: () => {} });
	await pm.ready();

	const app = express();
	pm.mountRoutes(app);
	app.get('/live/', (req, res) => res.sendFile('live.html', { root: rendererPath }));
	app.use('/live', express.static(rendererPath, { index: false }));
	const server = http.createServer(app);
	await new Promise((r) => server.listen(PORT, r));
	const sockets = new SocketServer();
	sockets.attach(server);

	// stand-in dashboard publishing command words
	const dash = new WS(`ws://127.0.0.1:${PORT}`); await new Promise((r) => dash.on('open', r));
	const put = (key, value) => dash.send(JSON.stringify({ type: 'update', key, value, timestamp: Date.now() }));

	// widgets render once their settings (and box) arrive, as from the dashboard
	put('horse-racing-settings', { widgetBox: { x: 0, y: 0, width: 1280, height: 720 }, raceLength: 100 });
	put('cmdwords-settings', { mainBox: { x: 0, y: 0, width: 600, height: 200 } });

	const browser = await chromium.launch();
	const errors = [];

	try {
		// ---- built-in: Horse Racing ----
		const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(`http://localhost:${PORT}/live/?single=true&toy=horseRacing&widget=track`);
		await wait(1500);
		const idle = () => page.evaluate(() => (document.querySelector('.idle-msg') || {}).textContent || '');
		check('horse: falls back to the default word before the dashboard publishes', /Type !joinrace to play!/.test(await idle()), (await idle()).trim());

		put('horse-racing-commands', { joinrace: { command: 'race', enabled: true, active: true }, horsebet: { command: 'bet', enabled: true, active: true }, eat: { command: 'eat', enabled: true, active: true } });
		await wait(500);
		check('horse: shows the renamed word', /Type !race to play!/.test(await idle()), (await idle()).trim());

		// ---- plugin ----
		put('cmdwords-commands', { join: { command: 'join2', enabled: true, active: true } });
		await wait(200);
		const ppage = await browser.newPage({ viewport: { width: 800, height: 300 } });
		ppage.on('pageerror', (e) => errors.push(e.message));
		await ppage.goto(`http://localhost:${PORT}/live/?single=true&toy=cmdwords&widget=mainWidget`);
		let frame = null;
		for (let i = 0; i < 40 && !frame; i++) {
			await wait(150);
			frame = ppage.frames().find((f) => f.url().includes('/plugins/cmdwords/'));
		}
		check('plugin: widget iframe loaded', !!frame);
		if (frame) {
			await wait(800);
			const hint = () => frame.evaluate(() => document.getElementById('hint').textContent);
			const active = () => frame.evaluate(() => document.getElementById('active').textContent);
			check('plugin: CT.commandWord gives the assigned word at load', (await hint()) === 'Type !join2 to play', await hint());
			check('plugin: CT.commands carries active', (await active()) === 'true');

			put('cmdwords-commands', { join: { command: 'play', enabled: true, active: false } });
			await wait(500);
			check('plugin: a rename reaches the widget live (onCommandsChange)', (await hint()) === 'Type !play to play', await hint());
			check('plugin: shadowed/disabled shows as not active', (await active()) === 'false');
		}

		check('no page errors', errors.length === 0, errors.join(' | '));
	} catch (e) {
		check('run', false, e.stack || e.message);
	} finally {
		await browser.close();
		dash.close();
		server.close();
		fs.rmSync(userData, { recursive: true, force: true });
	}

	const failed = results.filter((r) => !r.ok).length;
	console.log(`\n${results.length - failed}/${results.length} passed`);
	process.exit(failed ? 1 : 0);
})();
