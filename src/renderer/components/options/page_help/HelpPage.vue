<!--
	HelpPage.vue
	------------

	This is the top level component for when the "Help" tab is active.
-->
<template>
	
	<VerticalItemsPage
		:verticalItems="pageItems"
		:selectedTab="selectedPage"
		@changeTab="(tab)=>selectedPage = tab"
	>
		<WelcomePage 
			v-if="selectedPage === 'help_welcome'" 
			:optionsApp="optionsApp"
		/>
		<HelpPage 
			v-if="selectedPage === 'help'" 
			:optionsApp="optionsApp"
		/>
		<VideoHelpPage 
			v-if="selectedPage === 'help_videos'" 
			:optionsApp="optionsApp"
		/>
		<ContactPage 
			v-if="selectedPage === 'help_contact'" 
			:optionsApp="optionsApp"
		/>
		<CreditsPage 
			v-if="selectedPage === 'credits'" 
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
import WelcomePage from './pages/WelcomePage.vue';
import HelpPage from './pages/HelpPage.vue';
import VideoHelpPage from './pages/VideoHelpPage.vue';
import ContactPage from './pages/ContactPage.vue';
import CreditsPage from './pages/CreditsPage.vue';

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
		slug: 'help_welcome',
		name: 'Welcome',
	},
	{
		slug: 'help',
		name: 'Help',
	},
	{
		slug: 'help_videos',
		name: 'Videos',
	},
	{
		slug: 'help_contact',
		name: 'Contact',
	},
	{
		slug: 'credits',
		name: 'Credits',
	}
];

// refs
const selectedPage = ref('help_welcome');

</script>
<style lang="scss" scoped>


</style>
