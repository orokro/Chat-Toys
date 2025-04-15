<!--
	ChatBoxWidget.vue
	-----------------

	Simple widget to show live chat messages on screen.
-->
<template>

	<!-- just a simple box -->
	<div 
		v-if="ready"
		class="chatBoxWidget"
		:class="{
			disableBG: socketSettingsRef?.enableChatBoxImage==false,
			demoMode: demoMode
		}"
		:style="{
			border: '30 solid transparent',
			borderImageSource: `url(${chatFramePath})`,
			borderImageSlice: '200 fill',
			borderImageRepeat: 'stretch',
		}"		
	>
		<div class="messageText">
			<div 
				v-for="(message, index) in (demoMode ? demoChat : chatLog)"
				:key="message.id"
				class="msgRow"
			>
				<span 
					v-if="socketSettingsRef?.showChatterNames"
					class="user"
					:class="{isMember:message.isMember}"
					:style="{
						color: socketSettingsRef?.chatNameColor,
					}"
				>
					{{ message.author }}:
				</span>
				<span
					:style="{
						color: socketSettingsRef?.chatTextColor,
					}"
				>
					{{ message.message }}
				</span>
			</div>
		</div>
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, watch, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'chat';
const widgetSlug = 'liveChat';
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
const socketSettingsRef = useToySettings('chat', 'chatWidgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const demoMode = socketShallowRefReadOnly('demoMode', false);
const chatLog = socketShallowRefReadOnly(slugify('chatLog'), '');
const chatFramePath = socketShallowRefReadOnly(slugify('chatFramePath'), null);


// set up demo logic if we're in demo mode.
const demoChat = shallowRef([]);
let demoInterval = 0;
watch(demoMode, (newVal) => {

	if (newVal) {
		demoInterval = setInterval(()=>{
			const chatItems = [...demoChat.value];
			chatItems.push({
				"id": Math.floor(Math.random() * 1000000),
				"author": ['Dude', 'Demo Girl', 'Buddy4Real', 'gOOber', 'sn@rk'][Math.floor(Math.random() * 5)],
				"message": ['Hi hi', 'Whats up', 'I love this', 'tuesday', 'true', 'no u'][Math.floor(Math.random() * 6)],
				"isMember": false
			});
			while(chatItems.length > 10)
				chatItems.shift();
			demoChat.value = chatItems;

		}, 1000);
		
	} else {
		
		clearInterval(demoInterval);
		demoChat.value = [];
	}
});
</script>
<style lang="scss" scoped>

	// the main box for the widget
	.chatBoxWidget {

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

		// try css slicing
		border: 60px solid transparent; 
		box-sizing: border-box;

		// disable the background/border if user wants
		&.disableBG {
			background: none !important;
			border: 0px none !important;
			border-image: none !important;

			&.demoMode {
				border: 1px dashed rgba(255, 255, 255, 0.5) !important;
				transform: scale(1);
			}
		}

		// text settings
		.messageText {

			// fixed inside frame
			position: absolute;
			inset: 0px;
			
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

			// clip overflow with no scroll bars
			overflow: hidden;

			// flex settings so the rows stack so new messages are at the bottom
			display: flex;
			flex-direction: column;
			justify-content: flex-end;

		}// .messageText

	}// .chatBoxWidget

</style>
