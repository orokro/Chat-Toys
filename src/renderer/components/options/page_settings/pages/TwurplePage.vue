<!--
	TwurplePage.vue
	---------------

	Connection Settings sub-tab for the new Twurple-based Twitch
	integration. Mirrors TwitchPage.vue's structure / styling so the
	user sees a familiar layout, with copy that makes clear this is the
	new system (alongside the legacy "Twitch Settings" tab during the
	Phase 1 migration).
-->
<template>

	<PageBox
		title="Twitch (Twurple) Settings"
		themeColor="indigo"
		themeImage="assets/bg_tiles/chatSettings.png"
		bgSize="120px"
		bgThemePos="-10px"
	>
		<br><br>
		<p>
			This is the <strong>new</strong> Twitch connection, powered by Twurple.
			It supports chat, channel point redeems, bits, follows, subs, and raids
			through a single auth session - replacing the legacy TMI tab above.
		</p>
		<p>
			While this is in beta, the legacy "Twitch Settings" tab also still
			works. To test the new system side-by-side, log out of the legacy tab,
			then connect here and confirm everything keeps working.
		</p>

		<SectionHeader title="Connect via Twurple" />
		<p>
			Click <strong>Connect via Twurple</strong> below. A Twitch
			authorization popup will appear; approve the requested scopes and
			you'll be returned here.
		</p>
		<TwurpleConnectionManager />

		<SectionHeader title="Live Raw Chat (All Sources)" />
		<p>
			Below you can see the live data that comes in from chatters across
			all configured sources (YouTube, the legacy Twitch tab, and - once
			Phase 1 task #9 lands - this Twurple connection too).
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
