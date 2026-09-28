/*
	End-to-end: Stream Credits plugin through the REAL plugin stack.

	Prerequisites (run from the repo root):
	  1. a build:  node scripts/build.js   (needs build/renderer + build/main)
	  2. a browser for Playwright, once:  npm i --no-save playwright-core && npx playwright-core install chromium
	  3. nothing else listening on port 3001 (quit Chat Toys)
	Run:  node tests/plugins/credits.e2e.cjs
*/
// End-to-end: Stream Credits plugin through the REAL plugin stack
//   production live page -> PluginWidgetHost -> sandboxed iframe -> ct-api.js SDK
//   -> RemoteBrokerProxy -> SocketServer 'plugin-rpc' -> (stand-in dashboard broker)
// The stand-in answers session.get the way PluginToy does and can push 'session'
// events, i.e. it replaces pluginForward -> Electron IPC -> PluginBridge -> PluginToy.
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

(async () => {
	// userData with the credits plugin installed in folder form
	const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-e2e-'));
	fs.cpSync(path.join(ROOT, 'misc', 'sample-plugins', 'credits'), path.join(userData, 'plugins', 'credits'), { recursive: true, filter: (p) => !p.endsWith('.zip') });
	const pm = new PluginManager({ getPath: () => userData, getAppPath: () => path.join(ROOT, 'nowhere') }, { log: () => {} });
	await pm.ready();

	const app = express();
	pm.mountRoutes(app);
	app.get('/live/', (req, res) => res.sendFile('live.html', { root: rendererPath }));
	app.use('/live', express.static(rendererPath, { index: false }));
	app.get('/groupWrap', (req, res) => res.send(`<!doctype html><html><body style="margin:0">
		<iframe class="group-item-iframe" src="/live/?single=true&toy=credits&widget=creditsWidget" style="width:1280px;height:720px;border:0"></iframe>
		<script>
			// the relay half of GroupWidget.vue, verbatim in behaviour
			const MSG='ct-obs-source-visibility', REQ='ct-obs-source-visibility-request', st={visible:true,active:true};
			const bc=()=>document.querySelectorAll('.group-item-iframe').forEach(f=>f.contentWindow.postMessage({type:MSG,...st,event:true},'*'));
			addEventListener('obsSourceActiveChanged',e=>{st.active=!!e.detail.active;bc();});
			addEventListener('obsSourceVisibleChanged',e=>{st.visible=!!e.detail.visible;bc();});
			addEventListener('message',e=>{ if(e.data&&e.data.type===REQ&&e.source) e.source.postMessage({type:MSG,...st,event:false},'*'); });
		</script></body></html>`));
	const server = http.createServer(app);
	await new Promise((r) => server.listen(PORT, r));
	const sockets = new SocketServer();
	sockets.attach(server);

	// ---- stand-in dashboard broker ----
	let snapshot = {
		id: 'ses_test', startedAt: Date.now() - 3600e3, live: false, chatterCount: 4,
		chatters: [
			{ id: 'UCa', name: 'Alice', platform: 'youtube', avatar: `http://localhost:${PORT}/live/assets/horse_racing/apple.png`, isMember: true, messages: 12, firstSeen: 1, points: 1500, pointsThisStream: 300 },
			{ id: 'bob', name: 'bob_twitch', platform: 'twitch', avatar: null, isMember: false, messages: 5, firstSeen: 2, points: 40, pointsThisStream: 0 },
			{ id: 'nb', name: 'Nightbot', platform: 'twitch', avatar: null, isMember: false, messages: 9, firstSeen: 3 },
			{ id: 'UCx', name: '<img src=x onerror=alert(1)>', platform: 'youtube', avatar: null, isMember: false, messages: 1, firstSeen: 4 },
		],
	};
	let sessionGets = 0;
	let denySession = false;
	const pluginClients = new Set();
	sockets.onMessage('plugin-rpc', (msg, socket) => {
		if (msg.kind === 'hello') { pluginClients.add(socket); return; }
		if (msg.kind === 'req') {
			let result, error;
			if (msg.reqType === 'session.get' && denySession) error = 'Permission denied: "session.get" requires session:read';
			else if (msg.reqType === 'session.get') { sessionGets++; result = JSON.parse(JSON.stringify(snapshot)); }
			else error = `Unknown or unpermitted request "${msg.reqType}"`;
			socket.send(JSON.stringify({ type: 'plugin-rpc', kind: 'res', slug: msg.slug, instanceId: msg.instanceId, reqId: msg.reqId, result, error }));
		}
	});
	const pushSession = () => { for (const s of pluginClients) s.send(JSON.stringify({ type: 'plugin-rpc', kind: 'evt', slug: 'credits', name: 'session', detail: { id: snapshot.id, chatterCount: snapshot.chatters.length } })); };

	// plugin settings (what PluginSettingsPage publishes)
	const dash = new WS(`ws://127.0.0.1:${PORT}`); await new Promise((r) => dash.on('open', r));
	const put = (key, value) => dash.send(JSON.stringify({ type: 'update', key, value, timestamp: Date.now() }));
	const settings = {
		before: 'Thanks for watching!\nArt by Someone\nMusic by Someone Else',
		chattersHeading: 'Chat crew', order: 'firstSeen', columns: 2,
		showAvatars: true, showPoints: true, showPointsThisStream: true,
		hideNames: 'Nightbot', membersHeading: 'Members', members: 'Patron One\nalice', autoMembers: true,
		after: 'See you next stream!', speed: 200, endBehavior: 'stop', textSize: 100,
		font: 'sans', textColor: '#FFFFFF', headingColor: '#FFD166', textShadow: true,
		creditsBox: { x: 0, y: 0, width: 1280, height: 720 },
	};
	put('credits-settings', settings);

	const browser = await chromium.launch();
	const errors = [];
	let dialogs = 0;
	const watchPage = (p) => {
		p.on('pageerror', (e) => errors.push(e.message));
		p.on('dialog', (d) => { dialogs++; d.dismiss(); });
	};

	// ======================= single widget page =======================
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
	watchPage(page);
	await page.goto(`http://localhost:${PORT}/live/?single=true&toy=credits&widget=creditsWidget`);
	let frame = null;
	for (let i = 0; i < 50 && !frame; i++) { frame = page.frames().find((f) => f.url().includes('/plugins/credits/')); if (!frame) await wait(100); }
	check('plugin iframe loads from /plugins/credits/ (sandboxed host)', !!frame);
	await frame.waitForSelector('.person', { timeout: 5000 }).catch(() => {});

	const content = await frame.evaluate(() => ({
		sections: [...document.querySelectorAll('#roll > .section')].map((s) => s.className),
		before: document.querySelector('.freeText')?.textContent,
		names: [...document.querySelectorAll('.chatters .name')].map((n) => n.textContent),
		pts: [...document.querySelectorAll('.chatters .pts')].map((n) => n.textContent),
		members: [...document.querySelectorAll('.memberList .name')].map((n) => n.textContent),
		avatars: document.querySelectorAll('.chatters img.avatar').length,
		initials: document.querySelectorAll('.chatters .initials').length,
		injected: document.querySelectorAll('#roll img[src="x"]').length,
		sdk: typeof window.CT,
	}));
	check('SDK injected into the plugin page', content.sdk === 'object');
	check('sections in order: Before, chatters, Members, After', JSON.stringify(content.sections) === JSON.stringify(['section', 'section chatters', 'section members', 'section']), content.sections.join(' | '));
	check('Before keeps line breaks', content.before === 'Thanks for watching!\nArt by Someone\nMusic by Someone Else');
	check('chatters in first-seen order, hidden names removed', JSON.stringify(content.names) === JSON.stringify(['Alice', 'bob_twitch', '<img src=x onerror=alert(1)>']), content.names.join(', '));
	check('chat names rendered as text, never HTML', content.injected === 0);
	check('points + points this stream shown (gain only when > 0)', JSON.stringify(content.pts) === JSON.stringify(['1,500 pts · +300 this stream', '40 pts']), content.pts.join(' / '));
	check('members = typed list + auto members, deduplicated', JSON.stringify(content.members) === JSON.stringify(['Patron One', 'alice']), content.members.join(', '));
	check('avatar image for chatters with one, initials otherwise', content.avatars === 1 && content.initials === 2, `${content.avatars} img / ${content.initials} initials`);

	// scrolling from the bottom up
	const y = () => frame.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('roll')).transform).m42);
	const y1 = await y(); await wait(600); const y2 = await y();
	check('scrolls upward', y2 < y1 - 50, `${Math.round(y1)} -> ${Math.round(y2)}`);

	// OBS scene switch: source hidden, then shown again -> restarts from the top
	await wait(1500);
	const beforeShow = await y();
	const getsBefore = sessionGets;
	await page.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: false } })); });
	await wait(200);
	await page.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })); });
	await wait(300);
	const afterShow = await y();
	check('restarts from the top when OBS shows the source', afterShow > beforeShow + 200, `${Math.round(beforeShow)} -> ${Math.round(afterShow)}`);
	check('re-fetches the chatter list on restart', sessionGets > getsBefore);

	// first "active" event for a source that loaded while off-air must still restart
	await wait(1500);
	const b2 = await y();
	await page.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })); });
	await wait(300);
	check('an "active" event with no prior "hidden" still restarts', (await y()) > b2 + 200);

	// late arrival while their spot is still below the screen -> appended
	await page.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })); });
	await wait(1200);
	snapshot.chatters.push({ id: 'late', name: 'LateLarry', platform: 'twitch', avatar: null, isMember: false, messages: 1, firstSeen: 5, points: 10, pointsThisStream: 10 });
	pushSession();
	await wait(800);
	const namesAfter = await frame.evaluate(() => [...document.querySelectorAll('.chatters .name')].map((n) => n.textContent));
	check('someone who chats during the credits is appended (spot still off-screen)', namesAfter.includes('LateLarry'), namesAfter.join(', '));

	// settings edit while showing (hide avatars) -> applied live
	put('credits-settings', { ...settings, showAvatars: false });
	await wait(600);
	check('settings changes apply live', (await frame.evaluate(() => document.querySelectorAll('.chatters img.avatar, .chatters .initials').length)) === 0);
	put('credits-settings', settings);
	await page.screenshot({ path: path.join(os.tmpdir(), 'credits-single.png') });

	// "stop" at the end: runs out and stays empty
	put('credits-settings', { ...settings, speed: 300, before: '', after: 'Bye' });
	await wait(300);
	await page.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })); });
	await wait(9000);
	const endState = await frame.evaluate(() => {
		const r = document.getElementById('roll').getBoundingClientRect();
		return { bottom: r.bottom };
	});
	check('stops when finished (roll has left the screen)', endState.bottom < 0, `roll bottom ${Math.round(endState.bottom)}`);
	put('credits-settings', settings);

	// ======================= inside a GroupWidget iframe =======================
	const gpage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
	watchPage(gpage);
	await gpage.goto(`http://localhost:${PORT}/groupWrap`);
	let gframe = null;
	for (let i = 0; i < 50 && !gframe; i++) { gframe = gpage.frames().find((f) => f.url().includes('/plugins/credits/')); if (!gframe) await wait(100); }
	await gframe.waitForSelector('.person', { timeout: 5000 }).catch(() => {});
	const gy = () => gframe.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('roll')).transform).m42);
	await wait(2000);
	const g1 = await gy();
	await gpage.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })); });
	await wait(300);
	check('inside a GroupWidget: group page relays OBS "shown" and credits restart', (await gy()) > g1 + 200);

	// ======================= older app / permission denied =======================
	denySession = true;
	await page.evaluate(() => { dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })); });
	await wait(800);
	const denied = await frame.evaluate(() => [...document.querySelectorAll('#roll > .section')].map((s) => s.className));
	check('session API refused (older app / not granted): texts + typed members still roll', JSON.stringify(denied) === JSON.stringify(['section', 'section members', 'section']), denied.join(' | '));
	denySession = false;

	// ======================= widget demo mode =======================
	put('demoMode', true);
	await wait(1000);
	const demoNames = await frame.evaluate(() => [...document.querySelectorAll('.chatters .name')].map((n) => n.textContent));
	check('demo mode shows sample chatters for positioning', demoNames.length >= 10 && demoNames.includes('PixelPanda'), `${demoNames.length} names`);
	await page.screenshot({ path: path.join(os.tmpdir(), 'credits-demo.png') });
	put('demoMode', false);

	check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
	check('no alert() dialogs from chat names', dialogs === 0);

	await browser.close(); sockets.detach(); server.close();
	const failed = results.filter((r) => !r.ok).length;
	console.log(`\n${results.length - failed}/${results.length} passed`);
	process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
