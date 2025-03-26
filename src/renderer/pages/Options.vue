<!--
	Options.vue
	-----------

	This is the main component for the options page.
-->
<template>

	<!-- via our "jenesius-vue-modal" modal library -->
	<widget-container-modal/>

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

			<HelpPage 
				v-if="activeTab === 0" 
				:optionsApp="optionsApp"
			/>
			<SettingsPage 
				v-if="activeTab === 1"
				:optionsApp="optionsApp"
			/>
			<ToyBoxPage 
				v-if="activeTab === 2"
				:optionsApp="optionsApp"
			/>
			<LayoutPage
				v-if="activeTab === 3"
				:optionsApp="optionsApp"
			/>
			<ButtonsPage
				v-if="activeTab === 4"
				:optionsApp="optionsApp"
			/>		

		</div>

	</div>
</template>
<script setup>

// vue
import { ref, onBeforeMount, onMounted } from 'vue'

// components
import TopTabBar from '../components/options/TopTabBar.vue'
import HelpPage from '../components/options/page_help/HelpPage.vue'
import SettingsPage from '../components/options/page_settings/SettingsPage.vue'
import ToyBoxPage from '../components/options/page_toy_box/ToyBoxPage.vue'
import LayoutPage from '../components/options/page_layout/LayoutPage.vue'
import ButtonsPage from '../components/options/page_buttons/ButtonsBoardPage.vue'
import { container as WidgetContainerModal } from "jenesius-vue-modal"; 

// our app scripts
import Options from '../scripts/options_state/Options';
let optionsApp = null;

// we'll define our tabs here
const tabs = [
	{ title: 'Help', icon: 'help', slug: 'help' },
	{ title: 'General Settings', icon: 'settings', slug: 'settings' },
	{ title: 'Toy Box', icon: 'toys', slug: 'toybox' },
	{ title: 'layout', icon: 'monitor', slug: 'layout' },
	{ title: 'Showtime Buttons Board', icon: 'dialpad', slug: 'buttons' },
];

// the index of the active tab
const activeTab = ref(3);

// before we render first time, we need to instantiate our options state
onBeforeMount(() => {
	optionsApp = new Options();

	window.optionsApp = optionsApp;
});

</script>
<style lang="scss" scoped>

	// the main wrapper for the page - fill the screen
	.optionsWrapper {

		// fill screen
		position: absolute;
		inset: 0px 0px 0px 0px;

		// default bg
		background: #424242;
		/* background: #00abae; */

		// top tab bar forced to top
		.topTabBar {
			
			position: absolute;
			inset: 0px 0px auto 0px;

		}// .topTabBar

		// the tab pages will spawn in this container
		.tabPagesWrapper {

			/* border: 1px solid red; */
			min-width: 990px;

			// fill bottom under top tabs
			position: absolute;
			inset: 42px 0px 0px 0px;
			/* background: white; */
			padding: 10px 10px 0px 10px;

			border-style: 15px;

			overflow-y: auto;

			//Ensures child elements respect height constraints
			display: flex; 
			flex-direction: column;
			height: calc(100vh - 42px);

		}// .tabPagesWrapper

	}// .optionsWrapper

	// styles for modal backdrop via the "jenesius-vue-modal" library
	:deep(.modal-container) {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(5px);
		z-index: 1000;
	}
	
</style>
