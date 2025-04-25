<!--
	ChatSourceManager.vue
	---------------------

	The component to manage chat sources.
-->
<template>

	<div class="chat-source-manager">

		<div class="chatSources">
			<div class="header">
				<h2>Chat Sources</h2>
				<div class="add-chat">
					<input type="text" v-model="newInput" placeholder="Enter YouTube ID or URL" />
					<button @click="addChat">Add</button>
				</div>
			</div>
			<!-- loop to show all the rows of chat sources -->
			<div 
				v-for="chat in [...chatSources].reverse()"
				:key="chat.youtube_id"
				class="chat-row"			
			>

				<!-- Enabled/Pending/Unavailable Status -->
				<div class="chat-status rb">

					<span v-if="chat.status_pending" class="material-icons spin">autorenew</span>
					<span v-else-if="!chat.available" class="unavailable">unavailable</span>
					<ToggleCheck
						v-else
						v-model="chat.enabled"
						@change="toggleEnabled(chat.youtube_id, !$event)"
					/>
				</div>

				<!-- Thumbnail -->
				<img
					class="thumb rb"
					:src="`https://img.youtube.com/vi/${chat.youtube_id}/hqdefault.jpg`"
					alt="thumbnail"
				/>

				<!-- YouTube ID (readonly input) -->
				<div class="videoID rb">
					Stream ID:<br/>

					<input type="text" class="youtube-id" :value="chat.youtube_id" readonly />
				</div>
				<!-- Actions -->
				<span class="material-icons action" @click="confirmRemove(chat.youtube_id)">delete</span>
				<span v-if="chat.enabled" class="material-icons action open" @click="showChat(chat.youtube_id)">open_in_new</span>

			</div>
		</div>
	</div>

</template>
<script setup>

// vue
import { shallowRef, onMounted } from 'vue';

// components
import ToggleCheck from '@components/ToggleCheck.vue';

// we'll grab the chats from the backend & store them in this local ref
const chatSources = shallowRef([]);

// ref to the input field dom element for adding new chats
const newInput = shallowRef('');


/**
 * Load chat sources initially from the Electron backend
 */
const loadChats = async () => {
	const all = await window.chatSourceAPI.getAll();
	chatSources.value = all;
};


// Subscribe to updates
window.chatSourceAPI.onUpdate((data) => {
	chatSources.value = data;
});


/*
	Method to add a new chat
*/
const addChat = async () => {

	// Check if input is empty & GTFO
	const input = newInput.value.trim();
	if (!input)
		return;

	// if a valid youtube ID or URL, parse it
	const youtube_id = parseYoutubeId(input);
	if (!youtube_id) {
		alert('Invalid YouTube URL or ID');
		return;
	}

	// tell our Electron backend to add the chat source
	const success = await window.chatSourceAPI.add(youtube_id);
	if (!success)
		alert('Error adding chat, maybe chat source already exists?');
	
	newInput.value = '';
};


/**
 * Method to enable/disable a chat source on the electron backend
 * 
 * @param id {string} - The ID of the chat source to enable/disable
 * @param enabled {boolean} - Whether to enable or disable the chat source
 */
const toggleEnabled = async (id, enabled) => {

	console.log(enabled);

	if (enabled)
		await window.chatSourceAPI.enable(id);
	else
		await window.chatSourceAPI.disable(id);
};


/**
 * Remove chat (with confirm)
 * 
 * @param id {string} - The ID of the chat source to remove
 */
const confirmRemove = async (id) => {

	if (confirm(`Remove chat source ${id}?`))
		await window.chatSourceAPI.remove(id);
};



/**
 * Show the chat window we're reading.
 * 
 * @param id {string} - The ID of the chat source to show
 */
const showChat = async (id) => {
	await window.chatSourceAPI.show(id);
};


/**
 * Extract YouTube video ID from any valid URL or ID
 * 
 * @param input {string} - The input to parse
 * @return {string|null} - The YouTube ID or null if invalid
 */
const parseYoutubeId = (input) => {
	try {
		// Direct ID
		if (/^[\w-]{11}$/.test(input)) return input;

		// some URLs will have a query string, like v=ID
		const url = new URL(input);
		if (url.hostname.includes('youtube.com')) {
			if (url.pathname === '/watch') {
				return url.searchParams.get('v');
			}
			if (url.pathname === '/live_chat') {
				return url.searchParams.get('v');
			}
		}

		// some URLs will be shortened, like youtu.be/ID
		if (url.hostname === 'youtu.be') {
			return url.pathname.slice(1);
		}

	} catch (e) {
		// Input wasn't a valid URL, fallback to ID test already handled
	}
	return null;
};

/**
 * Load chat sources when the component is mounted
 */
onMounted(loadChats);

</script>
<style lang="scss" scoped>

	// main outer container
	.chat-source-manager {

		// stack column
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		font-family: sans-serif;

		// box with the chat sources
		.chatSources {

			position: relative;

			// thicc boarder rounded box
			border: 2px solid black;
			border-radius: 10px;
			overflow: hidden;
			background: #ACACAC;
			
			// space for the fixed header
			padding-top: 50px;

			input[type="text"] {
				padding: 5px 20px;
				border: 2px solid black;
				border-radius: 8px;
				box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.5);

				// text settings
				font-family: 'Courier New', Courier, monospace;
			}

			// header for the box
			.header {
				
				// fixed on top
				position: absolute;
				inset: 0px 0px auto 0px;
				height: 50px;
				padding: 10px 10px;

				// black bar with white text, smaller font
				background: black;
				color: white;
				font-size: 12px;
				border-bottom: 2px solid black;
				
				// the row to add chats
				.add-chat {

					position: absolute;
					inset: 7px 10px 7px auto;
					width: 450px;

					// for debug
					/* border: 1px solid red; */

					display: flex;
					justify-content: flex-end;

					gap: 0.5rem;

					// text box for the url/ video ID
					input {

						// box styles
						width: 390px;						

					}// input

					// the add button
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

					}// button

				}// .add-chat

			}// .header

			// the row for added chat source
			.chat-row {

				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem;
				border-top: 2px solid black;

				.chat-status {
					width: 140px;
					text-align: center;
				}

				.unavailable {
					background: rgb(216, 9, 9);
					border-radius: 30px;

					color: white;
					padding: 4px 8px;

					font-style: italic;
					font-weight: bold;
					font-size: 0.9rem;
				}

				.thumb {

					border: 2px solid black;
					border-radius: 8px;

					width: 160px;
					height: 90px;
					object-fit: cover;
					border-radius: 4px;
				}

				.videoID {

					width: 300px;
					padding-left: 30px;

					.youtube-id {
						width: 250px;
					}
				}

				.material-icons.action {
					cursor: pointer;
					user-select: none;
					padding: 4px 30px;
					font-size: 30px;

					&:hover {
						color: #FF0000;

						&.open {
							color: #eeeeee;
						}
					}
				}

				.material-icons.spin {
					animation: spin 1s linear infinite;
				}

			}// .chat-row

		}// .chatSources

	}// .chat-source-manager

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

</style>
