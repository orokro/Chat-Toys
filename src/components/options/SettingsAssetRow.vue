<!--
	SettingsAssetRow.vue
	--------------------

	Displays a row for our settings pages, that allows an asset to be selected.
-->
<template>

	<SettingsRow :desc="desc">

		<slot></slot>

		<div class="box">
			
			<!-- area with the file preview and the button to pick.-->
			<table class="settings-asset-row" width="100%">
				<tr>
					<td colspan="2">
						
					</td>
				</tr>
				<tr>
					<td 
						class="file-preview-cell"
						rowspan="2"
						:width="kindFilter==='image' ? 200 : 300"
					>
						<FilePreview 
							:fileId="assetValue"
							:assetManager="optionsApp.assetsMgr"
							:border="false"
							:height="kindFilter==='image' ? 200 : 70"
						/>
					</td>
					<td class="name-cell" align="center">
						{{ optionsApp.assetsMgr.getFileData(assetValue)?.name }}
					</td>
				</tr>
				<tr>
					<td align="center">
						<button @click="handlePickAsset">{{ pickButtonName }}</button>
					</td>
				</tr>

			</table>
		
		</div>

	</SettingsRow>

</template>
<script setup>

// vue
import { ref, markRaw, watch, computed } from 'vue';

// components
import SettingsRow from './SettingsRow.vue';
import FilePreview from './FilePreview.vue';
import AssetPickerModal from './AssetPickerModal.vue';

// lib/misc
import { promptModal } from 'jenesius-vue-modal';

// v-model binding (expects a ref/shallowRef)
const assetValue = defineModel();

// props
const props = defineProps({
	
	// the kind filer
	kindFilter: {
		type: String,
		default: null
	},

	// options app reference
	optionsApp: {
		type: Object,
		default: null
	},

	// the description of the setting
	desc: {
		type: String,
		default: ''
	},
});


/**
 * Returns english name for kind
 * 
 * @param {String} kindFilter - the kind filter
 */
function getKindName(kindFilter){
	switch(kindFilter){
		case 'image':
			return 'Image';
		case 'sound':
			return 'Sound';
		case '3d':
			return '3D Model';
		default:
			return 'Asset';
	}// swatch
}


// the name for the button
const pickButtonName = computed(() => {

	const kindName = getKindName(props.kindFilter);
	return `Pick ${kindName}`;
});


// handle when user clicks the pick asset button
async function handlePickAsset(){

	// prompt the user to confirm the delete with our custom modal
	const kindName = getKindName(props.kindFilter);
	const response = await promptModal(AssetPickerModal, {
		title: `Pick an ${kindName} File`,
		assetManager: markRaw(props.optionsApp.assetsMgr),
		allowCustomImports: true,
		kindFilter: props.kindFilter,
	});

	// if the response was null or not the 'yes' button, return
	if(response==null)
		return;
	if(response.index!==0)
		return;

	// set the model id
	assetValue.value = response.value.id;
}

</script>
<style lang="scss" scoped>

	.box {

		display: inline-block;
		width: 600px;

		border-radius: 10px;
		border: 2px solid black;
		overflow: hidden;

		.settings-asset-row {

			/* width: 100%; */
			border-collapse: collapse;
			background: #ACACAC;

			.file-preview-cell {
				border-right: 2px solid black;
			}

			.name-cell {
				border-bottom: 2px solid black;
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

		}// .settings-asset-row
	
	}// .box

</style>
