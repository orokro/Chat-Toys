<!--
	ContactPage.vue
	---------------

	Page to contact the dev and all that.
-->
<template>

	<PageBox
		title="Contact"
		themeColor="#00ABAE"
		themeImage="assets/bg_tiles/contact.png"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/help_contact.png" height="300px" style="float:right"/>
		</div>
		
		<br>
		<div class="itemRow">
			<img 
				src="/assets/other/website_icon.png"
				width="100"
			/>
			<div class="spacer"></div>
			<h3>Website</h3>
			<div 
				class="fakeLink"
				@click="openLink(`http://chattoys.pro`)"
			>
				http://chattoys.pro
			</div>
		</div>
		<div class="itemRow">
			<img 
				src="/assets/other/discord_icon.png"
				width="100"
			/>
			<div class="spacer"></div>
			<h3>Discord</h3>
			<div
				class="fakeLink"
				@click="openLink(`https://discord.gg/g2WhaH6cjH`)"
			>
				Chat Toys
			</div>
		</div>
		<div class="itemRow">
			<img 
				src="/assets/other/x_icon.png"
				width="100"
			/>
			<div class="spacer"></div>
			<h3>X</h3>
			<div
				class="fakeLink"
				@click="openLink(`https://x.com/ChatToysX`)"
			>
				@ChatToysX
			</div>
		</div>
		<div class="itemRow">
			<img 
				src="/assets/other/email_icon.png"
				width="100"
			/>
			<div class="spacer"></div>
			<h3>Email</h3>
			<div
				class="fakeLink"
				@click="openLink(`mailto:chat.toys.contact@gmail.com`)"
			>
				chat.toys.contact@gmail.com
			</div>
		</div>
		<div class="itemRow">
			<img 
				src="/assets/other/github_icon.png"
				width="100"
			/>
			<div class="spacer"></div>
			<h3>Github</h3>
			<div
				class="fakeLink"
				@click="openLink(`https://github.com/orokro/Chat-Toys`)"
			>
				https://github.com/orokro/Chat-Toys
			</div>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';


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

	.itemRow {

		height: 120px;

		.spacer {
			/* border: 1px solid black; */
			height: 12px;
		}

		img {
			float: left;
			margin-right: 20px;
		}

		.fakeLink {

			position: relative;
			top: -20px;

			margin-top: 1px;
			color: rgb(0, 47, 255);
			font-style: italic;
			cursor: pointer;
			
			&:hover {
				text-decoration: underline;
			}

		}// .fakeLink

	}// .itemRow

</style>
