<!--
	LayoutWidgets.vue
	-----------------

	To keep the LayoutScreen.vue component clean, we'll move the
	widgets that are spawned in to this component.
-->
<template>

	<!-- this container will 100% fill the LayoutScreen component -->
	<div class="layoutWidgetsSpawnContainer">

		
	</div>

</template>
<script setup>

// vue
import { ref, onMounted } from 'vue'

// accept some props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	},

	// the currently active widget tab
	activeTab: {
		type: String,
		default: 'settings'
	}
});


/**
 * Determines if a widget should be shown in the layout
 * 
 * @param {string} slug
 * @returns {boolean}
 */
 const shouldShowInLayout = (slug) => {
	
	// check if the slug is in our list of enabled toys
	const isEnabled = props.optionsApp.enabledToys.value.includes(slug);

	// if the item isn't enabled, we don't care if we are showing all widgets
	if (!isEnabled)
		return false;

	// check if we have all widgets enabled
	const showAll = showAllWidgets.value;
	if(showAll)
		return true;
	
	// if we aren't showing all widgets, we only show the enabled ones
	return props.activeTab === slug;
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
		border: 1px solid red;
		
	}// .layoutWidgetsSpawnContainer

</style>
