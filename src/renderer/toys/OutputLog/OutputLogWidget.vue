<!--
	OutputLogWidget.vue
	-------------------

	This shows the various system logs in a widget, including:
	- system messages
	- info notes
	- errors
-->
<template>

	<!-- outermost log box -->
	<div 
		class="logBox"
		:class="{ 
			demoMode: demoMode,
		}"
		:style="{
			'--logBGColor': socketSettingsRef?.logBGColor || 'white',
			'--logBGOpacity': socketSettingsRef?.logBGOpacity || '0.5',
			'--logTextColor': socketSettingsRef?.logTextColor || 'white'
		}"
	>

		<!-- background layer, w/ opacity -->
		<div v-if="socketSettingsRef?.showLogBG" class="logBackground" />

		<div class="logList">
			
			<!-- loop through messages -->
			<div 
				v-for="msg in messages"
				class="logRow"
				:class="{ 
					'error': msg.type === 'error',
					'info': msg.type === 'info',
					'log': msg.type === 'log',					
				}"
				:key="msg.id"
			>
				<span>●</span>{{msg.text}}
			</div>
		</div>
	</div>
</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'log';
const widgetSlug = 'log';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('log', 'widgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const messages = socketShallowRefReadOnly('syslog', []);
const demoMode = socketShallowRefReadOnly('demoMode', false);

</script>
<style lang="scss" scoped>

	// main outer box
	.logBox {

		// fill parent widget container
		width: 100%;
		height: 100%;	

		// so we can position children abso-lutely
		position: relative;

		// allow nothing to escape
		overflow: hidden;
		border-radius: 10px;

		&.demoMode {
			border: 1px dashed rgba(255, 255, 255, 0.5) !important;
			transform: scale(1);
		}
		
		// for debug
		/* border: 1px solid white; */

		// fill parent container
		.logBackground {

			position: absolute;
			inset: 0px;
			background-color: var(--logBGColor);
			opacity: var(--logBGOpacity);

		}// .logBackground

		// fill parent container with hard-coded padding
		.logList {

			// space in
			position: absolute;
			inset: 10px;

			// hide scroll
			overflow-y: hidden;
			overflow-x: hidden;
			color: var(--logTextColor);

			// flex settings so the rows stack so new messages are at the bottom
			display: flex;
			flex-direction: column;
			justify-content: flex-end;

			// one of the log rows
			.logRow {

				// text settings
				color: var(--logTextColor);
				font-size: 12px;
				text-shadow: 2px 2px 0px black;
				
				// padding
				padding: 0px 5px;

				// log dot
				span {
					margin-right: 5px;
				}
				&.error {
					span {
						color: red;
					}
				}
				&.info {
					span {
						color: rgb(91, 157, 255);
					}
				}

				// alternate row colors
				&:nth-child(odd) {
					background-color: rgba(0, 0, 0, 0.1);
				}

			}// .logRow

		}// .logList

	}// .logBox

</style>
