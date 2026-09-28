# socket-bench

Gradient test for the socket transport: the OLD socket-ref server
(`legacyServer.mjs`, the patched 0.0.7 copy) vs the NEW
`src/main/system/sockets/SocketServer.js`, under the same simulated load.

Each run is: a dashboard page (~150 refs, publishing a ~26 KB chat log at
`CHAT_HZ`), plus a GroupWidget page and one iframe page per group item
(~10 refs each, 1 Hz heartbeats; item 0 is a chat widget). The server runs in
its own process like the Electron main process; the dashboard gets its own
process (stands in for the ChatToys window); the other pages share the rest.
Clients `JSON.parse` every frame they receive, like the real client does.

    node --experimental-detect-module tests/sockets/bench/bench.mjs

Knobs (env vars): `DURATION` (ms per run, default 6000), `CHAT_HZ` (default 20),
`GROUP_SIZES` (default `0,3,6,10`).

Columns: `sockets` (server-side connections), `cpuPct` / `lagP99ms` /
`lagMaxMs` / `outMBps` (server process), `dashCpuPct` / `dashParsedPerSec`
(dashboard process), `obsCpuPct` / `obsParsedMBps` (OBS-side pages).

This is a model of the traffic, not the real app: the ref counts and chat
payload size are estimates. It measures the transport's scaling, which is the
part that changed. Numbers from 2026-09-28 (2-core cloud box, CHAT_HZ=20):

| group | transport | sockets | server CPU | server out | dashboard CPU | OBS-side CPU |
|------:|-----------|--------:|-----------:|-----------:|--------------:|-------------:|
| 0  | old | 150 | 6.6% | 81 MB/s  | 33.6% | - |
| 0  | new | 1   | 1.8% | 0 MB/s   | 0.9%  | - |
| 6  | old | 213 | 8.9% | 116 MB/s | 32.5% | 21.8% |
| 6  | new | 8   | 2.1% | 0.5 MB/s | 0.9%  | 1.0% |
| 10 | old | 253 | 10.7% | 138 MB/s | 32.9% | 30.3% |
| 10 | new | 12  | 2.3% | 0.5 MB/s | 1.1%  | 1.1% |
