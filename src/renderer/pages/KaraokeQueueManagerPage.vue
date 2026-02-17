<template>
	<div class="managerPage">
		<widget-container-modal/>
		<KaraokeQueueManager v-if="ready" />
		<div v-else class="loading">Loading Karaoke Manager...</div>
	</div>
</template>

<script setup>
import { ref, provide, onBeforeMount, onBeforeUnmount } from 'vue'
import { container as WidgetContainerModal } from "jenesius-vue-modal"; 
import ChatToysApp from '../scripts/ChatToysApp';
import KaraokeQueueManager from '../toys/KaraokeQueue/KaraokeQueueManager.vue';

const ready = ref(false);
let ctApp = null;

onBeforeMount(() => {
	ctApp = new ChatToysApp();
	provide('ctApp', ctApp);
	ready.value = true;
});

onBeforeUnmount(() => {
	if (ctApp) ctApp.end();
});
</script>

<style lang="scss">
// Global styles for the manager window
body {
	margin: 0;
	padding: 0;
	overflow: hidden;
}
.managerPage {
	width: 100vw;
	height: 100vh;
	background: #222;
	color: white;
}
.loading {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	font-family: sans-serif;
	font-size: 20px;
}
</style>
