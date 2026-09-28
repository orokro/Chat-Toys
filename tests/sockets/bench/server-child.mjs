// Runs ONE server (legacy or new) and reports its own CPU + event-loop lag.
import http from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { socketRefServer } from './legacyServer.mjs';
import { SocketServer } from '../../../src/main/system/sockets/SocketServer.js';

const mode = process.argv[2];
const httpServer = http.createServer();
await new Promise(r => httpServer.listen(0, '127.0.0.1', r));
let wss;
if (mode === 'legacy') {
	wss = socketRefServer({ server: httpServer });
	// what chatForward + pluginForward add today: two more parses per frame
	for (let i = 0; i < 2; i++) wss.on('connection', s => s.on('message', d => { try { JSON.parse(d); } catch (_) {} }));
} else {
	const srv = new SocketServer();
	wss = srv.attach(httpServer);
	srv.onMessage('chat', () => {}); srv.onMessage('plugin-rpc', () => {});
}
process.send({ ready: true, port: httpServer.address().port });

let h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
let cpu = process.cpuUsage();
let bytesOut = 0;
const origSend = (await import('ws')).WebSocket.prototype.send;
(await import('ws')).WebSocket.prototype.send = function (data, ...rest) { bytesOut += data.length; return origSend.call(this, data, ...rest); };

process.on('message', (m) => {
	if (m.reset) { h.reset(); cpu = process.cpuUsage(); bytesOut = 0; return; }
	if (m.report) {
		const c = process.cpuUsage(cpu);
		process.send({ report: {
			cpuMs: (c.user + c.system) / 1000,
			lagP99: h.percentile(99) / 1e6, lagMax: h.max / 1e6,
			bytesOut, clients: wss.clients.size,
		}});
	}
});
