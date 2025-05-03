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
		<p>Below you will find the complete list of users that have interacted previously.</p>
		<p>You can select any user by clicking their row in the table, <br>
			and a box with more info will appear.</p>
		<p>You can use this box to:</p>
		<ul>
			<li>Edit the users points.</li>
			<li>View a list of all the streams they've participated in!</li>
			<li>View a list & bar-chart of all the commands the user has run!</li>
			<li>Ban or un-ban the user!</li>
		</ul>
		<InfoBox icon="warning">
			NOTE: "Banning" a user in this context only bans them from participating with the Chat Toys system.
			This has nothing to do with your Channel or anything else.
		</InfoBox>
		<InfoBox icon="info">
			FYI, the database used is a SQLLite database stored in your systems <strong><em>%APPDATA%</em></strong> directory for this app.
			<br>
			Should you desire, you can connect to it with a database client such as DBeaver, and edit it directly.
			<br/>
			It is out-of-scope for this application to provide robust database tools, so feel free to poke around.
			<br/>
			But be warned! Always make a backup copy of the database before you start make changes.
		</InfoBox>
		
		<SectionHeader title="Users"/>
		<div 
			class="table"
			:class="{
				showUserInfo: selectedRow!='',
			}"
		>
			<div class="leftColumn">
	
				<CustomDataTable
					title="All Recorded Users"
					:buttonText="'Refresh List'"
					:data="users"
					:selected_id="selectedRow"		
					:ignoreColumns="['id', 'youtube_id', 'streams', 'first_seen', 'commands']"	
					:showDeleteColumn="false"
					@rowClick="rowClick"
					@cellClick="cellClick"
					@cellEdit="cellEdit"
					@buttonClicked="handleRefreshList"
				/>
			</div>
			<div class="rightColumn">

				<div 
					v-if="selectedRow!='' && selectedUserData!=null"
					class="userInfo" 
				>
					<div class="header">User Info</div>
					<div class="row">
						<div class="key">User ID:</div>
						<div class="value">{{ selectedUserData.youtube_id }}</div>
					</div>
					<div class="row">
						<div class="key">Display Name:</div>
						<div class="value">{{ selectedUserData.display_name }}</div>
					</div>
					<div class="row">
						<div class="key">Points:</div>
						<div class="value">{{ selectedUserData.points }}
							<button type="button" class="showStreams" @click="e=>handleEditPoints(selectedUserData)">
								Edit
							</button>
						</div>
					</div>
					<div class="row">
						<div class="key">Points Spent:</div>
						<div class="value">{{ selectedUserData.points_spent }}</div>
					</div>
					<div class="row">
						<div class="key">First Seen:</div>
						<div class="value">{{ formatDate(selectedUserData.first_seen) }}</div>
					</div>
					<div class="row">
						<div class="key">Last Seen:</div>
						<div class="value">{{ formatDate(selectedUserData.last_seen) }}</div>
					</div>
					<div class="row">
						<div class="key">Banned:</div>
						<div class="value">
							{{ selectedUserData.banned ? 'Yes' : 'No' }}

							<ToggleCheck
								class="banToggle"
								v-model="selectedUserData.banned"
								@change="e=>toggleUserBan(selectedUserData.youtube_id, !$event)"
							/>
						</div>
					</div>
					<div class="row">
						<div class="key">Participated In:</div>
						<div class="value">
							{{ selectedUserData.streams.length }} Streams
							<button type="button" class="showStreams" @click="e=>handleShowStreams(selectedUserData)">
								Show Streams
							</button>
						</div>
					</div>
					<div class="row">
						<div class="key">Commands Used:</div>
						<div class="value">
							{{ selectedUserData.commands.length }}
							<button type="button" class="showCommands" @click="e=>handleShowCommands(selectedUserData)">
								Show Commands
							</button>
						</div>
					</div>
					<pre v-if="false">
						{{ selectedUserData }}
					</pre>
				</div>
			</div>
		</div>
		
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/bWa-IjAIPfI"
			width="100%"
		/>

	</PageBox>

</template>
<script setup>

// vue
import { ref, inject, shallowRef } from 'vue';

// components
import ToggleCheck from '@components/ToggleCheck.vue';
import ConfirmModal from '../../ConfirmModal.vue';
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CustomDataTable from '../CustomDataTable.vue';
import FilePreview from '../../FilePreview.vue';
import StreamsListModal from '../StreamsListModal.vue';
import CommandsListModal from '../CommandsListModal.vue';
import EditUserModal from '../EditUserModal.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"

// fetch the main app state context
const ctApp = inject('ctApp');

// the currently selected row
const selectedRow = ref("");

// when a user is selected, we will show their data in the right column
const selectedUserData = shallowRef(null);


// list of users for the table
const users = shallowRef(ytctDB.getAllUsersFull().map(user=>{
	return {
		id: user.youtube_id,
		...user,
		last_seen: formatDate(user.last_seen, true),
	}
}));


