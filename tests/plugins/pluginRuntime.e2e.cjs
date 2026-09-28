/*
	End-to-end: the plugin runtime on a stand-in dashboard.

	A small Vite-built page (tests/plugins/harness) runs the REAL
	CommandProcessor, Omni + Shout toys, a real PluginToy and a real
	PluginWidgetHost hosting a test plugin with the real SDK (ct-api.js), so:
	  - CT.userData.* goes SDK -> host -> PluginToy -> window.pluginDataDB
	    (an in-memory stand-in; the SQLite store has node tests in
	    pluginUserData.test.mjs)
	  - CT.omni.* turns wait for / block the Omni group like a built-in alert

	Prerequisites (run from the repo root):
	  1. a build:  node scripts/build.js   (needs build/main)
	  2. a browser for Playwright, once:  npm i --no-save playwright-core && npx playwright-core install chromium
	  3. nothing else listening on port 3001 (quit Chat Toys)
	Run:  node tests/plugins/pluginRuntime.e2e.cjs
*/
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const { execSync } = require('child_process');
const express = require('express');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_OUT = path.join(os.tmpdir(), 'ct-plugin-runtime-harness');
const { SocketServer } = require(path.join(ROOT, 'build/main/system/sockets/SocketServer.js'));
const { PluginManager } = require(path.join(ROOT, 'build/main/system/PluginManager.js'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  (' + detail + ')' : ''}`); };

const MANIFEST = {
	manifestVersion: 1, id: 'test.raffle', slug: 'raffle', version: '1.0.0', apiVersion: 2, name: 'Raffle', class: 'toy',
	permissions: ['userdata:store'], commands: [], settings: [],
	widgets: [{ key: 'alertBox', slug: 'alertWidget', name: 'Alert', entry: 'w.html', omni: true, defaultBox: { x: 0, y: 0, width: 400, height: 200 } }],
};
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="s">x</div><script>
	window.ready = CT.ready();
</script></body></html>`;

(async () => {
	const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-h2-'));
	const pdir = path.join(userData, 'plugins', 'raffle'); fs.mkdirSync(pdir, { recursive: true });
	fs.writeFileSync(path.join(pdir, 'manifest.json'), JSON.stringify(MANIFEST));
	fs.writeFileSync(path.join(pdir, 'w.html'), PAGE);
	const pm = new PluginManager({ getPath: () => userData, getAppPath: () => path.join(ROOT, 'src') }, { log: () => {} });
	await pm.ready();
	console.log('building the harness page...');
	execSync('npx vite build --config tests/plugins/harness/vite.config.mjs', { cwd: ROOT, stdio: 'inherit' });

	const app = express(); pm.mountRoutes(app);
	app.use('/harness', express.static(HARNESS_OUT));
	const server = http.createServer(app); await new Promise((r) => server.listen(3001, r));
	const sockets = new SocketServer(); sockets.attach(server);

	const b = await chromium.launch();
	const d = await b.newPage(); const errs = [];
	// offline test: fail external requests (e.g. Google Fonts pulled in by
	// toy styles) at once instead of letting them hang the page's imports
	await d.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	d.on('pageerror', (e) => errs.push('dash: ' + e.message));
	d.on('requestfailed', (r) => { if (/localhost/.test(r.url())) errs.push('request failed: ' + r.url()); });
	// (toy icons / tiles 404 here: the harness doesn't serve the app's public dir)
	d.on('response', (r) => { if (r.status() >= 400 && !/\.(png|jpe?g|gif|svg|webp)$/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
	d.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); if (process.env.DEBUG) console.log('[page]', m.type(), m.text().slice(0, 200)); });
	try {
		await d.goto('http://localhost:3001/harness/dashboard.html');
		await d.waitForFunction(() => document.getElementById('out').textContent === 'ready', null, { timeout: 15000 });
		check('toys constructed', (await d.evaluate(() => window.__t.errs)).length === 0, JSON.stringify(await d.evaluate(() => window.__t.errs)));
		check('plugin with an "omni" widget is an alert toy', await d.evaluate(() => window.__t.Raffle.isAlertToy === true && window.__t.Raffle.alertWidgetSlug === 'alertWidget'));

		let frame = null;
		for (let i = 0; i < 60 && !frame; i++) { await wait(100); frame = d.frames().find((f) => f.url().includes('/plugins/raffle/')); }
		check('plugin page loaded', !!frame);
		await frame.evaluate(() => window.ready);

		// ---------- userData through the SDK ----------
		const ud = await frame.evaluate(async () => {
			const out = {};
			out.limits = await CT.userData.limits();
			out.set = await CT.userData.set('UCa', { v: 1, highScore: 5 });
			out.get = await CT.userData.get('UCa');
			out.upd = await CT.userData.update('UCa', { highScore: 9 });
			try { await CT.userData.set('UCa', { blob: 'x'.repeat(5000) }); out.big = 'no error'; } catch (e) { out.big = e.message; }
			return out;
		});
		check('userData: set / get / update reach the store', ud.get.highScore === 5 && ud.upd.highScore === 9, JSON.stringify(ud.upd));
		check('userData: keyed by the manifest id, not the slug', (await d.evaluate(() => window.__t.calls.every((c) => c[1] === 'test.raffle'))));
		check('userData: a limit error reaches the plugin as a clear message', /over the 4096-byte limit/.test(ud.big), ud.big);
		check('userData: limits() works', ud.limits && ud.limits.bytesPerUser === 4096);

		// permission revoked -> denied
		const denied = await d.evaluate(async () => { const t = window.__t.toys.raffle; t._perms.delete('userdata:store'); try { await t.request('userData.get', { user: 'UCa' }); return 'allowed'; } catch (e) { return e.message; } finally { t._perms.add('userdata:store'); } });
		check('userData: needs the userdata:store permission', /requires userdata:store/.test(denied), denied);

		// ---------- Omni turns ----------
		const t0 = await frame.evaluate(async () => { const t = await CT.omni.turn(); await CT.omni.done(); return t; });
		check('omni: not in a group -> turn granted at once, inOmni false', t0 && t0.inOmni === false, JSON.stringify(t0));

		await d.evaluate(() => window.__t.setGroups(['shout', 'raffle']));
		await wait(100);
		await d.evaluate(() => window.__t.shoutShow(true));
		await frame.evaluate(() => { window.got = null; CT.omni.turn().then((t) => { window.got = t; }); });
		await wait(700);
		check('omni: waits while another toy in the group is showing', (await frame.evaluate(() => window.got)) === null);
		await d.evaluate(() => window.__t.shoutShow(false));
		await wait(500);
		const got = await frame.evaluate(() => window.got);
		check('omni: granted once the slot frees, inOmni true', got && got.inOmni === true, JSON.stringify(got));
		check('omni: while holding, the plugin counts as showing', await d.evaluate(() => window.__t.toys.raffle.isShowing()));
		check('omni: ...so built-in toys in the group hold their fire', await d.evaluate(() => window.__t.app.omniRegistry.isBlocking('shout')));
		await frame.evaluate(() => CT.omni.done());
		check('omni: done() frees the slot', !(await d.evaluate(() => window.__t.app.omniRegistry.isBlocking('shout'))));

		// two turns serialize; run() releases even when fn throws
		const order = await frame.evaluate(async () => {
			const log = [];
			const a = CT.omni.run(async () => { log.push('a-start'); await new Promise((r) => setTimeout(r, 300)); log.push('a-end'); });
			const b = CT.omni.run(async () => { log.push('b'); throw new Error('boom'); }).catch((e) => log.push('b-threw'));
			await a; await b;
			return log;
		});
		check('omni: turns line up one at a time; run() releases on throw', JSON.stringify(order) === JSON.stringify(['a-start', 'a-end', 'b', 'b-threw']), JSON.stringify(order));
		check('omni: nothing held after run()', !(await d.evaluate(() => window.__t.toys.raffle.isShowing())));

		// a forgotten done() is released after maxMs
		await frame.evaluate(() => CT.omni.turn({ maxMs: 1000 }));
		check('omni: held...', await d.evaluate(() => window.__t.toys.raffle.isShowing()));
		await wait(1300);
		check('omni: ...and auto-released after maxMs', !(await d.evaluate(() => window.__t.toys.raffle.isShowing())));

		// no permissions needed for omni
		const noPerm = await d.evaluate(async () => { const t = window.__t.toys.raffle; const saved = new Set(t._perms); t._perms.clear(); try { const r = await t.request('omni.turn', {}); await t.request('omni.done', {}); return !!r; } catch (e) { return e.message; } finally { t._perms = saved; } });
		check('omni: needs no permission', noPerm === true, String(noPerm));

		// ---------- Omni settings page ----------
		const chips = () => d.evaluate(() => ({ pool: window.__t.chips('.chip-pool'), group: window.__t.chips('.group-drop') }));
		let c = await chips();
		check('omni page: the plugin shows in its group', c.group.includes('Raffle') && c.group.includes('Shout'), JSON.stringify(c));
		await d.evaluate(() => window.__t.setGroups(['shout']));
		await wait(100);
		c = await chips();
		check('omni page: an added plugin with an omni widget is offered in the pool', c.pool.includes('Raffle'), JSON.stringify(c));
		await d.evaluate(() => window.__t.setGroups(['shout', 'raffle']));
		await d.evaluate(() => window.__t.enable(['omni', 'shout']));
		await wait(100);
		c = await chips();
		check('omni page: a removed plugin vanishes from its group and the pool', !c.group.includes('Raffle') && !c.pool.includes('Raffle'), JSON.stringify(c));
		check('omni page: ...but stays in the saved group', (await d.evaluate(() => window.__t.groups()[0].includedToys)).includes('raffle'));
		await d.evaluate(() => window.__t.enable(['omni', 'shout', 'raffle']));
		await wait(100);
		c = await chips();
		check('omni page: re-adding it puts it back in the same group', c.group.includes('Raffle') && !c.pool.includes('Raffle'), JSON.stringify(c));

		// removing the plugin frees the slot and rejects waiters
		await d.evaluate(() => window.__t.shoutShow(true));
		await frame.evaluate(() => { window.rej = null; CT.omni.turn().catch((e) => { window.rej = e.message; }); });
		await wait(200);
		await d.evaluate(() => window.__t.toys.raffle.end());
		await wait(300);
		check('omni: a removed plugin rejects its waiting turns', (await frame.evaluate(() => window.rej)) === 'Plugin disabled', await frame.evaluate(() => window.rej));
		check('omni: ...and never blocks the group afterwards', await d.evaluate(() => !window.__t.toys.raffle.isShowing()));
	} catch (e) {
		check('run', false, e.stack);
	}
	check('no page errors', errs.length === 0, errs.join(' | '));
	await b.close(); server.close();
	fs.rmSync(userData, { recursive: true, force: true });
	const passed = results.filter(Boolean).length;
	console.log(`\n${passed}/${results.length} passed`);
	process.exit(passed === results.length ? 0 : 1);
})();
