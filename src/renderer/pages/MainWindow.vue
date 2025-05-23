<!--
	MainWindow.vue
	--------------

	This is the root component for the main electron window.

	Historical note - originally this file was called 'Options.vue',
	because it was the options page for a chrome-plugin, before the project
	was converted to an electron app.

	This main window will primarily set up the main view's tabs, and
	create the instance of the ChatToysApp, which will be the main state.
-->
<template>

	<!-- via our "jenesius-vue-modal" modal library -->
	<widget-container-modal/>

	<div class="mainWindowWrapper">
		
		<!-- the tab strip along the top of the main window page -->
		<TopTabBar
			class="topTabBar"
			:tabs="tabs"
			:activeTab="activeTab"
			@changeTab="(e)=>activeTab = e"
		/>

		<!-- the tab pages will spawn in this container -->
		<div class="tabPagesWrapper">

			<HelpPage v-if="activeTab === 0" />
			<SettingsPage v-if="activeTab === 1" />			
			<ToyBoxPage v-if="activeTab === 2" />
			<LayoutPage v-if="activeTab === 3" />	
			<DatabasePage v-if="activeTab === 4" />

		</div>

	</div>
</template>
<script setup>

// vue
import { ref, provide, onBeforeMount } from 'vue'
import { chromeRef, chromeShallowRef } from '@scripts/chromeRef';

// components
import TopTabBar from '../components/options/TopTabBar.vue'
import HelpPage from '../components/options/page_help/HelpPage.vue'
import SettingsPage from '../components/options/page_settings/SettingsPage.vue'
import ToyBoxPage from '../components/options/page_toy_box/ToyBoxPage.vue'
import LayoutPage from '../components/options/page_layout/LayoutPage.vue'
import DatabasePage from '../components/options/page_database/DatabasePage.vue'
import { container as WidgetContainerModal } from "jenesius-vue-modal"; 

// our app scripts
import ChatToysApp from '../scripts/ChatToysApp';
let ctApp = null;

// we'll define our tabs here
const tabs = [
	{ title: 'Help', icon: 'help', slug: 'help' },
	{ title: 'Connection Settings', icon: 'settings_ethernet', slug: 'settings' },	
	{ title: 'Toy Box', icon: 'toys', slug: 'toybox' },
	{ title: 'Layout', icon: 'monitor', slug: 'layout' },
	{ title: 'Database', icon: 'storage', slug: 'settings' },

	// deprecated page
	// { title: 'Showtime Buttons Board', icon: 'dialpad', slug: 'buttons' },
];

// the index of the active tab
const activeTab = chromeRef('mainTab', 0);

// before we render first time, we need to instantiate our main state
onBeforeMount(() => {

	// create the app, which will be the main state manager for the app
	ctApp = new ChatToysApp();

	// since we're using vue3, we can provide the app state to all children
	provide('ctApp', ctApp);

	// provide access for window for e-z-debugging
	window.dctApp = ctApp;
});


// switch to the help tab when invoked
const selectedHelpPage = chromeRef('helpPageTab', 'help_welcome');
window.electronAPI.onShowHelp((page) => {

	activeTab.value = 0;
	selectedHelpPage.value = page;
});


</script>
<style lang="scss" scoped>

	// the main wrapper for the page - fill the screen
	.mainWindowWrapper {

		// fill screen
		position: absolute;
		inset: 0px 0px 0px 0px;
		
		// default bg
		background: #424242;
		/* background: #00abae; */
		background: #323232 url('/assets/bg_tiles/main.png') repeat;

		// top tab bar forced to top
		.topTabBar {
			
			position: absolute;
			inset: 0px 0px auto 11px;

		}// .topTabBar

		// the tab pages will spawn in this container
		.tabPagesWrapper {

			// fill bottom under top tabs
			position: absolute;
			inset: 52px 0px 0px calc(50vw - 800px);			
			
			/* transition: inset 0.4s ease-in-out; */

			padding: 10px 10px 0px 10px;
			border-style: 15px;

			overflow-y: auto;
			overflow-x: hidden;
			
			//Ensures child elements respect height constraints
			display: flex; 
			flex-direction: column;
			height: calc(100vh - 42px);

		}// .tabPagesWrapper

	}// .mainWindowWrapper

	// styles for modal backdrop via the "jenesius-vue-modal" library
	:deep(.modal-container) {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(5px);
		z-index: 1000;
	}
	
	// for smaller widths, we need to adjust the layout
	@media (max-width: 1599px) {

		.mainWindowWrapper {

			// for debug, make it obvious
			/* background: #00abae !important; */

			.tabPagesWrapper {
				position: absolute;
				inset: 52px 0px 0px 0px !important;
			
			}// .tabPagesWrapper

		}// .mainWindowWrapper
	}

</style>
