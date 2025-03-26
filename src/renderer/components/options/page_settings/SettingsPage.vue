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
		<GeneralSettingsPage 
			v-if="selectedPage === 'settings'" 
			:optionsApp="optionsApp"
		/>
		<AssetsPage 
			v-if="selectedPage === 'assets_db'" 
			:optionsApp="optionsApp"
		/>
		<UsersPage 
			v-if="selectedPage === 'users_db'" 
			:optionsApp="optionsApp"
		/>

	</VerticalItemsPage>

</template>
<script setup>

// vue
import { ref, shallowRef, onMounted, markRaw, watch, computed } from 'vue';
import { chromeRef } from '../../../scripts/chromeRef';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import GeneralSettingsPage from './pages/GeneralSettingsPage.vue';
import AssetsPage from './pages/AssetsPage.vue';
import UsersPage from './pages/UsersPage.vue';

// components
import PageBox from '../PageBox.vue';
import SectionHeader from '../SectionHeader.vue';

const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// pages
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
