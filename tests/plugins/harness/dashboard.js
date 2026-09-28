// Stand-in dashboard for tests/plugins/pluginRuntime.e2e.cjs (plugin userData
// + Omni turns): real CommandProcessor, real Omni + Shout toys, a real
// PluginToy, a real PluginWidgetHost (local broker) running the plugin's page
// with the real SDK, and the real Omni settings page. pluginDataDB is a small
// in-memory stand-in (the SQLite store has its own node tests).
import { ref, h, createApp, nextTick } from 'vue';
import { setGlobalSocketRefPort } from '@scripts/sockets';
import { chromeShallowRef } from '@scripts/chromeRef';
import { CommandProcessor } from '@scripts/CommandProcessor';
import { OmniRegistry } from '@scripts/OmniRegistry';
import Omni from '@toys/Omni/Omni';
import Shout from '@toys/Shout/Shout';
import { makePluginToyClass } from '@plugins/PluginToy.js';
import PluginWidgetHost from '@plugins/PluginWidgetHost.vue';
import OmniPage from '@toys/Omni/OmniPage.vue';

window.isPrimaryWindow = true;
window.setElectronTimeout = setTimeout; window.setElectronInterval = setInterval;
window.clearElectronInterval = clearInterval; window.clearElectronTimeout = clearTimeout;
window.env = { isDev: false };
window.initPort = 3001;
window.ytctDB = { getUser() { return null; }, getUsers() { return []; } };
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

const manifest = await (await fetch('/plugins/installed.json')).json().then((j) => j.plugins.find((p) => p.slug === 'raffle'));
const Raffle = makePluginToyClass(manifest, {});

const toys = {};
const app = {
	commands: chromeShallowRef('commands', {}),
	enabledToys: chromeShallowRef('enabledToys', []),
	serverPort: ref(3001),
	log: { err() {}, error() {}, info() {}, log() {}, msg() {} },
	toysData: Object.assign([Omni, Shout, Raffle], { asObject: { raffle: Raffle, shout: Shout, omni: Omni } }),
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
app.enabledToys.value = [...app.enabledToys.value, 'raffle'];
await nextTick();
try { toys.raffle = new Raffle(tm); } catch (e) { errs.push('raffle: ' + e.stack); }

// the plugin's page, hosted exactly like the dashboard preview does
const widgetInfo = Raffle.widgetComponents[0];
createApp({ render: () => h('div', { style: 'width:400px;height:200px' }, [h(PluginWidgetHost, { widgetInfo })]) })
	.provide('ctApp', app).mount('#app');

// the Omni settings page (drag-and-drop pool + groups)
createApp({ render: () => h(OmniPage) }).provide('ctApp', app).mount('#omniPage');

window.__t = {
	app, toys, errs, calls, Raffle,
	setGroups(slugs) { toys.omni.settings.omniGroups.value = [{ id: 'g1', name: 'G', includedToys: slugs }]; },
	shoutShow(on) { toys.shout.shoutMode.value = on ? 'SHOW' : 'IDLE'; },
	enable(list) { app.enabledToys.value = list; },
	groups() { return toys.omni.settings.omniGroups.value; },
	chips(sel) { return Array.from(document.querySelectorAll(sel + ' .toy-chip .label')).map((e) => e.textContent.trim()); },
};
document.getElementById('out').textContent = 'ready';