// make sure users DB is up-to-date
function handleRefreshList(){

	// refresh the list of users
	users.value = ytctDB.getAllUsersFull().map(user=>{
		return {
			id: user.youtube_id,
			...user,
			last_seen: formatDate(user.last_seen, true),
		}
	});

}


// handle when a row is clicked
async function rowClick({ id, data }){

	selectedRow.value = id;
	
	const user = await ytctDB.getUserFull(id);
	selectedUserData.value = user;
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


/**
 * Makes date formatting pretty
 * 
 * @param isoString {String} - the ISO string to format
 * @param noTime {Boolean} - OPTIONAL; if true, don't show the time, default is fals
 */
function formatDate(isoString, noTime=false) {
	const date = new Date(isoString);

	if(noTime)
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	else
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
}


/**
 * Shows the modal list of streams the user has participated in
 * 
 * @param userData {Object} - the user data to show
 */
async function handleShowStreams(userData){

	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(StreamsListModal, {
		userData
	});
}


/**
 * Shows the modal with a bar-graph/chart of the commands the user has used
 * 
 * @param userData {Object} - the user data to show
 */
async function handleShowCommands(userData){

	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(CommandsListModal, {
		userData
	});
}


/**
 * Shows the modal to edit the points for a user
 * 
 * @param userData {Object} - the user data to show
 */
async function handleEditPoints(userData){

	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(EditUserModal, {
		userData
	});

	// gtfo if the user cancelled
	if(response==null || response.button=='cancel')
		return;

	// get new value as int
	const newValue = parseInt(response.value, 10);

	// update the user in the database w/ new points
	await window.ytctDB.setUserPoints(userData.youtube_id, newValue);

	// refresh things
	handleRefreshList();
	selectedUserData.value = await ytctDB.getUserFull(userData.youtube_id);
}


/**
 * Toggles the user ban status
 * 
 * @param userId {String} - the user ID to toggle
 */
async function toggleUserBan(userId){

	// get users current ban status
	const user = await ytctDB.getUserFull(userId);

	// set it to the opposite
	await (parseInt(user.banned, 10)==0) ? window.ytctDB.ban(userId) : window.ytctDB.unBan(userId);

	// update both the list on the left and the user data block on the right column
	handleRefreshList();
	selectedUserData.value = await ytctDB.getUserFull(userId);
}

</script>
<style lang="scss" scoped>	

	// table for both the users list (left column) and the user info (right column)
	.table {

		position: relative;
		white-space: nowrap;
		min-height: 410px;
		/* border: 1px solid red; */
		overflow: clip;

		// area that shows the list of users
		.leftColumn {

			transition: width 0.5s ease;
			width: 1000px;
			display: inline-block;
			/* float: left; */
		}

		// area that shows the user info
		.rightColumn {

			position: absolute;
			top: 0px;
			right: 0px;

			transition: width 0.5s ease;
			width: 0px;
			
			float: right;
			margin-left: 10px;
		}

		&.showUserInfo {
			.leftColumn {
				width: 650px;
			}

			.rightColumn {
				width: 340px;
			}
		}

	}// .table

	.userInfo {

		// reset stacking context
		position: absolute;
		top: 0px;
		left: 0px;

		// rounded box
		width: 340px;
		border: 2px solid black;
		border-radius: 10px;
		overflow: clip !important;
		padding-top: 40px;

		// the black header on the top..
		.header {
			position: absolute;
			inset: 0px 0px auto 0px;
			height: 40px;
			padding: 8px 15px;

			// black bar with white text, smaller font
			background: black;
			color: white;
			font-weight: bold;
			border-bottom: 2px solid black;
		
		}// .header

		// row styles
		.row {

			position: relative;
			height: 40px;

			// alternate the bgs
			background: #E4E2E5;
			&:nth-child(odd) {
				background: #D8D6D8;
			}

			.key {
				
				// fix dark box on left column
				position: absolute;
				inset: 0px auto 0px 0px;
				width: 115px;
				background: rgba(0, 0, 0, 0.5);

				padding: 10px 10px;

				// text settings
				text-align: right;
				font-size: 12px;
				color: white;
				
			}// .key
			
			.value {

				// fix light box on right column
				position: absolute;
				inset: 0px 0px 0px 115px;

				padding: 10px 6px 0px 16px;

				// text settings
				font-size: 12px;

				.banToggle {
					float: right;
					position: relative;
					top: -5px;
				}

				button {
					
					position: relative;
					float: right;

					border-radius: 100px;
					border: 2px solid black;

					padding: 2px 12px;
					font-weight: bold;
					
					cursor: pointer;

					&:hover {
						background: black;
						color: white;
					}
				}

			}// .value

		}// .row

	}// .userInfo

</style>
