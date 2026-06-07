<!--
	SettingsBackgroundRow.vue
	-------------------------

	A reusable settings block for a "background image" that can be off, 9-sliced,
	or tiled. Composes the existing settings rows + the NineSliceEditorModal so
	any toy can offer a bring-your-own-asset framed/tiled background with a few
	setting keys:

		mode  -> 'none' | 'sliced' | 'tiled'   (modeKey)
		asset -> asset id                       (assetKey)
		scale -> tile size px (tiled only)      (scaleKey)
		slice -> frame config (sliced only)     (sliceKey, see nineSlice.js)

	The "Edit Slicing…" button (and thus the modal) is only available once an
	asset is chosen and the mode is 'sliced'.
-->
<template>

	<SettingsInputRow type="options" :options="modeOptions" v-model="modeModel">
		<template #title>{{ label }}</template>
		<p v-if="desc">{{ desc }}</p>
		<p v-else>Choose how the {{ label.toLowerCase() }} image is applied.</p>
	</SettingsInputRow>

	<template v-if="modeModel !== 'none'">

		<SettingsAssetRow v-model="assetModel" :kind-filter="kindFilter">
			<h3>Image</h3>
			<p>Pick the image to use for the {{ label.toLowerCase() }}.</p>
		</SettingsAssetRow>

		<SettingsInputRow
			v-if="modeModel === 'tiled'"
			type="number"
			:min="8"
			:max="512"
			:step="1"
			v-model="scaleModel"
		>
			<template #title>Tile Size (px)</template>
			<p>How large each repeated tile renders.</p>
		</SettingsInputRow>

		<SettingsRow v-if="modeModel === 'sliced'">
			<h3>9-Slice</h3>
			<p>Drag slice guides and set frame width, padding and margin.</p>
			<button class="sliceBtn" :disabled="!assetModel" @click="editSlicing">
				{{ assetModel ? 'Edit Slicing…' : 'Pick an image first' }}
			</button>
		</SettingsRow>

	</template>

</template>
<script setup>

// vue
import { inject } from 'vue';

// lib misc
import { promptModal } from 'jenesius-vue-modal';

// components
import SettingsInputRow from './SettingsInputRow.vue';
import SettingsAssetRow from './SettingsAssetRow.vue';
import SettingsRow from './SettingsRow.vue';
import NineSliceEditorModal from './NineSliceEditorModal.vue';

// shared frame helpers
import { defaultSliceConfig } from './nineSlice';

// props: the toy + which setting keys we drive
const props = defineProps({
	toy: { type: Object, required: true },
	modeKey: { type: String, required: true },
	assetKey: { type: String, required: true },
	scaleKey: { type: String, required: true },
	sliceKey: { type: String, required: true },
	label: { type: String, default: 'Background' },
	desc: { type: String, default: '' },
	kindFilter: { type: String, default: 'image' },
});

// app state (for asset URL resolution)
const ctApp = inject('ctApp');

// resolve the toy's setting refs once (keys are static); template auto-unwraps
const modeModel = props.toy.settings[props.modeKey];
const assetModel = props.toy.settings[props.assetKey];
const scaleModel = props.toy.settings[props.scaleKey];
const sliceModel = props.toy.settings[props.sliceKey];

// the three background modes
const modeOptions = [
	{ value: 'none', name: 'None' },
	{ value: 'sliced', name: 'Sliced (9-slice frame)' },
	{ value: 'tiled', name: 'Tiled' },
];


/**
 * Resolve the picked asset to a temporary object URL and open the 9-slice
 * editor. On Save, write the returned frame config back to the slice setting.
 */
async function editSlicing() {

	const assetId = assetModel.value;
	if (!assetId) return;

	// pull a File for the asset and make a temporary URL for the editor
	const file = await ctApp.assetsMgr.getFile(assetId);
	if (!file) return;
	const url = URL.createObjectURL(file);

	// seed the editor with the current config (or defaults)
	const current = (sliceModel.value && Object.keys(sliceModel.value).length)
		? JSON.parse(JSON.stringify(sliceModel.value))
		: defaultSliceConfig();

	const res = await promptModal(NineSliceEditorModal, {
		title: `Edit Slicing — ${props.label}`,
		imageUrl: url,
		config: current,
	});

	URL.revokeObjectURL(url);

	if (res && res.index === 0)
		sliceModel.value = res.value;
}

</script>
<style lang="scss" scoped>

	.sliceBtn {
		padding: 7px 18px;
		border: 2px solid black;
		border-radius: 999px;
		background: #00ABAE;
		color: #fff;
		font-weight: bold;
		cursor: pointer;

		&:disabled {
			background: #ccc;
			color: #666;
			cursor: default;
		}
	}

</style>
