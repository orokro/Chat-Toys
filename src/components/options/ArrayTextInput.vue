<!--
	ArrayTextInput.vue
	------------------

	This is a component to be used in conjunction with the ArrayEdit component.

	Basically, it's a text input that will be used to edit the items in the array.
-->
<template>

	<div class="arrayTextInput relative">

		<input
			type="text"
			v-model="inputValue"
			@input="validate"
			@blur="clearErrorOnBlur"
			:class="{'error': errorMessage}"
			class="input"
		/>
		<span 
			v-if="errorMessage"
			class="error-icon material-icons"
			v-tippy="{ content: errorMessage }"
		>
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

	// the value to edit
	value: {
		type: null,
		default: null,
	},

	// optional schema for validation
	schema: {
		type: Object,
		default: null,
	},
});

// emits / events
const emit = defineEmits(['change']);

// temp local state for the inputs value
const inputValue = ref(props.value);

// if we're using a schema, errors will be stored here
const errorMessage = ref('');

// watch the value prop and update the local state
watch(
	() => props.value,
	(newValue) => {
		inputValue.value = newValue;
	}
);

// validate on input
const validate = async () => {

	// run schema if we have one
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

// reset our input and any error when we lose focus
const clearErrorOnBlur = () => {
	errorMessage.value = '';
	inputValue.value = props.value;
};

</script>
<style lang="scss" scoped>

	// main outer wrapper
	.arrayTextInput {

		// reset stacking context
		position: relative;

		// fixed size box
		width: 500px;
		height: 40px;
		
		padding: 6px 10px;

		// actual input box
		input {
			border: 1px solid black;
			outline: 1px solid black;
			border-radius: 5px;
			padding: 5px 10px;
			width: 500px;

			// inset shadow
			box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);

			// error
			&.error {
				border-color: rgb(255, 8, 8);
				outline: 1px solid rgb(255, 8, 8);
			}
		}// error

		.material-icons {

			position: absolute;
			top: 8px;
			left: 515px;

			font-size: 22px;
			color: rgb(255, 8, 8);
			
			// use filter to make black outline
			filter: drop-shadow(1px 1px 1px black);
		}

	}// .arrayTextInput
	

</style>
