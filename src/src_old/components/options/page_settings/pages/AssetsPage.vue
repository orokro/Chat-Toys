<!--
	AssetsPage.vue
	--------------

	Lets the user browse, edit, import, view, and modify assets to be
	consumed by the various toys, and throughout the extension.
-->
<template>

	<PageBox
		title="Assets"
		themeColor="lightblue"
	>
		<p>The various toys will require types of assets to function, such as sounds to play or images to show.</p>
		<p>The types of assets include:</p>
		<ul>
			<li>Images (.png or .gif only)</li>
			<li>Sounds (.mp3 or .wav only)</li>
			<li>3D Models (.glb only)</li>
		</ul>
		<br>
		<p>
			There are many assets built-in to the plugin, because some toys require at least
			one of certain kinds to function. However, many of the toys allow you to load
			custom assets from your PC to use instead of the built ins.
		</p>
		<p>
			Below is a list of all the assets, both built in and custom. You can delete, or edit
			the assets to various degrees. But all assets you ever interact with will be listed here.
		</p>
		<InfoBox icon="warning">
			<strong>
				NOTE: it is HIGHLY RECOMMENDED that you move all custom assets to a safe folder
				on your PC, BEFORE you import them.
				<br><br>
				For example, if you import them directly from downloads/ or desktop/, and then
				you move them later on, the plugin will not be able to find them the next time it runs.
				This may affect your stream if assets are missing!
				<br><br>
				Therefore, it's recommended you move all assets you intend to use to a folder such as
				"My Documents/StreamToysAssets/" or similar. This way you will not accidentally move
				or delete them, and the plugin will always be able to find them.
				<br><br>
				Should a file end up missing, you can replace it in the list below, or reimport it
				and reassign it to the toy.
			</strong>
		</InfoBox>
		<template v-if="selectedRow">
			<SectionHeader title="Preview"/>
			<FilePreview
				:fileId="selectedRow"
				:height="100"
				:assetManager="props.optionsApp.assetsMgr"
			/>
		</template>
		<SectionHeader title="Assets Database"/>
		<button 
			type="button"
			class="importButton"
			@click="handleImportAssets"
		>Import Assets</button>
		<AssetsView
			:data="props.optionsApp.assetsMgr.assets.value"
			:selected_id="selectedRow"			
			:ignoreColumns="['id', 'file_path']"
			:showDeleteColumn="true"
			@rowClick="rowClick"
			@cellClick="cellClick"
			@cellEdit="cellEdit"
			@deleteRow="deleteRow"
		/>
	</PageBox>

</template>
<script setup>

//:editableFields="['name', 'tags']"

// vue
import { ref } from 'vue';

// components
import ConfirmModal from '../../ConfirmModal.vue';
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import AssetsView from '../CustomDataTable.vue';
import FilePreview from '../../FilePreview.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"

// props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// the currently selected row
const selectedRow = ref(props.optionsApp.assetsMgr.assets.value[0].id);

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
	props.optionsApp.assetsMgr.remove(id);
	if(selectedRow.value===id)
		selectedRow.value = null;
}

// handle when the import assets button is clicked
async function handleImportAssets(){

	// open the modal to import assets
	const optionsApp = props.optionsApp;
	const assetsMgr = optionsApp.assetsMgr;
	const imports = await assetsMgr.importFiles('any', true);

	// show list of imported IDs (for debug)
	console.log('imported assets', imports);
}

</script>
<style lang="scss" scoped>	


</style>
