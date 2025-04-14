<!--
	HeadPatsWidget.vue
	------------------
	
	The icon that will periodically appear to allow chatters to claim points.
-->
<template>

	<!-- auto sizer so we can lazily scale the widget lol -->
	<AutoSizer :targetWidth="200" v-model="scale">

		<!-- box to scale -->
		<div
			class="scaleBox"
			
			:style="{
				transform: `translate(-50%, -50%) scale(${scale})`,
				height: showProfilePicture ? '250px' : '200px'
			}"
		>
			<!-- the main box for the widget -->
			<div 
				v-if="ready"
				class="headPatsWidget"
				:class="{ 
					idle: mode === 'IDLE',
					showProfilePicture: showProfilePicture
				}"
				:style="{
					height: showProfilePicture ? '250px' : '200px'
				}"
			>
				<!-- only show this if this is the user head pat -->
				<template v-if="showProfilePicture">
					<img 
						class="profilePicture"
						:src="userImagePath"
						alt="channel points icon"
						width="120"
					/>
					<div class="targetUserName">
						{{ currentPatData?.pattee }}
					</div>
				</template>

				<!-- the main money - head pat gif -->
				<img 
					class="headPatImage"
					src="/builtin/headpat-hand.gif"
					alt="head pat icon"
				/>

				<!-- the name of the user doing the pat -->
				<div class="patUserName">
					<span>{{ currentPatData?.patter }}</span> pats
				</div>

			</div>
		</div>
	</AutoSizer>

</template>
<script setup>

// vue
import { ref, watch, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// other components
import AutoSizer from '@components/AutoSizer.vue';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

// inherit scale from AutoSizer
const scale = ref(1);

const thisSlug = 'headPat';
const widgetSlug = 'streamer';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

	// true if we should show the user profile picture
	showProfilePicture: {
		type: Boolean,
		default: false
	},

	// disable the keep-alive code for this widget
	noKeepAlive: {
		type: Boolean,
		default: false
	}
});


// set up our live-light code
if(props.noKeepAlive === false){

	// keep alive the socket
	keepAliveSocket(thisSlug, widgetSlug);
}

// gets our settings
const ready = ref(false);
const boxString = props.showProfilePicture ? 'chatterWidgetBox' : 'streamerWidgetBox';
const socketSettingsRef = useToySettings('head-pat', boxString, emit, () => {
	ready.value = true;
});

watch(socketSettingsRef, (newVal) => {
	// console.log('channel-points settings updated');
	// console.log(newVal);
});


const mode = computed(()=>{
	return props.showProfilePicture ? chatterMode.value : streamerMode.value;
});

const currentPatData = computed(()=>{
	return props.showProfilePicture ? currentChatterPat.value : currentPat.value;
});

// // gets live sockets
// const claimCommand = socketShallowRefReadOnly(slugify('claimCommand'), '');
// const claimsLeft = socketShallowRefReadOnly(slugify('claimsLeft'), 0);
const userImagePath = socketShallowRefReadOnly(slugify('userImagePath'), '');
const streamerMode = socketShallowRefReadOnly(slugify('streamerMode'), 'IDLE');
const chatterMode = socketShallowRefReadOnly(slugify('chatterMode'), 'IDLE');
const currentPat = socketShallowRefReadOnly(slugify('currentPat'), null);
const currentChatterPat = socketShallowRefReadOnly(slugify('currentChatterPat'), null);

</script>
<style lang="scss" scoped>

	// box used to scale the widget
	.scaleBox {
		
		// same size as the default widget scale
		width: 200px;
		
		// center in the widget
		position: absolute;
		top: 50%;
		left: 50%;
		
	}// .scaleBox

	// the main box for the widget
	.headPatsWidget {

		// fixed size (if the user wants to adjust size we'll use transforms)
		width: 200px;

		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}

		color: white;

		// the actual head pat image
		.headPatImage {
			position: absolute;
			top: 20px;

		}// .headPatImage

		// show the profile picture of users
		.profilePicture {

			// slightly below the hand
			position: absolute;
			top: 60px;

			// glow
			filter: drop-shadow(0 0 5px white);

		}// .profilePicture

		// the name of the user doing the pat
		.patUserName {

			// force on top
			position: absolute;
			top: 0px;
			left: 50%;
			transform: translateX(-50%);
			width: 100%;			

			span {
				color: #FFD700;
			}			

		}// .patUserName

		// for when another chat user is being patted, their name
		.targetUserName {

			// force on bottom
			position: absolute;
			bottom: 0px;
			left: 50%;
			transform: translateX(-50%);
			width: 100%;

		}// .targetUserName
		
		// text settings
		.patUserName, .targetUserName {

			text-shadow: 2px 2px 0px black;
			font-size: 25px;
			font-weight: bold;
			text-align: left;
			white-space: nowrap;

		}// .patUserName, .targetUserName

	}// .headPatsWidget

</style>
