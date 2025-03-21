<!--
	ArrayTosserEdit.vue
	-------------------

	This file is to be used in conjunction with the ArrayEdit component.

	This lets us edit the array of tossable objects in the Tosser system.
-->
<template>

	<!-- good 'ol tables, gotta love 'em -->
	<table class="arrayTosserEdit">

		<!-- table headers -->
		<thead>
			<tr>
				<th>Model</th>
				<th>Sound</th>
				<th>Scale</th>
				<th>Slug <span class="tippySpan" v-tippy="slugTippyText">ℹ️</span></th>
				<th>Command <span class="tippySpan" v-tippy="slugCommandText">ℹ️</span></th>
				<th>&nbsp;</th>
			</tr>
		</thead>

		<!-- table body -->
		<tbody>

			<!-- first row is the previews & text inputs -->
			<tr>
				<td width="150" rowspan="2">
					<FilePreview 
						:fileId="value.model"
						:assetManager="rowProps.assetManager"
						:height="150"
						:width="150"
						:border="true"
					/>
				</td>
				<td width="350">
					<FilePreview 
						:fileId="value.sound"
						:assetManager="rowProps.assetManager"
						:border="false"
					/>
				</td>
				<td>
					<input type="number" step="0.1" v-model="scaleInput" @input="validateScale" />
				</td>
				<td>
					<input type="text" v-model="slugInput" @input="validateSlug" />
				</td>
				<td>
					<input type="text" v-model="cmdInput" @input="validateCmd" />
				</td>
			</tr>

			<!-- second row is the buttons / sliders -->
			<tr>
				<td colspan="1">
					<div class="buttonSpread">
						<button @click="handlePickModel">Pick Model</button>
						<button @click="handlePickSound">Pick Sound</button>
					</div>
				</td>
				<td>
					<input type="range" min="0.1" max="5" step="0.1" v-model.number="scaleInput" @input="validateScale" />
				</td>
				<td></td>
				<td></td>
			</tr>
		</tbody>
	</table>

</template>
<script setup>

// vue
import { ref, watch } from 'vue';
import { directive as VTippy } from 'vue-tippy';
import 'tippy.js/dist/tippy.css';

// components
import FilePreview from './FilePreview.vue';

// lib/misc
import * as yup from 'yup';

const slugTippyText = `
	Slug is the "item" in "!toss <item>".
	Leave black to explicitly disable the tossing this item by name.
`;
const slugCommandText = `
	If you added a custom command above in the Command Triggers section, name it here.
	This will allow users to toss this item by typing the command in chat.
	Technically you could bind this to a completely unrelated command as well, like "!bet".
`;

// props
const props = defineProps({

	// the asset manager so we can render previews
	assetManager: Object,

	// the color value to edit
	value: {
		type: Object,
		default: '',
	},

	// optional schema for validation
	rowProps: {
		type: Object,
		default: () => ({})
	},
});

// emits / events
const emit = defineEmits(['change']);

// local state for the input value
const inputValue = ref(props.value);

// if we're using a schema, errors will be stored here
const errorMessage = ref('');

// yup schemas
const scaleSchema = yup.number().min(0.1).max(5);
const textSchema = yup.string().matches(/^[a-z0-9]*$/, 'Invalid characters');

// local state for the input values, copied from props
const scaleInput = ref(props.value.scale);
const slugInput = ref(props.value.slug);
const cmdInput = ref(props.value.cmd);
watch(() => props.value, (newValue) => {
	scaleInput.value = newValue.scale;
	slugInput.value = newValue.slug;
	cmdInput.value = newValue.cmd;
});

// emit the entire object when any of the inputs change
const emitChange = () => {
	emit('change', {
		model: props.value.model,
		sound: props.value.sound,
		scale: scaleInput.value,
		slug: slugInput.value,
		cmd: cmdInput.value,
	});
};

const validateScale = async () => {
	try {
		await scaleSchema.validate(scaleInput.value);
		emitChange();
	} catch (err) {
		scaleInput.value = props.value.scale;
	}
};

const validateSlug = async () => {
	try {
		await textSchema.validate(slugInput.value);
		emitChange();
	} catch (err) {
		slugInput.value = props.value.slug;
	}
};

const validateCmd = async () => {
	try {
		await textSchema.validate(cmdInput.value);
		emitChange();
	} catch (err) {
		cmdInput.value = props.value.cmd;
	}
};


// watch the value prop and update the local state
watch(() => props.value, (newValue) => {
	inputValue.value = newValue;
});

const handlePickModel = () => {
	console.log('Picking model...');
};

const handlePickSound = () => {
	console.log('Picking sound...');
};


</script>
<style lang="scss" scoped>


	// .arrayTosserItem
	.arrayTosserEdit {

		width: 100%;
		border-collapse: collapse;

		
		thead {
			background-color: #535353;
			color: white;
			font-size: 12px;

			th {
				border-bottom: 2px solid black;
				padding: 8px 10px;
			}
		}

		 
		tbody {

			td {
				border-bottom: 1px solid gray;
				padding: 5px;
				text-align: center;		
			}

			.compact-row td {
				padding: 0px;
				font-size: 0.9em;
			}

		}// tbody

		.tippySpan {
			cursor: help;
			margin-left: 5px;

			display: inline-block;
			scale: 1.8;
		}

		// the text inputs
		input[type="text"], input[type="number"] {
			
			// fixed size
			width: 100px;
			
				
			// thick box w/ nice inner shadow
			border: 1px solid black;
			outline: 1px solid black;
			border-radius: 5px;
			padding: 5px 10px;
			box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);

			// error
			&.error {
				border-color: rgb(255, 8, 8);
				outline: 1px solid rgb(255, 8, 8);
			}
		}

		// the slider
		input[type="range"] {
			accent-color: black;
		}

		// the buttons
		.buttonSpread {

			display: flex;
			justify-content: space-around;
			
			// make the add button look nice
			button {

				// box styles
				background: #EFEFEF;
				border: none;
				border-radius: 40px;
				padding: 5px 10px;
				cursor: pointer;
				border: 2px solid black;

				// text settings
				color: black;
				font-weight: bolder;

				&:hover {
					background: white;
					border: 2px solid rgba(255, 255, 255, 1);

				}
			}// button
		}// .buttonSpread


	}// .arrayTosserEdit

</style>
