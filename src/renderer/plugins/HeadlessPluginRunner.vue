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
-->
<template>
	<div class="headlessRunner" aria-hidden="true">
		<PluginWidgetHost
			v-for="h in headlessWidgets"
			:key="h.pluginSlug"
			:widgetInfo="h"
		/>
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

	// keep it rendered (so the iframes run) but completely out of sight
	.headlessRunner {
		position: fixed;
		left: -99999px;
		top: -99999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
		pointer-events: none;
		opacity: 0;
	}

</style>
