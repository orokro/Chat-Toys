<!--
	ParsedMessage.vue
	-----------------

	Parses emojis for a chat message and renders them inline.
-->
<template>

	<span class="message-content">

		<template v-for="(token, i) in tokens" :key="i">

			<span v-if="token.type === 'text'">{{ token.content }}</span>

			<EmojiImg
				v-else-if="token.type === 'emoji'"
				:url="token.content"
				:alt="token.alt"
			/>

			<br v-else-if="token.type === 'br'" />

		</template>
		<div v-html="injects.messageBodyInjects"></div>

	</span>

</template>
<script setup>

// vue
import { computed } from 'vue';

// components
import EmojiImg from './EmojiImg.vue';

// define props
const props = defineProps({

	// The message text containing emoji codes
	text: {
		type: String,
		required: true
	},

	// Array of available emojis with { code, url }
	emojis: {
		type: Array,
		default: () => []
	},

	// raw html to inject
	injects: {
		type: Object,
		default: () => ({})
	}
});


// 1. Create a dictionary for O(1) emoji lookup
const emojiMap = computed(() => {
	const map = new Map();
		props.emojis.forEach(e => {
		map.set(e.code, e.url);
	});
	return map;
});


// 2. Parse the string into tokens
const tokens = computed(() => {

	if (!props.text)
		return [];

	const regex = /(&[a-zA-Z0-9_\-:]+;)/g;

	const parts = props.text.split(regex);

	const finalTokens = [];

	parts.forEach(part => {

		// Emoji token?
		if (part.startsWith('&') && part.endsWith(';')) {

			const code = part.slice(1, -1);
			const url = emojiMap.value.get(code);

			if (url) {
				finalTokens.push({
					type: 'emoji',
					content: url,
					alt: code
				});
				return;
			}
		}

		// TEXT token — now handle line breaks
		if (part.includes('\n')) {

			const lines = part.split('\n');

			lines.forEach((line, idx) => {
				// push text part
				if (line.length > 0) {
					finalTokens.push({
						type: 'text',
						content: line
					});
				}
				// if not the last line, push <br/>
				if (idx < lines.length - 1) {
					finalTokens.push({
						type: 'br'
					});
				}
			});

		} else {
			// Normal plain text
			finalTokens.push({
				type: 'text',
				content: part
			});
		}

	});

	return finalTokens;

});

</script>
<style lang="scss" scoped>

	.chat-emoji {

		// box styles
		display: inline-block;
		height: 28px;           
		width: auto;
		margin: 0 2px;

		// Aligns emoji with text baseline
		vertical-align: middle;

	}// .chat-emoji

</style>
