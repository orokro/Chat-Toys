<!--
	RawChatPreview.vue
	------------------

	Component to make our chat settings page prettier with a formatted
	live view of the chat data as it comes in.
-->
<template>

	<!-- main container -->
	<div ref="container" class="chat-container">

		<!-- we'll reverse scroll and prioritize newer things on the bottom -->
		<div
			v-for="(msg, index) in messages.reverse()"
			:key="msg.id"
			:class="['chat-row', index % 2 === 0 ? 'bg-dark' : 'bg-darker']"
		>
			<!-- format the actual item with it's inherent white space -->
			<pre class="json-text">{{ formatJSON(msg) }}</pre>
		</div>
	</div>

</template>
<script setup>

// vue
import { onMounted, onUpdated, ref, watch } from 'vue'

// define some props
const props = defineProps({

	// our raw list of messages
	messages: {
		type: Array,
		required: true,
	},

});

// ref to the container DOM el for scroll manipulation
const container = ref(null)

// scroll to the bottom of the container
const scrollToBottom = () => {
	if (container.value) {
		container.value.scrollTop = container.value.scrollHeight
	}
}

// scroll to the bottom when mounted and updated
onMounted(scrollToBottom)
onUpdated(scrollToBottom)
watch(() => props.messages.length, scrollToBottom)

// format the JSON object to a string with tabs
// for better readability
const formatJSON = (obj) => {

	// BTW \t is tabs instead of spaces
	return JSON.stringify(obj, null, '\t') 
}

</script>
<style lang="scss" scoped>

	// main chat container
	.chat-container {

		// reverse the scroll / stacking direction for the rows via flex
		display: flex;
		flex-direction: column-reverse;
		overflow-y: scroll;

		// box settings
		max-height: 600px;
		background-color: #1e1e1e;
		border: 2px solid black;
		border-radius: 8px;
		box-shadow: inset 0 0 10px #000000aa;
		padding: 8px;

		// text settings
		font-family: monospace;

		// row for a chat data block
		.chat-row {

			// box settings
			padding: 6px;
			border-radius: 4px;
			margin-top: 4px;

			// text settings
			white-space: pre-wrap;
			word-break: break-word;

			// default background color
			background-color: #222222;

			// for the alternating row colors
			&:nth-child(odd) {
				background-color: #2e2e2e;
			}

			// the raw json text
			.json-text {
				margin: 0;
				color: #e0e0e0;
				font-weight: bold;
			}// .json-text

		}// .chat-row

	}// .chat-container
	
</style>
