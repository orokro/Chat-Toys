<!--
	MediaWidget.vue
	---------------
	
	Shows pictures, gifs, and plays sounds.
-->
<template>

	<!-- the main box for the widget -->
	<div 
		v-if="ready"
		class="mediaWidget"
		:class="{ 
			idle: mode === 'IDLE',
			demoMode: demoMode,
			showTextShadow: socketSettingsRef?.chatterNameShadow
		}"
		:style="{
			'--chatterNameColor': socketSettingsRef?.chatterNameColor || '#00ABAE',
			'--chatterTextColor': socketSettingsRef?.chatterTextColor || '#FFFFFF',
			'--chatterNameFontSize': (socketSettingsRef?.chatterNameFontSize || 25) + 'px',
		}"
	>
		<!-- the main media image/gif -->
		<img 
			v-if="demoMode || (imagePath !== null && imageLoaded)"
			class="mediaImage"
			:src="demoMode ? 'builtin/yay.gif' : imagePath"
			@load="imageLoaded = true"
			:style="{
				transform: `scale(${scale})`,
				transformOrigin: 'top left'
			}"
		/>
		<img v-if="imagePath !== null && !imageLoaded" :src="imagePath" @load="imageLoaded = true" style="display:none" />

		<!-- the message / user name -->
		<div 
			v-if="socketSettingsRef?.showPatterName"
			class="messageText"
		>
			<span class="authorName">{{ demoMode ? 'yay!' : author }}</span> {{ demoMode ? ' lets goooooo!' : 'used !' + commandName }}
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
const demoMode = socketShallowRefReadOnly('demoMode', false);
const mode = socketShallowRefReadOnly(slugify('mode'), 'IDLE');
const author = socketShallowRefReadOnly(slugify('author'), '');
const commandName = socketShallowRefReadOnly(slugify('commandName'), '');
const soundPath = socketShallowRefReadOnly(slugify('soundPath'), null);
const imagePath = socketShallowRefReadOnly(slugify('imagePath'), null);
const volume = socketShallowRefReadOnly(slugify('volume'), 1);
const scale = socketShallowRefReadOnly(slugify('scale'), 1);

// track if the image has finished loading
const imageLoaded = ref(false);
watch(imagePath, () => {
	imageLoaded.value = false;
});

// keep track of the last sound we played to avoid double playing
let lastSoundPlayed = null;

// we only want to play the sound when we switch from IDLE to PLAY
// or if the soundPath arrives while we are already in PLAY mode
const maybePlaySound = () => {
	if(mode.value === 'PLAY' && soundPath.value !== null && soundPath.value !== lastSoundPlayed) {
		const audio = new Audio(soundPath.value);
		audio.volume = volume.value !== undefined ? volume.value : 1;
		audio.play().catch(e => console.error('Error playing audio:', e));
		lastSoundPlayed = soundPath.value;
	}

	if(mode.value === 'IDLE') {
		lastSoundPlayed = null;
	}
}

watch([mode, soundPath], maybePlaySound);

</script>
<style lang="scss" scoped>

	// the main box for the widget
	.mediaWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		transition: transform 0.25s ease-in-out, opacity 0.25s ease-in-out;
		transform: scale(1);
		opacity: 1;
		&.idle {
			opacity: 0;
		}

		&.demoMode {
			border: 1px dashed rgba(255, 255, 255, 0.5) !important;
			transform: scale(1);
		}

		// image positioning
		.mediaImage {
			position: absolute;
			top: 0;
			left: 0;
			
			// Fit to container while maintaining aspect ratio, anchored top-left
			width: 100%;
			height: 100%;
			object-fit: contain;
			object-position: top left;
		}

		// text settings
		.messageText {

			// position
			position: absolute;
			top: 0px;
			left: 0px;

			color: var(--chatterTextColor);

			// text settings
			font-size: var(--chatterNameFontSize);
			font-weight: bold;
			text-align: left;
			white-space: nowrap;

			.authorName {
				color: var(--chatterNameColor);
			}

			// Optional shadow
			&.showTextShadow {
				text-shadow: 0.1em 0.085em 0px black;
			}

		}// .messageText

		&.showTextShadow {
			.messageText {
				text-shadow: 0.1em 0.085em 0px black;
			}
		}

	}// .mediaWidget

</style>
