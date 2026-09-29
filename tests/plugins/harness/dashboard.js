// Stand-in dashboard for tests/plugins/pluginRuntime.e2e.cjs (plugin userData
// + Omni turns): real CommandProcessor, real Omni + Shout toys, a real
// PluginToy, a real PluginWidgetHost (local broker) running the plugin's page
// with the real SDK, and the real Omni settings page. pluginDataDB is a small
// in-memory stand-in (the SQLite store has its own node tests).
import { ref, h, createApp, nextTick } from 'vue';
import { setGlobalSocketRefPort, socketShallowRefReadOnly } from '@scripts/sockets';
import { chromeShallowRef } from '@scripts/chromeRef';
import { CommandProcessor } from '@scripts/CommandProcessor';
import { OmniRegistry } from '@scripts/OmniRegistry';
import Omni from '@toys/Omni/Omni';
import Shout from '@toys/Shout/Shout';
import { makePluginToyClass } from '@plugins/PluginToy.js';
import PluginWidgetHost from '@plugins/PluginWidgetHost.vue';
import HeadlessPluginRunner from '@plugins/HeadlessPluginRunner.vue';
import OmniPage from '@toys/Omni/OmniPage.vue';

window.isPrimaryWindow = true;
window.setElectronTimeout = setTimeout; window.setElectronInterval = setInterval;
window.clearElectronInterval = clearInterval; window.clearElectronTimeout = clearTimeout;
window.env = { isDev: false };
window.initPort = 3001;
// points: an in-memory stand-in for the users table
const balances = new Map();
window.ytctDB = {
	getUser: (id) => (balances.has(id) ? { youtube_id: id, display_name: id, points: balances.get(id) } : null),
	getUsers: () => [],
	updateUser: (id, { relativePoints = 0 } = {}) => { balances.set(id, (balances.get(id) || 0) + relativePoints); },
};
const tickers = new Set();
window.electronAPI = { invoke: async () => null, on() {}, send() {}, tick: (fn) => tickers.add(fn), clearTick: (fn) => tickers.delete(fn) };
setInterval(() => { for (const fn of tickers) fn(); }, 1000);

const calls = [];
const mem = new Map();
window.pluginDataDB = {
	limits: { bytesPerUser: 4096 },
	get: (p, u) => { calls.push(['get', p, u]); const v = mem.get(p + '|' + u); return v ? JSON.parse(v) : null; },
	set: (p, u, d) => { calls.push(['set', p, u]); const j = JSON.stringify(d); if (j.length > 4096) throw new Error(`userData: ${j.length} bytes for one chatter is over the 4096-byte limit`); mem.set(p + '|' + u, j); return JSON.parse(j); },
	update: (p, u, patch) => { calls.push(['update', p, u]); const next = { ...(window.pluginDataDB.get(p, u) || {}), ...patch }; return window.pluginDataDB.set(p, u, next); },
	remove: (p, u) => mem.delete(p + '|' + u),
	getMany: () => ({}), top: () => [], stats: () => ({ users: mem.size, bytes: 0 }), clear: () => 0,
};

localStorage.clear();
localStorage.setItem('enabledToys', JSON.stringify(['omni', 'shout']));

setGlobalSocketRefPort(3001);

// ?plugin=<slug> picks the installed plugin to host (default: the runtime
// test's "raffle")
const pluginSlug = new URL(location.href).searchParams.get('plugin') || 'raffle';
const manifest = await (await fetch('/plugins/installed.json')).json().then((j) => j.plugins.find((p) => p.slug === pluginSlug));
const Raffle = makePluginToyClass(manifest, {});

