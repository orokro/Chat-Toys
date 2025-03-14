<!--
	ToyBoxPage.vue
	--------------

	This is the top level component for when the "Toy Box" tab is active.
-->
<template>
	
	<!-- main page wrapper-->
	<div class="page toyBoxPage">
		 
		<!-- the column on the left where toys can be added, removed, or selected to configue -->
		<ToysStrip
			class="toysStrip"
			:toys="optionsApp.enabledToys.value"
			:selectedToy="optionsApp.selectedToy.value"
			@addToy="handleAddToy"
			@selectToy="(toy)=>optionsApp.selectToy(toy)"
		/>

		<!-- the main area where the selected toys appear -->
		<div class="toyPageArea">

			<!-- if no toy is selected, show arrow -->
			<template v-if="optionsApp.enabledToys.value.length<=0">
				<img
					class="clickToAddFirstToy"
					:src="'/assets/click_to_add_first_toy.png'" 
					alt="arrow"
				/>
			</template>
			
			<button
				@click="handleTestConfirmModal"
				:style="{
					margin: '30px',
					padding: '5px 10px',
				}"
			>Show ConfirmModal</button>
		</div>
	
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, onMounted, markRaw } from 'vue';
import { chromeRef } from '../../../scripts/chromeRef';

// components
import ToysStrip from './ToysStrip.vue';
import AddToyModal from './AddToyModal.vue';
import ConfirmModal from '../ConfirmModal.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"

// accept some props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

function handleTestConfirmModal(){
	promptModal(ConfirmModal, {
		title: 'Test of Confirm Modal',
		prompt: 'U sure this is working?',
		buttons: ['yes', 'no', 'unsure'],
		icon: 'warning'
	});
}

onMounted(() => {

});

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

			position: absolute;
			inset: 0px 0px 0px 100px;

			.clickToAddFirstToy{

				position: relative;
				top: 30px;
				left: 30px;
			}

		}// .toyPageArea
		
	}// .toyBoxPage

</style>
