<!--
	DatabasePage.vue
	----------------

	This is the top level component for when the "Database" tab is active.
-->
<template>
	ads
	<VerticalItemsPage
		:verticalItems="pageItems"
		:selectedTab="selectedPage"
		@changeTab="(tab)=>selectedPage = tab"
	>	
		<AssetsPage v-if="selectedPage === 'assets_db'" />
		<UsersPage v-if="selectedPage === 'users_db'" />
	</VerticalItemsPage>

</template>
<script setup>

// vue
import { ref } from 'vue';
import { chromeRef, chromeShallowRef } from '@scripts/chromeRef';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import AssetsPage from './pages/AssetsPage.vue';
import UsersPage from './pages/UsersPage.vue';

// this will generate the icons for the vertical strip items
const pageItems = [
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
const selectedPage = chromeRef('databasePageTab', 'assets_db');

</script>
<style lang="scss" scoped>


</style>
