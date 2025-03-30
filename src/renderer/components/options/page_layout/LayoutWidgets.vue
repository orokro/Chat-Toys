<!--
	LayoutWidgets.vue
	-----------------

	To keep the LayoutScreen.vue component clean, we'll move the
	widgets that are spawned in to this component.
-->
<template>

	<!-- this container will 100% fill the LayoutScreen component -->
	<div class="layoutWidgetsSpawnContainer">

		<!-- loop to spawn layout boxes for each -->
		<template 
			v-for="widget in widgets"
			:key="`widget-${widget.slug}-${widget.key}`"
		>
			<LayoutBox
				v-if="shouldShowInLayout(widget.slug)"
				:editing="activeTab === widget.slug"
				:scale="scale"
				:slug="widget.slug"
				:boxData="widget.settings[widget.key].value"
				:allowResize="widget.allowResize"
				:maintainAspectRatio="widget.lockAspectRatio"
				:color="widget.color"
				@boxChange="e=>handleBoxChange(e, widget)"
			>
				<component
					v-if="widget.component != null"
					:demoMode="true"
					:is="widget.component"
				/>
			</LayoutBox>
		</template>
	</div>

</template>
<script setup>

const a = (a, b) => {
	console.log(a, b);
	return a;
}

// vue
import { shallowRef, inject } from 'vue'
import { chromeRef, chromeShallowRef } from '../../../scripts/chromeRef';
import { RefAggregator } from '../../../scripts/RefAggregator';

// components
import LayoutBox from './LayoutBox.vue';
import ChannelPointsWidget from '../../../toys/ChannelPoints/ChannelPointsWidget.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// accept some props
const props = defineProps({

	// the scale of the layout screen
	scale: {
		type: Number,
		default: 1
	},

	// the currently active widget tab
	activeTab: {
		type: String,
		default: 'settings'
	},

	// true if the layout screen should show all widgets
	showAllWidgets: {
		type: Boolean,
		default: false
	}
});


// make general settings to store the output widget box
const generalSettings = {
	outputWidgetBox: shallowRef({
		x: 1280-150-300,
		y: 720-150,
		width: 300,
		height: 150
	})
};
const generalSettingsStorRef = chromeShallowRef('general-settings', {});
const settingsAggregator = new RefAggregator(generalSettingsStorRef);
settingsAggregator.registerObject('outputWidgetBox', generalSettings);

// refs to our various settings
const channelPointsSettings = chromeRef('channel-points-settings', {});
const chatBoxSettings = chromeShallowRef('chat-box-settings', {});
const fishingSettings = chromeShallowRef('fishing-settings', {});
const gambaSettings = chromeShallowRef('gamba-settings', {});
const headPatsSettings = chromeShallowRef('head-pat-settings', {});
const mediaSettings = chromeShallowRef('media-settings', {});
const prizeWheelSettings = chromeShallowRef('prize-wheel-settings', {});
const tosserSettings = chromeShallowRef('tosser-settings', {});

// we'll store a list of widgets that can be spawned in the layout
const widgets = [

	// settings isn't a toy in itself, so we'll hard code stuff for it's widget
	{
		slug: 'settings',
		component: null,
		settings: generalSettings,
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


/**
 * Determines if a widget should be shown in the layout
 * 
 * @param {string} slug
 * @returns {boolean}
 */
 const shouldShowInLayout = (slug) => {
	
	// check if the slug is in our list of enabled toys
	const isEnabled = [
		'settings',
		...ctApp.enabledToys.value].includes(slug);

	// if the item isn't enabled, we don't care if we are showing all widgets
	if (!isEnabled)
		return false;

	// check if we have all widgets enabled
	const showAll = props.showAllWidgets;
	if(showAll)
		return true;
	
	// if we aren't showing all widgets, we only show the enabled ones
	return props.activeTab === slug;
}


/**
 * Handles a change in the box from one of the LayoutBox widgets
 * 
 * @param {object} e - the new box data
 * @param {object} widget - the widget that spawned the box
 */
function handleBoxChange(e, widget) {

	widget.settings.value = {
		...widget.settings.value,
		[widget.key]: e
	};
}

</script>
<style lang="scss" scoped>

	// area to spawn widgets
	.layoutWidgetsSpawnContainer {

		// fill area
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		// for debug
		/* border: 1px solid red; */

	}// .layoutWidgetsSpawnContainer

</style>
