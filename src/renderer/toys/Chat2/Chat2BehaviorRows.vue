<!--
	Chat2BehaviorRows.vue
	---------------------

	The behavior toggles shared by the Chat2 'simple' and 'custom' modes.

	These settings affect WHAT the chat shows (names, avatars, command
	filtering, points, grouping) rather than how it's styled, so they stay
	visible regardless of theming mode. Factored into one component so both
	modes render an identical set without duplication.
-->
<template>

	<SettingsInputRow type="boolean" v-model="filterCommands">
		<template #title>Filter !commands from Chat</template>
		<p>Filter out the <span class="cmd">!commands</span> from the chat widget.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="showChatterNames">
		<template #title>Show Chatter Names</template>
		<p>Disable to show messages only.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="showChatterPFP">
		<template #title>Show Chatter Profile Pictures</template>
		<p>Enable to show user profile pictures next to their messages.</p>
	</SettingsInputRow>

	<SettingsInputRow type="number" :min="16" :max="256" :step="1" v-model="pfpSize">
		<template #title>Profile Picture Size</template>
		<p>Size (in pixels) for user profile pictures in chat.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="messageOnNewLine">
		<template #title>Message On New Line</template>
		<p>Enable to show message text on a new line under the name, rather than inline.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="groupUserMessages">
		<template #title>Group Recent Messages</template>
		<p>If the last set of messages are from the same user, they'll be grouped into one message.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="showChatterPoints">
		<template #title>Show Chatter Points</template>
		<p>Users' channel points will be displayed next to their name in the chat box.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="showSystemMessages">
		<template #title>Show System Messages</template>
		<p>Show system messages (point totals, prize wins, etc.) in chat. Recommended to keep on.</p>
	</SettingsInputRow>

	<SettingsInputRow type="boolean" v-model="cachePFPImages">
		<template #title>Cache Profile Pictures</template>
		<p>Cache profile pictures locally for faster loading and less bandwidth. Recommended on.</p>
	</SettingsInputRow>

</template>
<script setup>

// components
import SettingsInputRow from '@components/options/SettingsInputRow.vue';

// the toy whose settings refs we bind to
const props = defineProps({
	toy: { type: Object, required: true },
});

// pull the behavior refs straight off the toy's settings block
const {
	filterCommands,
	showChatterNames,
	showChatterPFP,
	pfpSize,
	messageOnNewLine,
	groupUserMessages,
	showChatterPoints,
	showSystemMessages,
	cachePFPImages,
} = props.toy.settings;

</script>
<style lang="scss" scoped>

	.cmd {
		font-family: monospace;
	}

</style>
