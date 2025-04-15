<!--
	SwarmWidget.vue
	---------------

	If a swarm is active, shows the swarm messages.
-->
<template>

	<!-- just a simple box -->
	<div 
		v-if="ready"
		class="swarmBoxWidget"
		:class="{
			disableBG: socketSettingsRef?.enableChatBoxImage==false,
			idle: swarmMode === 'IDLE',
			demoMode: demoMode,
		}"	
	>
	
		<div 
			v-for="(message, index) in (demoMode ? demoSwarm : swarmLog)"
			:key="message.id"
			class="messageText"
			:style="{
				left: `${message.pos.x}%`,
				top: `${message.pos.y}%`,
			}"
		>
			<span 
				v-if="socketSettingsRef?.showChatterNames"
				class="user"
				:class="{isMember:message.isMember}"
				:style="{
					color: socketSettingsRef?.chatNameColor,
				}"
			>
				{{ message.userName }}:
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
</template>
<script setup>

// vue
import { ref, shallowRef, watch, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'chat';
const widgetSlug = 'swarmBox';
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
const socketSettingsRef = useToySettings('chat', 'swarmWidgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const demoMode = socketShallowRefReadOnly('demoMode', false);
const swarmLog = socketShallowRefReadOnly(slugify('swarmLog'), '');
const swarmMode = socketShallowRefReadOnly(slugify('swarmMode'), null);

// set up demo logic if we're in demo mode.
const demoSwarm = shallowRef([]);
let demoInterval = 0;
watch(demoMode, (newVal) => {

	if (newVal) {
		demoInterval = setInterval(()=>{
			const swarmItems = [...demoSwarm.value];

			// pick a random % position to show the message
			const x = parseInt(Math.random()*60, 10)+20;
			const y = parseInt(Math.random()*60, 10)+20;
			swarmItems.push({
				id: Math.floor(Math.random() * 1000000),
				timestamp: Date.now(),
				userName: ['Dude', 'Demo Girl', 'Buddy4Real', 'gOOber', 'sn@rk'][Math.floor(Math.random() * 5)],
				userID: Math.floor(Math.random() * 1000000),
				message: ['Hi hi', 'Whats up', 'I love this', 'tuesday', 'true', 'no u'][Math.floor(Math.random() * 6)],
				pos: { x, y },
			});

			while(swarmItems.length > 10)
				swarmItems.shift();
			demoSwarm.value = swarmItems;

		}, 1000);
		
	} else {		
		clearInterval(demoInterval);
		demoSwarm.value = [];
	}
});

</script>
<style lang="scss" scoped>

	// the main box for the widget
	.swarmBoxWidget {

		// fill parent
		width: 100%;
		height: 100%;
		z-index: 9001;

		// reset stacking context
		position: relative;

		opacity: 1;
		&.idle {
			opacity: 0;
		}

		&.demoMode {
			border: 1px dashed rgba(255, 255, 255, 0.5) !important;
			opacity: 1 !important;
		}
		
		// text settings
		.messageText {

			// fixed inside frame
			position: absolute;
			transform: translate(-50%, -50%);
			
			color: white;

			// text settings
			text-shadow: 2px 2px 0px black;
			font-size: 25px;
			font-weight: bold;
			text-align: center;			

			min-width: 600px;
			max-height: 60px;
			line-height: 28px;

			// truncate with ellipse
			/* white-space: nowrap; */
			overflow: hidden;
			text-overflow: ellipsis;
			span {
				color: #FFD700;
			}	

			// clip overflow with no scroll bars
			overflow: hidden;

			// play this animation forward, once
			animation: fadeInOut 3s ease-in-out forwards;

		}// .messageText

	}// .swarmBoxWidget

	/*
		below are the keyframes for an animation where...
		the div starts off scaled 0, then quickly scales to 1
		it also starts off with a 0 opacity, then quickly fades in
		but also fads out much longer
	*/
	@keyframes fadeInOut {
		0% {
			transform: translate(-50%, -50%) scale(0);
			opacity: 0;
		}
		10% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		90% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 0;
		}
	}

</style>
