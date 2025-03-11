<!--
	Options.vue
	-----------

	This is the main component for the options page.
-->
<template>
	<div>
		<h2>Extension Settings</h2>
		<input type="color" v-model="bgColor" @input="saveColor" />
	</div>
</template>
<script setup>

// vue
import { ref, onMounted } from 'vue'

// the background color for the popup window
const bgColor = ref('#ffffff')

// save the background color to storage
const saveColor = () => {
	chrome.storage.sync.set({ bgColor: bgColor.value })
}

// load the background color from storage when the component is mounted
onMounted(() => {

	chrome.storage.sync.get('bgColor', ({ bgColor: storedColor }) => {
		if (storedColor) {
			bgColor.value = storedColor
		}
	})
});

</script>
<style scoped>


</style>
