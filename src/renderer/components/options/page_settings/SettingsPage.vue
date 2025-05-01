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
		<PluginPage v-if="selectedPage === 'plugin'" />
		<CommandsDescPage v-if="selectedPage === 'copy_details'" />

	</VerticalItemsPage>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import OBSSettingsPage from './pages/OBSSettingsPage.vue';
import ChatPage from './pages/ChatPage.vue';
import PluginPage from './pages/PluginPage.vue';
import CommandsDescPage	 from './pages/CommandsDescPage.vue';

// this will generate the icons for the vertical strip items
const pageItems = [
	{
		slug: 'chatSettings',
		name: 'Chat Settings',
	},
	{
		slug: 'obsSettings',
		name: 'General Settings',
	},
	{
		slug: 'copy_details',
		name: 'Commands Desc',
	}
	// {
	// 	slug: 'plugin',
	// 	name: 'Plugin Settings',
	// },
];

// refs
const selectedPage = ref('chatSettings');

</script>
<style lang="scss" scoped>


</style>
