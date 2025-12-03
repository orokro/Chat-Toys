<!--
	PfpImg.vue
	----------

	A Vue component to display a profile picture (PFP) with caching support.
	Handles loading the image from a URL and caches it to improve performance
	as well as reduce network requests.
-->
<template>

	<div class="pfp-container">
		<img
			:src="src"
			:alt="alt"
			referrerpolicy="no-referrer"
			:class="[
				'chat-pfp',
				{ 'chat-pfp--cached': fromCache }
			]"
		/>
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, watch } from 'vue';

// cache helper
import { getPfpSource } from './pfpCache'; // adjust path as needed

const props = defineProps({
	url: {
		type: String,
		required: true
	},
	alt: {
		type: String,
		default: ''
	},
	cacheEnabled: {
		type: Boolean,
		default: true
	},
});

const src = ref(props.url);
const fromCache = ref(false);

async function load() {
	if (!props.url) {
		src.value = '';
		fromCache.value = false;
		return;
	}

	try {
		const result = await getPfpSource(props.url, {
			cacheEnabled: props.cacheEnabled
		});
		src.value = result.src;
		fromCache.value = result.fromCache;
	} catch (err) {
		console.error('[PfpImg] failed to load PFP', err);
		src.value = props.url;
		fromCache.value = false;
	}
}

onMounted(load);

watch(
	() => [props.url, props.cacheEnabled],
	() => {
		// Reset to raw URL while we resolve cache
		src.value = props.url;
		fromCache.value = false;
		load();
	}
);

</script>
<style lang="scss" scoped>
	
	// Debug border for cached avatars; tweak/remove as needed
	.chat-pfp--cached {

		// for debug
		/* outline: 1px solid lime; */
	}

</style>
