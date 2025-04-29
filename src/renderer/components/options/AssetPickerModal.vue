<!--
	AssetPickerModal.vue
	--------------------

	We provide a component to use with the "jenesius-vue-modal" library to allow
	the user to pick an asset from the assets in the extension.

	NOTE: todo - make things like modals resizable and responsive in the future.
-->
<template>

	<ModalWindowFrame
		:title="title"
		:height="690 - (allowCustomImports ? 0 : 75)"
		:width="800"
	>
		<!-- main outer wrapper -->
		<div class="modalContent">

			<!-- box with asset list and preview -->
			<div class="assets">

				<div class="assetList">
					<CustomDataTable
						:noHeaders="true"
						:data="props.assetManager.assets.value"
						:selected_id="selectedRow"			
						:ignoreColumns="['id', 'file_path', 'tags', 'internal']"
						:showDeleteColumn="false"
						:filter="filterFn"
						@rowClick="rowClick"
					/>
				</div>
				<div class="assetPreview">
					<FilePreview
						:fileId="filteredSelectedRow"
						:height="500"
						:width="260"
						:border="false"
						:autoPlay="true"
						:assetManager="props.assetManager"
					/>
				</div>
			</div>

			<!-- along the top, optionally show bar to pick custom files -->
			<div v-if="allowCustomImports" class="importCustom">
				Not finding what you're looking for?
				<button
					type="button"
					class="cmdImportCustom"
					@click="importCustomFiles"
				>Import Custom Assets</button>
			</div>

			<!-- the buttons along hte bottom -->
			<div 
				class="buttons"				
				tabindex="0"
			>
				<button
					class="primary"
					@click="buttonClicked('save', 0)"
				>
					Save
				</button>
				<button
					@click="closeModal"
				>
					Cancel
				</button>
			</div>

		</div>

	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';

// components
import ModalWindowFrame from './ModalWindowFrame.vue';
import CustomDataTable from './page_database/CustomDataTable.vue';
import FilePreview from './FilePreview.vue';

// lib misc
import { closeModal, Modal } from 'jenesius-vue-modal';

// props
const props = defineProps({

	// title of the modal
	title: {
		type: String,
		default: 'Asset Picker'
	},

	// reference to the state of the options page
	assetManager: {
		type: Object,
		default: null
	},

	// true if we allow import of custom files
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

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

// determine the filter fn
const filterFn = (item) => {
	if (!props.kindFilter) return true;
	return item.kind === props.kindFilter;
};

// the currently selected row
const selectedRow = ref(props.assetManager.assets.value[0].id);

// make sure we can have a valid selected row, even if the filter changes
const filteredSelectedRow = computed(() => {
	
	// filter using our filterFn
	const data = props.assetManager.assets.value;
	const filtered = data.filter(filterFn);

	// check if the selected row is in the filtered data
	if (filtered.find(item => item.id === selectedRow.value))
		return selectedRow.value;

	// if not, return the first item
	return filtered[0].id;
});

// handle when a row is clicked
function rowClick({ id, data }){
	selectedRow.value = id;
}


// handle when the import custom files button is clicked
function importCustomFiles(){
	props.assetManager.importFiles(props.kindFilter)
}


// when user clicks a button
function buttonClicked(button, index){

	console.log('button clicked', button, index);

	// ignore 'save' if the value is not valid
	if (button !== 'save')
		return;

	// emit the event that closes the prompt-type modal with the value
	const file = props.assetManager.getFileData(filteredSelectedRow.value);
	emit(Modal.EVENT_PROMPT, {button, index, value: file});
}

</script>
<style lang="scss" scoped>

	// fill modal
	.modalContent {

		// fill bottom with a gray box
		width: 100%;
		height: 100%;

		// fill modal
		position: absolute;
		inset: 0px;

		// optional box with custom import button
		.importCustom {

			text-align: center;

			margin: 15px;
			padding: 15px;
			background: #EEE;
			border-radius: 10px;

			// make the add button look nice
			button {

				display: inline-block;

				// box styles
				background: #EFEFEF;
				border: none;
				border-radius: 40px;
				padding: 5px 10px;
				cursor: pointer;
				border: 2px solid black;

				margin-left: 10px;

				// text settings
				color: black;
				font-weight: bolder;

				&:hover {
					background: white;
					/* border: 2px solid rgba(255, 255, 255, 1); */
				}

			}// button

		}// .importCustom

		// main asset area
		.assets {

			// reset stacking context
			position: relative;

			// box styles
			width: 765px;
			height: 500px;
			border: 2px solid gray;
			border-radius: 10px;
			margin: 15px;

			overflow: clip;
			
			// list box of assets on the left
			.assetList {

				// pos and box styles
				position: absolute;
				inset: 0px auto 0px 0px;
				width: 500px;

				overflow-y: scroll;

				border-right: 2px solid gray;

				// mac-style scrollbars
				&::-webkit-scrollbar {
					width: 14px;
				}

				&::-webkit-scrollbar-track {
					background: transparent;
					background: #E5E5E5;
				}

				&::-webkit-scrollbar-thumb {
					background-color: rgba(120, 120, 120, 0.3);
					border-radius: 6px;
					transition: background-color 0.2s ease-in-out;
				}

				&:hover::-webkit-scrollbar-thumb,
				&:active::-webkit-scrollbar-thumb {
					background-color: rgba(120, 120, 120, 0.6);
				}

			}// .assetList

			// preview box on the right
			.assetPreview {
				position: absolute;
				inset: 0px 0px 0px 500px;
				width: 265px;

				// for debug
				/* border-left 2px solid red; */

			}// .assetPreview

		}// .assets


		// put buttons bar along the bottom, slightly gray
		.buttons {

			// disable the default outline
			outline: none;

			// fill bottom with a gray box
			position: absolute;
			inset: auto 0px 0px 0px;
			background: #EEE;
			height: 50px;

			// space buttons nicely
			display: flex;
			justify-content: flex-start;
			flex-direction: row-reverse;
			align-items: center;
			gap: 10px;
			padding-right: 10px;

			// make buttons look pretty
			button {

				// nice padding, rounded corners, and pointer cursor
				padding: 5px 10px;
				border-radius: 5px;
				cursor: pointer;

				// nice vertical gradient
				background: linear-gradient(180deg, #FFF, #DDD);
				text-transform: uppercase;

				&:disabled {
					pointer-events: none;
					opacity: 0.5;
					cursor: not-allowed;
				}

				// mm that primary tho
				&.primary {
					background: linear-gradient(180deg, #05dee2, #00ABAE);
					font-weight: bolder;
					color: white;
				}

				&:hover {
					background: linear-gradient(180deg, #f4fbff, #c4d0d6);
				}

			}// button

		}// .buttons

	}// .modalContent

</style>

