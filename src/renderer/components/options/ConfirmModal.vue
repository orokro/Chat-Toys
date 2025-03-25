<!--
	ConfirmModal.vue
	----------------

	Modal with:
		- title
		- prompt text
		- list of buttons
-->
<template>

	<ModalWindowFrame
		:title="title"
		:width="400"
		:height="250"
	>
		
		<!-- our inner content wrapper -->
		<div
			class="modalContent"
			:class="{
				hasIcon: icon!=''
			}"
		>

			<!-- optional (material) icon as specified in props -->
			<div 
				v-if="icon!=''"
				class="icon"
			>
				<span class="material-icons">{{ icon }}</span>
			</div>

			<!-- the prompt -->
			<div class="prompt">
				{{ prompt }}
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
import ModalWindowFrame from './ModalWindowFrame.vue';

// lib misc
import { Modal } from 'jenesius-vue-modal';

// some props
const props = defineProps({
	
	// the title text
	title: {
		type: String,
		default: 'Are you sure?'
	},

	// the prompt text
	prompt: {
		type: String,
		default: 'Are you sure \' bout that?'
	},

	// the list of buttons
	buttons: {
		type: Array,
		default: () => []
	},

	// optional icon
	icon: {
		type: String,
		default: ''
	},

});

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

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

</script>
<style lang="scss" scoped>

	// fill modal
	.modalContent {

		// fill modal
		position: absolute;
		inset: 0px;

		// for debug
		/* border: 1px solid red; */

		// optional icon
		.icon {

			// fixed on top left
			position: absolute;
			top: 20px;
			left: 20px;
			width: 60px;
			height: 60px;

			// for debug
			/* border: 1px solid #CCC; */

			span {
				width: 60px;
				height: 60px;

				font-size: 60px;
				color: #333;
			}

		}// icon

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

		// when we have an icon, make room for it
		&.hasIcon {
			.prompt {
				inset: 20px 20px 60px 90px;
			}
		}

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
