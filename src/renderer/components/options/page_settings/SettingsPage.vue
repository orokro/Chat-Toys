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
		<GeneralSettingsPage v-if="selectedPage === 'settings'" />
		<AssetsPage v-if="selectedPage === 'assets_db'" />
		<UsersPage v-if="selectedPage === 'users_db'" />

	</VerticalItemsPage>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import GeneralSettingsPage from './pages/GeneralSettingsPage.vue';
import AssetsPage from './pages/AssetsPage.vue';
import UsersPage from './pages/UsersPage.vue';

// this will generate the icons for the vertical strip items
const pageItems = [
	{
		slug: 'settings',
		name: 'General Settings',
	},
	{
		slug: 'assets_db',
		name: 'Assets',
	},
	{
		slug: 'users_db',
		name: 'Users',
	},
];

// refs
const selectedPage = ref('assets_db');

</script>
<style lang="scss" scoped>


</style>
