<!--
	ArrayPrizeItemEdit.vue
	----------------------

	Per-row editor used by ArrayEdit to manage entries in the ClawGame prize
	list. Each prize is { name, image (asset id), scale }.

	Mirrors the structure of ArrayFishEdit.vue (Fishing toy) but trimmed down
	to just the fields the claw game needs - no rarity / points, since prizes
	are sampled uniformly and have no point value.
-->
<template>

	<table class="arrayPrizeItemEdit">

		<thead>
			<tr>
				<th>Prize Image</th>
				<th>Name</th>
				<th>Scale <span class="tippySpan" v-tippy="scaleTippyText">ℹ️</span></th>
			</tr>
		</thead>

		<tbody>
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
			</tr>

			<tr>
				<td>
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
import FilePreview from '@components/options/FilePreview.vue';
import AssetPickerModal from '@components/options/AssetPickerModal.vue';

// lib/misc
import * as yup from 'yup';
import { promptModal } from 'jenesius-vue-modal';

const scaleTippyText = `
	How large this prize is in the machine, relative to the default size.
	1.0 is the baseline. Larger prizes are easier to push around and harder
	to fit through the chute.
`;

const props = defineProps({

	/** The prize object being edited: { name, image, scale } */
	value: {
		type: Object,
		default: () => ({}),
	},

	/** Pass-through props from the parent ArrayEdit (e.g., assetManager). */
	rowProps: {
		type: Object,
		default: () => ({}),
	},
});

const emit = defineEmits(['change']);

// yup schemas
const scaleSchema = yup.number().min(0.1).max(5);
const textSchema = yup.string().trim().required();

// local state, copied from props
const nameInput = ref(props.value.name);
const scaleInput = ref(props.value.scale);

watch(() => props.value, (newValue) => {
	nameInput.value = newValue.name;
	scaleInput.value = newValue.scale;
});


/**
 * Emit the full prize object back to the parent ArrayEdit, preserving
 * fields we don't directly edit (like image id, which is mutated by
 * handlePickImage).
 */
const emitChange = () => {
	emit('change', {
		name: nameInput.value,
		scale: scaleInput.value,
		image: props.value.image,
	});
};


/** Validate name; revert to last good value on failure. */
const validateName = async () => {
	try {
		await textSchema.validate(nameInput.value);
		emitChange();
	} catch (err) {
		nameInput.value = props.value.name;
	}
};


/** Validate scale; revert to last good value on failure. */
const validateScale = async () => {
	try {
		await scaleSchema.validate(scaleInput.value);
		emitChange();
	} catch (err) {
		scaleInput.value = props.value.scale;
	}
};


/**
 * Open the asset picker so the streamer can pick a different prize image.
 */
const handlePickImage = async () => {

	const response = await promptModal(AssetPickerModal, {
		title: 'Pick an image for this prize',
		assetManager: markRaw(props.rowProps.assetManager),
		allowCustomImports: true,
		kindFilter: 'image',
	});

	if (response == null) return;
	if (response.index !== 0) return;

	props.value.image = response.value.id;
	emitChange();
};

</script>
<style lang="scss" scoped>

	.arrayPrizeItemEdit {

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
		}

		.tippySpan {
			cursor: help;
			margin-left: 5px;
			display: inline-block;
			scale: 1.8;
		}

		input[type="text"], input[type="number"] {

			width: 150px;

			border: 1px solid black;
			outline: 1px solid black;
			border-radius: 5px;
			padding: 5px 10px;
			box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);

			&.error {
				border-color: rgb(255, 8, 8);
				outline: 1px solid rgb(255, 8, 8);
			}
		}

		input[type="range"] {
			accent-color: black;
		}

		.buttonSpread {
			display: flex;
			justify-content: space-around;

			button {
				background: #EFEFEF;
				border: none;
				border-radius: 40px;
				padding: 5px 10px;
				cursor: pointer;
				border: 2px solid black;

				color: black;
				font-weight: bolder;

				&:hover {
					background: white;
					border: 2px solid rgba(255, 255, 255, 1);
				}
			}
		}
	}

</style>
