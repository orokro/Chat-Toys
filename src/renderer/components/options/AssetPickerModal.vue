<!--
	AssetPickerModal.vue
	--------------------

	Modal-flavored host for the asset picker. Wraps the shared
	AssetBrowser component (vuefinder + preview sidebar) inside a
	responsive jenesius-vue-modal frame, plus the picker-specific Save /
	Cancel buttons along the bottom.

	Save resolves to the focused asset's full data record (looked up
	via the AssetManager so SettingsAssetRow keeps receiving the same
	shape it always has: `{ id, name, kind, ... }`).

	The `kindFilter` prop is honored by the AssetBrowser when displaying
	the file list - non-matching files are visually hidden but folders
	are always visible so the user can still navigate.
-->
<template>

	<ModalWindowFrame
		:title="title"
		:height="modalHeight"
		:width="modalWidth"
	>

		<div class="modalContent">

			<!-- the shared file browser fills the body above the buttons -->
			<div class="browserHost">
				<AssetBrowser
					ref="browserRef"
					finder-id="assetPicker"
					:kindFilter="kindFilter"
					:singleSelect="true"
					@select="onSelect"
					@navigate-to-toy="onNavigateToToy"
				/>
			</div>

			<!-- save / cancel along the bottom -->
			<div class="buttons" tabindex="0">
				<button
					class="primary"
					:disabled="!focusedAssetRef"
					@click="buttonClicked('save', 0)"
				>
					Save
				</button>
				<button @click="closeModal">
					Cancel
				</button>
			</div>

		</div>

	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';

// components
import ModalWindowFrame from './ModalWindowFrame.vue';
import AssetBrowser from './AssetBrowser.vue';

// lib misc
import { closeModal, Modal } from 'jenesius-vue-modal';


// props
const props = defineProps({

	// title of the modal
	title: {
		type: String,
		default: 'Asset Picker'
	},

	// reference to the asset manager (kept for backward compat with
	// existing callers — we read ctApp.assetsMgr internally now).
	assetManager: {
		type: Object,
		default: null
	},

	// kept for compat - the new browser supports drag-drop upload natively
	// (no separate "import custom assets" affordance needed). The prop is
	// still accepted but ignored.
	allowCustomImports: {
		type: Boolean,
		default: false
	},

	// filter for kind (either 'image', 'sound', or '3d')
	kindFilter: {
		type: String,
		default: null
	},

});


// jenesius-vue-modal: emit Modal.EVENT_PROMPT to close with a value
const emit = defineEmits([Modal.EVENT_PROMPT]);


// main app state - needed to translate the focused vuefinder row's
// asset_ref back into the asset record shape the caller expects.
const ctApp = inject('ctApp');


// the AssetBrowser instance, so we can read its focused-file getter
// at Save time if needed.
const browserRef = ref(null);


// the asset_ref of the currently-focused single file; null when nothing
// or a folder is selected. Bound to the Save button's disabled state.
const focusedAssetRef = ref(null);


// modal sizing - responsive within sane caps. The ModalWindowFrame
// component now accepts CSS strings; this works in both dev (wide
// screens) and packaged builds (which may be more constrained).
const modalWidth = 'min(95vw, 1400px)';
const modalHeight = 'min(90vh, 900px)';


/**
 * Receives the AssetBrowser's `select` event. Stores the asset_ref so
 * Save can hand back the right thing.
 *
 * @param {{ row: Object, assetRef: string }|null} payload
 */
function onSelect(payload) {
	focusedAssetRef.value = payload?.assetRef || null;
}


/**
 * The AssetBrowser already updated ChatToysApp's `selectedToy` and
 * `activeTab` to land the user on the right toy's page. All we have
 * to do here is close the picker so the user actually sees the
 * destination.
 */
function onNavigateToToy() {
	closeModal();
}


/**
 * Bottom-bar button click. Save resolves to the asset's full record
 * (same shape the legacy picker returned, so SettingsAssetRow doesn't
 * need to change).
 *
 * @param {string} button - 'save' | 'cancel'
 * @param {number} index  - button index (0 = save)
 */
function buttonClicked(button, index) {
	if (button !== 'save') return;
	if (!focusedAssetRef.value) return;

	// Translate asset_ref back to the AssetManager record. Built-in
	// asset_refs are numeric strings; user asset_refs are uuid-with-ext.
	// AssetManager handles both lookups via getFileData(id).
	const assetData = ctApp.assetsMgr.getFileData(focusedAssetRef.value);
	if (!assetData) {
		console.warn('[AssetPickerModal] asset not in AssetManager:', focusedAssetRef.value);
		return;
	}

	emit(Modal.EVENT_PROMPT, { button, index, value: assetData });
}

</script>
<style lang="scss" scoped>

	// fill the modal frame
	.modalContent {

		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;

		.browserHost {
			// browser stretches to fill above the button strip
			flex: 1;
			min-height: 0;
			overflow: hidden;
		}

		.buttons {

			outline: none;

			height: 50px;
			background: #EEE;
			border-top: 1px solid rgba(0, 0, 0, 0.08);

			display: flex;
			justify-content: flex-start;
			flex-direction: row-reverse;
			align-items: center;
			gap: 10px;
			padding-right: 10px;

			// re-use the button styling from the old modal
			button {

				padding: 5px 14px;
				border-radius: 5px;
				cursor: pointer;
				border: 1px solid rgba(0, 0, 0, 0.15);

				background: linear-gradient(180deg, #FFF, #DDD);
				text-transform: uppercase;
				font-size: 12px;
				font-weight: 600;

				&:disabled {
					pointer-events: none;
					opacity: 0.4;
					cursor: not-allowed;
				}

				&.primary {
					background: linear-gradient(180deg, #05dee2, #00ABAE);
					color: white;
					border-color: transparent;
				}

				&:hover:not(:disabled) {
					background: linear-gradient(180deg, #f4fbff, #c4d0d6);
				}

				&.primary:hover:not(:disabled) {
					background: linear-gradient(180deg, #1be8eb, #00bdc0);
				}

			}// button

		}// .buttons

	}// .modalContent

</style>
