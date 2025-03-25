<!--
	TopBarBar.vue
	-------------

	The main tab bar along the top of the options page.

	For example:
	- Help
	- Settings
	- ToyBox
-->
<template>

	<div
		class="topTabBar"
	>
		<TopTab
			v-for="(tab, index) in tabs"
			:key="`${index}_${tab.slug}`"
			:title="tab.title"
			:icon="tab.icon"
			:index="index"
			:slug="tab.slug"
			:active="index === activeTab"
			@click="() => emits('changeTab', index)"
		/>
	</div>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import TopTab from './TopTab.vue';

// props
const props = defineProps({

	// array of tab details to spawn in the tab bar
	tabs: {
		type: Array,
		default: () => []
	},

	// the index of the active tab
	activeTab: {
		type: Number,
		default: 0
	}
});

// emit events
const emits = defineEmits(['changeTab']);

</script>
<style lang="scss" scoped>

// the main bar at the top of the screen
.topTabBar {

	// box styles
	background: rgb(104, 96, 112);
	height: 40px;
	border-bottom: 2px solid #333;

	// stack the children from left to right via flex
	display: flex;
	flex-direction: row;
	
	// make tabs stack from left to right
	justify-content: center;
	
}// .topTabBar

</style>
