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
				<!-- Preview Column -->
				<td rowspan="2" class="preview-cell">
					<div class="preview-wrap">
						<FilePreview 
							v-if="hasImageInput"
							:fileId="value.imageId"
							:assetManager="rowProps.assetManager" 
							:height="100"
						/>
					</div>
				</td>

				<!-- Image Row -->
				<td class="cell-check">
					<label>
						<input type="checkbox" v-model="hasImageInput" @change="emitChange" /> Show Media?
					</label>
				</td>
				<td class="cell-action">
					<button 
						@click="handlePickImage"
						:disabled="!hasImageInput"
					>
						Pick Image
					</button>
				</td>
				<td class="cell-slider">
					<div class="slider-box" :class="{ disabled: !hasImageInput }">
						<span class="slider-lbl">Scale:</span>
						<input type="range" v-model.number="scaleInput" min="0" max="2" step="0.1" @input="emitChange" :disabled="!hasImageInput" />
						<span class="val">{{ scaleInput.toFixed(1) }}</span>
					</div>
				</td>
				<td class="cell-duration">
					Duration: 
					<input 
						type="number"
						v-model.number="durationInput"
						@input="validateDuration"
						@blur="fixDurationOnBlur"
						class="input duration-input"
					/> s
				</td>
			</tr>
			<tr>
				<!-- Audio Row -->
				<td class="cell-check">
					<label>
						<input type="checkbox" v-model="hasSoundInput" @change="emitChange" /> Play Sound?
					</label>
				</td>
				<td class="cell-action">
					<button
						@click="handlePickSound"
						:disabled="!hasSoundInput"
					>
						Pick Sound
					</button>
				</td>
				<td class="cell-slider">
					<div class="slider-box" :class="{ disabled: !hasSoundInput }">
						<span class="slider-lbl">Vol:</span>
						<input type="range" v-model.number="volumeInput" min="0" max="1" step="0.01" @input="emitChange" :disabled="!hasSoundInput" />
						<span class="val">{{ Math.round(volumeInput * 100) }}%</span>
					</div>
				</td>
				<td class="cell-preview">
					<div v-if="hasSoundInput && value.soundId" class="sound-preview-area">
						Preview:
						<button
							class="playBtn"
							@click="handlePreviewSound"
							title="Preview Sound"
						>
							▶
						</button>
						<div class="soundName">
							{{ rowProps.assetManager.getFileData(value.soundId)?.name }}
						</div>
					</div>
				</td>
			</tr>
		</tbody>
	</table>

</template>
<script setup>

// vue
import { ref, watch, markRaw } from 'vue';

// components
import FilePreview from '@components/options/FilePreview.vue';
import AssetPickerModal from '@components/options/AssetPickerModal.vue';

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
const volumeInput = ref(props.value.volume !== undefined ? props.value.volume : 1);
const scaleInput = ref(props.value.scale !== undefined ? props.value.scale : 1);

watch(() => props.value, (newValue) => {
	hasImageInput.value = newValue.hasImage;
	hasSoundInput.value = newValue.hasSound;
	durationInput.value = parseInt(newValue.duration, 10);
	volumeInput.value = newValue.volume !== undefined ? newValue.volume : 1;
	scaleInput.value = newValue.scale !== undefined ? newValue.scale : 1;
});


// wrap up the entire object & emit it
const emitChange = () => {
	emit('change', {
		...props.value,
		hasImage: hasImageInput.value,
		hasSound: hasSoundInput.value,
		duration: durationInput.value,
		volume: volumeInput.value,
		scale: scaleInput.value,
	});
};


// validate the duration input box
const durationSchema = yup.number().nullable().min(1).max(300);
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


// handle previewing the sound
const handlePreviewSound = async () => {
	const file = await props.rowProps.assetManager.getFile(props.value.soundId);
	if (file) {
		const url = URL.createObjectURL(file);
		const audio = new Audio(url);
		audio.volume = volumeInput.value;
		audio.play();
		// clean up the URL after playing
		audio.onended = () => URL.revokeObjectURL(url);
	}
};


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

		input[type="checkbox"] {
			position: relative;
			top: 6px;
			width: 25px;
			height: 25px;
			accent-color: black;
		}

		input[type="range"] {
			accent-color: black;
			vertical-align: middle;
			cursor: pointer;
		}

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

		.preview-cell {
			width: 120px;
			background: #444;
			border-right: 2px solid black !important;
			padding: 0 !important;
			
			.preview-wrap {
				display: flex;
				justify-content: center;
				align-items: center;
				height: 100%;
			}
		}

		.cell-check {
			width: 160px;
			text-align: left !important;
			padding-left: 15px !important;
			font-weight: bold;
		}

		.cell-action {
			width: 180px;
		}

		.slider-lbl {
			width: 40px;
			text-align: right;
		}

		.cell-slider {
			width: 200px;
			
			.slider-box {
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 12px;
				font-weight: bold;

				&.disabled {
					opacity: 0.5;
				}

				.val {
					display: inline-block;
					width: 40px;
					text-align: center;
				}
			}
		}

		.cell-duration {
			.duration-input {
				width: 60px !important;
				text-align: center;
			}
		}

		.cell-preview {
			.sound-preview-area {

				padding-left: 42px;
				display: flex;
				align-items: center;
				gap: 10px;
				// font-size: 12px;
				// font-weight: bold;

				.playBtn {
					width: 30px;
					height: 30px;
					padding: 0;
					display: flex;
					justify-content: center;
					align-items: center;
					font-size: 14px;
				}

				.soundName {
					font-size: 10px;
					color: #333;
					max-width: 120px;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
			}
		}
	
	}// .arrayMediaEdit

</style>
