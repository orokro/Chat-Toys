<!--
	HeadlessPluginRunner.vue
	------------------------

	Mounts a HIDDEN PluginWidgetHost for every enabled plugin that declares a
	`headless.entry` in its manifest. The host loads the plugin's headless HTML
	in a sandboxed iframe and connects it to the LOCAL broker (the PluginToy in
	this dashboard renderer) - so the plugin's authoritative game/state logic
	runs even when no widget is on screen.

	The headless runner is where command handling + simulation live; OBS widgets
	just subscribe to CT.state and render. That's what makes a plugin consistent
	across multiple widget sources (one brain, many passive views).

	Lives once in MainWindow. The v-for keys on slug, so enabling/disabling a
	headless plugin mounts/unmounts its runner automatically.

	Hiding it: Chromium throttles JS timers in cross-origin frames it thinks
	are hidden (off screen, or only a few pixels big) to one wake-up per
	second. Plugin frames are cross-origin (sandboxed), so a headless brain
	parked off screen had every setTimeout land up to a second late (tanks
	snapped back after a drive, explosions lagged the shell). Each runner is
	therefore a normal-sized frame, ON screen, seen through a 1px transparent
	window: the frame counts as visible, the user sees nothing.
-->
<template>
	<div class="headlessRunner" aria-hidden="true">
		<div
			v-for="h in headlessWidgets"
			:key="h.pluginSlug"
			class="headlessSlot"
		>
			<PluginWidgetHost :widgetInfo="h" />
		</div>
	</div>
</template>
<script setup>

import { computed, inject } from 'vue';
import PluginWidgetHost from './PluginWidgetHost.vue';

const ctApp = inject('ctApp');

// enabled plugins that ship a headless entry -> a widgetInfo pointing at it
const headlessWidgets = computed(() => {
	return (ctApp?.enabledToys?.value || [])
		.map((slug) => ctApp.toysData.asObject[slug])
		.filter((c) => c && c.manifest && c.manifest.headless && c.manifest.headless.entry)
		.map((c) => ({
			pluginSlug: c.slug,
			slug: '__headless',
			widgetSlug: '__headless',
			entry: c.manifest.headless.entry,
			permissions: c.manifest.permissions || [],
		}));
});

</script>
<style lang="scss" scoped>

	// keep it rendered and ON screen (so the frames' timers run at full
	// speed, see the header) but invisible: a 1px transparent window
	.headlessRunner {
		position: fixed;
		left: 0px;
		top: 0px;
		width: 1px;
		height: 1px;
		overflow: hidden;
		pointer-events: none;
		opacity: 0;
		z-index: -1;
	}

	// a normal-sized frame (tiny frames count as hidden too)
	.headlessSlot {
		position: relative;
		width: 320px;
		height: 180px;
	}

</style>
