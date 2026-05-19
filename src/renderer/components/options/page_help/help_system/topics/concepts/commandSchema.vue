<!--
	concepts/commandSchema.vue
	--------------------------
-->
<script>
export const meta = {
	title: 'Command Schema',
	tags: ['commands', 'reference', 'concepts'],
	keywords: ['cost', 'cooldown', 'parameters', 'params', 'super only', 'member only', 'custom commands', 'how commands work'],
	summary: 'Every field on a command, what it does, and how the processor reads it.',
	order: 3,
};
</script>
<template>

	<HelpSection title="Every command is the same shape">
		<p>
			Whether it's built-in (the prize wheel's
			<HelpKbd>!spin</HelpKbd>) or one you add yourself (a custom
			<HelpKbd>!hype</HelpKbd> that fires a Media item), every
			command shares the same set of fields. The Command Editor
			and the master
			<HelpLink to="system.commands">Commands page</HelpLink>
			expose the same columns either way.
		</p>
	</HelpSection>

	<HelpSection title="The fields">

		<p><strong>Enabled.</strong> Off means the command does nothing — chat can type it but no toy gets the message.</p>

		<p><strong>Super Only.</strong> Command will only fire if the chat message is a Super Chat (YouTube) or a comparable Twitch hype. Useful for higher-cost commands you only want gated to viewers who paid.</p>

		<p><strong>Member Only.</strong> Command will only fire if the sender is a channel member / Twitch sub.</p>

		<p><strong>Command.</strong> The chat text after the leading <HelpKbd>!</HelpKbd>. You can rename this to match your channel's vibe — the underlying logic stays attached via the command's stable <em>slug</em>.</p>

		<p><strong>Params.</strong> Optional structured arguments. The chat parser splits the rest of the message on whitespace and applies each named param in order. Required params missing? Command silently fails validation. Optional params absent? The command still fires.</p>

		<p><strong>Cost.</strong> Channel points charged to the chatter when the command fires. Ignored unless the <HelpLink to="tools.channelPoints">Channel Points</HelpLink> tool is enabled. Insufficient balance = command silently rejected.</p>

		<p><strong>User Cool Down.</strong> Seconds before the <em>same chatter</em> can run this command again.</p>

		<p><strong>Group Cool Down.</strong> Seconds before <em>any</em> chatter can run this command again.</p>

		<p><strong>Description.</strong> The viewer-facing hint that shows up in the copy/paste command list. Some toys also use this as the tip line shown by the in-app Help widget.</p>
	</HelpSection>

	<HelpSection title="Admin bypass">
		<p>
			The command processor honors an admin status (channel owner
			or moderator on the source platform). Admins bypass
			cooldowns and channel-points costs entirely, so you can
			test any command in your own chat without burning balance.
		</p>
	</HelpSection>

	<HelpSection title="Built-in vs custom commands">
		<p>
			Built-in commands ship with their owning toy. You can
			rename them, change their cost / cooldown / member-only,
			disable them — but they always belong to a specific toy
			and trigger that toy's behavior.
		</p>
		<p>
			Custom commands live on toys that opt in (currently
			<HelpLink to="toys.media">Media</HelpLink>,
			<HelpLink to="toys.tosser">Tosser</HelpLink>, and
			<HelpLink to="toys.vtsTosser">VTS Tosser</HelpLink>).
			You add them yourself, and you wire each one to a specific
			asset (a Media item, a Tosser model) in that toy's settings.
		</p>
		<HelpTip>
			When the schema gets a new field (we recently added
			<HelpKbd>tipText</HelpKbd> for the Help widget), existing
			user-edited commands inherit the new field's default
			automatically — your customizations aren't lost. See
			<HelpKbd>reconcileCommandsList</HelpKbd> in the source
			if you're curious how.
		</HelpTip>
	</HelpSection>

</template>
