<!--
	connectionSettings/twitch.vue
	-----------------------------
-->
<script>
export const meta = {
	title: 'Twitch Settings',
	tags: ['twitch', 'chat', 'connection'],
	keywords: ['authenticate', 'oauth', 'irc', 'bits'],
	summary: 'Authenticating Chat-Toys against Twitch to read chat.',
	order: 2,
};
</script>
<template>

	<HelpSection title="One-click connect">
		<p>
			Unlike YouTube, Twitch chat is tied to your account at the
			permission level — once you authenticate Chat-Toys against
			Twitch, the app can read chat from any of your channels
			without you having to add individual chat sources.
		</p>
		<p>
			Hit the "Authenticate with Twitch" button on the Twitch
			Settings page. Twitch opens its standard authorization flow
			in the browser; once you approve, you're connected.
		</p>
	</HelpSection>

	<HelpSection title="What you get from a Twitch connection">
		<ul>
			<li>Live chat as the source for every command.</li>
			<li><strong>Cheer / bits</strong> events routed to the
				<HelpLink to="toys.donations">Donations toy</HelpLink>,
				so a viewer cheering bits triggers a donation alert and
				bumps the appropriate counters.</li>
			<li>Member-only command flags honored against your Twitch
				subscribers (the "Member Only" checkbox on a command).</li>
		</ul>
	</HelpSection>

	<HelpSection title="The raw-chat preview">
		<p>
			Same idea as the YouTube page — the Live Raw Chat panel at
			the bottom mirrors everything coming in. Use it to sanity-
			check that your Twitch connection is alive without having
			to start a stream.
		</p>
	</HelpSection>

	<HelpTrouble>
		<p><strong>Bits cheer doesn't fire a donation alert.</strong></p>
		<p>
			This is a known interaction: bits only route to Donations
			if your chat source is Twitch <em>and</em> the Donations
			toy is enabled. Make sure both are true. The Donations toy
			itself has a dedicated section about bits — see the
			<HelpLink to="toys.donations">Donations docs</HelpLink>.
		</p>
	</HelpTrouble>

</template>
