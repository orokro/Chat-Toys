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
		<ChatPage v-if="selectedPage === 'chat'" />
		<PluginPage v-if="selectedPage === 'plugin'" />
		
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

// this will generate the icons for the vertical strip items
const pageItems = [
	{
		slug: 'obsSettings',
		name: 'General Settings',
	},
	{
		slug: 'chat',
		name: 'Chat Settings',
	},
	{
		slug: 'plugin',
		name: 'Plugin Settings',
	},
];

// refs
const selectedPage = ref('chat');

</script>
<style lang="scss" scoped>


</style>
