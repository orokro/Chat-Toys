<!--
	ChatPage.vue
	------------

	Page to show chat reading configuration details
-->
<template>

	<PageBox
		title="Chat Settings"
		themeColor="#262262"
		themeImage="assets/bg_tiles/chatSettings.png"
		bgSize="120px"
		bgThemePos="-10px"
	>
		<br><br>
		<p>
			Use this page to configure the chat sources you want to read commands from.
		</p>
		<SectionHeader title="Chat Sources"/>
		<p>
			Below you can add or remove chat sources for the app to read.
			<br>
			<strong>NOTE:</strong> a chat source must be enabled for commands to work!
			<br><br>
			If a live stream ends or chat is disabled, the source will be "unavailable."
			<br>
			You cannot enable an unavailable source.
		</p>
		<ChatSourceManager/>

		<SectionHeader title="Auto Chat"/>
		<p>
			The following feature is experimental and may not work as expected.
			<br>
			Below you can paste in a link to your YouTube channel page.
			<br>
			If present, the app will attempt to detect when you're live in OBS, and if live,<br>
			attempt to find the latest live stream on your channel and automatically add it as a source.
			<br><br>
			This can fail in two ways:
		</p>
		<ul>
			<li>
				The app may not be able to detect when you're live in OBS.
			</li>
			<li>
				YouTube API may not be able to find the stream.
			</li>			
		</ul>
		<p>
			<br>
			So, you might want to check this page after you go live to see if it's been added,
			and if not you can add it manually.
			<br>
			Also, due to the nature of this program - if the channel page changes, this feature
			might become broken.
			<br><br>
			<strong>Consider this feature a potential <em>convenience</em> and not a guarantee.</strong>
		</p>

		<SectionHeader title="Live Raw Chat"/>
		<p>
			Below you can see the live data that comes in from chatters.
			<br>
			You don't need to know how to read this, and you don't need to do anything with it.
			<br>
			You can just peruse the data as it flows in, or check if anything is coming it at all.
			<br>
			If nobody is in your chat, you can post a message in your own chat and see if it shows up here to make sure all systems are working.
			<br>
		</p>
		<RawLogPreview
			:messages="ctApp.chatProcessor.screenMessages.value"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';
import { chromeShallowRef } from '@scripts/chromeRef';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import RawLogPreview from '../RawLogPreview.vue';
import ChatSourceManager from '../ChatSourceManager.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

</script>
<style lang="scss" scoped>	


</style>
