<!--
	TwurplePage.vue
	---------------

	Connection Settings sub-tab for the app's Twitch integration: connecting
	the user's Twitch account for chat, channel point redeems, bits, follows,
	subs, and raids through a single auth session.

	Note: "Twurple" is kept as the internal component / file name; all
	user-facing copy refers to this simply as Twitch.
-->
<template>

	<PageBox
		title="Twitch Settings"
		themeColor="indigo"
		themeImage="assets/bg_tiles/chatSettings.png"
		bgSize="120px"
		bgThemePos="-10px"
	>
		<br><br>
		<p>
			Connect your Twitch account to power chat commands, channel point
			redeems, bits, follows, subs, and raids - all through a single
			sign-in.
		</p>

		<SectionHeader title="Connect Twitch" />
		<p>
			Click <strong>Connect Twitch</strong> below. A Twitch authorization
			popup will appear; approve the requested permissions and you'll be
			returned here. Your connection stays signed in and refreshes
			automatically, so you shouldn't need to reconnect.
		</p>
		<TwurpleConnectionManager />

		<SectionHeader title="Live Raw Chat (All Sources)" />
		<p>
			Below you can see the live chat coming in from every connected
			source (Twitch and YouTube).
		</p>

		<RawLogPreview
			:messages="ctApp.chatProcessor.screenMessages.value"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import RawLogPreview from '../RawLogPreview.vue';
import TwurpleConnectionManager from '../TwurpleConnectionManager.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

</script>
<style lang="scss" scoped>
</style>
