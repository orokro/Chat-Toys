<!--
	AssetsPage.vue
	--------------

	Lets the user browse, edit, import, view, and modify assets to be
	consumed by the various toys, and throughout the extension.
-->
<template>

	<PageBox
		title="Assets Database"
		themeColor="#69457f"
		:limitWidth="true"
		themeImage="assets/bg_tiles/assets.png"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/assets_db.png" height="300px" style="float:right"/>
		</div>
		
		<br>
		<br><br>
		<p>Below you will find the complete list of assets available..</p>
		<p>This includes built-in assets, as well as ones you previously imported.</p>
		
		<template v-if="selectedRow">
			<SectionHeader title="Preview"/>
			<FilePreview
				:fileId="selectedRow"
				:height="100"
				:assetManager="ctApp.assetsMgr"
			/>
		</template>
		<SectionHeader title="Assets Database"/>
			<CustomDataTable
				title="All Available Assets"
				:addButtonText="'Import Assets'"
				:data="ctApp.assetsMgr.assets.value"
				:selected_id="selectedRow"			
				:ignoreColumns="['id', 'file_path']"
				:showDeleteColumn="true"
				@rowClick="rowClick"
				@cellClick="cellClick"
				@cellEdit="cellEdit"
				@deleteRow="deleteRow"
				@addClicked="handleImportAssets"
			/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';

// components
import ConfirmModal from '../../ConfirmModal.vue';
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CustomDataTable from '../CustomDataTable.vue';
import FilePreview from '../../FilePreview.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"

// fetch the main app state context
const ctApp = inject('ctApp');

// the currently selected row
const selectedRow = ref(ctApp.assetsMgr.assets.value[0].id);

// handle when a row is clicked
function rowClick({ id, data }){

	selectedRow.value = id;
	// console.log('row clicked', id, data);
}

// handle when a cell is clicked
function cellClick({ id, key, value }){

	// currently for debug only
	// console.log('cell clicked', id, key, value);
}

// handle when a cell edit is requested
function cellEdit({ id, data, key, value }){

	// currently for debug only
	// console.log('cell edit', id, key, value);
}

// handle when a row delete is requested
async function deleteRow(id){

	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(ConfirmModal, {
		title: 'Are you sure?',
		prompt: `Are you sure you want to delete file id ${id}?`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning'
	});

	// if the response was null or not the 'yes' button, return
	if(response==null)
		return;
	if(response.index!==0)
		return;

	// remove the file
	ctApp.assetsMgr.remove(id);
	if(selectedRow.value===id)
		selectedRow.value = null;
}

// handle when the import assets button is clicked
async function handleImportAssets(){

	// open the modal to import assets
	const assetsMgr = ctApp.assetsMgr;
	const imports = await assetsMgr.importFiles('any', true);

	// show list of imported IDs (for debug)
	console.log('imported assets', imports);
}

</script>
<style lang="scss" scoped>	


</style>
