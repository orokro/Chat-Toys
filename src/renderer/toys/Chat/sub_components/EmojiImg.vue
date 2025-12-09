<!--
	EmojiImage.vue
	--------------

	A Vue component that displays an emoji image from a given URL,
	with caching support to optimize loading times / minimize network requests.
-->
<template>

	<img
		:src="src"
		:alt="alt"
		referrerpolicy="no-referrer"
		:class="[
			'chat-emoji',
			{ 'chat-emoji--cached': fromCache }
		]"
	/>

</template>
<script setup>

// vue
import { ref, onMounted, watch } from 'vue';

// cache helper
import { getEmojiSource } from '../../emojiCache';

// props
const props = defineProps({

	// URL of the emoji image
	url: {
		type: String,
		required: true
	},

	// alt text for the image
	alt: {
		type: String,
		default: ''
	}
});

const src = ref(props.url);
const fromCache = ref(false);

// load initial + react if URL changes
async function load() {

	try {
		const result = await getEmojiSource(props.url);
		src.value = result.src;
		fromCache.value = result.fromCache;

	} catch (err) {
		console.error('[EmojiImg] failed to load emoji', err);
		src.value = props.url;
		fromCache.value = false;
	}
}

onMounted(load);

watch(
	() => props.url,
	() => {
		src.value = props.url;
		fromCache.value = false;
		load();
	}
);

</script>
<style lang="scss" scoped>

	// main emoji image styles
	.chat-emoji {

		// box styles
		display: inline-block;
		height: 28px;           
		width: auto;
		margin: 0 2px;

		// Aligns emoji with text baseline
		vertical-align: middle;

	}// .chat-emoji

	// you can tweak this however you want for debugging
	.chat-emoji--cached {

		// null operation:
		filter: none;

		// debug border
		/* outline: 1px solid lime; */

	}// .chat-emoji--cached

</style>
