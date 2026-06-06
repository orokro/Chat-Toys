<!--
	PluginWidgetHost.vue
	--------------------

	The trusted host for a single plugin widget. Used by BOTH the dashboard
	layout and the OBS-served live page - it's the one component every plugin
	widget renders through, so the app never imports plugin code.

	What it does:
	  - renders the plugin's entry HTML inside an opaque-origin sandboxed iframe
	    (sandbox="allow-scripts", NO allow-same-origin)
	  - performs the MessageChannel handshake: transfers a private port into the
	    iframe, then speaks the protocol.js message format over it
	  - owns the plugin's NAMESPACED render-state sockets and its (read-only)
	    settings socket - these never touch the broker, they're inside the
	    plugin's own namespace and need no permission
	  - relays every other capability request to the BROKER (the PluginToy
	    instance), which is the single permission-enforcement point

	Broker resolution:
	  - dashboard context: inject('ctApp') exists -> the local PluginToy instance
	  - live page (OBS): no ctApp -> a remote proxy over the socket/WS bridge.
	    That transport is the NEXT slice; for now it's a clearly-marked stub so
	    the dashboard path is fully functional end-to-end.
-->
<template>
	<div class="pluginWidgetHost">
		<iframe
			ref="frameEl"
			class="pluginFrame"
			sandbox="allow-scripts"
			:src="entryUrl"
			@load="onFrameLoad"
		></iframe>
	</div>
</template>
<script setup>

// vue
import { ref, computed, inject, watch, onMounted, onBeforeUnmount } from 'vue';
import { socketShallowRef, socketShallowRefReadOnly } from 'socket-ref';

// our app
import { keepAliveSocket } from '../toys/keepAliveSocket.js';
import { RemoteBrokerProxy } from './RemoteBrokerProxy';
import {
	PORT_HANDSHAKE,
	KIND,
	EVT,
	stateSocketKey,
	settingsSocketKey,
} from './protocol';

// the widget descriptor the minted plugin class put on its widgetComponents
const props = defineProps({
	widgetInfo: { type: Object, required: true },
});

// pull the plugin coordinates out of the descriptor. `widgetSlug` prefers the
// dedicated field because LiveLayout overwrites `slug` with the toy slug.
const pluginSlug = props.widgetInfo.pluginSlug;
const widgetSlug = props.widgetInfo.widgetSlug || props.widgetInfo.slug;
const entry = props.widgetInfo.entry;

// dashboard provides the app; live page does not (-> remote broker)
const ctApp = inject('ctApp', null);

// the iframe + the live port to the SDK inside it
const frameEl = ref(null);
let port = null;
let broker = null;
const brokerUnsubs = [];

// lazily-created namespaced state sockets: key -> socketShallowRef
const stateSockets = new Map();

// state keys the iframe has subscribed to (key -> stop-watch fn)
const stateWatchers = new Map();

// read-only mirror of the plugin's published settings
const settingsSocket = socketShallowRefReadOnly(settingsSocketKey(pluginSlug), {});

// read-only mirror of the app-wide "Widget Demo Mode" toggle, forwarded into
// the frame as EVT.DEMO so plugins can render sample content for OBS layout.
const demoSocket = socketShallowRefReadOnly('demoMode', false);

// keep-alive so the app's live-status light works (no-op inside Electron)
let keepAlive = null;


/**
 * Absolute URL to the plugin's entry HTML on the Express plugin-serving route.
 * Always points at the widget server (where /plugins/<slug>/ is mirrored),
 * regardless of dev vs prod renderer host.
 *
 * @type {import('vue').ComputedRef<string>}
 */
const entryUrl = computed(() => {
	const q = new URLSearchParams(window.location.search);
	const serverPort = parseInt(q.get('port') || window.initPort || location.port || '3001', 10) || 3001;
	const path = String(entry || '').replace(/^\/+/, '');
	return `http://localhost:${serverPort}/plugins/${pluginSlug}/${path}`;
});


/**
 * Resolve the broker for this plugin. Local PluginToy on the dashboard; a
 * stub remote proxy on the live page until the WS transport slice lands.
 *
 * @returns {Object} broker-like: { request, onBroker, resolveCommandAck }
 */
function resolveBroker() {

	const local = ctApp?.toyManager?.getToyBySlug?.(pluginSlug);
	if (local)
		return local;

	// live page (OBS / browser): no local PluginToy - talk to the dashboard
	// broker over the WS bridge (main relay -> PluginBridge).
	return new RemoteBrokerProxy(pluginSlug);
}


/**
 * Get (creating if needed) the namespaced state socket for a key.
 *
 * @param {string} key
 * @returns {Object} a socketShallowRef
 */
function stateSocket(key) {
	let s = stateSockets.get(key);
	if (!s) {
		s = socketShallowRef(stateSocketKey(pluginSlug, key), null);
		stateSockets.set(key, s);
	}
	return s;
}


/**
 * Start relaying a namespaced state key to the iframe: push the current value
 * immediately and on every change, as a 'state' event. Idempotent per key.
 *
 * @param {string} key
 */
function subscribeState(key) {

	if (stateWatchers.has(key))
		return;

	const s = stateSocket(key);
	send({ kind: KIND.EVT, name: EVT.STATE, detail: { key, value: s.value } });
	const stop = watch(s, (val) => {
		send({ kind: KIND.EVT, name: EVT.STATE, detail: { key, value: val } });
	});
	stateWatchers.set(key, stop);
}


/**
 * Post a message to the SDK over the private port (guards a closed port).
 *
 * @param {Object} msg
 */
function send(msg) {
	if (port) port.postMessage(msg);
}


