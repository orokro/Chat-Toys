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
				:optionsApp="optionsApp"
				:editing="activeTab === widget.slug"
				:scale="scale"
				:slug="widget.slug"
				:boxData="widget.settings.value[widget.key]"
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

// vue
import { ref, onMounted, shallowRef, watch } from 'vue'
import { chromeRef, chromeShallowRef } from '../../../scripts/chromeRef';
import { RefAggregator } from '../../../scripts/RefAggregator';

// components
import LayoutBox from './LayoutBox.vue';
import ChannelPointsWidget from '../../stage/widgets/ChannelPointsWidget.vue';

// accept some props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	},

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
const generalSettings = chromeShallowRef('general-settings', {});
const outputWidgetBox = shallowRef({
	x: 1280-150-300,
	y: 720-150,
	width: 300,
	height: 150
});
const settingsAggregator = new RefAggregator(generalSettings);
settingsAggregator.register('outputWidgetBox', outputWidgetBox);

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
	{
		slug: 'settings',
		component: null,
		settings: generalSettings,
		key: 'outputWidgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#FFFFFF'
	},
	{
		slug: 'channel_points',
		component: ChannelPointsWidget,
		settings: channelPointsSettings,
		key: 'widgetBox',
		allowResize: true,
		lockAspectRatio: true,
		color: '#EED43A'
	},
	{
		slug: 'chat_box',
		component: null,
		settings: chatBoxSettings,
		key: 'chatWidgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#60C5F1'
	},
	{
		slug: 'chat_box',
		component: null,
		settings: chatBoxSettings,
		key: 'shoutWidgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#60C5F1'
	},
	{
		slug: 'fishing',
		component: null,
		settings: fishingSettings,
		key: 'widgetBox',
		allowResize: true,
		lockAspectRatio: true,
		color: '#A4704C'
	},
	{
		slug: 'gamba',
		component: null,
		settings: gambaSettings,
		key: 'widgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#458233'
	},
	{
		slug: 'gamba',
		component: null,
		settings: gambaSettings,
		key: 'resultsWidgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#458233'
	},
	{
		slug: 'head_pats',
		component: null,
		settings: headPatsSettings,
		key: 'streamerWidgetBox',
		allowResize: true,
		lockAspectRatio: true,
		color: '#C6C37A'
	},
	{
		slug: 'head_pats',
		component: null,
		settings: headPatsSettings,
		key: 'chatterWidgetBox',
		allowResize: true,
		lockAspectRatio: true,
		color: '#C6C37A'
	},
	{
		slug: 'media',
		component: null,
		settings: mediaSettings,
		key: 'widgetBox',
		allowResize: true,
		lockAspectRatio: false,
		color: '#51547D'
	},
	{
		slug: 'prize_wheel',
		component: null,
		settings: prizeWheelSettings,
		key: 'widgetBox',
		allowResize: true,
		lockAspectRatio: true,
		color: '#FFAAC5'
	},
	{
		slug: 'tosser',
		component: null,
		settings: tosserSettings,
		key: 'targetWidgetBox',
		allowResize: true,
		lockAspectRatio: true,
		color: '#E65A5A'
	}
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
		...props.optionsApp.enabledToys.value].includes(slug);

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
