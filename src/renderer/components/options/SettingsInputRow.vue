<!-- 
 	SettingsInputRow.vue
	--------------------

	This file provides a reusable row we can use for input fields in the settings page.

	This primarily coverts text-based inputs for now, but can be expanded to include other types.
-->
<template>

	<div class="settings-row">

		<div class="topRow">

			<div class="left">
				<h3><slot name="title"></slot></h3>
			</div>
			<div class="right">

				<!-- Input Field -->
				<input 
					v-if="type !== 'boolean' && type !== 'options' && type !== 'radio'"
					:type="type === 'color' ? 'text' : (type==='float' ? 'number' : type)"
					:step="step"
					v-model="internalValue" @blur="handleBlur"
					class="settings-input"
					:style="{ width: inputWidth }"
				/>

				<!-- Range slider if min and max are set -->
                <input
                    v-if="(type === 'number' || type === 'float') && min !== undefined && max !== undefined"
                    type="range"
                    :min="min"
                    :max="max"
                    :step="step || 1"
                    v-model="internalValue"
                    class="settings-slider"
                />

				<!-- if color mode, also show color input -->
				<div v-if="type === 'color'" class="colorWrapper">
					<input 
						type="color"
						v-model="internalValue" @blur="handleBlur"
						class="settings-input"
					/>
				</div>

				<template v-else-if="type === 'boolean'">
					<div align="right">
						<!-- disabled classic checkbox while testing out new custom toggle -->
						<!-- <input type="checkbox" v-model="setting"> -->
						<ToggleCheck v-model="setting" />
					</div>
				</template>
				
				<template v-else-if="type === 'options'">
					<select v-model="setting">
						<option v-for="option in options" :key="option.value" :value="option.value">
							{{ option.name }}
						</option>
					</select>
				</template>

				<template v-else-if="type === 'radio'">
					<div v-for="option in options" :key="option.value">
						<label>
							<input type="radio" v-model="setting" :value="option.value">
							{{ option.name }}
						</label>
					</div>
				</template>

				<!-- Error Message -->
				<div v-if="errorMessage" class="error-message">
					{{ errorMessage }}
				</div>
			</div>

		</div>
		<div class="bottomRow">
			
			<!-- Description -->
			<div v-if="desc" class="desc">{{ desc }}</div>
			<slot v-else></slot>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, watch, shallowRef } from 'vue';
import * as yup from 'yup';

// components
import ToggleCheck from '@components/ToggleCheck.vue';

// Define Props
const props = defineProps({
	desc: { type:String, default: null },

	// 'number', 'string', 'color', 'boolean', 'options', 'radio'
	type: { type: String, required: true }, 
	options: { type: Array, required: false },
	min: { type: Number, required: false },
	max: { type: Number, required: false },
	step: { type: Number, required: false, default: 1 },
	schema: { type: Object, required: false }, // Optional Yup schema
	inputWidth: { type: String, default: '150px' },
});

// v-model binding (expects a ref/shallowRef)
const setting = defineModel();

// Define Emits
const emit = defineEmits(['update', 'error']);

// Local state
// Editable input
const internalValue = ref(setting.value); 
const errorMessage = ref('');

// watch our model (setting) and copy the value to our internal value,
// but only if the input box is not currently focused
watch(setting, (value) => {
	internalValue.value = value;
});

// Generate internal Yup schema based on type & min/max constraints
const getSchema = () => {
	let baseSchema;

	if (props.type === 'number') {
		baseSchema = yup
			.number()
			.typeError('Must be a valid number')
			.integer('Must be an integer')
			.min(props.min ?? -Infinity, `Must be at least ${props.min}`)
			.max(props.max ?? Infinity, `Must be at most ${props.max}`)
			.required('This field is required');
	
	} else if (props.type === 'float') {
		baseSchema = yup
			.number()
			.typeError('Must be a valid number')
			.min(props.min ?? -Infinity, `Must be at least ${props.min}`)
			.max(props.max ?? Infinity, `Must be at most ${props.max}`)
			.required('This field is required');

	} else if (props.type === 'string') {
		baseSchema = yup
			.string()
			.min(props.min ?? 0, `Must be at least ${props.min} characters`)
			.max(props.max ?? Infinity, `Must be at most ${props.max} characters`)
			.required('This field is required');
	} else {
		baseSchema = yup.string().required('This field is required'); // 'color' case, but open-ended
	}

	return props.schema ? props.schema.concat(baseSchema) : baseSchema;
};

// Validate Input
const validate = async () => {

	try {
		await getSchema().validate(internalValue.value);
		errorMessage.value = '';
		setting.value = internalValue.value;
		emit('update', internalValue.value);

	} catch (error) {

		errorMessage.value = error.message;
		emit('error', error.message);
	}
};


// Handle Blur: Revert to last valid value if invalid
const handleBlur = () => {
	if (errorMessage.value) {
		internalValue.value = setting.value;
	}
};

// Watch for changes and validate live
watch(internalValue, validate);

</script>
<style lang="scss" scoped>

	.topRow {

		margin-top: 5px;
		h3 {
			/* border: 1px solid red; */
			/* border-bottom: 2px solid black; */
			text-decoration: none !important
		}
		border-bottom: 5px solid rgba(0, 0, 0, 0.03);
		padding-bottom: 5px;;

		.left {
			float: left;

		}

		.right {
			float: right;
			min-width: 500px;
			
			/* border: 1px solid red; */
		}

	}// .topRow

	.bottomRow {
		margin-bottom: 5px;
	}

	// main container
	.settings-row {
		
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 10px 0px;

		max-width: 1200px;

		:deep(h3) {
			margin-bottom: 0px;
			/* text-decoration: underline; */
		}
		:deep(p) {
			margin-top: 0px;
			margin-bottom: 0px;
		}

		.desc {
			font-weight: bold;
		}

		.settings-input {
			padding: 5px;
			border: 1px solid #ccc;
			border-radius: 4px;
			width: 100%;
			/* max-width: 150px; */
		}

		.settings-slider {

			position: relative;
			top: 10px;
			margin-right: 10px;
			accent-color: black;
		}

		input {
			float: right;
		}

		select {
			width: 100%;
			max-width: 300px;
		}

		input[type="text"],
		input[type="number"] {

			padding: 8px 12px;
			border: 2px solid black;
			box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.5);
			float: right;
		}

		input[type="checkbox"] {
			width: 25px;
			height: 25px;
			accent-color: black;
		}

		.error-message {
			color: red;
			font-size: 0.85em;
		}

		.colorWrapper {

			float: right;
			width: 35px;
			height: 35px;

			border: 3px solid black;
			border-radius: 40px;
			overflow: hidden;
			position: relative;

			margin-right: 5px;
			
			input[type="color"] {
				position: absolute;
				top: -20px;
				left: -10px;
				width: 400px !important;
				max-width: 400px !important;
				height: 60px;
			}
		}

	}// .settings-row

</style>
