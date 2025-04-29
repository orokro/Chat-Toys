<!--
	EditUserModal.vue
	-----------------

	This modal will be for editing users in the users db page.

	For now, the only field we'll support is the user's points.
-->
<template>

	<ModalWindowFrame
		:title="title"
		:width="550"
		:height="250"
	>		
		<!-- our inner content wrapper -->
		<div
			class="modalContent"
		>
			<!-- blurb about editing costs  -->
			<div
				class="blurb infoBox"
			>
				Edit the points for the the user, <span class="user">{{ props.userData.display_name }}</span>:
			</div>

			<!-- the area where we'll have the edit input and provide validation feedback -->
			<div class="editArea" align="center">
				<span class="inputPrefix">₱</span>
				<input
					ref="inputRef"
					v-model="editValue"
					:placeholder="`${0}`"
					class="editInput"
					:class="{
						error: validValue !== true
					}"
					@input="()=>{}"
				>
				<div 
					v-if="validValue !== true"
					class="errorMsg"
				>
					{{ validValue }}
				</div>
			</div>

			<!-- the buttons along the bottom -->
			<div 
				class="buttons"				
				tabindex="0"
			>
				<button
					class="primary"
					:disabled="validValue !== true"
					@click="buttonClicked('save', 0)"
				>
					Save
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

// components
import ModalWindowFrame from '../ModalWindowFrame.vue';

// lib misc
import { Modal } from 'jenesius-vue-modal';

// some props
const props = defineProps({

	// data for the user
	userData: {
		type: Object,
		default: null
	},

});

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

// reference to the input to focus on start
const inputRef = ref(null);

// the value that we'll re-use for various inputs
const editValue = ref(props.userData.points);

// title for the modal
const title = computed(() => {
	return `Edit Points for ${props.userData.display_name}`;
});


// validate the value
const validValue = computed(() => {
	
	const value = editValue.value;
	const numValue = Number(value);
	
	if (!Number.isInteger(numValue))
		return 'Value must be a whole number (integer).';
	
		if (numValue < 0)
		return 'Cost cannot be negative or below 0.';

	return true;
});


// when user clicks a button
function buttonClicked(button, index){

	// ignore 'save' if the value is not valid
	if (button === 'save' && validValue.value !== true)
		return;

	// emit the event that closes the prompt-type modal with the value
	emit(Modal.EVENT_PROMPT, {button, index, value: editValue.value});
}


// format the value based on the kind
function formatValue(){

	let formatted = editValue.value.toString().replace(/[^0-9.]/g, '');
	let numValue = parseFloat(formatted);
	if (!isNaN(numValue)) {
		editValue.value = Math.round(numValue).toString();
	}
	
};


// watch the edit value and format it if necessary
watch(editValue, formatValue);

// when the component is mounted we should add an event listener for enter and send whatever the first button is
onMounted(() => {

	// copy the initial value to the edit value
	editValue.value = props.userData.points;

	// focus on the input & select all it's text
	inputRef.value.focus();
	inputRef.value.select();

	// add an event listener for enter
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			buttonClicked('save', 0);
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
			padding: 20px;
		}

		.user {
			font-style: italic;
			text-decoration: underline;
		}

		// symbol for the input
		.inputPrefix {
			position: relative;
			top: 2px;
			font-size: 1.5em;
			font-weight: bold;
			margin-right: 5px;
		}// .inputPrefix

		// the area where we'll have the edit input and provide validation feedback
		.editInput {

			padding: 3px 10px;
			border-radius: 5px;
			border: 2px solid #CCC;
			box-shadow: inset 0px 0px 5px #CCC;

			// text settings
			font-size: 1.2em;

			&.error {
				border-color: red;
				outline-color: red;
				box-shadow: inset 0px 0px 5px red;
			}
		}// .editInput


		// area under the input with validation errors
		.errorMsg {
			background: rgba(255, 0, 0, 0.1);
			padding: 5px;
			margin: 15px;
			border-radius: 5px;
			font-size: 12px;
			font-style: italic;
		}// .errorMsg


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
