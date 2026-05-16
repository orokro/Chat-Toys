<!--
	ArrayDonationTierEdit.vue
	-------------------------

	Per-row editor for the Donations toy's tier table. Pattern mirrors
	ArrayPrizeItemEdit / ArrayFishEdit (image picker + form fields), with the
	addition of a sound picker and an enable toggle.

	Bits-threshold monotonicity (each row's threshold >= the previous row's)
	is enforced in DonationsPage.vue via a deep watcher on the array, not
	here - this component just edits a single row.
-->
<template>

	<table class="arrayDonoTierEdit">

		<thead>
			<tr>
				<th>Image</th>
				<th>Sound</th>
				<th>Tier</th>
				<th>Label</th>
				<th>Min Bits</th>
				<th>Enabled</th>
			</tr>
		</thead>

		<tbody>
			<tr>
				<td width="120" rowspan="2">
					<FilePreview
						v-if="value.imageId"
						:fileId="value.imageId"
						:assetManager="rowProps.assetManager"
						:height="100"
						:width="100"
						:border="true"
					/>
					<div v-else class="emptySlot">(no image)</div>
				</td>
				<td width="80" rowspan="2">
					<div class="soundIndicator" :class="{ set: !!value.soundId }">
						{{ value.soundId ? '🔊' : '🔈' }}
					</div>
				</td>
				<td>
					<div class="tierBadge" :style="{ background: tierColor }">
						{{ value.tier }}
					</div>
				</td>
				<td>
					<input type="text" v-model="labelInput" @input="validateLabel" />
				</td>
				<td>
					<input
						type="number"
						step="1"
						:min="minBits"
						v-model="bitsInput"
						@input="validateBits"
						@blur="validateBits"
					/>
				</td>
				<td>
					<ToggleCheck :modelValue="value.enabled" @update:modelValue="updateEnabled" />
				</td>
			</tr>
			<tr>
				<td colspan="4">
					<div class="buttonSpread">
						<button @click="handlePickImage">Pick Image</button>
						<button @click="handlePickSound">Pick Sound</button>
						<button v-if="value.imageId" @click="clearImage">Clear Image</button>
						<button v-if="value.soundId" @click="clearSound">Clear Sound</button>
					</div>
				</td>
			</tr>
		</tbody>

	</table>

</template>
<script setup>

// vue
import { ref, watch, computed, markRaw } from 'vue';

// components
import FilePreview from '@components/options/FilePreview.vue';
import AssetPickerModal from '@components/options/AssetPickerModal.vue';
import ToggleCheck from '@components/ToggleCheck.vue';

// lib/misc
import * as yup from 'yup';
import { promptModal } from 'jenesius-vue-modal';


// props
const props = defineProps({

	/** The tier row being edited. Shape: { tier, enabled, label, bitsThreshold, imageId, soundId } */
	value: { type: Object, default: () => ({}) },

	/** Pass-through props from ArrayEdit (assetManager, plus a minBits hint
	 *  for the monotonicity rule - set by DonationsPage to the previous
	 *  row's bitsThreshold so HTML5 number input prevents typing below it). */
	rowProps: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['change']);

// yup schemas
const labelSchema = yup.string().trim().max(40);
const bitsSchema = yup.number().integer().min(0);

// local input state, hydrated from props
const labelInput = ref(props.value.label ?? '');
const bitsInput = ref(props.value.bitsThreshold ?? 0);

watch(() => props.value, (v) => {
	labelInput.value = v.label ?? '';
	bitsInput.value = v.bitsThreshold ?? 0;
});


/** Tier number controls the accent color shown in the badge. */
const TIER_COLORS = ['#888', '#1565C0', '#00E5FF', '#0F9D58', '#FFCA28', '#F57C00', '#E91E63', '#E62117'];
const tierColor = computed(() => TIER_COLORS[props.value.tier] || '#888');


/** Lower-bound bits hint coming from the parent's monotonicity logic. */
const minBits = computed(() => props.rowProps?.minBits ?? 0);


/**
 * Emit the full tier object back to ArrayEdit. We preserve fields we don't
 * directly edit here (imageId, soundId - mutated via the picker handlers).
 */
function emitChange(overrides = {}) {
	emit('change', {
		tier:          props.value.tier,
		enabled:       props.value.enabled,
		label:         labelInput.value,
		bitsThreshold: Math.max(0, Math.floor(Number(bitsInput.value) || 0)),
		imageId:       props.value.imageId || '',
		soundId:       props.value.soundId || '',
		...overrides,
	});
}


/** Label validator - clamps to 40 chars; reverts on schema fail. */
async function validateLabel() {
	try {
		await labelSchema.validate(labelInput.value);
		emitChange();
	} catch (e) {
		labelInput.value = props.value.label ?? '';
	}
}


/** Bits validator - non-negative integer, no upper bound. */
async function validateBits() {
	try {
		await bitsSchema.validate(bitsInput.value);
		emitChange();
	} catch (e) {
		bitsInput.value = props.value.bitsThreshold ?? 0;
	}
}


/** Enabled-toggle write path. */
function updateEnabled(v) {
	emitChange({ enabled: !!v });
}


/** Open the asset picker for the image slot. */
async function handlePickImage() {
	const response = await promptModal(AssetPickerModal, {
		title: `Pick image for Tier ${props.value.tier}`,
		assetManager: markRaw(props.rowProps.assetManager),
		allowCustomImports: true,
		kindFilter: 'image',
	});
	if (response == null || response.index !== 0) return;
	emitChange({ imageId: response.value.id });
}


/** Open the asset picker for the sound slot. */
async function handlePickSound() {
	const response = await promptModal(AssetPickerModal, {
		title: `Pick sound for Tier ${props.value.tier}`,
		assetManager: markRaw(props.rowProps.assetManager),
		allowCustomImports: true,
		kindFilter: 'sound',
	});
	if (response == null || response.index !== 0) return;
	emitChange({ soundId: response.value.id });
}


function clearImage() { emitChange({ imageId: '' }); }
function clearSound() { emitChange({ soundId: '' }); }

</script>
<style lang="scss" scoped>

	.arrayDonoTierEdit {
		width: 100%;
		border-collapse: collapse;

		thead {
			background: #535353;
			color: white;
			font-size: 12px;
			th { border-bottom: 2px solid black; padding: 8px 10px; }
		}

		tbody td {
			border-bottom: 1px solid gray;
			padding: 5px;
			text-align: center;
			vertical-align: middle;
		}

		.tierBadge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			border-radius: 50%;
			color: white;
			font-weight: bold;
			border: 2px solid black;
		}

		.emptySlot {
			color: #666;
			font-size: 0.85em;
			font-style: italic;
		}

		.soundIndicator {
			font-size: 28px;
			color: #888;
			&.set { color: #0F9D58; }
		}

		input[type="text"], input[type="number"] {
			width: 110px;
			border: 1px solid black;
			outline: 1px solid black;
			border-radius: 5px;
			padding: 5px 10px;
			box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
		}

		.buttonSpread {
			display: flex;
			justify-content: center;
			gap: 8px;
			flex-wrap: wrap;

			button {
				background: #EFEFEF;
				border: 2px solid black;
				border-radius: 40px;
				padding: 5px 10px;
				cursor: pointer;
				font-weight: bolder;
				color: black;

				&:hover { background: white; }
			}
		}
	}

</style>
