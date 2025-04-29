<!--
	StreamsListModal.vue
	--------------------

	Shows the list of YouTube thumbnails for the streams a user has participated in.
-->
<template>

	<ModalWindowFrame
		:title="title"
		:width="800"
		:height="600"
	>
		
		<!-- our inner content wrapper -->
		<div
			class="modalContent"
		>
			<!-- the prompt -->
			<div class="prompt">
				{{ promptText }}
			</div>


			<div class="streamsListbox">
				<div 
					v-for="stream in userData.streams" 
					:key="stream" 
					style="display: flex; flex-direction: column; align-items: center; width: 200px;"
				>
					<img 
						:src="`https://img.youtube.com/vi/${stream}/hqdefault.jpg`" 
						alt="Stream Thumbnail" 
						style="width: 100%; border-radius: 8px; cursor: pointer;"
						@click="openLink(`https://www.youtube.com/watch?v=${stream}`)"
					/>

					<div 
						class="fakeLink" 
						@click="openLink(`https://youtu.be/${stream}`)"
						style="margin-top: 8px; color: blue; text-decoration: underline; cursor: pointer;"
						>
							youtu.be/{{ stream }}
					</div>
				</div>
				
			</div>

			<!-- the buttons along hte bottom -->
			<div 
				ref="buttonsBar"
				class="buttons"
				tabindex="0"
			>
				<button
					v-for="button, index in buttons"
					:key="button"
					:class="{
						primary: index==0
					}"
					@click="buttonClicked(button, index)"
				>
					{{ button }}
				</button>
			</div>
		</div>


	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

// components
import ModalWindowFrame from '@components/options/ModalWindowFrame.vue';

// lib misc
import { Modal } from 'jenesius-vue-modal';

// some props
const props = defineProps({
	
	userData: {
		type: Object,
		default: null
	},

});

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

// hard coded buttons
const buttons = [
	'OK',
];

// the title and prompt text
const title = `Streams ${props.userData.display_name} has participated in:`;
const promptText = `The user, ${props.userData.display_name}, has participated in the following streams:`;


// ref to the buttons bar so we can focus on it
const buttonsBar = ref(null);


// when user clicks a button
function buttonClicked(button, index){
	emit(Modal.EVENT_PROMPT, {button, index});
}


// when user presses enter, we should send the first button
const windowKeyEventFn = (e) => {
	if(e.key === 'Enter'){
		buttonClicked(props.buttons[0], 0);
	}
};


// when the component is mounted we should add an event listener for enter and send whatever the first button is
onMounted(() => {
	window.addEventListener('keydown', windowKeyEventFn);
	buttonsBar.value.focus();
});


// we should also clean up event listeners before unmounting
onUnmounted(() => {
	window.removeEventListener('keydown', windowKeyEventFn);
});


/**
 * Open a link in the default browser
 * 
 * @param url {string} - The URL to open
 */
const openLink = (url) => {
	electronAPI.openExternal(url);
};


</script>
<style lang="scss" scoped>

	.fakeLink {
		
		margin-top: 1px;
		color: rgb(0, 47, 255);
		font-weight: bold;
		cursor: pointer;
		
		&:hover {
			text-decoration: underline;
		}    
	
	}// .fakeLink

	// fill modal
	.modalContent {

		// fill modal
		position: absolute;
		inset: 0px;

		// the prompt
		.prompt {

			// fill area under icon
			position: absolute;
			inset: 20px 20px 60px 20px;
			text-align: left;
			font-size: 20px;

			// for debug
			/* border: 1px solid red; */

		}// .prompt

		.streamsListbox {

			border-radius: 10px;
			background: rgba(0, 0, 0, 0.1);
			padding: 20px;
			overflow: clip;

			overflow-y: scroll;
			position: absolute;
			inset: 60px 20px 60px 20px;

			display: flex;
			flex-wrap: wrap;
			gap: 30px;
			
			// mac-style scrollbars
			&::-webkit-scrollbar {
				width: 14px;
				
			}

			&::-webkit-scrollbar-track {
				background: transparent;
				background: #E5E5E5;
				border-radius: 0px 8px 8px 0px;
			}

			&::-webkit-scrollbar-thumb {
				background-color: rgba(120, 120, 120, 0.3);
				border-radius: 6px;
				transition: background-color 0.2s ease-in-out;
			}

			&:hover::-webkit-scrollbar-thumb,
			&:active::-webkit-scrollbar-thumb {
				background-color: rgba(120, 120, 120, 0.6);
			}
			
		}// streamsListbox

		// put buttons bar along the bottom, slightly gray
		.buttons {

			// disable the default outline
			outline: none;

			// fill bottom with a gray box
			position: absolute;
			inset: auto 0px 0px 0px;
			background: #EEE;
			height: 50px;

			// space buttons nicely
			display: flex;
			justify-content: flex-start;
			flex-direction: row-reverse;
			align-items: center;
			gap: 10px;
			padding-right: 10px;

			// make buttons look pretty
			button {

				// nice padding, rounded corners, and pointer cursor
				padding: 5px 10px;
				border-radius: 5px;
				cursor: pointer;

				// nice vertical gradient
				background: linear-gradient(180deg, #FFF, #DDD);
				text-transform: uppercase;

				// mm that primary tho
				&.primary {
					background: linear-gradient(180deg, #05dee2, #00ABAE);
					font-weight: bolder;
					color: white;
				}

				&:hover {
					background: linear-gradient(180deg, #f4fbff, #c4d0d6);
				}

			}// button

		}// .buttons

	}// .modalContent

</style>
