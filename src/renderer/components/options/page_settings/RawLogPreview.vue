<!--
	RawLogPreview.vue
	-----------------

	Component to display an array as a live scrolling log, in a pretty widget.
-->
<template>

	<!-- main container -->
	<div ref="container" class="log-container">

		<!-- we'll reverse scroll and prioritize newer things on the bottom -->
		<div
			v-for="(msg, index) in messages.reverse()"
			:key="msg.id"
			:class="['log-row', index % 2 === 0 ? 'bg-dark' : 'bg-darker']"
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
	.log-container {

		// reverse the scroll / stacking direction for the rows via flex
		display: flex;
		flex-direction: column-reverse;
		overflow-y: scroll;

		// box settings
		min-height: 200px;
		max-height: 600px;
		background-color: #1e1e1e;
		border: 2px solid black;
		border-radius: 8px;
		box-shadow: inset 0 0 10px #000000aa;
		padding: 8px;

		// text settings
		font-family: monospace;

		// mac-style scrollbars
		&::-webkit-scrollbar {
			width: 8px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
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

		// row for a chat data block
		.log-row {

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

		}// .log-row

	}// .log-container
	
</style>
