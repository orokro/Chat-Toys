<!--
	ShoutWidget.vue
	---------------

	Displays a message on screen when a user uses the
	!shout command in chat.

	!shout is like super chat in a way (displays an onscreen message),
	but uses channel points instead of money.
-->
<template>

	<!-- just a simple box -->
	<div 
		v-if="ready"
		class="shoutWidget"
		:class="{ 
			idle: shoutMode === 'IDLE',
		}"
	>
		<div class="messageText">
			<span class="user">{{ shoutMessage.user }}:</span> {{ shoutMessage.message }}
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

const thisSlug = 'chat';
const widgetSlug = 'shoutBox';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// set up our live-light code
try {
	keepAliveSocket(thisSlug, widgetSlug);
}catch(e){
	console.error(e);
}

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('chat', 'shoutWidgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const shoutMode = socketShallowRefReadOnly(slugify('shoutMode'), 'IDLE');
const shoutMessage = socketShallowRefReadOnly(slugify('shoutMessage'), '');
const soundPath = socketShallowRefReadOnly(slugify('soundPath'), null);

// we only want to play the sound when we switch from IDLE to PLAY
watch(shoutMode, (newVal) => {

	if(newVal === 'SHOWING' && soundPath.value !== null) {
		const audio = new Audio(soundPath.value);
		audio.play();
	}
});

</script>
<style lang="scss" scoped>

	// the main box for the widget
	.shoutWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		// debug bg
		/* background: rgba(255, 255, 255, 0.1); */

		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}

		// text settings
		.messageText {

			color: white;

			// text settings
			text-shadow: 2px 2px 0px black;
			font-size: 25px;
			font-weight: bold;
			text-align: left;
			/* white-space: nowrap; */

			span {
				color: #FFD700;
			}	

		}// .messageText

	}// .shoutWidget

</style>
