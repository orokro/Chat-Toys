<!--
	StreamStagePopup.vue
	--------------------

	This is the main component for the popup window.

	Basically this is the "stage" where the various toys appear.

	This is the popup window that is designed to be captured by OBS.
-->
<template>
	
	<!-- The container's style is bound to bgColor so it updates automatically -->
	<div :style="{ backgroundColor: bgColor }">
		<h2>Hello, World from Popup!</h2>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted } from 'vue';

// The background color for the popup window.
const bgColor = ref('#ffffff');

// fetch the background color from storage when the component is mounted
onMounted(() => {

	// Retrieve the saved background color from Chrome storage on mount.
	chrome.storage.sync.get("bgColor", ({ bgColor: savedBgColor }) => {
		if (savedBgColor) {
			bgColor.value = savedBgColor;
		}
	});

	// Listen for changes to the background color and update accordingly.
	chrome.storage.onChanged.addListener((changes) => {
		if (changes.bgColor) {
			bgColor.value = changes.bgColor.newValue;
		}
	});

});
</script>

<style scoped>
	/* You can add additional styles here if needed */
</style>
