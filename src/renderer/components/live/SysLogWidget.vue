<!--
	SysLogWidget.vue
	----------------

	This shows the various system logs in a widget, including:
	- system messages
	- info notes
	- errors
-->
<template>

	<!-- outermost log box -->
	<div 
		class="logBox"
		:style="{
			'--logBGColor': generalSettings?.logBGColor || 'white',
			'--logBGOpacity': generalSettings?.logBGOpacity || '0.5',
			'--logTextColor': generalSettings?.logTextColor || 'white'
		}"
	>

		<!-- background layer, w/ opacity -->
		<div class="logBackground" />

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

//  the messages list
const messages = socketShallowRefReadOnly('syslog', []);

const generalSettings = socketShallowRefReadOnly('general-settings', {});

console.log('syslog messages', messages);
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
