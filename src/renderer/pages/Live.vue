<!--
	Live.vue
	--------

	This is the root component for the live page, that will be compiled and served from Express
	in the final build, so that OBS can use it as a browser source.

	This page will either include the LiveLayout component, which will use the Layout
	as built in the main YTCT app.

	OR, if our query URL has a slug, it will load _just_ that widget, this way OBS
	can layout the individual widgets using browser sources for each. This is better
	for users that want multiple scenes handled by OBS.
-->
<template>

	<div 
		class="pageContainer"
		:style="{ '--bgColor': bg }"
		:class="{ 'hasBg': bg!=null }"
	>

		<!-- show the layout of all widgets if a toy wasn't specified in the params -->
		<LiveLayout v-if="toySlug == null" />

	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';
import { socketRef, socketShallowRef } from 'socket-ref';

// components
import LiveLayout from '@components/live/LiveLayout.vue';

// general app settings
const generalSettingsJSON = socketRef('general-settings', 'foo');

// Grab query parameters from the URL
const query = new URLSearchParams(window.location.search);

// bg=<color> → string or null
// Handle bg param
let rawBg = query.get('bg')
let parsedBg = null

if (rawBg) {
  const hexPattern = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
  parsedBg = hexPattern.test(rawBg) ? `#${rawBg}` : rawBg
}
const bg = ref(parsedBg)

// slug=<slug_string> → string or null
const toySlug = ref(query.get('slug'));

// widx=<number> → number or 0
const widgetIndex = ref(parseInt(query.get('widx') || '0', 10));

</script>
<style lang="scss" scoped>

	// main page wrapper
	.pageContainer {

		// fill area
		position: absolute;
		inset: 0px;

		&.hasBg {
			background: var(--bgColor);
		}

		h1 {
			color: black;
		}

	}// .pageContainer

</style>
