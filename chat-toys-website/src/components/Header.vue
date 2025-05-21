<!--
	Header.vue
	----------

	The main page header, with the logo & socials.
-->
<template>

	<!-- main header wrapper, affixed to top of page -->
	<div class="header-box">

		<!-- the title logo -->
		<div class="logo"/>

		<!-- box on right with social icons -->
		<div 
			class="icons"
			align="right"
		>
			<a href="https://discord.gg/g2WhaH6cjH" target="_blank">
				<img src="../assets/img/socials/discord_icon.png" alt="Discord">
			</a>
			<a href="mailto:chat.toys.contact@gmail.com" target="_blank">
				<img src="../assets/img/socials/email_icon.png" alt="Email">
			</a>
			<a href="https://github.com/orokro/Chat-Toys" target="_blank">
				<img src="../assets/img/socials/github_icon.png" alt="Github">
			</a>
			<a href="https://x.com/ChatToysX" target="_blank">
				<img src="../assets/img/socials/x_icon.png" alt="X">
			</a>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

</script>
<style lang="scss">

	// main header box
	.header-box {
		
		// fixed on top of screen
		position: fixed;
		inset: 0px 0px auto 0px;
		height: 12vh;
		padding: 1vh 2vh;		

		min-width: 305px;

		// dark bg w/ blur filter
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(5px);

		// box containing chat-toys logo
		.logo {
			
			// for debug
			/* border: 1px solid red; */

			// box containing logo via contained bg css
			height: 100%;
			max-width: 70%;

			// make sure to use contain
			background-image: url("@/assets/img/header.png");
			background-size: contain;
			background-position: 0% 50%;
			background-repeat: no-repeat;

		}// .logo

		.icons {

			// for debug
			/* border: 1px solid red; */

			position: absolute;
			top: 10px;
			bottom: 10px;
			right: 15px;
			max-width: 50%;
			aspect-ratio: 1.3;

			img {
				aspect-ratio: 1;
				height: 48%;

				filter: invert(1);
				opacity: 0.9;

				border: 4px solid white;
				border-radius: 10px;
				overflow: clip;

				&:hover {
					opacity: 1;
					border: 4px solid rgb(48, 48, 48);
				}

			}// img

		}// .icons

	}// .header-box

</style>
