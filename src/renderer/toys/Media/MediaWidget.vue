<!--
	HeadPatsWidget.vue
	------------------
	
	The icon that will periodically appear to allow chatters to claim points.
-->
<template>

	<!-- the main box for the widget -->
	<div 
		v-if="ready"
		class="mediaWidget"
		:class="{ 
			idle: mode === 'IDLE',
		}"
	>
		<!-- the main money - head pat gif -->
		<img 
			v-if="imagePath !== null"
			width="100%"
			class="mediaImage"
			:src="imagePath"
		/>

		<!-- the name of the user doing the pat -->
		<div class="messageText">
			{{ message }}
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, watch, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'media';
const widgetSlug = 'mediaBox';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('media', 'widgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const mode = socketShallowRefReadOnly(slugify('mode'), 'IDLE');
const message = socketShallowRefReadOnly(slugify('message'), '');
const soundPath = socketShallowRefReadOnly(slugify('soundPath'), null);
const imagePath = socketShallowRefReadOnly(slugify('imagePath'), null);

// we only want to play the sound when we switch from IDLE to PLAY
watch(mode, (newVal) => {

	if(newVal === 'PLAY' && soundPath.value !== null) {
		const audio = new Audio(soundPath.value);
		audio.play();
	}
});

</script>
<style lang="scss" scoped>

	// the main box for the widget
	.mediaWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}

		// text settings
		.messageText {

			// position
			position: absolute;
			top: 0px;
			left: 0px;

			color: white;

			// text settings
			text-shadow: 2px 2px 0px black;
			font-size: 25px;
			font-weight: bold;
			text-align: left;
			white-space: nowrap;

		}// .messageText

	}// .mediaWidget

</style>
