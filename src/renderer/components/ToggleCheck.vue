<!--
	ToggleCheck.vue
	---------------

	A toggle style element that can be used as a checkbox.
-->
<template>

	<!-- the outer wrapper, with a tab stop, for accessibility -->
	<div 
		class="toggle-check"
		:class="{ enabled: setting }"
	>

		<!-- the actual checkbox -->
		<input
			type="checkbox"
			v-model="setting"
			class="toggle-check-input"
			@change="emit('change', setting)"
		/>

		<!-- slider to move back & fourth-->
		<div class="toggle-check-slider">
			<span class="material-icons">check</span>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';

// v-model binding (expects a ref/shallowRef)
const setting = defineModel();

// make change emit to forward
const emit = defineEmits(['change']);

</script>
<style lang="scss">

	// pill shape
	.toggle-check {

		// reset stacking context for positioning children absolutely
		position: relative;
		
		// fixed size, inline
		display: inline-block;
		width: 60px;
		height: 30px;
		border-radius: 30px;
		/* border: 3px solid black; */

		// animated bg based on state
		transition: background 0.2s ease-in-out;
		background-color: gray;


		// allow nothing to escape
		overflow: hidden;

		// the checkbox itself
		.toggle-check-input {

			// fill parent container
			width: 100%;
			height: 100%;
			
			// clickable, and invisible
			cursor: pointer;
			opacity: 0;

		}// .toggle-check-input

		// the slider knob
		.toggle-check-slider {

			// fixed animated post
			position: absolute;
			transition: left 0.2s ease-in-out;
			top: 3px;
			left: 3px;

			// don't interfere with the click
			pointer-events: none;
			
			// white circle
			background: white;
			width: 24px;
			height: 24px;
			border-radius: 50%;

			// the check icon
			.material-icons {		

				transition: scale 0.2s ease-in-out;
				scale: 0.0;
			}// .material-icons
			
		}// .toggle-check-slider

		// when enabled, move the slider
		&.enabled {
			background: black;

			& .toggle-check-slider {
				left: 33px;

				.material-icons {
					scale: 0.9;
				}

			}// .toggle-check-slider

		}// &.enabled

	}// .toggle-check

</style>
