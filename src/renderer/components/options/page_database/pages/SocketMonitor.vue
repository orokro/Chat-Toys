<!--
	SocketMonitor.vue
	-----------------

	Dev Debug page section: a live view of the socket layer.

	Polls the main process once a second (ipc 'socket-stats', served by
	src/main/system/diagnostics.js) for the SocketServer's numbers, and reads
	this window's own connection from getSocketStats(). Nothing runs unless
	this section is on screen.

	What to look for:
	  - Main loop lag: sustained values over ~50ms mean the main process is
	    struggling; anything in the hundreds is the freeze zone.
	  - Out KB/s + the top-keys table: which key is costing the most, and how
	    many subscribers it's being fanned out to.
	  - Backed up / max buffered: a client that can't keep up (the server is
	    coalescing for it rather than queueing unboundedly).
	  - Connections: one row per page. A GroupWidget shows up as one row for
	    the group plus one per iframe. "legacy" rows are pages still running
	    an old cached client (one socket per ref); reloading them fixes it.
-->
<template>
	<div class="socketMonitor">

		<div class="topRow">
			<span class="statusDot" :class="loopClass"></span>
			<span>
				Main loop lag (last second): <strong>{{ snap?.loop?.lagMaxLastSecMs ?? '—' }} ms</strong>
				<span class="muted"> · stalls ≥250ms since start: {{ snap?.loop?.stallsTotal ?? 0 }}</span>
			</span>
			<span class="spacer"></span>
			<span class="muted" v-if="snap?.diag">--diag log: <code>{{ snap.logPath }}</code></span>
			<span class="muted" v-else>--diag file logging off</span>
			<button class="linkBtn" @click="paused = !paused">{{ paused ? 'Resume' : 'Pause' }}</button>
		</div>

		<p v-if="error" class="errorLine">{{ error }}</p>

		<template v-if="server">

			<div class="tiles">
				<div class="tile"><div class="n">{{ server.clients }}</div><div class="l">connections</div></div>
				<div class="tile"><div class="n">{{ server.subscriptions }}</div><div class="l">subscriptions</div></div>
				<div class="tile"><div class="n">{{ server.rates.msgsInPerSec }}</div><div class="l">msgs in / s</div></div>
				<div class="tile"><div class="n">{{ server.rates.msgsOutPerSec }}</div><div class="l">msgs out / s</div></div>
				<div class="tile"><div class="n">{{ kb(server.rates.bytesOutPerSec) }}</div><div class="l">KB out / s</div></div>
				<div class="tile"><div class="n">{{ server.rates.broadcastMsMax }}</div><div class="l">slowest broadcast (ms)</div></div>
				<div class="tile" :class="{ warn: server.backedUpClients > 0 }"><div class="n">{{ server.backedUpClients }}</div><div class="l">clients backed up</div></div>
				<div class="tile"><div class="n">{{ kb(server.maxBufferedBytes) }}</div><div class="l">max buffered (KB)</div></div>
			</div>

			<h4>Heaviest keys (last second)</h4>
			<table class="grid" v-if="server.rates.topKeys.length">
				<thead><tr><th>key</th><th>KB/s out</th><th>updates/s</th><th>subscribers</th></tr></thead>
				<tbody>
					<tr v-for="k in server.rates.topKeys" :key="k.key">
						<td><code>{{ k.key }}</code></td>
						<td>{{ kb(k.bytesOutPerSec) }}</td>
						<td>{{ k.updatesPerSec }}</td>
						<td>{{ k.subscribers }}</td>
					</tr>
				</tbody>
			</table>
			<p v-else class="muted">No key traffic in the last second.</p>

			<h4>Connections ({{ server.clientList?.length || 0 }})</h4>
			<table class="grid">
				<thead><tr><th>#</th><th>where</th><th>page</th><th>subs</th><th>msgs out</th><th>buffered KB</th><th>pending</th><th>age</th></tr></thead>
				<tbody>
					<tr v-for="c in server.clientList" :key="c.id" :class="{ legacy: !c.muxed }">
						<td>{{ c.id }}</td>
						<td>{{ c.muxed ? (c.env || '?') : 'legacy' }}</td>
						<td class="page">{{ pageLabel(c.page) }}</td>
						<td>{{ c.subs }}</td>
						<td>{{ c.msgsOut }}</td>
						<td>{{ kb(c.buffered) }}</td>
						<td>{{ c.pending }}</td>
						<td>{{ age(c.ageSec) }}</td>
					</tr>
				</tbody>
			</table>

			<p class="muted totals">
				Since start: {{ server.totals.connectionsOpened }} connections opened,
				{{ server.totals.updatesApplied }} updates applied,
				{{ server.totals.updatesStale }} stale updates dropped,
				{{ server.totals.coalesced }} coalesced for slow clients,
				{{ server.keys }} keys stored.
			</p>
		</template>

		<h4>This window's connection</h4>
		<table class="grid" v-if="local.length">
			<thead><tr><th>url</th><th>open</th><th>keys</th><th>refs</th><th>msgs in</th><th>msgs out</th><th>connects</th></tr></thead>
			<tbody>
				<tr v-for="c in local" :key="c.url">
					<td><code>{{ c.url }}</code></td>
					<td>{{ c.open ? 'yes' : 'no' }}</td>
					<td>{{ c.channels }}</td>
					<td>{{ c.refs }}</td>
					<td>{{ c.msgsIn }}</td>
					<td>{{ c.msgsOut }}</td>
					<td>{{ c.connects }}</td>
				</tr>
			</tbody>
		</table>

	</div>
