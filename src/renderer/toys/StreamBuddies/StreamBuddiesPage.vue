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
		<CommandsConfigBox
			:toyName="'Stream Buddies'"
			:toySlug="StreamBuddies.slug"
			:commands="commands"
		/>
		
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

// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: StreamBuddies.slugify('join'),
		command: 'join',
		description: 'Being on screen is optional, users can opt-in with this command.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('leave'),
		command: 'leave',
		description: 'Being on screen is optional, users can opt-out with this command.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('left'),
		command: 'left',
		params: [
			{ name: 'amount', type: 'number', optional: true, desc: 'Amount to walk left in pixels' },
		],
		description: 'Make their character walk left',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('right'),
		command: 'right',
		params: [
			{ name: 'amount', type: 'number', optional: true, desc: 'Amount to walk right in pixels' },
		],
		description: 'Make their character walk right',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('jump'),
		command: 'jump',
		params: [
			{ name: 'amount', type: 'string', optional: true, desc: 'Either "left" or "right"' },
		],
		description: 'Make their character jump up, or optionally, a direction.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('hug'),
		command: 'hug',
		params: [
			{ name: 'user', type: 'username', optional: false, desc: 'user to hug' },
		],
		description: 'Make their character hug another user.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('attack'),
		command: 'attack',
		params: [
			{ name: 'user', type: 'username', optional: false, desc: 'user to attack' },
		],
		description: 'Make their character attack another user.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('sit'),
		command: 'sit',
		description: 'Make character sit down.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: StreamBuddies.slugify('fart'),
		command: 'fart',
		description: 'Make character fart.',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	}
];

</script>
<style lang="scss" scoped>	


</style>
