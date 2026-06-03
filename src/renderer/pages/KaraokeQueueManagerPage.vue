<!--
	KaraokeQueueManagerPage.vue
	---------------------------

	Thin wrapper window for the Karaoke Queue manager pop-out.

	This window intentionally does NOT construct a ChatToysApp. The manager
	component talks to the toy entirely through cross-window socket refs, so
	there's no need to spin up the full toy runtime (ToyManager, chat/command
	processors, connection managers) just to render this UI. See
	KaraokeQueueManager.vue for the details.
-->
<template>
	<div class="managerPage">
		<widget-container-modal/>
		<KaraokeQueueManager />
	</div>
</template>

<script setup>
import { container as WidgetContainerModal } from "jenesius-vue-modal";
import KaraokeQueueManager from '../toys/KaraokeQueue/KaraokeQueueManager.vue';
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
