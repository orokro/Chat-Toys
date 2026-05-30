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
		<DebugPage    v-if="selectedPage === 'debug' && isDev" />
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
import DebugPage from './pages/DebugPage.vue';

// `npm run dev` only - production builds drop window.env.isDev to false
// so the Debug sub-tab never appears. Captured at module-load time
// rather than inside a computed since dev mode can't flip at runtime.
const isDev = !!window.env?.isDev;

// Vertical strip items for the System tab. Non-database entries (Widgets,
// Commands, future system tabs) sit above the database-flavored entries
// (Assets, Users) so the page reads as "system overview" first, "system
// data stores" second. The Debug entry is appended dynamically and only
// in dev builds.
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
if (isDev) {
	pageItems.push({
		slug: 'debug',
		name: 'Debug Tools',
	});
}

// refs
const selectedPage = chromeRef('databasePageTab', 'widgets');

// If a user had 'debug' persisted from a prior dev session and is now
// on a production build, bounce them back to the default tab.
if (selectedPage.value === 'debug' && !isDev)
	selectedPage.value = 'widgets';

</script>
<style lang="scss" scoped>


</style>
