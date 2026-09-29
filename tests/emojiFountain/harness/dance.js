// Stand-in dashboard for tests/emojiFountain/dance.e2e.cjs: the real
// EmojiFountain toy (as the dashboard runs it) and its real widget (as OBS
// shows it), talking over the real socket server.
import { ref, h, createApp, nextTick } from 'vue';
import { setGlobalSocketRefPort } from '@scripts/sockets';
import { chromeShallowRef } from '@scripts/chromeRef';
import { CommandProcessor } from '@scripts/CommandProcessor';
import EmojiFountain from '@toys/EmojiFountain/EmojiFountain';
import EmojiFountainWidget from '@toys/EmojiFountain/EmojiFountainWidget.vue';

// count animation frames requested (idle CPU check)
let rafCalls = 0;
const raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (fn) => { rafCalls++; return raf(fn); };

window.isPrimaryWindow = true;
window.setElectronTimeout = setTimeout; window.setElectronInterval = setInterval;
window.clearElectronInterval = clearInterval; window.clearElectronTimeout = clearTimeout;
window.env = { isDev: false };
window.initPort = 3001;
window.electronAPI = { invoke: async () => null, on() {}, send() {}, tick() {}, clearTick() {} };
localStorage.clear();
localStorage.setItem('enabledToys', JSON.stringify(['emojiFountain']));
setGlobalSocketRefPort(3001);

const toys = {};
const logs = [];
const app = {
	commands: chromeShallowRef('commands', {}),
	enabledToys: chromeShallowRef('enabledToys', []),
	serverPort: ref(3001),
	log: { err: (m) => logs.push(['err', String(m)]), error() {}, info() {}, log() {}, msg: (m) => logs.push(['msg', String(m)]) },
	toysData: Object.assign([EmojiFountain], { asObject: { emojiFountain: EmojiFountain } }),
	assetsMgr: { getFileData() { return null; } },
	twitchEvents: null,
	chatProcessor: { onNewChats() {}, removeNewChatsListener() {} },
};
app.commandProcessor = new CommandProcessor(app, app.chatProcessor);
const tm = { chatToysApp: app, toys, getToyBySlug: (s) => toys[s] || null };
app.toyManager = tm;

const errs = [];
try { toys.emojiFountain = new EmojiFountain(tm); } catch (e) { errs.push('toy: ' + e.stack); }
await nextTick();

const q = new URL(location.href).searchParams;
const W = Number(q.get('w') || 1280), H = Number(q.get('h') || 720);
createApp({ render: () => h('div', { class: 'widgetBox', style: `position:relative;width:${W}px;height:${H}px;background:#3a4a5a;overflow:hidden` }, [h(EmojiFountainWidget)]) }).mount('#app');

let seq = 0;
window.__t = {
	toys, errs, logs,
	settings: () => toys.emojiFountain.settings,
	particles: () => JSON.parse(JSON.stringify(toys.emojiFountain.particles.value)),
	rafCalls: () => rafCalls,
	// a chat command the way CommandProcessor hands it to the toy; resolves { accepted, reason }
	command(key, text, emojis = []) {
		return new Promise((resolve) => {
			const msg = { id: 'm' + (++seq), authorUniqueID: 'u1', author: 'Alice', messageText: text, emojis };
			toys.emojiFountain.onCommand(key, msg, { points: 0 }, { message: text }, {
				accept: () => resolve({ accepted: true }),
				reject: (reason) => resolve({ accepted: false, reason }),
			});
		});
	},
};
document.getElementById('out').textContent = 'ready';
