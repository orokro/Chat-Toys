<!--
	ScrollBeggar.vue
	----------------

	Before the user scrolls, this will appear on the bottom of the page,
	encouraging them to scroll down.
-->
<template>

	<!-- main wrapper to anchor to bottom -->
	<div
		class="scroll-beggar-box"
		:class="{ 'is-visible': isVisible }"
	>

		<!-- row with the letters that say "SCROLL DOWN" -->
		<div class="text-row row">
			<span
				v-for="(char, index) in text"
				:key="index"
				class="letter"
				:style="{ animationDelay: `${index * 0.2}s` }"
			>
				{{ char }}
			</span>
		</div>

		<!-- row with downward arrows -->
		<div class="arrow-row row">
			<span class="arrow" v-for="i in 3" :key="i">&#8595;</span>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

// break up our letters
const text = 'SCROLL DOWN!'.split('');

// true when we should show the better
const isVisible = ref(true);

// compute if we should show it at all
const checkScroll = () => {
	isVisible.value = window.scrollY >= 0 && window.scrollY <= 100;
};

onMounted(() => {
	checkScroll();
	window.addEventListener('scroll', checkScroll);
	window.addEventListener('resize', checkScroll);
});

onUnmounted(() => {
	window.removeEventListener('scroll', checkScroll);
	window.removeEventListener('resize', checkScroll);
});

</script>
<style lang="scss">

	.scroll-beggar-box {

		// for debug
		/* background: rgba(0, 0, 0, 0.5);
		border: 2px solid red; */
	
		// animate opacity
		opacity: 0;
		transition: opacity 0.5s ease-in-out;
		&.is-visible {
			opacity: 1;
		}

		// don't allow any kind of user input
		pointer-events: none;

		// centered on bottom
		position: fixed;
		bottom: 0px;
		left: 50%;
		transform: translateX(-50%);

		// fixed size
		height: 100px;
		width: 300px;

		// layout
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: center;
		overflow: hidden;

		// font styles
		font-size: 24px;
		font-weight: bolder;
		color: white;
		text-shadow: 2px 2px 0px black;

		// the row of letters animating up and down that spells out "SCROLL DOWN!"
		.text-row {

			// size & layout
			display: flex;
			justify-content: center;
			gap: 4px;
			height: 50%;
			align-items: center;

			// one of our letters
			.letter {
				
				position: relative;
				top: 10px;

				display: inline-block;
				font-weight: bolder;

				// animate up and down
				animation: float 3s infinite ease-in-out;

			}// .letter

			@keyframes float {
				0%   { transform: translateY(0); }
				50%  { transform: translateY(-20px); }
				100%   { transform: translateY(0); }
			}// @keyframes float

		}// .text-row

		// the row of arrows animating down
		.arrow-row {

			// size & layout
			height: 50%;
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 10px;

			// one of the arrows
			.arrow {

				font-weight: bolder;

				// arrow down animation
				animation: arrowMove 2s infinite ease-in-out;

			}// .arrow

			@keyframes arrowMove {
				0% {
					opacity: 0;
					transform: translateY(-50%);
				}
				20% {
					opacity: 1;
				}
				80% {
					opacity: 1;
				}
				90% {
					opacity: 0;
				}
				100% {
					opacity: 0;
					transform: translateY(20%);
				}
			}// @keyframes arrowMove

		}// .arrow-row

	}// .scroll-beggar-box

</style>
