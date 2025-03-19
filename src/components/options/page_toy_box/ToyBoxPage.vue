<!--
	ToyBoxPage.vue
	--------------

	This is the top level component for when the "Toy Box" tab is active.
-->
<template>
	
	<!-- main page wrapper-->
	<div class="page toyBoxPage">
		 
		<!-- the column on the left where toys can be added, removed, or selected to configure -->
		<ToysStrip
			class="toysStrip"
			:toys="optionsApp.enabledToys.value"
			:selectedToy="optionsApp.selectedToy.value"
			@addToy="handleAddToy"
			@selectToy="(toy)=>optionsApp.selectToy(toy)"
			@removeToy="(toy)=>handleRemoveToy(toy)"
		/>

		<!-- the main area where the selected toys appear -->
		<div ref="toyPageArea" class="toyPageArea">

			<!-- if no toy is selected, show arrow -->
			<template v-if="optionsApp.enabledToys.value.length<=0">
				<img
					class="clickToAddFirstToy"
					:src="'/assets/click_to_add_first_toy.png'" 
					alt="arrow"
				/>
			</template>

			<template v-else>

				<ChannelPointsPage 
					v-show="optionsApp.selectedToy.value === 'channel_points'" 
					:optionsApp="optionsApp"
				/>
				<ChatBoxPage 
					v-show="optionsApp.selectedToy.value === 'chat_box'" 
					:optionsApp="optionsApp"
				/>
				<FishingPage 
					v-show="optionsApp.selectedToy.value === 'fishing'" 
					:optionsApp="optionsApp"
				/>
				<GambaPage 
					v-show="optionsApp.selectedToy.value === 'gamba'" 
					:optionsApp="optionsApp"
				/>
				<HeadPatsPage 
					v-show="optionsApp.selectedToy.value === 'head_pats'" 
					:optionsApp="optionsApp"
				/>
				<MediaPage 
					v-show="optionsApp.selectedToy.value === 'media'" 
					:optionsApp="optionsApp"
				/>
				<PrizeWheelPage 
					v-show="optionsApp.selectedToy.value === 'prize_wheel'" 
					:optionsApp="optionsApp"
				/>
				<StreamBuddiesPage 
					v-show="optionsApp.selectedToy.value === 'stream_buddies'" 
					:optionsApp="optionsApp"
				/>
				<TosserPage 
					v-show="optionsApp.selectedToy.value === 'tosser'" 
					:optionsApp="optionsApp"
				/>
			</template>

		</div>
	
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, onMounted, markRaw, watch } from 'vue';
import { chromeRef } from '../../../scripts/chromeRef';

// components
import ToysStrip from './ToysStrip.vue';
import AddToyModal from './AddToyModal.vue';
import ConfirmModal from '../ConfirmModal.vue';
import ChannelPointsPage from './toy_pages/ChannelPointsPage.vue';
import ChatBoxPage from './toy_pages/ChatBoxPage.vue';
import FishingPage from './toy_pages/FishingPage.vue';
import GambaPage from './toy_pages/GambaPage.vue';
import HeadPatsPage from './toy_pages/HeadPatsPage.vue';
import MediaPage from './toy_pages/MediaPage.vue';
import PrizeWheelPage from './toy_pages/PrizeWheelPage.vue';
import StreamBuddiesPage from './toy_pages/StreamBuddiesPage.vue';
import TosserPage from './toy_pages/TosserPage.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"
import { toysData } from '../../../scripts/ToysData';

// accept some props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
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
	props.optionsApp.removeToy(toy);
}


// handle when the add a toy button was clicked on the strip
// (i.e. show the modal to add toys to our system)
const handleAddToy = async () => {

	const result = await promptModal(AddToyModal, {
		optionsApp: markRaw(props.optionsApp),
	});
	
	// if no toy was selected, return
	if(result==null)
		return;

	// add the toy to the toy box
	const toySlug = result.slug;
	props.optionsApp.addToy(toySlug)
};

// when the current toy changes, reset the scroll of the toyPageArea container
watch(() => props.optionsApp.selectedToy.value, (newVal, oldVal) => {
	if(toyPageArea.value)
		toyPageArea.value.scrollTop = 0;
});

window.resetCommands = () => {
	props.optionsApp.commands.value = {};
}

</script>
<style lang="scss" scoped>

	// the main page wrapper
	.toyBoxPage {

		// fill page area
		position: absolute;
		inset: 0;

		// force tool strip on left side
		.toysStrip {
			position: absolute;
			inset: 0px auto 0px 0px;
		}

		// for debug
		/* border: 2px solid red; */
		
		// fill on right
		.toyPageArea {

			// fill right side of screen
			position: absolute;
			inset: 0px 0px 0px 100px;
			overflow: hidden;
			overflow-y: auto;
			// padding for contents (which will always be a PageBox, etc)
			padding: 20px 30px 0px 30px;

			// image to guide user to add their first item
			.clickToAddFirstToy{

				position: relative;
				top: 30px;
				left: 30px;

			}// .clickToAddFirstToy

		}// .toyPageArea
		
	}// .toyBoxPage

</style>
