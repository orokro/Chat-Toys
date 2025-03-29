<!--
	AddToyModal.vue
	---------------

	The menu that pops up when the [+] add button is clicked in the toy box, toy strip.

	This will show a selection of icons available to the user.
-->
<template>

	<ModalWindowFrame
		title="Add a Toy"
		:width="750"
		:height="550"
	>

		<!-- box with scrollable list of toy icons -->
		<div class="iconsContent">
			
			<!-- loop through the toys and display them -->
			<div
				v-for="toy in ctApp.toysData"
				:key="toy.slug"
				class="toyIcon"
				:class="{ alreadyAdded: includedToys[toy.slug] }"
				@click="()=>!includedToys[toy.slug] && select(toy)"
				@mouseover="hoveredToySlug = toy.slug"
				@mouseleave="hoveredToySlug = null"
			>
				<!-- the icon for the toy -->
				<img
					class="toyIconImage"
					:src="`assets/icons/${toy.slug}.png`"
					alt="toy.name"
					height="80"
				/>

				<!-- the name for the toy -->
				<div class="toyName">
					{{ toy.name }}

					<!-- green checkmark if toy is already included -->
					<div
						v-if="includedToys[toy.slug]"
						class="checkmark"
					>
						<span class="material-icons">check</span>
					</div>
				</div>
				
			</div>

		</div>

		<!-- box pinned on bottom with hover text -->
		<div class="descriptionBox">
				
			<!--  if descriptionText is just a string show it, otherwise, show each line -->
			<div v-if="typeof descriptionText === 'string'">
				{{ descriptionText }}
			</div>
			<div v-else>
				<div><strong>{{ descriptionText.topText }}</strong></div>
				<div>{{ descriptionText.bottomText }}</div>	
			</div>
		</div>

	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, computed, inject } from 'vue';

// components
import ModalWindowFrame from '../ModalWindowFrame.vue';

// lib misc
import { closeModal, Modal } from 'jenesius-vue-modal';

// which item is hovered
const hoveredToySlug = ref(null);

// fetch the main app state context
const ctApp = inject('ctApp');

// so we can close the modal using the jenesius-vue-modal event and return a value
const emit = defineEmits([Modal.EVENT_PROMPT]);

// we will use computed to see if a user already has added a toy so we can show the add button
const includedToys = computed(() => {

	const data = {};	
	ctApp.toysData.map(toy => {
		data[toy.slug] = ctApp.enabledToys.value.includes(toy.slug);
	});
	return data;
});

// cache description text
const descriptionText = computed(() => {

	// if no hover
	if(hoveredToySlug.value === null)
		return 'Hover over an icon to learn more.';

	// if already added
	const alreadyAdded = includedToys.value[hoveredToySlug.value];

	// find the toy's description
	const toy = ctApp.toysData.find(toy => toy.slug === hoveredToySlug.value);
	if(toy === undefined)
		return 'No description available.';

	// return the description
	return {
		topText: `${alreadyAdded ? '[Already Added] ' : ''} ${toy.name}:`,
		bottomText: toy.desc
	}

});

// when the user selects a toy, close modal with the prompt value
function select(value){
	emit(Modal.EVENT_PROMPT, value);
}

</script>
<style lang="scss" scoped>

	// scrollable box w/ toy icons
	.iconsContent {

		// for debug
		/* border: 1px solid red; */

		// position absolutely in our parent container
		position: absolute;
		inset: 0px 0px auto 0px;
		height: 450px;

		// flex
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 25px;		
		padding: 30px;

		// scroll the box
		overflow-y: auto;

		// the containers for the toy icons as laid-out by the above flex code
		.toyIcon {

			// fixed gray rectangle
			width: 150px;
			height: 110px;
			background: rgb(236, 236, 236);
			border-radius: 25px;

			// new stacking context
			position: relative;

			// center the icon
			display: flex;
			justify-content: center;
			align-items: top;

			// appear clickable
			cursor: pointer;

			// hover styles
			&:hover {
				background: rgb(214, 231, 238);

				.toyIconImage {
					top: 0px;
					transform: rotate(-10deg);
				}
			}// &:hover

			// already added styles
			&.alreadyAdded {

				// only allow hover pointer
				cursor: not-allowed;

				background: rgb(214, 231, 238);

				.toyName {
					background: #13b147;
				}
			}// &.alreadyAdded

			// the icon for the toy
			.toyIconImage {

				// fixed size
				
				// move the transform origin to center of image
				transform-origin: center;

				// transition top and rotation
				transition: top 0.2s, transform 0.2s;

				// no rotation and default position (these will be transitioned)
				transform: rotate(0deg);
				position: relative;
				top: 8px;

			}// .toyIconImage

			// the name for the toy
			.toyName {

				// fixed on bottom
				position: absolute;
				bottom: -10px;
				left: 50%;
				transform: translateX(-50%);

				// pill shape
				background: #00ABAE;
				padding: 2px 10px;
				border-radius: 20px;
				color: white;
				font-weight: bold;
				font-size: 12px;
				white-space: nowrap;
			
				// optional checkmark on top right of name text
				.checkmark {

					position: absolute;
					top: -13px;
					right: -13px;
					width: 25px;
					height: 25px;
					background: #13b147;
					border-radius: 50%;
					border: 2px solid black;

					span {
						font-size: 18px;
						font-weight: bold;
						position: relative;
						left: 1px;
						top: 2px;
					}
				}// checkmark

			}// .toyName

		}// .toyIcon

	}// .iconsContent

	// box with hover text
	.descriptionBox {

		// box settings
		position: absolute;
		inset: auto 0px 0px 0px;
		height: 70px;
		background: #00ABAE;
		padding: 6px 0px;

		// text settings
		text-align: center;
		color: white;
		font-size: 20px;
		line-height: 20px;

	}//.descriptionBox

</style>
