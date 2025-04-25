<!--
	RawChatPreview.vue
	------------------

	Component to make our chat settings page prettier with a formatted
	live view of the chat data as it comes in.
-->
<template>

	<div ref="container" class="chat-container">

		<div v-for="(msg, index) in messages" :key="msg.id"
			:class="['chat-row', index % 2 === 0 ? 'bg-dark' : 'bg-darker']">
			<pre class="json-text">{{ formatJSON(msg) }}</pre>
		</div>

	</div>

</template>
<script setup>

// vue
import { onMounted, onUpdated, ref, watchEffect } from 'vue'

// Props: your incoming array of chat messages
const props = defineProps({
	messages: {
		type: Array,
		required: true,
	},
})

const container = ref(null)

const scrollToBottom = () => {
	if (container.value) {
		container.value.scrollTop = container.value.scrollHeight
	}
}

// Scroll to bottom whenever new messages arrive
onMounted(scrollToBottom)
onUpdated(scrollToBottom)
watchEffect(scrollToBottom)

const formatJSON = (obj) => {
	return JSON.stringify(obj, null, 2)
}

</script>
<style scoped>

	.chat-container {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 400px;
		/* Adjust as needed */
		overflow-y: auto;
		background-color: #1e1e1e;
		border: 2px solid black;
		border-radius: 8px;
		box-shadow: inset 0 0 10px #000000aa;
		padding: 8px;
		font-family: monospace;
	}

	.chat-row {
		padding: 6px;
		border-radius: 4px;
		margin-bottom: 4px;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.bg-dark {
		background-color: #2b2b2b;
	}

	.bg-darker {
		background-color: #242424;
	}

	.json-text {
		margin: 0;
		color: #e0e0e0;
	}

</style>
