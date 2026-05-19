<!--
	connectionSettings/bttv.vue
	---------------------------
-->
<script>
export const meta = {
	title: 'BTTV Integration',
	tags: ['bttv', 'emoji', 'twitch'],
	keywords: ['betterttv', 'emote', 'custom emoji', 'channel emote'],
	summary: 'Optional BetterTTV emoji support for Twitch chat.',
	order: 5,
};
</script>
<template>

	<HelpSection title="What BTTV adds">
		<p>
			BetterTTV (<HelpKbd>betterttv.com</HelpKbd>) is a popular
			Twitch-side service that adds custom emojis on top of
			Twitch's built-in set. With BTTV integration enabled,
			Chat-Toys can recognize and render those emojis in chat-
			facing widgets — chat overlay, shout pop-ups, etc.
		</p>
		<HelpWarning>
			BTTV support is currently experimental. In particular, BTTV
			emotes do <strong>not</strong> work inside the Tosser
			system (the items you throw on screen). Standard emojis
			and regular Twitch emotes still work fine there.
		</HelpWarning>
	</HelpSection>

	<HelpSection title="Turning it on">
		<ol>
			<li>Toggle <strong>Enable BTTV Integration</strong>. Chat-
				Toys downloads BTTV's global emoji set and caches it
				locally.</li>
			<li>Optionally enable <strong>Use Global BTTV Emojis</strong>
				to fall back to BTTV's site-wide emote set when no
				channel-specific match is found.</li>
		</ol>
	</HelpSection>

	<HelpSection title="Channel-specific emojis">
		<p>
			BTTV emojis are usually per-channel. Down the page you'll
			find a field that takes <strong>numerical Twitch channel
			IDs</strong> — paste yours (and any channels whose emojis
			you also want to use) to pull their emoji set.
		</p>
		<HelpTip>
			Looking up your channel ID: services like
			<HelpKbd>streamweasels.com/tools/convert-twitch-username-to-user-id</HelpKbd>
			translate a username to its numerical id.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Browse and enable">
		<p>
			The Browse &amp; Search section lets you cherry-pick which
			emojis to enable from the larger BTTV catalog, so you don't
			have to wholesale-import thousands of emotes. Anything you
			check stays enabled across app restarts.
		</p>
	</HelpSection>

</template>
