<!--
	ToyBoxPage.vue
	--------------

	This is the top level component for when the "Toy Box" tab is active.
-->
<template>
	
	<VerticalItemsPage
		:verticalItems="verticalItems"
		:selectedTab="ctApp.selectedToy.value"
		:showAddButton="allToysAdded===false"
		:showDeleteButton="true"
		@changeTab="(tab)=>ctApp.selectToy(tab)"
		@addItem="handleAddToy"			
		@removeItem="(toy)=>handleRemoveToy(toy)"
	>

		<!-- if no toy is selected, show arrow -->
		<template v-if="ctApp.enabledToys.value.length<=0">
			<img
				class="clickToAddFirstToy"
				:src="'assets/click_to_add_first_toy.png'" 
				alt="arrow"
			/>
		</template>

		<template v-else>

			<ChannelPointsPage v-show="ctApp.selectedToy.value === 'channel_points'" />
			<ChatBoxPage v-show="ctApp.selectedToy.value === 'chat_box'" />
			<FishingPage v-show="ctApp.selectedToy.value === 'fishing'" />
			<GambaPage v-show="ctApp.selectedToy.value === 'gamba'" />
			<HeadPatsPage v-show="ctApp.selectedToy.value === 'head_pats'" />
			<MediaPage v-show="ctApp.selectedToy.value === 'media'" />
			<PrizeWheelPage v-show="ctApp.selectedToy.value === 'prize_wheel'" />
			<StreamBuddiesPage v-show="ctApp.selectedToy.value === 'stream_buddies'" />
			<TosserPage v-show="ctApp.selectedToy.value === 'tosser'" />

		</template>
	</VerticalItemsPage>
</template>
<script setup>

// vue
import { ref, markRaw, watch, computed, inject } from 'vue';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import AddToyModal from './AddToyModal.vue';
import ConfirmModal from '../ConfirmModal.vue';
import ChannelPointsPage from './pages/ChannelPointsPage.vue';
import ChatBoxPage from './pages/ChatBoxPage.vue';
import FishingPage from './pages/FishingPage.vue';
import GambaPage from './pages/GambaPage.vue';
import HeadPatsPage from './pages/HeadPatsPage.vue';
import MediaPage from './pages/MediaPage.vue';
import PrizeWheelPage from './pages/PrizeWheelPage.vue';
import StreamBuddiesPage from './pages/StreamBuddiesPage.vue';
import TosserPage from './pages/TosserPage.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"
import { toysData } from '../../../scripts/ToysData';


// fetch the main app state context
const ctApp = inject('ctApp');


// list of items to show in the vertical strip
const verticalItems = computed(() => {
	return ctApp.enabledToys.value.map((slug)=>(toysData.asObject[slug]));
});


// true when the user has added all the toys
const allToysAdded = computed(() => {
	return ctApp.enabledToys.value.length >= toysData.length;
});


// the container for the various pages
const toyPageArea = ref(null);


// handle when the remove toy button was clicked on the strip
async function handleRemoveToy(toy){

	const toyDetails = toysData.asObject[toy];
	const response = await promptModal(ConfirmModal, {
		title: 'Are you sure?',
		prompt: `Are you sure you want to remove the toy: ${toyDetails.name}?`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning'
	});

	// if the response was null, return
	if(response==null)
		return;

	// otherwise, if the response was not {button: 'yes', index:0}, return
	if(response.index!==0)
		return;

	// remove the toy
	ctApp.removeToy(toy);
}


// handle when the add a toy button was clicked on the strip
// (i.e. show the modal to add toys to our system)
const handleAddToy = async () => {

	const result = await promptModal(AddToyModal);
	
	// if no toy was selected, return
	if(result==null)
		return;

	// add the toy to the toy box
	const toySlug = result.slug;
	ctApp.addToy(toySlug)
};


// when the current toy changes, reset the scroll of the toyPageArea container
watch(() => ctApp.selectedToy.value, (newVal, oldVal) => {
	if(toyPageArea.value)
		toyPageArea.value.scrollTop = 0;
});


</script>
<style lang="scss" scoped>

	// the main page wrapper
	.toyBoxPage {

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
		// image to guide user to add their first item
		.clickToAddFirstToy{

			position: relative;
			top: 30px;
			left: 30px;

		}// .clickToAddFirstToy
		
	}// .toyBoxPage

</style>