</template>
<script setup>

// vue
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// this window's side of the socket layer
import { getSocketStats } from '@scripts/sockets';

const snap = ref(null);
const local = ref([]);
const error = ref('');
const paused = ref(false);

const server = computed(() => snap.value?.server || null);

const loopClass = computed(() => {
	const lag = snap.value?.loop?.lagMaxLastSecMs;
	if (lag == null) return 'unknown';
	if (lag < 50) return 'ok';
	if (lag < 250) return 'warn';
	return 'bad';
});


/**
 * Pull one snapshot from the main process + this window.
 */
async function poll() {
	if (paused.value)
		return;
	try {
		snap.value = await window.electronAPI.invoke('socket-stats');
		error.value = '';
	} catch (e) {
		error.value = `socket-stats unavailable: ${e && e.message}`;
	}
	local.value = getSocketStats();
}

let timer = null;
onMounted(() => {
	poll();
	timer = setInterval(poll, 1000);
});
onBeforeUnmount(() => clearInterval(timer));


/**
 * Turn a page path the client reported into something short.
 * '/live/?single=true&toy=chat2&widget=liveChat2' -> 'chat2 / liveChat2'
 */
function pageLabel(page) {
	if (!page)
		return '—';
	try {
		const u = new URL(page, 'http://x');
		const toy = u.searchParams.get('toy');
		const widget = u.searchParams.get('widget');
		if (toy) {
			const idx = u.searchParams.get('index');
			return `${toy} / ${widget || '?'}${idx != null ? ` #${idx}` : ''}`;
		}
		return u.pathname + (u.search.length > 1 ? u.search : '');
	} catch (_) {
		return page;
	}
}

function kb(bytes) {
	return Math.round((bytes || 0) / 1024);
}

function age(sec) {
	if (sec < 60) return `${sec}s`;
	if (sec < 3600) return `${Math.floor(sec / 60)}m`;
	return `${Math.floor(sec / 3600)}h`;
}

</script>
<style lang="scss" scoped>

	.socketMonitor {
		padding: 1rem 1.25rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;

		h4 {
			margin: 1.1rem 0 0.4rem 0;
		}

		.muted {
			color: #6b7280;
			font-size: 0.85rem;
		}

		.topRow {
			display: flex;
			align-items: center;
			gap: 0.6rem;
			flex-wrap: wrap;

			.spacer { flex: 1; }

			code {
				font-size: 0.8rem;
			}
		}

		.statusDot {
			width: 12px;
			height: 12px;
			border-radius: 50%;
			border: 1px solid rgba(0, 0, 0, 0.4);
			background: #9ca3af;

			&.ok { background: #22c55e; }
			&.warn { background: #f59e0b; }
			&.bad { background: #ef4444; }
		}

		.errorLine {
			color: #b91c1c;
		}

		.tiles {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 0.5rem;
			margin-top: 0.8rem;

			.tile {
				background: white;
				border: 1px solid #d1d5db;
				border-radius: 0.4rem;
				padding: 0.5rem 0.6rem;

				.n {
					font-size: 1.3rem;
					font-weight: 700;
					font-variant-numeric: tabular-nums;
				}
				.l {
					font-size: 0.75rem;
					color: #6b7280;
				}

				&.warn {
					border-color: #f59e0b;
					background: #fffbeb;
				}
			}
		}

		table.grid {
			width: 100%;
			border-collapse: collapse;
			background: white;
			font-size: 0.85rem;
			font-variant-numeric: tabular-nums;

			th, td {
				text-align: left;
				padding: 0.25rem 0.5rem;
				border-bottom: 1px solid #e5e7eb;
			}
			th {
				background: #e5e7eb;
				font-weight: 600;
			}
			td.page {
				max-width: 320px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			tr.legacy td {
				background: #fff7ed;
			}
		}

		.totals {
			margin-top: 0.5rem;
		}

		.linkBtn {
			background: transparent;
			color: #4b5563;
			border: none;
			text-decoration: underline;
			cursor: pointer;
			padding: 0.25rem 0;
			font-size: 0.85rem;

			&:hover { color: #1f2937; }
		}
	}

</style>
