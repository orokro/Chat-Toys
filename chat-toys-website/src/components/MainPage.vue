<!--
	MainPage.vue
	------------

	The main scrolling & interactive page of the website
-->
<template>

	<!-- this will wrap our content in the opening-box animation -->
	<BoxAnimation>

		<div class="box-content">

			<ContentSection
				section-title="Welcome!"
				theme-color="#00ABAE"
				:is-left="false"
				:show-top-circle="true"
				@onScreenEnter="setPageBGColor"
			>
				<div class="spacer" style="padding-left: 10%;">
					Chat Toys is a collection of fun & interactive widgets to use in OBS,<br>
					that interact with YouTube live chat.
					<br/><br/>
					This application runs entirely locally on your computer,<br>
					and does not require cloud connections, servers, or subscriptions!
					<br/><br/>
					Chat Toys is also open source, and you can 
					<a href="https://github.com/orokro/Chat-Toys" target="_blank">find it on GitHub.</a>
					<br/><br/>
					Scroll down to find out what's inside, or...<br><br>
					<a href="https://github.com/orokro/Chat-Toys/releases/" target="_blank">
						<div class="dl-button">
							Download Chat Toys
						</div>
					</a>
				</div>
			</ContentSection>

			<ContentSection
				section-title="Channel Points"
				:section-image="getChatGuyImage('src/assets/img/chat/channel_points.png')"
				image-scale="0.9"
				theme-color="#EED43A"
				:is-left="true"
				@onScreenEnter="setPageBGColor"
			>	
				The channel points system is the heart of Chat Toys.				
				<br><br>
				It will periodically show a widget on screen letting your chatters know it's time to type <cmd>get</cmd> in chat so they can earn points to spend on other Chat Toys systems!
				<br><br>
				You can configure the other commands to then spend these points on fun features!
				
				<img src="../assets/img/ref/channel_points_image.png" width="70%"/>

				<br><br>
				Check the video below to learn more!
				<br><br>
				<ThumbnailBox
					slug='channel_points'
					count="4"
					videoUrl="wGxNc5xE-ww"
					@thumbnail-click="handleThumbnailClick"
				/>

			</ContentSection>

			<ContentSection
				section-title="Prize Wheel"
				:section-image="getChatGuyImage('src/assets/img/chat/prize_wheel.png')"
				image-scale="1.3"
				theme-color="#FFAAC5"
				:is-left="false"
				@onScreenEnter="setPageBGColor"
			>
				The Prize Wheel widget lets chatters type <cmd>spin</cmd> in chat to spin a wheel and win prizes!
				<br><br>
				You can customize the prizes, color, and wheel PNG!
				<br><br>
				<ThumbnailBox
					slug='prize_wheel'
					count="3"
					videoUrl="JMofM8hf9SI"
					@thumbnail-click="handleThumbnailClick"
				/>
			</ContentSection>

			<ContentSection
				section-title="Head Pats"
				:section-image="getChatGuyImage('src/assets/img/chat/head_pat.png')"
				image-scale="1.1"
				theme-color="#C6C37A"
				:is-left="true"
				@onScreenEnter="setPageBGColor"
			>
				The Head Pat toy will will automatically play the head-pat gif when a chatter submits a
				<cmd>pat</cmd> command!
				<br><br>
				You can enable chatters to pat each other, as well!
				
				<ThumbnailBox
					slug='head_pats'
					count="2"
					videoUrl="wDCzZFhiU-s"
					@thumbnail-click="handleThumbnailClick"
				/>

			</ContentSection>
			
			<ContentSection
				section-title="Tosser"
				:section-image="getChatGuyImage('src/assets/img/chat/tosser.png')"
				image-scale="1.4"
				theme-color="#E65A5A"
				:is-left="false"
				@onScreenEnter="setPageBGColor"
			>
				The Tosser Toy lets your chatters toss tomatoes, pies, or paper-wads at your webcam or avatar!
				<br><br>
				Objects are rendered in 3D & animated in real-time!
				<br><br>
				You can even import custom objects to toss.
				<br><br>
				Chatters can type <cmd>toss</cmd> command in chat,<br>
				or specify with <cmd>toss tomato</cmd>.
				<br><br>
				<ThumbnailBox
					slug='tosser'
					count="3"
					videoUrl="B4YfacihXjc"
					@thumbnail-click="handleThumbnailClick"
				/>

			</ContentSection>
			
			<ContentSection
				section-title="Gamba"
				:section-image="getChatGuyImage('src/assets/img/chat/gamba.png')"
				image-scale="1.4"
				theme-color="#458233"
				:is-left="true"
				@onScreenEnter="setPageBGColor"
			>
				The Gamba system lets your chatters place bets on predictions you set up for your stream.
				<br><br>
				<cmd>bet &lt;option&gt; &lt;amount&gt;</cmd> lets chatters specify the bet option &amp; amount of their channel points to put ont the line!
				<br><br><br>
				Check the video below to learn more!<br><br>
				<ThumbnailBox
					slug='gamba'
					count="4"
					videoUrl="lv5cDifVbTc"
					@thumbnail-click="handleThumbnailClick"
				/>
			</ContentSection>

			<ContentSection
				section-title="Media"
				:section-image="getChatGuyImage('src/assets/img/chat/media.png')"
				image-scale="1.1"
				theme-color="#51547D"
				:is-left="false"
				@onScreenEnter="setPageBGColor"
			>
				The Media Toy lets you set up any number of images, sounds, and gifs that can play with custom commands.
				<br><br>
				For example, set up a command such as <cmd>yay</cmd> for happy sounds & a fun gif,
				or a command like <cmd>sad</cmd> for sad sounds & a sad gif.
				<br><br>
				There is no limit to the number of sounds & gifs you can import and assign custom commands.				
				<br><br>
				
				<ThumbnailBox
					slug='media'
					count="3"
					videoUrl="35cJEtJNiq8"
					@thumbnail-click="handleThumbnailClick"
				/>
			</ContentSection>

			<ContentSection
				section-title="Fishing"
				:section-image="getChatGuyImage('src/assets/img/chat/fishing.png')"
				image-scale="1.4"
				theme-color="#A4704C"
				:is-left="true"
				@onScreenEnter="setPageBGColor"
			>
				The Fishing Toy let's chatters play an idle-game where they can <cmd>cast</cmd> and <cmd>reel</cmd>	at their leisure.
				<br><br>
				You can completely customize the pond animation, the stock of fish including their names, images, rarity, and reward values.	
				<br><br>
				Check the video below to learn more!
				<img 
					src="../assets/img/ref/fishing_widget.png" 
					width="100%"
					style="position: relative; top: -0px;"
				/>

				<ThumbnailBox
					slug='fishing'
					count="4"
					videoUrl="sm5-RHsqQmI"
					@thumbnail-click="handleThumbnailClick"
				/>
			</ContentSection>

			<ContentSection
				section-title="Stream Buddies"
				:section-image="getChatGuyImage('src/assets/img/chat/buddies.png')"
				image-scale="1.2"
				theme-color="#B59EDE"
				:is-left="false"
				@onScreenEnter="setPageBGColor"
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
				<br><br><br>
				<ThumbnailBox
					slug='stream_buddies'
					count="3"
					videoUrl="7cNTiqa_Kq8"
					@thumbnail-click="handleThumbnailClick"
				/>

			</ContentSection>
			
			<ContentSection
				section-title="Chat"
				:section-image="getChatGuyImage('src/assets/img/chat/chat.png')"
				image-scale="1.0"
				theme-color="#60C5F1"
				:is-left="true"
				@onScreenEnter="setPageBGColor"
			>
				There are other Chat systems, such as <cmd>shout</cmd> which is like a Super Chat using channel points!
				<br><br>
				Also included is <cmd>swarm</cmd>, which shows user messages in a swarm if enough chatters type the command simultaneously!
				
				<br><br><br><br><br>
				<ThumbnailBox
					slug='chat'
					count="4"
					videoUrl="kc-181dg2M8"
					@thumbnail-click="handleThumbnailClick"
				/>
			</ContentSection>

			<ContentSection
				section-title="Commands"
				:is-left="false"
				theme-color="#00ABAE"
				@onScreenEnter="setPageBGColor"
			>
				<img 
					src="../assets/img/ref/command_box.png" 
					width="100%"
					style="
						position: relative; 
						top: -0px;
						border-radius: 5px;
					"
				/>
				<br><br>
				The various Chat Toys all provide commands for chat to interact with them. Seen above are the settings for the Head Pat Toy's <cmd>pat</cmd> command.
				<br><br>
				As shown above, you can:
				<ul>
					<li>Enable or disable the command</li>
					<li>Limit the command to Super Chats only</li>
					<li>Limit the command to Channel Members only</li>
					<li>Edit the text of the command, like changing <cmd>pat</cmd> to <cmd>headpat</cmd></li>
					<li>Set the Channel Points ₱ cost to use the command</li>
					<li>Set a cool-down timer for chatters using the command</li>
					<li>Set a cool-down timer for anyone using the command</li>					
				</ul>
				
			</ContentSection>

			<ContentSection
				section-title="Download Now!"
				:is-left="true"
				theme-color="#00ABAE"
				:showBottomCircle="true"
				@onScreenEnter="setPageBGColor"
			>
				If you're ready to make your YouTube live chat more exciting, <br><br>
				<a href="https://github.com/orokro/Chat-Toys/releases/" target="_blank">
					<div class="dl-button">
						Download Chat Toys
					</div>
				</a>
			</ContentSection>
		</div>

	</BoxAnimation>

	<!-- header comes after the box, for automatic correct z-positioning -->
	<Header/>
	
	<!-- a box on the bottom of the page to prompt the user to scroll down -->
	<ScrollBeggar/>

	<container/>
