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
		<WelcomePage v-if="selectedPage === 'help_welcome'" />
		<HelpPage v-if="selectedPage === 'help'" />
		<VideoHelpPage v-if="selectedPage === 'help_videos'" />
		<ContactPage v-if="selectedPage === 'help_contact'" />
		<CreditsPage v-if="selectedPage === 'credits'" />
	
	</VerticalItemsPage>
</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import WelcomePage from './pages/WelcomePage.vue';
import HelpPage from './pages/HelpPage.vue';
import VideoHelpPage from './pages/VideoHelpPage.vue';
import ContactPage from './pages/ContactPage.vue';
import CreditsPage from './pages/CreditsPage.vue';

// pages (this will generate the icons for the vertical strip items)
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
