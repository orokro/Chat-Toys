<!--
	ChatPage.vue
	------------

	Page to show scraping details.
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
			General settingsz
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
		<RawChatPreview
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
import RawChatPreview from '../RawChatPreview.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

</script>
<style lang="scss" scoped>	


</style>
