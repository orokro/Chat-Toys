<!--
	PrizeWheelWidget.vue
	--------------------

	The widget for the prize wheel toy system
-->
<template>

	<!-- auto sizer so we can lazily scale the widget lol -->
	<FixedAutoSizer
		:targetWidth="200"
		:targetHeight="222"
		v-model="scale"
	>

		<!-- box to scale -->
		<div 
			class="scaleBox" 
			:style="{
				transform: `translate(-50%, -50%) scale(${scale})`,
				'--rot': `${rotation}deg`,
			}"
		>
			<!-- just a simple box -->
			<div 
				v-if="ready"
				class="prizeWheelWidget" 
				:class="{ 
					idle: (wheelMode === 'IDLE') && (socketSettingsRef?.alwaysShowWheel == false),
				}"
				:style="{
					backgroundImage: `url(${wheelImagePath})`,
				}"
			>
				
				<!-- wheel -->
				<svg 
					class="wheel"
					:width="svgSize"
					:height="svgSize"
					:viewBox="`0 0 ${svgSize} ${svgSize}`"
				>
					<!-- Empty Circle if no items -->
					<template v-if="finalItems.length === 0">

						<!-- basic circle if no items -->
						<circle
							:cx="svgSize / 2"
							:cy="svgSize / 2"
							:r="diameter / 2"
							fill="#d3d3d3"
						/>
					</template>

					<!-- Draw slices -->
					<template v-else>
						<g :transform="`translate(5, 5)`">

							<template v-for="(slice, i) in slices" :key="i">

								<path :d="slice.path" :fill="adjustedColors()[i]" />
								<text
									:x="radius * 1.6"
									:y="radius"
									text-anchor="middle"
									alignment-baseline="middle"
									:transform="`rotate(${slice.textAngle+0}, ${radius}, ${radius})`"
									font-size="5"
									fill="black"
								>
									<g :transform="`scale(1.5)`">
										{{ slice.label }}
									</g>
								{{ slice.label }}
								</text>

								</template>
							</g>
					</template>
				</svg>

				<!-- text items -->
				<div class="spinnerMessage messageText">
					<span>{{ spinMessage }}</span> spins the wheel
				</div>
				<div class="spinnerItem messageText">{{ spinItem }}</div>

				<!-- the center circle & flipper thing -->
				<div class="centerCircle"></div>
				<div 
					class="flipper"
					:style="{
						backgroundImage: `url(${wheelImagePath})`,
					}"
				></div>

			</div>
		</div>
	</FixedAutoSizer>

</template>
<script setup>

