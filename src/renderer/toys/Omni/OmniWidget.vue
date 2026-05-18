<!--
	OmniWidget.vue
	--------------

	The OBS-side renderer for one omni group. Reads `?omniGroupId=<uuid>`
	from the URL, looks up that group's `includedToys` in the omni's
	settings, and mounts one iframe per (toy, widget) pair. Iframes stay
	mounted at all times - they're transparent when their toy is idle, and
	the alert toy's StateTickerQueue is the gate that ensures only one
	toy fires at a time within the group.

	No queue logic in the widget. No claim mechanism. No state-ref
	mirroring. The serialization happens server-side in the toys' queues
	via the canFire callback talking to OmniRegistry.

	This is intentionally a dumb container.
-->
<template>

	<div class="omni-wrapper">

		<div v-if="!group" class="missing-group">
			This omni group isn't configured. Open the Omni Widget settings to
			set it up.
		</div>

		<template v-else>
			<iframe
				v-for="iframe in iframeSpecs"
				:key="iframe.toySlug"
				:src="iframe.url"
				class="omni-iframe"
				frameborder="0"
				allowtransparency="true"
				:title="iframe.toyName"
			></iframe>
		</template>

	</div>

</template>
<script setup>

import { ref, computed } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

import { keepAliveSocket } from '../keepAliveSocket.js';

// Direct registry import - the omni widget runs in the OBS browser source
// context (live.html) where `inject('ctApp')` returns null (ctApp only
// exists in the main app window). The toysData module is a plain ES export
// and works in every context.
import { toysData } from '@toys/ToysData';


const thisSlug = 'omni';
const widgetSlug = 'group';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);


/**
 * Read the omni's settings socket directly (we don't go through
 * useToySettings here because we don't use widgetBox - the parent OBS
 * source dimensions are what we fill).
 */
const settingsSocket = socketShallowRefReadOnly('omni-settings', 'uninitialized');


/** ?omniGroupId=<uuid> from the URL identifies which group this widget shows. */
const omniGroupId = new URL(location.href).searchParams.get('omniGroupId') || null;


/**
 * The resolved group descriptor from the omni's settings (or null if the
 * group hasn't been configured / has been deleted / settings haven't
 * loaded yet).
 */
const group = computed(() => {
	const s = settingsSocket.value;
	if (!s || s === 'uninitialized') return null;
	const groups = s.omniGroups || [];
	if (!omniGroupId) return groups[0] || null;
	return groups.find(g => g.id === omniGroupId) || null;
});


/**
 * Determine which port to use where. There are two ports in play:
 *   - pagePort: where this widget itself is being served (8080 in dev,
 *     OBS server port in prod, typically 3001).
 *   - wsPort: where the WebSocket socket-ref server is running (always
 *     the OBS server port - 3001 by default).
 *
 * In dev these differ - the Vite dev server hosts the page at 8080 while
 * the WS server runs at 3001. The earlier version of this code conflated
 * them and ended up writing `port=8080` into iframe URLs, which made the
 * iframes' socket-refs try to connect to the dev server's WebSocket port
 * instead of the actual OBS server - widgets loaded but never received
 * state, so the omni's panel stayed transparent / unhealthy.
 *
 * Logic matches live.js's socketPort detection so iframes inherit the
 * same server.
 */
const isDev = (location.host === 'localhost:8080');
const queryPort = parseInt(new URL(location.href).searchParams.get('port') || '3001', 10);
const pagePort = parseInt(location.port || '3001', 10);
const wsPort = isDev ? queryPort : pagePort;

// Where to point the iframe's `src` host:
//   dev → 8080 (Vite dev server)
//   prod → the OBS server port (which is also the page port)
const hostPort = isDev ? 8080 : wsPort;

// Only include `port=N` in the iframe URL when the WS port isn't the
// default 3001 (matches Toy.getWidgetURLs's `showPort` behavior).
const showPort = (wsPort !== 3001);


/**
 * Build the iframe specs for the current group. One per included toy,
 * pointing at the toy's alert widget URL.
 *
 * @type {import('vue').ComputedRef<Array<{toySlug, toyName, url}>>}
 */
const iframeSpecs = computed(() => {
	const g = group.value;
	if (!g) return [];

	const out = [];
	for (const toySlug of (g.includedToys || [])) {
		// Resolve the alert widget slug for this toy via the static toys
		// registry (works in every context, unlike injected ctApp).
		// `static alertWidgetSlug` names the omni-eligible widget; we fall
		// back to the first widget if the toy didn't opt in.
		const ToyClass = toysData.asObject?.[toySlug];
		if (!ToyClass) continue;
		const widgetSlugForToy = ToyClass.alertWidgetSlug
			|| (ToyClass.widgetComponents?.[0]?.slug)
			|| null;
		if (!widgetSlugForToy) continue;

		let url = `http://localhost:${hostPort}/`;
		url += isDev ? 'live.html?' : 'live/?';
		url += showPort ? `port=${wsPort}&` : '';
		url += 'single=true&';
		url += `toy=${toySlug}&widget=${widgetSlugForToy}`;

		out.push({
			toySlug,
			toyName: ToyClass.name || toySlug,
			url,
		});
	}
	return out;
});

</script>
<style lang="scss" scoped>

	.omni-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: transparent;
	}

	// Iframes stack on top of each other, all full-size, transparent. Each
	// alert widget renders nothing when its toy is idle (CSS-level v-if), so
	// only the firing one is visible. Pointer-events: none means the stack
	// doesn't intercept clicks if the streamer happens to overlay something
	// interactive (rare, but cheap insurance).
	.omni-iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: transparent;
		pointer-events: none;
	}

	.missing-group {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		font-family: 'Rajdhani', sans-serif;
		text-align: center;
	}

</style>
