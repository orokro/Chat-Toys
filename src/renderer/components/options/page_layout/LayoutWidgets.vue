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
					v-if="widget.component != null && widget.component != DummyWidget"
					:demoMode="true"
					:is="widget.component"
				/>
			</LayoutBox>
		</template>
	</div>

</template>
<script setup>

// vue
import { shallowRef, inject } from 'vue'
import { chromeRef, chromeShallowRef } from '../../../scripts/chromeRef';
import { RefAggregator } from '../../../scripts/RefAggregator';

// components
import LayoutBox from './LayoutBox.vue';
import ChannelPointsWidget from '../../../toys/ChannelPoints/ChannelPointsWidget.vue';
import DummyWidget from '../../../toys/DummyWidget.vue';

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


// we'll store a list of widgets that can be spawned in the layout
const widgets = [

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
	widget.settings[widget.key].value = e;
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
