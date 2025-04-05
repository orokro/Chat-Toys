<!--
	ResolveGambaModal.vue
	---------------------

	This modal let's the streamer end the betting round and resolve the bets.
-->
<template>

	<ModalWindowFrame
		title="Resolve Gamba Round"
		:width="550"
		:height="450"
	>
		
		<!-- our inner content wrapper -->
		<div
			class="modalContent"
		>	

			<!-- blurb about editing commands -->
			<div
				class="blurb infoBox"
			>
				Which outcome won? <br>

				<!-- radio option group for everything in toy.settings.gambaOptions.value -->
				<div
					class="radioGroup"
					ref="inputRef"
					tabindex="0"
				>
					<div
						class="radioOption"
						v-for="(option, index) in toy.settings.gambaOptions.value"
						:key="index"
					>
						<input
							
							type="radio"
							:name="option"
							:value="index"
							:id="option"
							v-model="chosenOption"
						/>
						<label :for="option">
							{{ option }}
						</label>
					</div>
				</div>

				<br><br><br><br>
			</div>

			<!-- the buttons along the bottom -->
			<div 
				class="buttons"				
				tabindex="0"
			>
				<button
					class="primary"
					:disabled="chosenOption === null"
					@click="buttonClicked('apply', 0)"
				>
					Resolve Round
				</button>
				<button
					@click="buttonClicked('cancel', 1)"
				>
					Cancel
				</button>
			</div>
		</div>

	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';

// components
import ModalWindowFrame from '@components/options/ModalWindowFrame.vue';

// our app
import Gamba from './Gamba';

// lib misc
import { Modal } from 'jenesius-vue-modal';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Gamba.slug];

// selected radio button
const chosenOption = ref(null);

// some props
const props = defineProps({

});

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

// reference to the input to focus on start
const inputRef = ref(null);


// when user clicks a button
function buttonClicked(button, index){

	// if no chosen option, gtfo
	if(button === 'apply' && chosenOption.value === null)
		return;
	
	// emit the event that closes the prompt-type modal with the value
	emit(Modal.EVENT_PROMPT, {button, index, value: chosenOption.value});
}

// when the component is mounted we should add an event listener for enter and send whatever the first button is
onMounted(() => {

	// focus on the first radio button
	inputRef.value.focus();

	// add an event listener for enter
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			buttonClicked('apply', 0);
		}
	});
});

// we should also clean up event listeners before unmounting
onUnmounted(() => {
	window.removeEventListener('keydown', ()=>{});
});

</script>
<style lang="scss" scoped>

	// fill modal
	.modalContent {

		// fill bottom with a gray box
		width: 100%;
		height: 100%;

		// fill modal
		position: absolute;
		inset: 0px;

		// details about what's being edited
		.infoBox {

			height: 100%;

			padding: 20px;
			overflow-y: scroll;
		}

		// the gamba options
		.radioGroup {

			// layout
			display: flex;
			flex-direction: column;
			gap: 20px;
			margin-top: 10px;
			margin-left: 20px;

			// actual option rows
			.radioOption {

				// layout
				display: flex;
				align-items: center;
				gap: 10px;

				// the inputs
				input[type="radio"] {
					
					// make the radio button bigger
					width: 20px;
					height: 20px;
					cursor: pointer;
				}

				label {
					cursor: pointer;
				}

			}// .radioOptions

		}// .radioGroup
		
		// put buttons bar along the bottom, slightly gray
		.buttons {

			// disable the default outline
			outline: none;

			// fill bottom with a gray box
			position: absolute;
			inset: auto 0px 0px 0px;
			background: #EEE;
			height: 50px;

			// space buttons nicely
			display: flex;
			justify-content: flex-start;
			flex-direction: row-reverse;
			align-items: center;
			gap: 10px;
			padding-right: 10px;

			// make buttons look pretty
			button {

				// nice padding, rounded corners, and pointer cursor
				padding: 5px 10px;
				border-radius: 5px;
				cursor: pointer;

				// nice vertical gradient
				background: linear-gradient(180deg, #FFF, #DDD);
				text-transform: uppercase;

				&:disabled {
					pointer-events: none;
					opacity: 0.5;
					cursor: not-allowed;
				}

				// mm that primary tho
				&.primary {
					background: linear-gradient(180deg, #05dee2, #00ABAE);
					font-weight: bolder;
					color: white;
				}

				&:hover {
					background: linear-gradient(180deg, #f4fbff, #c4d0d6);
				}

			}// button

		}// .buttons

	}// .modalContent

</style>
