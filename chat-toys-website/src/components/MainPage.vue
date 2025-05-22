<!--
	MainPage.vue
	------------

	The main scrolling & interactive page of the website
-->
<template>

	<!-- this will wrap our content in the opening-box animation -->
	<BoxAnimation>

		<div class="box-content">

			<h1 class="my-header">
				<Bloc>Welcome To</Bloc> <Bloc>Chat Toys!</Bloc>
			</h1>
			<div class="clip-top">
				<BlurbBox class="top-dashes">
					Chat Toys is a collection of fun & interactive widgets to use in OBS, that interact with YouTube live chat.
					<br/><br/>
					This application runs entirely locally on your computer, and does not require clouds, servers, or subscriptions!
					<br/><br/>
					Chat Toys is also open source, and you can find it on GitHub.
					<br/><br/>
					Scroll down to find out what's inside!
				</BlurbBox>
			</div>

			<ContentSection
				section-title="Channel Points"
				section-image="src/assets/img/chat/channel_points.png"
				image-scale="0.9"
				:is-left="true"
			>	
				The channel points system is the heart of Chat Toys.				
				<br><br>
				It will periodically show a widget on screen letting your chatters know it's time to type <cmd>get</cmd> in chat so they can earn points to spend on other Chat Toys systems!
				<br><br>
				
				<!-- youtube embed -->
				<!-- <iframe
					width="560"
					height="315"
					src="https://www.youtube.com/embed/wGxNc5xE-ww"
					title="YouTube video player"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe> -->
			</ContentSection>

			<ContentSection
				section-title="Prize Wheel"
				section-image="src/assets/img/chat/prize_wheel.png"
				image-scale="1.3"
				:is-left="false"
			>
				The Prize Wheel widget lets chatters type <cmd>spin</cmd> in chat to spin a wheel and win prizes!
				<br><br>
				You can customize the prizes, color, and wheel PNG!
				
			</ContentSection>

			<ContentSection
				section-title="Head Pats"
				section-image="src/assets/img/chat/head_pat.png"
				image-scale="1.1"
				:is-left="true"
			>
				The head pat system will will automatically play the head-pad gif when a chatter submits a
				<cmd>pat</cmd> command in chat.
				<br><br>
				You can also enable chatters to pat each other, not just pat the streamer!
				
			</ContentSection>

			<ContentSection
				section-title="Tosser"
				section-image="src/assets/img/chat/tosser.png"
				image-scale="1.4"
				:is-left="false"
			>
				The Tosser Toy lets your chatters toss tomatoes, pies, wads of paper at your webcam or avatar!
				<br><br>
				Objects rendered in 3D & animated in real-time!
				<br><br>
				You can even import custom objects to toss!
				<br><br>
				Chatters can type <cmd>toss</cmd> command in chat, or specify with <cmd>toss tomato</cmd>, etc.
				
			</ContentSection>

			<ContentSection
				section-title="Gamba"
				section-image="src/assets/img/chat/gamba.png"
				image-scale="1.4"
				:is-left="true"
			>
				The Gamba system lets your chatters place bets on predictions you set up for your steam.
				<br><br>
				<cmd>bet &lt;option&gt; &lt;amount&gt;</cmd> lets chatters specify the bet option &amp; amount of their channel points to put ont the line!				
			</ContentSection>

			<ContentSection
				section-title="Media"
				section-image="src/assets/img/chat/media.png"
				image-scale="1.1"
				:is-left="false"
			>
				The Media Toy lets you set up any number of images, sounds, and gifs that can play with any custom commands.
				<br><br>
				For example, set up a command such as <cmd>yay</cmd> for happy sounds & a fun gif, or
				<br>
				a command like <cmd>sad</cmd> for sad sounds & a sad gif.
				<br><br>
				There is no limit to the number of sounds & gifs you can import and assign custom commands.				
			</ContentSection>

			<ContentSection
				section-title="Fishing"
				section-image="src/assets/img/chat/fishing.png"
				image-scale="1.4"
				:is-left="true"
			>
			The Fishing Toy let's chatters play an idle-game where they can <cmd>cast</cmd> and <cmd>reel</cmd>	at their leisure.
				<br><br>
				You can completely customize the pond animation, the stock of fish including their names, images, rarity, and reward values.		
			</ContentSection>

			<ContentSection
				section-title="Steam Buddies"
				section-image="src/assets/img/chat/buddies.png"
				image-scale="1.2"
				:is-left="false"
			>
				Stream Buddies show 3D avatars on stream of various members of your chat.
				<br><br>
				Their avatars will show their chat messages, move around, jump, fight, dance, and more!
				<br><br>
				You can even customize the 3D models with, with a compatible FBX rigged with a
				<a 
					href="https://www.mixamo.com/#/?page=1&query=t+pose&type=Motion%2CMotionPack"
					target="_blank"
				>Mixamo T-Pose skeleton.</a>
			</ContentSection>

			<ContentSection
				section-title="Chat"
				section-image="src/assets/img/chat/chat.png"
				image-scale="1.0"
				:is-left="true"
			>
				There are other Chat systems, such as <cmd>shout</cmd> which is like a Super Chat using channel points!
				<br><br>
				Also included is <cmd>swarm</cmd>, which shows user messages in a swarm if enough chatters type the command simultaneously!
			</ContentSection>


		</div>

	</BoxAnimation>

	<!-- header comes after the box, for automatic correct z-positioning -->
	<Header/>
	
	<!-- a box on the bottom of the page to prompt the user to scroll down -->
	<ScrollBeggar/>

</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

// components
import Bloc from './Bloc.vue';
import Cmd from './Cmd.vue';
import Header from './Header.vue';
import BoxAnimation from './BoxAnimation.vue';
import ScrollBeggar from './ScrollBeggar.vue';
import BlurbBox from './BlurbBox.vue';
import ContentSection from './ContentSection.vue';

</script>
<style lang="scss">

	.clip-top {
		/* border: 1px solid red; */
		overflow: hidden;
		
	}

	.top-dashes {
		position: relative;
		top: 4px;

		border: 3px dashed white;
		border-radius: 36px 36px 36px 0px;
		border-bottom: 0px;
		border-right: 0px;
		padding-bottom: 14px;

	}

	.box-content {

		color: white;
		/* padding: 50px; */
	}

	.my-header {


		font-weight: bolder;
		text-shadow: 3px 3px 0px black;
		text-align: center;
	}
</style>
