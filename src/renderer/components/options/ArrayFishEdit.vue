<!--
	ArrayFishEdit.vue
	-----------------

	This component is for editing the array of fish objects,
	which are part of the Fishing system / toy.
-->
<template>

	<!-- good 'ol tables, gotta love 'em -->
	<table class="arrayFishEdit">

		<!-- table headers -->
		<thead>
			<tr>
				<th>Fish Image</th>
				<th>Fish Name</th>
				<th>Scale</th>
				<th>Points <span class="tippySpan" v-tippy="pointsTippyText">ℹ️</span></th>
				<th>Rarity <span class="tippySpan" v-tippy="rarityCommandText">ℹ️</span></th>
				<th>&nbsp;</th>
			</tr>
		</thead>

		<!-- table body -->
		<tbody>

			<!-- first row is the previews & text inputs -->
			<tr>
				<td width="150" rowspan="2">
					<FilePreview 
						:fileId="value.image"
						:assetManager="rowProps.assetManager"
						:height="150"
						:width="150"
						:border="true"
					/>
				</td>
				<td>
					<input type="text" v-model="nameInput" @input="validateName" />
				</td>
				<td>
					<input type="number" step="0.1" v-model="scaleInput" @input="validateScale" />
				</td>
				<td>
					<input type="text" v-model="pointsInput" @input="validatePoints" />
				</td>
				<td>
					<input type="text" v-model="rarityInput" @input="validateRarity" />
				</td>
			</tr>

			<!-- second row is the buttons / sliders -->
			<tr>
				<td colspan="1">
					<div class="buttonSpread">
						<button @click="handlePickImage">Pick Image</button>
					</div>
				</td>
				<td>
					<input
						type="range"
						min="0.1"
						max="5"
						step="0.1"
						v-model.number="scaleInput"
						@input="validateScale"
					/>
				</td>
				<td></td>
				<td></td>
			</tr>
		</tbody>
	</table>

</template>
<script setup>

// vue
import { ref, watch, markRaw } from 'vue';
import { directive as VTippy } from 'vue-tippy';
import 'tippy.js/dist/tippy.css';

// components
import FilePreview from './FilePreview.vue';
import AssetPickerModal from './AssetPickerModal.vue';

// lib/misc
import * as yup from 'yup';
import { promptModal } from 'jenesius-vue-modal';

const pointsTippyText = `
	How many channel points should be rewarded for catching this fish?
	You can set this to 0 if you don't want to reward points.
`;
const rarityCommandText = `
	Higher is more common. The calculated percentage will be displayed as you change this value.
`;

// props
const props = defineProps({

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

// if we're using a schema, errors will be stored here
const errorMessage = ref('');

// yup schemas
const scaleSchema = yup.number().min(0.1).max(5);
const numberSchema = yup.number().min(0);
const textSchema = yup.string().trim().required();

// local state for the input values, copied from props
const nameInput = ref(props.value.name);
const scaleInput = ref(props.value.scale);
const pointsInput = ref(props.value.points);
const rarityInput = ref(props.value.rarity);
watch(() => props.value, (newValue) => {
	nameInput.value = newValue.name;
	scaleInput.value = newValue.scale;
	pointsInput.value = newValue.points;
	rarityInput.value = newValue.rarity;
});

// emit the entire object when any of the inputs change
const emitChange = () => {
	emit('change', {
		name: nameInput.value,
		scale: scaleInput.value,
		points: pointsInput.value,
		rarity: rarityInput.value,
		image: props.value.image,
	});
};

const validateName = async () => {
	try {
		await textSchema.validate(nameInput.value);
		emitChange();
	} catch (err) {
		nameInput.value = props.value.name;
	}
};

const validateScale = async () => {
	try {
		await scaleSchema.validate(scaleInput.value);
		emitChange();
	} catch (err) {
		scaleInput.value = props.value.scale;
	}
};

const validatePoints = async () => {
	try {
		await textSchema.validate(pointsInput.value);
		emitChange();
	} catch (err) {
		numberSchema.value = props.value.points;
	}
};

const validateRarity = async () => {
	try {
		await numberSchema.validate(rarityInput.value);
		emitChange();
	} catch (err) {
		rarityInput.value = props.value.rarity;
	}
};


// handle when the user clicks the pick image button
const handlePickImage = async () => {

	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(AssetPickerModal, {
		title: 'Pick an Image for this fish',
		assetManager: markRaw(props.rowProps.assetManager),
		allowCustomImports: true,
		kindFilter: 'image',
	});

	// if the response was null or not the 'yes' button, return
	if(response==null)
		return;
	if(response.index!==0)
		return;

	// set the model id
	props.value.image = response.value.id;
	emitChange();
};


</script>
<style lang="scss" scoped>

	// .arrayTosserItem
	.arrayFishEdit {

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
			width: 150px;
			
				
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

	}// .arrayFishEdit

</style>
