<!--
	HelpPage.vue
	------------

	This is the top level component for when the "Help" tab is active.
-->
<template>
	
	<!-- main page wrapper-->
	<div class="page helpPage">
		 
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
		<div ref="helpPageArea" class="pageArea">

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

		</div>
	
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, onMounted, markRaw, watch, computed } from 'vue';
import { chromeRef } from '../../../scripts/chromeRef';

// components
import VerticalItemStrip from '../VerticalItemStrip.vue';
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

		// fill on right
		.pageArea {

			// fill right side of screen
			position: absolute;
			inset: 0px 0px 0px 100px;
			overflow: hidden;
			overflow-y: auto;

			// padding for contents (which will always be a PageBox, etc)
			padding: 20px 30px 30px 30px;

			// image to guide user to add their first item
			.clickToAddFirstToy{

				position: relative;
				top: 30px;
				left: 30px;

			}// .clickToAddFirstToy

		}// .pageArea

	}// .page

</style>
