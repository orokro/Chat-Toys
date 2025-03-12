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
			@addToy="handleAddToy"
		/>

		<!-- the main area where the selected toys appear -->
		<div class="toyPageArea">

			<!-- if no toy is selected, show arrow -->
			<template v-if="selectedToy==null">
				<img
					class="clickToAddFirstToy"
					:src="'/assets/click_to_add_first_toy.png'" 
					alt="arrow"
				/>
			</template>
			

		</div>
	
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, onMounted } from 'vue';

// components
import ToysStrip from './ToysStrip.vue';
import AddToyModal from './AddToyModal.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"

// list of toys the user has added
// TODO: move to state controller
const toys = shallowRef([]);

// the currently selected toy, if any
const selectedToy = ref(null);

onMounted(() => {
	if(toys.value.length > 0){
		selectedToy.value = toys.value[0];
	}
});

// handle when the add a toy button was clicked on the strip
// (i.e. show the modal to add toys to our system)
const handleAddToy = async () => {
	console.log('add toy');

	const result = await promptModal(AddToyModal);

	console.log('result', result);
};

</script>
<style lang="scss" scoped>

	// the main page wrapper
	.toyBoxPage {

		// fill page area
		position: absolute;
		inset: 0;

		// force tool stip on left side
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
