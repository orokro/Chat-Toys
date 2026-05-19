<!--
	system/users.vue
	----------------
-->
<script>
export const meta = {
	title: 'Users Database',
	tags: ['users', 'system', 'database'],
	keywords: ['chatters', 'viewers', 'points', 'channel points', 'ban', 'history', 'sqlite'],
	summary: 'Every chatter who has interacted with Chat-Toys.',
	order: 4,
};
</script>
<template>

	<HelpSection title="The viewer record">
		<p>
			Every viewer who has run a command or otherwise registered
			with Chat-Toys gets a row here. The record includes their
			display name, their underlying channel id, their current
			channel-points balance, every command they've ever run, and
			every stream they've participated in.
		</p>
		<p>
			Click a row to expand a detail panel — you can adjust their
			points, see a bar chart of their command usage, and
			toggle their Chat-Toys ban status.
		</p>
	</HelpSection>

	<HelpSection title="What banning means here">
		<HelpWarning>
			Banning a user here only blocks them from interacting with
			the Chat-Toys system — they can't redeem points, run
			commands, trigger toys, etc. It does <strong>not</strong>
			ban them from your channel itself or from chat. That's a
			separate moderation action you'd take on YouTube / Twitch.
		</HelpWarning>
	</HelpSection>

	<HelpSection title="Where the data lives">
		<p>
			Users are stored in a SQLite database in this app's
			<HelpKbd>%APPDATA%</HelpKbd> directory. If you really need
			to do bulk-editing or run queries, you can open it with a
			tool like DBeaver.
		</p>
		<HelpWarning>
			Always back up the database file before editing it
			directly. Chat-Toys assumes its schema is correct — if you
			drop a column the app needs, things break.
		</HelpWarning>
	</HelpSection>

	<HelpSection title="Where points come from">
		<p>
			The points column is driven by the
			<HelpLink to="tools.channelPoints">Channel Points</HelpLink>
			tool. If that tool isn't enabled, the points column is
			effectively cosmetic.
		</p>
	</HelpSection>

</template>
