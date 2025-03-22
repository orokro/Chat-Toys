<!--
	ArrayMediaEdit.vue
	------------------

	We will create a new component called ArrayMediaEdit.vue.
	This component will be used to edit an array of media objects.
	
	This is to be used in conjunction with the ArrayEdit component.
-->
<template>

	<table class="arrayMediaEdit">
		<thead>
			<tr>
				<th colspan="5">Media for command <span class="cmd">!{{ value.commandName }}</span></th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>
					<input type="checkbox" v-model="hasImageInput" @change="emitChange" /> Show Media?
				</td>
				<td rowspan="2">
					<FilePreview 
						v-if="hasImageInput"
						:fileId="value.imageId"
						:assetManager="rowProps.assetManager" 
						:height="100"
					/>
				</td>
				<td>
					<input type="checkbox" v-model="hasSoundInput" @change="emitChange" /> Play Sound?
				</td>
				<td rowspan="2" width="300">
					{{ rowProps.assetManager.getFileData(value.soundId)?.name }}
					<FilePreview 
						v-if="hasSoundInput"
						:fileId="value.soundId"
						:assetManager="rowProps.assetManager"
						:width="300"
						:border="false"
					/>
				</td>
				<td>
					Duration (s):
				</td>
			</tr>
			<tr class="compact-row">
				<td>
					<button 
						@click="handlePickImage"
						:disabled="!hasImageInput"
					>
						Pick Image
					</button>
				</td>
				<td>
					<button
						@click="handlePickSound"
						:disabled="!hasSoundInput"
					>
						Pick Sound
					</button>
				</td>
				<td>
					<input 
						type="number"
						v-model.number="durationInput"
						@input="validateDuration"
						@blur="fixDurationOnBlur"
						class="input"
					/>
				</td>
			</tr>
		</tbody>
	</table>

</template>
<script setup>

// vue
import { ref, watch, markRaw } from 'vue';

// components
import FilePreview from './FilePreview.vue';
import AssetPickerModal from './AssetPickerModal.vue';

// lib/misc
import * as yup from 'yup';
import { promptModal } from 'jenesius-vue-modal';

// props
const props = defineProps({

	// the media object
	value: {
		type: Object,
		required: true,
	},

	// optional schema for validation
	rowProps: {
		type: Object,
		default: () => ({})
	},
});

// events
const emit = defineEmits(['change']);

// handle state locally
const hasImageInput = ref(props.value.hasImage);
const hasSoundInput = ref(props.value.hasSound);
const durationInput = ref(parseInt(props.value.duration, 10));
watch(() => props.value, (newValue) => {
	hasImageInput.value = newValue.hasImage;
	hasSoundInput.value = newValue.hasSound;
	durationInput.value = parseInt(newValue.duration, 10);
});


// wrap up the entire object & emit it
const emitChange = () => {
	emit('change', {
		commandSlug: props.value.commandSlug,
		commandName: props.value.commandName,
		hasImage: hasImageInput.value,
		imageId: props.value.imageId,
		hasSound: hasSoundInput.value,
		soundId: props.value.soundId,
		duration: durationInput.value,
	});
};


// validate the duration input box
const durationSchema = yup.number().nullable().min(5).max(300);
const validateDuration = async () => {
	try {
		await durationSchema.validate(durationInput.value);
		emitChange();
	} catch (err) {

		if(durationInput.value=='')
			return;
	}
};


// fix the duration on blur (if necessary)
const fixDurationOnBlur = async ()=>{
	
	try {
		await durationSchema.validate(durationInput.value);
		emitChange();
	} catch (err) {
		durationInput.value = props.value.duration;
	}
}


// handle picking an image
const handlePickImage = async () => {
	
	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(AssetPickerModal, {
		title: 'Pick an Image File to display',
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
	props.value.imageId = response.value.id;
	emitChange();
};


// handle picking a sound
const handlePickSound = async () => {
	
	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(AssetPickerModal, {
		title: 'Pick a Sound Effect to play',
		assetManager: markRaw(props.rowProps.assetManager),
		allowCustomImports: true,
		kindFilter: 'sound',
	});

	// if the response was null or not the 'yes' button, return
	if(response==null)
		return;
	if(response.index!==0)
		return;

	// set the sound id
	props.value.soundId = response.value.id;
	emitChange();
};

</script>
<style lang="scss" scoped>

	// main table
	.arrayMediaEdit {
		width: 100%;
		border-collapse: collapse;

		thead th {

			background-color: #535353;
			color: white;
			font-size: 14px;

			text-align: left;
			border-bottom: 2px solid black;
			padding: 8px 15px;;
		}

		tbody td {
			border-bottom: 1px solid gray;
			padding: 10px;
			text-align: center;
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
		}// input[type="text"], input[type="number"]

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

			&:disabled {
				background: #ccc;
				color: #666;
				border: 2px solid #999;
				cursor: not-allowed;
			}

		}// button
	
	}// .arrayMediaEdit

</style>
