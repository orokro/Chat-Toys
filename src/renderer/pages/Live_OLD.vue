<!--
	Live.vue
	--------

	This is the root component for the live page, that will be compiled and served from Express
	in the final build, so that OBS can use it as a browser source.
-->
<template>

	<div 
		class="pageContainer"
		:class="{ 'blackBG': blackBG }"
	>
		<h1 :style="{color: '#00ABAE'}">OBS Version {{ obsVersion }}</h1>
		<h1>Live {{ socketTest }}</h1>
		<h2>2 {{ asdasd }}</h2>
		<ChannelPointsWidget

		></ChannelPointsWidget>

		<pre>{{ generalSettingsJSON }}</pre>

		
	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';
import { socketRef, socketShallowRef } from 'socket-ref';

// include the demo channel points widget
import ChannelPointsWidget from '../toys/ChannelPoints/ChannelPointsWidget.vue';

// local state
const blackBG = ref(false);

// check if our URL has &blackbg=true
if (window.location.search.toLocaleLowerCase().includes('blackbg=true')) {
	blackBG.value = true;
}

const socketTest = socketRef('test', 'foo');
const asdasd = socketRef('test2', 'foo');

window.st = socketTest;

const generalSettingsJSON = socketRef('general-settings', 'foo');
const json = socketRef('chat-settings', 'foo');

const obsVersion = ref('unknown');
setTimeout(()=>{
	obsVersion.value = window.obsstudio?.pluginVersion;
}, 1000);	

</script>
<style lang="scss" scoped>

	// main page wrapper
	.pageContainer {

		// fill area
		position: absolute;
		inset: 0px;

		&.blackBG {
			background: black;
		}

		h1 {
			color: black;
		}

	}// .pageContainer

</style>
