<!--
	SettingsPage.vue
	----------------

	This is the top level component for when the "Settings" tab is active.
-->
<template>
	
	<!-- main page wrapper-->
	<div class="page settingsPage">
		 
		<!-- the column on the left where toys can be added, removed, or selected to configure -->
		<VerticalItemStrip
			class="vItemsStrip"
			:vItems="pageItems"
			:selectedItemSlug="selectedPage"
			:showAdd="false"
			:showDelete="false"
			:iconPath="'assets/icons'"
			@selectItem="(itemSlug)=>selectedPage = itemSlug.slug"
		/>

		<!-- the main area where the selected pages -->
		<div ref="helpPageArea" class="contentPageArea">

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

		</div>
	
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, onMounted, markRaw, watch, computed } from 'vue';
import { chromeRef } from '../../../scripts/chromeRef';

// components
import VerticalItemStrip from '../VerticalItemStrip.vue';
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

	// the main page wrapper
	.page {

		// fill page area
		position: absolute;
		inset: 0;

		// force tool strip on left side
		.vItemsStrip {
			position: absolute;
			inset: 0px auto 0px 0px;
		}

		// for debug
		/* border: 2px solid red; */

	}// .page

</style>
