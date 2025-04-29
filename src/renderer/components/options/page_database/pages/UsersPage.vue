<!--
	UsersPage.vue
	-------------

	Displays list of users we've interacted with.
-->
<template>

	<PageBox
		title="Users Database"
		themeColor="#69457f"
		:limitWidth="true"
		themeImage="assets/bg_tiles/usersDB.png"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/users_db.png" height="300px" style="float:right"/>
		</div>
		
		<br>
		<br><br>
		<p>Below you will find the complete list of users that have interacted previously.</p>
		<p>Currently this is read only, but in the future may be editing or support more user-features..</p>
		
		<SectionHeader title="Users"/>
		<CustomDataTable
			title="All Recorded Users"
			:data="users"
			:selected_id="selectedRow"		
			:ignoreColumns="['id', 'streams', 'commands']"	
			:showDeleteColumn="false"
			@rowClick="rowClick"
			@cellClick="cellClick"
			@cellEdit="cellEdit"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject, shallowRef } from 'vue';

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

const users = shallowRef(ytctDB.getAllUsersFull().map(user=>{
	return {
		id: user.youtube_id,
		...user
	}
}));

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
