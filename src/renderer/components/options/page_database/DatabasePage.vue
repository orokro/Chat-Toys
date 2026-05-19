<!--
	DatabasePage.vue
	----------------

	This is the top level component for when the "Database" tab is active.
-->
<template>

	<VerticalItemsPage
		:verticalItems="pageItems"
		:selectedTab="selectedPage"
		@changeTab="(tab)=>selectedPage = tab"
	>
		<WidgetsPage  v-if="selectedPage === 'widgets'" />
		<CommandsPage v-if="selectedPage === 'commands'" />
		<AssetsPage   v-if="selectedPage === 'assets_db'" />
		<UsersPage    v-if="selectedPage === 'users_db'" />
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
import WidgetsPage from './pages/WidgetsPage.vue';
import CommandsPage from './pages/CommandsPage.vue';

// Vertical strip items for the System tab. Non-database entries (Widgets,
// Commands, future system tabs) sit above the database-flavored entries
// (Assets, Users) so the page reads as "system overview" first, "system
// data stores" second.
const pageItems = [
	{
		slug: 'widgets',
		name: 'Widgets',
	},
	{
		slug: 'commands',
		name: 'Commands',
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
const selectedPage = chromeRef('databasePageTab', 'widgets');

</script>
<style lang="scss" scoped>


</style>
