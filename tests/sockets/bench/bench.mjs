// Gradient test: legacy vs new server, dashboard + a GroupWidget of G iframes,
// dashboard publishing a ~26KB chat log at R Hz (Lofi Girl-ish).
import { fork } from 'node:child_process';

const DURATION_MS = +(process.env.DURATION || 6000);
const CHAT_HZ = +(process.env.CHAT_HZ || 20);
const DASH_REFS = 150;
const WORKERS = 4;

function buildPages(groupSize) {
	const pages = [];
	// the dashboard: owns lots of keys, publishes the chat log
	const dash = { refs: [], writes: [{ key: 'chat2-chatLog', rateHz: CHAT_HZ, size: 26000 }] };
	dash.refs.push('chat2-chatLog', 'obsStatus');
	for (let i = 0; dash.refs.length < DASH_REFS; i++) dash.refs.push(`dash-key-${i}`);
	pages.push(dash);
	// the GroupWidget page itself (settings + keepAlive's 2)
	if (groupSize > 0) pages.push({ refs: ['widget-group-settings', 'live-state-WidgetGroup-groupLayer', 'obsStatus'],
		writes: [{ key: 'live-state-WidgetGroup-groupLayer', rateHz: 1 }, { key: 'obsStatus', rateHz: 1 }] });
	// one iframe page per group item, ~10 refs each; item 0 is a chat widget
	for (let g = 0; g < groupSize; g++) {
		const refs = [`toy${g}-settings`, `live-state-toy${g}-w`, 'obsStatus'];
		if (g === 0) refs.push('chat2-chatLog');
		for (let j = 0; refs.length < 10; j++) refs.push(`toy${g}-data-${j}`);
		pages.push({ refs, writes: [{ key: `live-state-toy${g}-w`, rateHz: 1 }, { key: 'obsStatus', rateHz: 1 }] });
	}
	return pages;
}

function once(child, pred) { return new Promise(r => { const f = m => { if (pred(m)) { child.off('message', f); r(m); } }; child.on('message', f); }); }

async function run(mode, groupSize) {
	const server = fork(new URL('./server-child.mjs', import.meta.url), [mode]);
	const { port } = await once(server, m => m.ready);
	const pages = buildPages(groupSize);
	// worker 0 = the dashboard alone (stands in for the ChatToys window);
	// the rest share the OBS-side pages
	const slices = Array.from({ length: WORKERS }, () => []);
	slices[0].push(pages[0]);
	pages.slice(1).forEach((p, i) => slices[1 + (i % (WORKERS - 1))].push(p));
	const workers = slices.filter(s => s.length).map(s => fork(new URL('./clients-child.mjs', import.meta.url), [mode, String(port), JSON.stringify(s)]));
	await Promise.all(workers.map(w => once(w, m => m.ready)));
	await new Promise(r => setTimeout(r, 500));
	workers.forEach(w => w.send({ start: true }));
	await new Promise(r => setTimeout(r, 1000)); // warm-up
	server.send({ reset: true });
	workers.forEach(w => w.send({ reset: true }));
	await new Promise(r => setTimeout(r, DURATION_MS));
	server.send({ report: true });
	const { report } = await once(server, m => m.report);
	const wr = await Promise.all(workers.map(w => { w.send({ report: true }); return once(w, m => m.report).then(m => m.report); }));
	workers.forEach(w => w.kill()); server.kill();
	const secs = DURATION_MS / 1000;
	return {
		mode, group: groupSize, sockets: report.clients,
		cpuPct: +(report.cpuMs / (secs * 10)).toFixed(1),
		lagP99ms: +report.lagP99.toFixed(1), lagMaxMs: +report.lagMax.toFixed(1),
		outMBps: +(report.bytesOut / secs / 1e6).toFixed(1),
		dashCpuPct: +(wr[0].cpuMs / (secs * 10)).toFixed(1),
		dashParsedPerSec: Math.round(wr[0].parsed / secs),
		obsCpuPct: +(wr.slice(1).reduce((a, r) => a + r.cpuMs, 0) / (secs * 10)).toFixed(1),
		obsParsedMBps: +(wr.slice(1).reduce((a, r) => a + r.received, 0) / secs / 1e6).toFixed(1),
	};
}

const groups = (process.env.GROUP_SIZES || '0,3,6,10').split(',').map(Number);
const rows = [];
for (const g of groups) for (const mode of ['legacy', 'new']) {
	const r = await run(mode, g);
	rows.push(r);
	console.log(JSON.stringify(r));
}
console.table(rows);