// vue
import { ref, watch, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// other components
import AutoSizer from '@components/AutoSizer.vue';
import FixedAutoSizer from '@components/FixedAutoSizer.vue';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'prizeWheel';
const widgetSlug = 'wheel';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

// autosize scale
const scale = ref(1);

watch(scale, (newVal) => {
	// set the scale on the widget
	console.log('scale', newVal);
});
const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('prize-wheel', 'widgetBox', emit, () => {
	ready.value = true;
});


// wheel settings
const items = ref(['really cool prize', 'another cool prize', 'even more cool prizes']);
const colors = ref([]);
const diameter = 150;
const radius = diameter / 2;
const svgSize = diameter + 10;

// default colors for wheel if user doesn't set any
const defaultColors = ['#d3d3d3', '#808080', '#ffffff'];

// gets live sockets
const wheelImagePath = socketShallowRefReadOnly(slugify('wheelImagePath'), null);
const wheelSoundPath = socketShallowRefReadOnly(slugify('wheelSoundPath'), null);
const wheelMode = socketShallowRefReadOnly(slugify('wheelMode'), 'IDLE');
const rotation = socketShallowRefReadOnly(slugify('rotation'), 0);
const spinMessage = socketShallowRefReadOnly(slugify('spinMessage'), '');
const spinItem = socketShallowRefReadOnly(slugify('spinItem'), '');

// the audio
let audio = null;

// update the audio if its changes
watch(wheelSoundPath, (newVal) => {
	audio = new Audio(wheelSoundPath.value);
});

// we only want to play the sound when we switch from IDLE to PLAY
watch(spinItem, (newVal) => {

	// load the sound if it exists
	if(audio==null) {
		audio = new Audio(wheelSoundPath.value);
	}
	
	// make sure audio is reset to start
	audio.currentTime = 0;
	audio.play();	
});


/**
 * If the user doesn't provide that many items, this function will repeat the items
 * 
 * @param {Array<String>} baseItems  - the base items to repeat	
 */
function repeatItems(baseItems) {
	const count = baseItems.length;
	if (count === 0) return [];
	if (count === 1) return Array(6).fill(baseItems[0]);
	if (count === 2) return Array.from({ length: 6 }, (_, i) => baseItems[i % 2]);
	if (count === 3) return Array.from({ length: 6 }, (_, i) => baseItems[i % 3]);
	if (count === 4) return Array.from({ length: 8 }, (_, i) => baseItems[i % 4]);
	if (count === 5) return Array.from({ length: 10 }, (_, i) => baseItems[i % 5]);
	return baseItems;
}


// the computed list of items & count for the wheel
const finalItems = computed(() => repeatItems(socketSettingsRef.value.wheelItems));
const totalSlices = computed(() => finalItems.value.length);


/**
 * This function will adjust the colors of the wheel based on the number of slices
 */
function adjustedColors() {

	const base = socketSettingsRef.value.wheelColors.length > 0 ? [...socketSettingsRef.value.wheelColors] : [...defaultColors];
	const result = [];
	for (let i = 0; i < totalSlices.value; i++) {
		result.push(base[i % base.length]);
	}
	// Prevent first and last being same if 3 or more colors
	if (base.length >= 3 && result[0] === result[result.length - 1]) {
		const secondLast = result[result.length - 2];
		const options = base.filter(c => c !== result[0] && c !== secondLast);
		if (options.length > 0) result[result.length - 1] = options[0];
	}
	return result;
}


/**
 * The array of prize items to display on the wheel,
 * with the start and end angles for each slice
 */
const slices = computed(() => {
	const items = finalItems.value;
	const anglePerSlice = 360 / items.length;
	return items.map((label, i) => {
		const startAngle = i * anglePerSlice;
		const endAngle = startAngle + anglePerSlice;
		const largeArcFlag = anglePerSlice > 180 ? 1 : 0;
		const x1 = radius + radius * Math.cos((Math.PI * startAngle) / 180);
		const y1 = radius + radius * Math.sin((Math.PI * startAngle) / 180);
		const x2 = radius + radius * Math.cos((Math.PI * endAngle) / 180);
		const y2 = radius + radius * Math.sin((Math.PI * endAngle) / 180);

		return {
			label,
			startAngle,
			path: `M${radius},${radius} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2} Z`,
			textAngle: startAngle + anglePerSlice / 2,
		};
	});
});

</script>
<style lang="scss" scoped>

	// box used to scale the widget
	.scaleBox {

		// same size as the default widget scale
		width: 200px;
		height: 222px;

		// center in the widget
		position: absolute;
		top: 50%;
		left: 50%;

	}// .scaleBox

	// the main box for the widget
	.prizeWheelWidget {

		border: 2px solid cyan;


		// fixed size
		width: 200px;
		height: 222px;

		// reset stacking context
		position: relative;

		// background image as CSS-sprites settings
		background-repeat: no-repeat;
		background-size: 200px 267px;
		background-position: 0px -46px;

		// allow nothing to escape
		overflow: hidden;

		// idle in-n-out animation
		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}

		// the SVG wheel
		.wheel {
			position: absolute;
			left: 100px;
			top: 106px;
			transform: translate(-50%, -50%) rotate(var(--rot));

		}// .wheel

		// the center circle
		.centerCircle {

			// fixed inside frame
			position: absolute;
			left: 100px;
			top: 106px;
			transform: translate(-50%, -50%);
			width: 17px;
			height: 17px;

			// black circle
			background-color: #000000;
			border-radius: 50%;
			z-index: 1;

		}// .centerCircle

		// the flipper
		.flipper {

			// fixed inside frame
			position: absolute;
			left: 100px;
			top: 19px;
			transform: translate(-50%, -50%);
			width: 30px;
			height: 40px;
			z-index: 1;

			background-repeat: no-repeat;
			background-size: 200px 267px;
			background-position: -85px -2px;

		}// .flipper

		// text settings
		.messageText {

			// fixed inside frame
			position: absolute;
			color: white;

			z-index: 2;

			// text settings
			text-shadow: 2px 2px 0px black;
			font-size: 12px;
			font-weight: bold;
			text-align: left;
			/* white-space: nowrap; */

			span {
				color: #FFD700;
				white-space: nowrap;
 				display: inline;
			}	

			// clip overflow with no scroll bars
			overflow: hidden;

			// flex settings so the rows stack so new messages are at the bottom
			display: flex;
			flex-direction: column;
			justify-content: flex-end;

			&.spinnerMessage {
				
				display: inline;
				top: 0px;
				left: 0px;
				right: 0px;
				
				overflow: hidden;
				text-overflow: ellipsis;

				text-align: center; 
				white-space: nowrap;
			}// .spinnerMessage

			&.spinnerItem {
				bottom: 25px;
				left: 0px;
				right: 0px;
				text-align: center;
			}

		}// .messageText

	}// .prizeWheelWidget
	
	text {
		pointer-events: none;
		user-select: none;
	}

</style>
