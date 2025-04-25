<!--
	ChatSourceManager.vue
	---------------------

	The component to manage chat sources.
-->
<template>

	<div class="chat-source-manager">

		<div class="add-chat">
			<input v-model="newInput" placeholder="Enter YouTube ID or URL" />
			<button @click="addChat">Add</button>
		</div>

		<div v-for="chat in chatSources" :key="chat.youtube_id" class="chat-row">

			<!-- Enabled/Pending/Unavailable Status -->
			<div class="chat-status">
				<span v-if="chat.status_pending" class="material-icons spin">autorenew</span>
				<span v-else-if="!chat.available" class="unavailable">unavailable</span>
				<input
					v-else
					type="checkbox"
					:checked="chat.enabled"
					@change="toggleEnabled(chat.youtube_id, $event.target.checked)"
				/>
			</div>

			<!-- Thumbnail -->
			<img
				class="thumb"
				:src="`https://img.youtube.com/vi/${chat.youtube_id}/hqdefault.jpg`"
				alt="thumbnail"
			/>

			<!-- YouTube ID (readonly input) -->
			<input class="youtube-id" :value="chat.youtube_id" readonly />

			<!-- Actions -->
			<span class="material-icons action" @click="confirmRemove(chat.youtube_id)">delete</span>
			<span class="material-icons action" @click="showChat(chat.youtube_id)">open_in_new</span>

		</div>
	</div>

</template>
<script setup>

// vue
import { shallowRef, onMounted } from 'vue';

const chatSources = shallowRef([]);
const newInput = shallowRef('');

// Load chat sources initially
const loadChats = async () => {
	const all = await window.chatSourceAPI.getAll();
	chatSources.value = all;
};

// Subscribe to updates
window.chatSourceAPI.onUpdate((data) => {
	chatSources.value = data;
});

// Add chat
const addChat = async () => {
	const input = newInput.value.trim();
	if (!input) return;

	const youtube_id = parseYoutubeId(input);
	if (!youtube_id) {
		alert('Invalid YouTube URL or ID');
		return;
	}

	const success = await window.chatSourceAPI.add(youtube_id);
	if (!success) {
		alert('Chat source already exists.');
	}
	newInput.value = '';
};

// Toggle chat enabled/disabled
const toggleEnabled = async (id, enabled) => {
	if (enabled) {
		await window.chatSourceAPI.enable(id);
	} else {
		await window.chatSourceAPI.disable(id);
	}
};

// Remove chat (with confirm)
const confirmRemove = async (id) => {
	if (confirm(`Remove chat source ${id}?`)) {
		await window.chatSourceAPI.remove(id);
	}
};

// Show chat window
const showChat = async (id) => {
	await window.chatSourceAPI.show(id);
};

// Extract YouTube video ID from any valid URL or ID
const parseYoutubeId = (input) => {
	try {
		// Direct ID
		if (/^[\w-]{11}$/.test(input)) return input;

		const url = new URL(input);
		if (url.hostname.includes('youtube.com')) {
			if (url.pathname === '/watch') {
				return url.searchParams.get('v');
			}
			if (url.pathname === '/live_chat') {
				return url.searchParams.get('v');
			}
		}
		if (url.hostname === 'youtu.be') {
			return url.pathname.slice(1);
		}
	} catch (e) {
		// Input wasn't a valid URL, fallback to ID test already handled
	}
	return null;
};

onMounted(loadChats);

</script>
<style scoped>

	.chat-source-manager {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		font-family: sans-serif;
	}

	.add-chat {
		display: flex;
		gap: 0.5rem;
	}

	.chat-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid #ccc;
		padding: 0.5rem;
		border-radius: 6px;
	}

	.chat-status {
		width: 30px;
		text-align: center;
	}

	.unavailable {
		color: red;
		font-weight: bold;
		font-size: 0.9rem;
	}

	.thumb {
		width: 80px;
		height: 45px;
		object-fit: cover;
		border-radius: 4px;
	}

	.youtube-id {
		width: 160px;
	}

	.material-icons.action {
		cursor: pointer;
		user-select: none;
		padding: 4px;
	}

	.material-icons.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
