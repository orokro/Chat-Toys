// Simulates a slice of pages. Each page = a list of keys it subscribes to and
// keys it writes. mode 'legacy' = one socket per ref; 'new' = one socket per page.
import { WebSocket } from 'ws';
const [, , mode, port, specJson] = process.argv;
const pages = JSON.parse(specJson);
const url = `ws://127.0.0.1:${port}`;
let received = 0;
let parsed = 0;
let cpu0 = process.cpuUsage();
const writers = []; // { socket, key, rateHz, size }

function open() { return new Promise((res, rej) => { const s = new WebSocket(url); s.on('open', () => res(s)); s.on('error', rej); s.on('message', d => { received += d.length; JSON.parse(d); parsed++; }); }); }

for (const page of pages) {
	if (mode === 'new') {
		const s = await open();
		for (const k of page.refs) s.send(JSON.stringify({ type: 'init', key: k }));
		for (const w of page.writes) writers.push({ socket: s, ...w });
	} else {
		const byKey = new Map();
		for (const k of page.refs) { const s = await open(); s.send(JSON.stringify({ type: 'init', key: k })); byKey.set(k, s); }
		for (const w of page.writes) writers.push({ socket: byKey.get(w.key), ...w });
	}
}
process.send({ ready: true });

const payloads = new Map();
function payload(size) {
	if (!payloads.has(size)) {
		const n = Math.max(1, Math.round(size / 260));
		payloads.set(size, Array.from({ length: n }, (_, i) => ({ id: 'm' + i, user: 'SomeChatter' + i, color: '#aabbcc', text: 'lofi beats to study to '.repeat(8), badges: ['sub'], ts: 0 })));
	}
	return payloads.get(size);
}
process.on('message', (m) => {
	if (m.reset) { cpu0 = process.cpuUsage(); received = 0; parsed = 0; return; }
	if (m.report) { const c = process.cpuUsage(cpu0); process.send({ report: { cpuMs: (c.user + c.system) / 1000, received, parsed } }); return; }
	if (!m.start) return;
	for (const w of writers) {
		setInterval(() => {
			const value = w.size ? payload(w.size) : `O_${Date.now()}`;
			w.socket.send(JSON.stringify({ type: 'update', key: w.key, value, timestamp: Date.now() }));
		}, 1000 / w.rateHz);
	}
});
