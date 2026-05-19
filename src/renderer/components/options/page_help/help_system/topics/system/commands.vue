<!--
	system/commands.vue
	-------------------
-->
<script>
export const meta = {
	title: 'Commands',
	tags: ['commands', 'system'],
	keywords: ['master command list', 'all commands', 'copy paste', 'every command'],
	summary: 'Master command table plus a copy-paste snippet of every enabled command.',
	order: 2,
};
</script>
<template>

	<HelpSection title="One editor for every command">
		<p>
			Each toy ships with its own command table on its own
			settings page. This page just collects every toy's table
			into one scroll — same editor, same fields, same behavior.
			Edit the
			<HelpLink to="toys.shout">Shout</HelpLink>'s command name
			here and it changes everywhere.
		</p>
		<p>
			Toys like
			<HelpLink to="toys.media">Media</HelpLink>,
			<HelpLink to="toys.tosser">Tosser</HelpLink>, and
			<HelpLink to="toys.vtsTosser">VTS Tosser</HelpLink>
			ship with no built-in commands at all, but still show up
			here so you can use their "Add Command" button to wire up
			custom triggers.
		</p>
	</HelpSection>

	<HelpSection title="The copy-paste command snippet">
		<p>
			Below the per-toy editors is a generated text snippet
			listing every <em>enabled</em> command, grouped by toy,
			showing parameters, member-only / super-only flags, and
			descriptions. Paste it into your YouTube description, your
			Twitch panels, or pin it in chat so viewers know what they
			can run.
		</p>
		<HelpTip>
			Re-copy whenever you change a command name, cost, or
			cooldown — the snippet regenerates live from your current
			config.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Want to understand the command schema?">
		<p>
			See <HelpLink to="concepts.commandSchema">Command Schema</HelpLink>
			for what each column means (cost vs cooldown vs group
			cooldown, super-only vs member-only, the difference between
			built-in and custom commands).
		</p>
	</HelpSection>

</template>
