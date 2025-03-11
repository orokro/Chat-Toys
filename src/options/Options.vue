<!--
	Options.vue
	-----------

	This is the main component for the options page.
-->
<template>

	<div class="optionsWrapper">
		
		<!-- the tab strip along the top of the options page -->
		<TopTabBar
			class="topTabBar"
			:tabs="tabs"
			:activeTab="activeTab"
			@changeTab="(e)=>activeTab = e"
		/>

		<!-- the tab pages will spawn in this container -->
		<div class="tabPagesWrapper">

			<input type="color" v-model="bgColor" @input="saveColor" />
			<Test title="Test Component" />

		</div>

	</div>
</template>
<script setup>

// vue
import { ref, onMounted } from 'vue'

// components
import Test from '../components/options/Test.vue'
import TopTabBar from '../components/options/TopTabBar.vue'

// we'll define our tabs here
const tabs = [
	{ title: 'Help', icon: 'help', slug: 'help' },
	{ title: 'Settings', icon: 'settings', slug: 'settings' },
	{ title: 'Toy Box', icon: 'toys', slug: 'toybox' }
];

// the index of the active tab
const activeTab = ref(0);

// the background color for the popup window
const bgColor = ref('#ffffff')

// save the background color to storage
const saveColor = () => {
	chrome.storage.sync.set({ bgColor: bgColor.value })
}

// load the background color from storage when the component is mounted
onMounted(() => {

	chrome.storage.sync.get('bgColor', ({ bgColor: storedColor }) => {
		if (storedColor) {
			bgColor.value = storedColor
		}
	})
});

</script>
<style lang="scss" scoped>

	// the main wrapper for the page - fill the screen
	.optionsWrapper {

		// fill screen
		position: absolute;
		inset: 0px 0px 0px 0px;

		// default bg
		background: black;

		// top tab bar forced to top
		.topTabBar {
			
			position: absolute;
			inset: 0px 0px auto 0px;

		}// .topTabBar

		// the tab pages will spawn in this container
		.tabPagesWrapper {

			// fill bottom under top tabs
			position: absolute;
			inset: 42px 0px 0px 0px;
			background: white;
			padding: 10px;

		}// .tabPagesWrapper

	}// .optionsWrapper

</style>
