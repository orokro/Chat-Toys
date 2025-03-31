<!--
	LiveLayout.vue
	--------------

	The Live Screen will use this component to layout multiple of the chat toys widgets on the screen.

	NOTE: widgets can also be loaded invidually to use OBS browser layout tools.

	The main Live.vue page will not load this component if it finds a slug in it's query string,
	and will instead load the individual widget.
-->
<template>

	<!-- this container will 100% fill the LayoutScreen component -->
	<div 
		class="layoutWidgetsSpawnContainer"
		:style="{
			width: generalSettingsJSON?.stageWidth + 'px',
			height: generalSettingsJSON?.stageHeight + 'px'
		}"
	>

		<!-- loop to spawn layout boxes for each -->
		<template 
			v-for="widget in widgets"
			:key="`widget-${widget.slug}-${widget.key}`"
		>
			<LayoutBox
				v-if="true"
				:editing="false"
				:slug="widget.slug"
				:boxData="boxData[widget.boxKey].value[widget.key]"
				:color="widget.color"
			>
				<component
					v-if="widget.component != null"
					:is="widget.component"
					:widgetInfo="widget"
					@boxChange="e=>handleBoxChange(e, widget)"
				/>
			</LayoutBox>
		</template>
	</div>

</template>
<script setup>

// vue
import { shallowRef, watch, markRaw } from 'vue'
import { socketRef, socketShallowRef, socketRefAsync, bindRef, bindRefs } from 'socket-ref';
import { RefAggregator } from '../../scripts/RefAggregator';

// components
import LayoutBox from '@components/options/page_layout/LayoutBox.vue';

// our toys data which includes the widget vue constructors
import { toysData } from '@toys/ToysData';

// accept some props
const props = defineProps({

});

// array of widgets to render
const widgets = shallowRef([]);

// story box settings, this will be dynamically populated by the widgets we spawn in
const boxData = {};

function handleBoxChange(e, widget) {

	// find the ref with this box key
	const boxDataValue = {...boxData[widget.boxKey].value};
	boxDataValue[widget.key] = e.value;
	boxData[widget.boxKey].value = boxDataValue;
}

// general app settings, via socket. watch to update widgets
const generalSettingsJSON = socketShallowRef('general-settings', 'uninitialized');
window.gs = generalSettingsJSON;;
watch(generalSettingsJSON, (newVal) => {
	if (newVal === 'uninitialized')
		return;
	buildWidgetsList();
});

function buildWidgetsList(){

	// get the list of enabled widgets from the app
	const enabledToys = generalSettingsJSON.value.enabledToys;

	// loop over the widgets for the toy with this slug
	widgets.value = enabledToys.flatMap(slug => {

		// loop over the widgets for the toy with this slug
		const toy = toysData.asObject[slug];
		return toy.widgetComponents.map(widget => {

			// build a box key that will store the widget's screen position
			const boxKey = slug + '-' + widget.key;

			// check if we already have a ref for this box key
			if (!boxData[boxKey]) {
				boxData[boxKey] = shallowRef({});
			}

			// update with placeholder until the widget populates this
			let data = {...boxData[boxKey].value};
			data = { 
				...data,
				[widget.key]: { x: 100, y: 100, width: 200, height: 200 },
			}
			boxData[boxKey].value = data;

			return {
				slug,
				key: widget.key,
				boxKey,
				component: widget.component,
				color: toy.themeColor,
			};
		});			
	});
}



/*
	// settings isn't a toy in itself, so we'll hard code stuff for it's widget
	{
		slug: 'settings',
		component: null,
		settings: ctApp.settings,
		key: 'outputWidgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#FFFFFF'
	},

	// flatly merge in the rest of the widgets as defined on the toy's themselves
	...(ctApp.enabledToys.value.flatMap(slug => {

			// loop over the widgets for the toy with this slug
			const toy = ctApp.toyManager.toys[slug];
			return toy.static.widgetComponents.map(widget => {

				return {
					slug: slug,
					component: widget.component,
					settings: toy.settings,
					key: widget.key,
					allowResize: widget.allowResize,
					lockAspectRatio: widget.lockAspectRatio,
					color: toy.static.themeColor,
				};
			});			
		})
	),
];
*/

</script>
<style lang="scss" scoped>

	// area to spawn widgets
	.layoutWidgetsSpawnContainer {

		border: 1px solid red;

		color: white !important;


		// reset stacking context
		position: relative;

		// for debug
		/* border: 1px solid red; */

	}// .layoutWidgetsSpawnContainer

</style>