</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted, inject } from 'vue';

// components
import Bloc from './Bloc.vue';
import Cmd from './Cmd.vue';
import Header from './Header.vue';
import BoxAnimation from './BoxAnimation.vue';
import ScrollBeggar from './ScrollBeggar.vue';
import BlurbBox from './BlurbBox.vue';
import ContentSection from './ContentSection.vue';
import ThumbnailBox from './ThumbnailBox.vue';
import ThumbModal from './ThumbModal.vue';

// lib/misc
import { promptModal, openModal, container } from 'jenesius-vue-modal';

// import thumbnail images for dynamic generation
const chatGuyImages = import.meta.glob('@assets/img/chat/*.png', { eager: true });

/**
 * Helper method to get loaded image in template
 * 
 * @param path {string} - the path to the image
 */
function getChatGuyImage(path) {
	const key = `/${path}`;
	const img = chatGuyImages[key]?.default;
	return img;
}


/**
 * Show thumbnail modal w/ selected thumbnail when clicked
 * 
 * @param details {Object} - the details of the thumbnail clicked
 */
function handleThumbnailClick(details){

	openModal(
		ThumbModal,
		{
			slug: details.slug,
			count: parseInt(details.count),
			index: parseInt(details.index),
			videoUrl: details.videoUrl,
		},
	);
}


const bgThemeColor = inject('bgThemeColor');
function setPageBGColor({bgColor}) {

	// console.log('color', bgColor);
	// bgThemeColor.value = bgColor;
}

</script>
<style lang="scss">


	// fancy dl button
	.dl-button {

		position: relative;
		display: inline-block;
		margin-top: 10px;

		// box & spacing settings
		padding: 12px 24px;
		border: 2px solid rgba(255, 255, 255, 0.5);
		border-radius: 8px;
		cursor: pointer;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
		overflow: hidden;

		// text
		font-size: 16px;
		font-weight: bold;
		color: white;

		// animated bg gradient
		background: linear-gradient(120deg, #5a13b6, #9f00ff, #612ba8);
		background-size: 200%;
		background-position: left;	
		transition: background-position 0.5s ease, box-shadow 0.3s ease;		

		&:hover {
			background-position: right;
			box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
		}

	}// .dl-button

	// styles for our main content inside the virtual box
	.box-content {

		// text
		color: white;
		
		// thiccc headers
		.my-header {
			
			font-weight: bolder;
			text-shadow: 3px 3px 0px black;
			text-align: center;

		}// .my-header

	}// .box-content
	
</style>
