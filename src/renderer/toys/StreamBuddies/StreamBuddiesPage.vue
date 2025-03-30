<!--
	StreamBuddiesPage.vue
	---------------------

	This is the settings page for the StreamBuddies system.
-->
<template>

	<PageBox
		title="Stream Buddies Settings"
		themeColor="#B59EDE"
	>
		<p>
			The Stream Buddies system lets chatters appear on screen as a character.
			<br>
			This is the most advanced system, and has the most settings to configure.
			However, at the time of writing, this system is considered "experimental" and may have bugs.
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Stream Buddies system.
		</p>
		<CommandsConfigBox :toy="toy" />
		
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';

// our app
import StreamBuddies from './StreamBuddies';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[StreamBuddies.slug];


// our local ref settings for this system
const { 
	maxBuddyCount,
	buddySize
} = ctApp.toyManager.toys[toy.slug].settings;

</script>
<style lang="scss" scoped>	


</style>
