<!--
	ParsedMessage.vue
	-----------------

	Parses emojis for a chat message and renders them inline.
-->
<template>

	<span class="message-content">

	  <template v-for="(token, i) in tokens" :key="i">

		<!-- Render Text -->
		<span v-if="token.type === 'text'">{{ token.content }}</span>
		
		<!-- Render Emoji -->
		<img 
			v-else-if="token.type === 'emoji'" 
			:src="token.content" 
			:alt="token.alt"
			class="chat-emoji"
		/>
	  </template>

	</span>

</template>
<script setup>

// vue
import { computed } from 'vue';

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

	// Regex to match your specific delimiter: &:CODE:;
	// The capturing group ( ) is important so split() includes the separator in the result
	const regex = /(&[a-zA-Z0-9_\-:]+;)/g;

	// "hello &:LUL:; world" -> ["hello ", "&:LUL:;", " world"]
	const parts = props.text.split(regex);
	
	return parts.map(part => {

		// Check if this part is one of our emoji tokens
		if (part.startsWith('&') && part.endsWith(';')) {

			// Extract code: "&:LUL:;" -> "LUL"
			const code = part.slice(1, -1); 
			const url = emojiMap.value.get(code);
 
			// If we found a matching URL in our map, it's an emoji
			if (url)
				return { type: 'emoji', content: url, alt: code };			
		}

		// Otherwise, it's just text (or a broken token)
		return { type: 'text', content: part };
	});

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
