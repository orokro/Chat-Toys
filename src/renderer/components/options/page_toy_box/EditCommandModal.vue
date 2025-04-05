<!--
	EditCommandModal.vue
	--------------------

	This modal will be used to edit various command properties.
	For example:
	- command string
	- cost
	- cool down
-->
<template>

	<ModalWindowFrame
		:title="title"
		:width="750"
		:height="550"
	>
		
		<!-- our inner content wrapper -->
		<div
			class="modalContent"
		>	

			<!-- blurb about editing commands -->
			<div
				v-if="kind=='command'"
				class="blurb infoBox"
			>
				You are editing the command, currently set to: <span class="cmd">!{{ initialValue }}</span>,
				<br>which is used to: "<em class="hl">{{ commandDetails.description }}</em>"
				<br><br>
				Commands can be:
				<ul>
					<li>Between 1 and 32 characters long</li>
					<li>Contain only lower case letters a-z and numbers 0-9</li>
					<li>No spaces allowed</li>
					<li>No special characters allowed</li>
					<li>The leading <strong>!</strong> is implied and does not need to be typed</li>
				</ul>
			</div>

			<!-- blurb about editing costs  -->
			<div
				v-if="kind=='cost'"
				class="blurb infoBox"
			>
				You are editing the cost for the command <span class="cmd">!{{ commandDetails.command }}</span>,
				<br>which is used to: "<em class="hl">{{ commandDetails.description }}</em>"
				<br><br>
				Costs can be:
				<ul>
					<li>₱ 0 (Free)</li>
					<li>Up to ₱ 999</li>
					<li>Whole numbers only (no fractions like ₱ 3.50)</li>
				</ul>
				If you do not have the Channel Points toy enabled, the cost will be ignored.
			</div>

			<!-- blurb about editing cooldowns  -->
			<div
				v-if="kind=='coolDown' || kind=='groupCoolDown'"
				class="blurb infoBox"
			>
				You are editing the <em class="hl">{{ kind=='coolDown' ? 'user' : 'group' }} cool down</em> for the command <span class="cmd">!{{ commandDetails.command }}</span>,
				<br>which is used to: "<em class="hl">{{ commandDetails.description }}</em>"
				<br><br>
				{{ kind=='coolDown' ? 'User' : 'Group' }} Cool Downs are:
				<ul>
					<li>How long before the {{ kind=='coolDown' ? 'user' : 'anyone' }} can invoke the command again.</li>
					<li>Low as 0 seconds, allowing for instant re-use of the command.</li>
					<li>Up to 3600 seconds (1 hour) before reuse.</li>
					<li>Whole numbers only (no fractions like 10.75 seconds)</li>
				</ul>
				<br>
				{{ 
					kind=='coolDown' ? 
					'Cool Downs are specific to the user who used the command, and determine how long before that user can use the command again. It will not affect other users usage of the same command.' : 
					'Group Cool Downs are shared by all users, and determine how long before anyone can use the command again. It will affect all users usage of the same command.'
				}}
			</div>

			<!-- the area where we'll have the edit input and provide validation feedback -->
			<div class="editArea" align="center">
				<span v-if="kind=='command'" class="inputPrefix">!</span>
				<span v-if="kind=='cost'" class="inputPrefix">₱</span>
				<span v-if="kind=='coolDown' || kind=='groupCoolDown'" class="inputPrefix">🕒</span>
				<input
					ref="inputRef"
					v-model="editValue"
					:placeholder="`${initialValue}`"
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
	
	// command details
	commandDetails: {
		type: Object,
		default: null
	},

	// the kind of value being edited (i.e. 'command', 'cost', 'coolDown', 'groupCoolDown')
	kind: {
		type: String,
		default: 'command'
	},

	// the initial value that's being edited
	initialValue: {

		// type can be string or number
		type: [String, Number],
		default: ''
	},

	// existing commands that are reserved
	reservedCommands: {
		type: Array,
		default: () => []
	}

});

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

// reference to the input to focus on start
const inputRef = ref(null);

// the value that we'll re-use for various inputs
const editValue = ref(props.initialValue);

// title for the modal
const title = computed(() => {
	return `Edit ${props.kind} for ${props.commandDetails.command}`;
});


// validate the value
const validValue = computed(() => {
	const value = editValue.value;
	
	// validate the value for command types
	if (props.kind === 'command') {
		if (typeof value !== 'string') return 'Command must be a string.';
		if (value.length < 1 || value.length > 32) return 'Command must be between 1 and 32 characters.';
		if (!/^[a-z0-9]+$/.test(value)) return 'Command can only contain lowercase letters (a-z) and numbers (0-9). No spaces or special characters allowed.';
		if (props.reservedCommands.includes(value)) return `The command "${value}" is reserved and cannot be used.`;
		return true;
	}
	
	// validate the value for cost, coolDown, and groupCoolDown types,
	// which are all whole numbers types
	if (props.kind === 'cost' || props.kind === 'coolDown' || props.kind === 'groupCoolDown') {
		const numValue = Number(value);
		if (!Number.isInteger(numValue)) return 'Value must be a whole number (integer).';
		if (props.kind === 'cost' && (numValue < 0 || numValue > 999)) {
			if (numValue < 0) return 'Cost cannot be negative or below 0.';
			if (numValue > 999) return 'Cost cannot exceed 999.';
		}
		if ((props.kind === 'coolDown' || props.kind === 'groupCoolDown') && (numValue < 0 || numValue > 3600)) {
			if (numValue < 0) return 'Cooldown cannot be negative or below 0.';
			if (numValue > 3600) return 'Cooldown cannot exceed 3600 seconds (1 hour).';
		}
		return true;
	}
	
	return 'Invalid kind type specified.';
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

	if (props.kind === 'command') {
		let formatted = editValue.value.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (formatted.length > 32) {
			formatted = formatted.substring(0, 32);
		}
		editValue.value = formatted;
	}

	if (props.kind === 'cost' || props.kind === 'coolDown' || props.kind === 'groupCoolDown') {
		let formatted = editValue.value.toString().replace(/[^0-9.]/g, '');
		let numValue = parseFloat(formatted);
		if (!isNaN(numValue)) {
			editValue.value = Math.round(numValue).toString();
		}
	}
};


// watch the edit value and format it if necessary
watch(editValue, formatValue);

// when the component is mounted we should add an event listener for enter and send whatever the first button is
onMounted(() => {

	// copy the initial value to the edit value
	editValue.value = props.initialValue;

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
