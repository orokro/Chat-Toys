<!--
	ArrayColorInput.vue
	-------------------

	This file is to be used in conjunction with the ArrayEdit component.

	This lets us edit an array of color values.
-->
<template>

	<!-- main outer wrapper -->
	<div class="arrayColorInput relative">

		<!-- text box version of the color value -->
		<input
			type="text"
			v-model="inputValue"
			@input="validate"
			@blur="clearErrorOnBlur"
			:class="{'error': errorMessage}"
			class="input"
		/>

		<!-- color picker version matching the same thing -->
		<div class="colorPickerWrapper">
			<input
				type="color"
				v-model="inputValue"
				@input="validate"
				class="color-picker"
			/>
		</div>
		<span 
			v-if="errorMessage"
			class="error-icon material-icons"
			v-tippy="{ content: errorMessage }">
			error
		</span>
	</div>
</template>
<script setup>

// vue
import { defineProps, defineEmits, ref, watch } from 'vue';
import { directive as VTippy } from 'vue-tippy';
import 'tippy.js/dist/tippy.css';

// lib/misc
import * as yup from 'yup';

// props
const props = defineProps({

	// the color value to edit
	value: {
		type: String,
		default: '',
	},

	// optional schema for validation
	schema: {
		type: Object,
		default: null,
	},
});

// emits / events
const emit = defineEmits(['change']);

// local state for the input value
const inputValue = ref(props.value);

// if we're using a schema, errors will be stored here
const errorMessage = ref('');

// watch the value prop and update the local state
watch(() => props.value, (newValue) => {
	inputValue.value = newValue;
});

// validate the input value
const validate = async () => {

	// if we have a schema, validate the input
	if (props.schema) {
		try {
			await props.schema.validate(inputValue.value);
			errorMessage.value = '';
			emit('change', inputValue.value);
		} catch (err) {
			errorMessage.value = err.message;
		}
	} else {
		emit('change', inputValue.value);
	}
};

// clear the error message on blur
const clearErrorOnBlur = () => {
	errorMessage.value = '';
	inputValue.value = props.value;
};

</script>
<style lang="scss" scoped>

	// main outer wrapper
	.arrayColorInput {

		// reset stacking context
		position: relative;

		// fixed size box
		/* width: 500px; */
		height: 40px;
		
		padding: 6px 10px;

		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 400px;


		// actual input box
		input.input {

			flex-shrink: none;
			flex-grow: none;

			border: 1px solid black;
			outline: 1px solid black;
			border-radius: 5px;
			padding: 5px 10px;
			width: 100px;
			box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);

			&.error {
				border-color: rgb(255, 8, 8);
				outline: 1px solid rgb(255, 8, 8);
			}

		}// input.input
		
		// color picker
		.colorPickerWrapper {

			// reset stacking context
			position: relative;

			// fixed size box with nice round border
			width: 50px;
			height: 30px;
			border: 2px solid black;
			border-radius: 10px;;
			overflow: hidden;

			input.color-picker {
				
				position: absolute;
				inset: -10px;
				width: 100px;
				height: 40px;
				border: none;
				cursor: pointer;

			}// input.color-picker


		}// .colorPickedWrapper

		// error icon		
		.material-icons {

			position: absolute;
			top: 8px;
			left: 175px;

			font-size: 22px;
			color: rgb(255, 8, 8);
			
			// use filter to make black outline
			filter: drop-shadow(1px 1px 1px black);

		}// .material-icons

	}// .arrayColorInput
	
</style>
