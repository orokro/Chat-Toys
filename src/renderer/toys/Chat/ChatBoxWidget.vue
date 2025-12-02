<!--
	ChatBoxWidget.vue
	-----------------

	Simple widget to show live chat messages on screen.
-->
<template>
	<!-- injected styles -->
	<div ref="styleInjector"></div>

	<!-- just a simple box -->
	<div 
		v-if="ready && socketSettingsRef?.enableChatBox"
		class="chatBoxWidget"
		:class="{
			disableBG: socketSettingsRef?.enableChatBoxImage==false,
			demoMode: demoMode,
			showTextShadow: socketSettingsRef?.chatTextShadow,
		}"
		:style="{
			border: '30 solid transparent',
			borderImageSource: `url(${chatFramePath})`,
			borderImageSlice: '200 fill',
			borderImageRepeat: 'stretch',
			'--fontSize': socketSettingsRef?.chatTextSize + 'px',
			'--pfpSize': socketSettingsRef?.pfpSize + 'px',
		}"		
	>
		<div class="messageText">
			<template 
				v-for="(message, index) in (demoMode ? demoChat : chatLog)"
				:key="message.id"
			>
				<div				
					v-if="!message.syslogger || (message.syslogger == true && socketSettingsRef?.showSystemMessages)"
					class="msgRow"
					:class="{
						isMember:message.isMember,
					}"
				>
					<!-- Profile Picture -->
					<div class="pfp-aligner">				
						<PfpImg
							v-if="socketSettingsRef?.showChatterPFP"
							:url="message.pfpUrl"
							:alt="message.author + ' profile picture'"
							:cache-enabled="socketSettingsRef?.cachePFPImages"
						/>
						<div v-html="injects.pfpInjects"></div>
					</div>

					<div class="message-contents">
						<span 
							v-if="socketSettingsRef?.showChatterNames"
							class="user"
							:class="{isMember:message.isMember}"
							:style="{
								color: socketSettingsRef?.chatNameColor,
							}"
						>
							{{ message.author }}:
							<span v-html="injects.userNameInjects"></span>
						</span>
						<br v-if="socketSettingsRef?.messageOnNewLine && socketSettingsRef?.showChatterNames"/>
						<span
							:style="{
								color: socketSettingsRef?.chatTextColor,
							}"
						>
							<!-- CHANGED: Replaced direct interpolation with the ParsedMessage component -->
							<ParsedMessage 
								:text="message.message" 
								:emojis="message.emojis" 
							/>
						</span>
						<div v-html="injects.messageBodyInjects"></div>
					</div>

					<div v-html="injects.chatRowInjects"></div>
				</div>
			</template>
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

// components
import PfpImg from './sub_components/PfpImg.vue';
import ParsedMessage from './sub_components/ParsedMessage.vue';

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
	console.log(socketSettingsRef.value);
});


// gets live sockets
const demoMode = socketShallowRefReadOnly('demoMode', false);
const chatLog = socketShallowRefReadOnly(slugify('chatLog'), '');
const chatFramePath = socketShallowRefReadOnly(slugify('chatFramePath'), null);

window.cl = chatLog;

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



function parseMultilineJSON(jsonString) {
  // Regex explanation:
  // /("(?:[^"\\]|\\.)*")/g
  // 1. Matches a "
  // 2. Matches any character that is NOT a " or \, OR matches an escaped character
  // 3. Matches the closing "
  
  const fixedString = jsonString.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
    // Inside the found string, replace literal newlines with escaped newlines
    return match.replace(/\n/g, "\\n");
  });

  return JSON.parse(fixedString);
}


// watch the socketSettingsRef.value.customChatTheme for changes. When it changes, inject the CSS into the styleInjector div.
const styleInjector = ref(null);
const injects = shallowRef({
	chatRowInjects: '',
	pfpInjects: '',
	contentsInjects: '',
	userNameInjects: '',
	messageBodyInjects: '',
	styleInjects: '',
});
watch(() => socketSettingsRef.value.customChatTheme, (newVal) => {
	if (styleInjector.value) {

		console.log('Updating chat box custom CSS', newVal);
		// get just the CSS
		injects.value = {
			chatRowInjects: '',
			pfpInjects: '',
			contentsInjects: '',
			userNameInjects: '',
			messageBodyInjects: '',
			styleInjects: '',
			...parseMultilineJSON(newVal || '{}')
		};
		
		styleInjector.value.innerHTML = `<style scoped>${injects.value.styleInjects}</style>`;
	}
}, { immediate: true });

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

		&.showTextShadow {
			.messageText {
				text-shadow: 0.05em 0.05em 0px black;
			}
		}

		// text settings
		.messageText {

			// fixed inside frame
			position: absolute;
			inset: 0px;
			
			color: white;

			// text settings
			
			font-size: var(--fontSize);
			font-weight: bold;
			text-align: left;
			/* white-space: nowrap; */

			span {
				/* color: #FFD700; */
			}	

			// clip overflow with no scroll bars
			overflow: hidden;

			// flex settings so the rows stack so new messages are at the bottom
			display: flex;
			flex-direction: column;
			justify-content: flex-end;

			// one of the message rows
			.msgRow {

				padding: 4px 8px;

				display: flex;
				flex-direction: row;
				justify-content: flex-start;

				// wrapper to align PFP
				.pfp-aligner {
					display: flex;
					align-items: center;
					justify-content: center;
					margin-right: 8px;
				}

				// styles for profile picture
				.chat-pfp {
					
					// for debug
					/* border: 2px solid black; */

					// size from settings
					height: var(--pfpSize) !important;
					width: var(--pfpSize) !important;

					// round
					border-radius: 50%;

					// margin to separate from text
					margin-right: 8px;

					// align with text
					vertical-align: middle;

					// prevent shrinking
					/* flex-shrink: 0; */
					

				}// .chat-pfp

				// to separate from the PFP
				.message-contents {

					.user {
						margin-bottom: 0px;
					}
				}// .message-contents

			}// .msgRow

		}// .messageText

	}// .chatBoxWidget

</style>
