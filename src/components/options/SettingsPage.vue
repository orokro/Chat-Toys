<!--
	SettingsPage.vue
	----------------

	This is the top level component for when the "General Settings" tab is active.

	This will be for things unrelated to the various toys.
-->
<template>
	
	<div class="page settingsPage">

		<PageBox
			title="General Settings"
			themeColor="lightblue"
		>
			<p>Configure generation plugin settings Here.</p>
			<p>I.E. not toy-specific settings</p>

			<div class="grayBox">
				<input type="color" v-model="bgColor" @input="saveColor" />
			</div>
		</PageBox>
	</div>
</template>
<script setup>

// vue
import { ref, onMounted } from 'vue'

// components
import PageBox from './PageBox.vue';

// the background color for the popup window
const bgColor = ref('#ffffff')

// save the background color to storage
const saveColor = () => {
	chrome.storage.sync.set({ bgColor: bgColor.value })
}

// load the background color from storage when the component is mounted
onMounted(() => {

	// chrome.storage.sync.get('bgColor', ({ bgColor: storedColor }) => {
	// 	if (storedColor) {
	// 		bgColor.value = storedColor
	// 	}
	// })
});

</script>
<style lang="scss" scoped>


</style>
