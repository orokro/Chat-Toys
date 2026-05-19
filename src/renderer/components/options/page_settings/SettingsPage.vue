<!--
	SettingsPage.vue
	----------------

	This is the top level component for when the "Settings" tab is active.
-->
<template>
	
	<VerticalItemsPage
		:verticalItems="pageItems"
		:selectedTab="selectedPage"
		@changeTab="(tab)=>selectedPage = tab"
	>	
		<OBSSettingsPage v-if="selectedPage === 'obsSettings'" />
		<ChatPage v-if="selectedPage === 'chatSettings'" />
		<TwitchPage v-if="selectedPage === 'twitch'" />
		<VTubeStudioPage v-if="selectedPage === 'vtsSettings'" />
		<PluginPage v-if="selectedPage === 'plugin'" />
		<BTTVPage v-if="selectedPage === 'bttv'" />

	</VerticalItemsPage>

</template>
<script setup>

// vue
import { ref } from 'vue';
import { chromeRef, chromeShallowRef } from '@scripts/chromeRef';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import OBSSettingsPage from './pages/OBSSettingsPage.vue';
import VTubeStudioPage from './pages/VTubeStudioPage.vue';
import ChatPage from './pages/ChatPage.vue';
import TwitchPage from './pages/TwitchPage.vue';
import PluginPage from './pages/PluginPage.vue';
// CommandsDescPage moved to the System -> Commands tab (the copy / paste
// command-list snippet now lives on the master CommandsPage). Connection
// Settings is no longer the right home for it.
import BTTVPage from './pages/BTTVPage.vue';

// this will generate the icons for the vertical strip items
const pageItems = [
	{
		slug: 'chatSettings',
		name: 'Chat Settings',
	},
	{
		slug: 'twitch',
		name: 'Twitch Settings',
	},
	{
		slug: 'obsSettings',
		name: 'General Settings',
	},
	{
		slug: 'vtsSettings',
		name: 'VTubeStudio Settings',
	},
	{
		slug: 'bttv',
		name: 'BTTV Integration',
	},
	// {
	// 	slug: 'plugin',
	// 	name: 'Plugin Settings',
	// },
];

// refs
const selectedPage = chromeRef('settingsPageTab', 'chatSettings');

// One-shot migration: if a user had the (now-removed) 'copy_details'
// tab persisted from a previous version, bounce them back to chat
// settings so they don't land on a blank page.
if (selectedPage.value === 'copy_details')
	selectedPage.value = 'chatSettings';

</script>
<style lang="scss" scoped>


</style>
