<!--
	AddToyModal.vue
	---------------

	The menu that pops up when the [+] add button is clicked in the toy box, toy strip.

	This will show a selection of icons available to the user.
-->
<template>

	<ModalWindowFrame
		title="Add a Toy"
		:width="400"
		:height="400"
	>
		<div class="modalContent">
			
			<!-- loop through the toys and display them -->
			<button
				v-for="toy in toysData"
				:key="toy.slug"
				@click="()=>select(toy)"
			>
				<img
					:src="`/assets/icons/${toy.slug}.png`"
					alt="toy.name"
					width="80"
					height="80"
				/>
			</button>

		</div>
	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import ModalWindowFrame from '../ModalWindowFrame.vue';

// lib misc
import { closeModal, Modal } from 'jenesius-vue-modal';
import { toysData } from '../../../scripts/ToysData';

const emit = defineEmits([Modal.EVENT_PROMPT]);

function select(value){
	emit(Modal.EVENT_PROMPT, value);
}

</script>
<style lang="scss" scoped>

	.modalContent {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		button {
			width: 100px;
			height: 30px;
			font-size: 1em;
			margin: 10px;
		}
	}

</style>