/**
 * Build the load detail handed to the SDK (mirrors SE onWidgetLoad).
 *
 * @returns {Promise<Object>}
 */
async function buildLoadDetail() {

	let obsLive = false;
	const perms = props.widgetInfo.permissions || [];
	if (perms.includes('obs:status')) {
		try { obsLive = await broker.request('obs.isLive'); }
		catch (e) { obsLive = false; }
	}

	return {
		settings: settingsSocket.value || {},
		info: {
			slug: pluginSlug,
			widget: { slug: widgetSlug, key: props.widgetInfo.key, box: props.widgetInfo.defaultBox },
		},
		obsLive,
	};
}


/**
 * Handle a message arriving from the SDK over the port.
 *
 * @param {MessageEvent} ev
 */
async function onPortMessage(ev) {

	const msg = ev.data;
	if (!msg || typeof msg !== 'object')
		return;

	switch (msg.kind) {

		// SDK is alive -> hand it static info, then the load event
		case KIND.HELLO: {
			send({ kind: KIND.INIT, info: { slug: pluginSlug, widget: { slug: widgetSlug, key: props.widgetInfo.key } } });
			send({ kind: KIND.EVT, name: EVT.LOAD, detail: await buildLoadDetail() });
			// seed current demo-mode state right after load
			send({ kind: KIND.EVT, name: EVT.DEMO, detail: { active: !!demoSocket.value } });
			break;
		}

		// brokered capability request
		case KIND.REQ:
			await handleRequest(msg);
			break;

		// command accept/reject
		case KIND.ACK:
			broker.resolveCommandAck(msg.token, !!msg.ok, msg.reason);
			break;

		// route a plugin log line
		case KIND.LOG:
			console.log(`[plugin:${pluginSlug}]`, ...(msg.args || []));
			break;
	}
}


/**
 * Route a request: state.* is handled locally inside the plugin's namespace;
 * everything else goes to the broker (which enforces permissions).
 *
 * @param {Object} msg - { id, type, payload }
 */
async function handleRequest(msg) {

	const reply = (result, error) => send({ kind: KIND.RES, id: msg.id, result, error });

	try {

		// --- host-handled, no permission (own namespace) ---
		if (msg.type === 'state.get') {
			reply(stateSocket(msg.payload.key).value);
			return;
		}
		if (msg.type === 'state.set') {
			stateSocket(msg.payload.key).value = msg.payload.value;
			reply(true);
			return;
		}
		if (msg.type === 'state.subscribe') {
			subscribeState(msg.payload.key);
			reply(true);
			return;
		}

		// --- broker-handled, permission-gated ---
		const result = await broker.request(msg.type, msg.payload);
		reply(result);

	} catch (err) {
		reply(undefined, err.message || String(err));
	}
}


/**
 * On iframe load, open a MessageChannel and transfer one port into the frame.
 * The SDK keeps it and posts HELLO back; everything else flows over it.
 */
function onFrameLoad() {

	// fresh channel per (re)load
	if (port) { try { port.close(); } catch (e) { /* noop */ } }

	const channel = new MessageChannel();
	port = channel.port1;
	port.onmessage = onPortMessage;

	// hand port2 to the sandboxed frame. '*' is fine: the frame is opaque-origin
	// (its origin is "null"), and only OUR frame receives this transfer.
	frameEl.value.contentWindow.postMessage(PORT_HANDSHAKE, '*', [channel.port2]);
}


onMounted(() => {

	broker = resolveBroker();

	// heartbeat for the live-status light
	keepAliveSocket(pluginSlug, widgetSlug).then((ka) => { keepAlive = ka; });

	// relay broker events (command / chat / obs) into the frame
	brokerUnsubs.push(broker.onBroker('command', (detail) => send({ kind: KIND.EVT, name: EVT.COMMAND, detail })));
	brokerUnsubs.push(broker.onBroker('chat', (detail) => send({ kind: KIND.EVT, name: EVT.CHAT, detail })));
	brokerUnsubs.push(broker.onBroker('obs', (detail) => send({ kind: KIND.EVT, name: EVT.OBS, detail })));

	// push settings changes through to the frame as they arrive
	brokerUnsubs.push(watch(settingsSocket, (val) => {
		send({ kind: KIND.EVT, name: EVT.SETTINGS, detail: val || {} });
	}));

	// push demo-mode toggles through to the frame
	brokerUnsubs.push(watch(demoSocket, (val) => {
		send({ kind: KIND.EVT, name: EVT.DEMO, detail: { active: !!val } });
	}));
});


onBeforeUnmount(() => {

	for (const off of brokerUnsubs) {
		try { off(); } catch (e) { /* noop */ }
	}
	brokerUnsubs.length = 0;

	for (const stop of stateWatchers.values()) {
		try { stop(); } catch (e) { /* noop */ }
	}
	stateWatchers.clear();

	if (keepAlive && typeof keepAlive.stopInterval === 'function')
		keepAlive.stopInterval();

	if (port) { try { port.close(); } catch (e) { /* noop */ } }
	port = null;

	// tear down a remote proxy's socket (local PluginToy brokers are shared and
	// must NOT be destroyed here).
	if (broker && typeof broker.destroy === 'function') {
		try { broker.destroy(); } catch (e) { /* noop */ }
	}
});

</script>
<style lang="scss" scoped>

	.pluginWidgetHost {

		// fill the LayoutBox we're mounted inside
		position: absolute;
		inset: 0px;

		.pluginFrame {
			width: 100%;
			height: 100%;
			border: 0;
			background: transparent;
			display: block;
		}

	}// .pluginWidgetHost

</style>
