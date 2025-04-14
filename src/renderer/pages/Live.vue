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

	<div class="pageContainer" :style="{ '--bgColor': bg }" :class="{ 'hasBg': bg != null }">

		<!-- show the layout of all widgets if a toy wasn't specified in the params -->
		<LiveLayout v-if="isSingle==false" />

		<!-- otherwise, load just the single widget -->
		<template v-else>
			
			<component :is="widgetComponent" />
		</template>
	</div>
</template>
<script setup>

// vue
import { ref, onBeforeMount } from 'vue';
import { socketRef, socketShallowRef } from 'socket-ref';

// components
import LiveLayout from '@components/live/LiveLayout.vue';

// app
import { toysData } from '@toys/toysData.js';

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

// widx=<number> → number or 0
const widgetIndex = ref(parseInt(query.get('widx') || '0', 10));

const isSingle = ref(false);
const singleToy = ref('');
const singleWidget = ref('');
let widgetComponent = null;


/**
 * Check if the URL has the 'single' query parameter set to true.
 * If so, it will return an object with the 'toy' and 'widget' parameters.
 * Otherwise, it will return false.
 * 
 * @returns {Object|boolean} - An object with 'toy' and 'widget' if valid, otherwise false.
 */
function validateQueryParams() {

	const params = new URLSearchParams(window.location.search);

	// Check if 'single' is present
	if (!params.has('single')) {
		return false;
	}

	const single = params.get('single');
	if (single !== 'true') {
		return false;
	}

	const toy = params.get('toy');
	const widget = params.get('widget');

	// Check if 'toy' and 'widget' are present and are non-empty strings
	if (typeof toy === 'string' && toy.length > 0 &&
		typeof widget === 'string' && widget.length > 0) {
		return { toy, widget };
	}

	return false;
}


// before the component mounts, find the component we need to load if in single-widget mode
onBeforeMount(()=>{

	// determine if we're in single widget status or full page layout
	const singleModeStatus = validateQueryParams();
	if (singleModeStatus) {

		// set our refs
		isSingle.value = true;
		singleToy.value = singleModeStatus.toy;
		singleWidget.value = singleModeStatus.widget;

		// get the toy's class for this slug
		const toyClassConstructor = toysData.asObject[singleToy.value];

		// let the list of widgets the toy provides.
		const toyWidgetList = toyClassConstructor.widgetComponents

		// narrow down potential list to the one that matches our widget slug
		const widgetData = toyWidgetList.find(
			(widget) => {
				return widget.slug === singleModeStatus.widget;
				;
			}
		);

		// save just the widget component
		widgetComponent = widgetData.component;

	} else {
		isSingle.value = false;
	}

});


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
