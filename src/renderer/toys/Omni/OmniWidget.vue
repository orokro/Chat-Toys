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

import { ref, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

import { keepAliveSocket } from '../keepAliveSocket.js';


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
 * Detect the host port + dev mode so we can build the same widget URLs the
 * main app would build for these toys. Mirrors logic in Toy.getWidgetURLs().
 */
const isDev = (location.host === 'localhost:8080');
const serverPort = parseInt(location.port || '3001', 10);
const showPort = (serverPort !== 3001);
const hostPort = isDev ? 8080 : serverPort;


/**
 * Build the iframe specs for the current group. One per included toy,
 * pointing at the toy's alert widget URL.
 *
 * @type {import('vue').ComputedRef<Array<{toySlug, toyName, url}>>}
 */
const ctApp = inject('ctApp', null);

const iframeSpecs = computed(() => {
	const g = group.value;
	if (!g) return [];

	const out = [];
	for (const toySlug of (g.includedToys || [])) {
		// Resolve the alert widget slug for this toy. We need to know which
		// of the toy's widgetComponents is the alert one. The toy class
		// exposes static alertWidgetSlug for this; fall back to the first
		// widget if not set.
		const ToyClass = ctApp?.toysData?.asObject?.[toySlug];
		if (!ToyClass) continue;
		const widgetSlugForToy = ToyClass.alertWidgetSlug
			|| (ToyClass.widgetComponents?.[0]?.slug)
			|| null;
		if (!widgetSlugForToy) continue;

		let url = `http://localhost:${hostPort}/`;
		url += isDev ? 'live.html?' : 'live/?';
		url += showPort ? `port=${serverPort}&` : '';
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