const toys = {};
const logs = [];
const app = {
	commands: chromeShallowRef('commands', {}),
	enabledToys: chromeShallowRef('enabledToys', []),
	serverPort: ref(3001),
	log: { err: (m) => logs.push(['err', String(m)]), error() {}, info() {}, log() {}, msg: (m) => logs.push(['msg', String(m)]) },
	toysData: Object.assign([Omni, Shout, Raffle], { asObject: { [pluginSlug]: Raffle, shout: Shout, omni: Omni } }),
	omniRegistry: new OmniRegistry(),
	assetsMgr: { getFileData() { return null; } },
	twitchEvents: null,
	chatProcessor: { onNewChats() {}, removeNewChatsListener() {} },
};
app.commandProcessor = new CommandProcessor(app, app.chatProcessor);
const tm = { chatToysApp: app, toys, getToyBySlug: (s) => toys[s] || null };
app.toyManager = tm;

const errs = [];
try { toys.omni = new Omni(tm); } catch (e) { errs.push('omni: ' + e.stack); }
try { toys.shout = new Shout(tm); } catch (e) { errs.push('shout: ' + e.stack); }
app.enabledToys.value = [...app.enabledToys.value, pluginSlug];
await nextTick();
try { toys[pluginSlug] = new Raffle(tm); } catch (e) { errs.push(pluginSlug + ': ' + e.stack); }

// the plugin's pages, hosted exactly like the dashboard does: its headless
// script (as HeadlessPluginRunner mounts it) and every widget (as the
// dashboard preview does). ?w=<px>&h=<px> sizes the widget boxes.
const q = new URL(location.href).searchParams;
const box = { width: (q.get('w') || 400) + 'px', height: (q.get('h') || 200) + 'px' };
const hosts = [];
// the headless brain runs in the real HeadlessPluginRunner (as MainWindow mounts it)
if (manifest.headless && manifest.headless.entry)
	hosts.push(h(HeadlessPluginRunner));
for (const widgetInfo of Raffle.widgetComponents)
	hosts.push(h('div', { class: 'widgetBox', 'data-widget': widgetInfo.widgetSlug, style: `position:relative;width:${box.width};height:${box.height};background:#556` }, [h(PluginWidgetHost, { widgetInfo })]));
createApp({ render: () => h('div', hosts) }).provide('ctApp', app).mount('#app');

// the Omni settings page (drag-and-drop pool + groups)
createApp({ render: () => h(OmniPage) }).provide('ctApp', app).mount('#omniPage');

let cmdSeq = 0;
const stateRefs = new Map();
window.__t = {
	// read a plugin CT.state key (what its headless published)
	state(key) {
		if (!stateRefs.has(key)) stateRefs.set(key, socketShallowRefReadOnly(`plugin:${pluginSlug}:state:${key}`, null));
		return JSON.parse(JSON.stringify(stateRefs.get(key).value));
	},
	app, toys, errs, calls, Raffle, logs, balances,
	setPoints(id, n) { balances.set(id, n); },
	// run a chat command through the plugin the way CommandProcessor does;
	// resolves with { accepted, reason }
	command(key, userId, params = {}, name = userId, avatar = null) {
		return new Promise((resolve) => {
			const msg = { id: 'm' + (++cmdSeq), authorUniqueID: userId, author: name, authorPFPUrl: avatar, messageText: '!' + key };
			toys[pluginSlug].onCommand(`${pluginSlug}__${key}`, msg, { points: balances.get(userId) || 0 }, params, {
				accept: () => resolve({ accepted: true }),
				reject: (reason) => { logs.push(['err', String(reason)]); resolve({ accepted: false, reason }); },
			});
		});
	},
	setGroups(slugs) { toys.omni.settings.omniGroups.value = [{ id: 'g1', name: 'G', includedToys: slugs }]; },
	shoutShow(on) { toys.shout.shoutMode.value = on ? 'SHOW' : 'IDLE'; },
	enable(list) { app.enabledToys.value = list; },
	groups() { return toys.omni.settings.omniGroups.value; },
	chips(sel) { return Array.from(document.querySelectorAll(sel + ' .toy-chip .label')).map((e) => e.textContent.trim()); },
};
document.getElementById('out').textContent = 'ready';
