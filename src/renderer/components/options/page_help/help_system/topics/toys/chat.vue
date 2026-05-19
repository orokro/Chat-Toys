<!--
	toys/chat.vue
	-------------
-->
<script>
export const meta = {
	title: 'Chat',
	tags: ['chat', 'overlay'],
	keywords: ['chat box', 'on-stream chat', 'overlay', 'usernames', 'pfp', 'profile pictures'],
	summary: 'On-screen chat overlay with usernames, PFPs, and message styling.',
	order: 10,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A drop-in chat overlay you can place anywhere on screen.
			Mirrors your live chat with configurable username colors,
			text styling, profile pictures, and optional channel-points
			badges. No commands — viewers just chat normally and their
			messages appear.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Show chatter names / PFPs</strong> — toggles. Independent of each other.</li>
			<li><strong>Filter commands</strong> — when on, messages starting with <HelpKbd>!</HelpKbd> are hidden from the overlay so command spam doesn't clutter the chat.</li>
			<li><strong>Show chatter points</strong> — when on, every chatter's current channel-points balance is rendered as a small badge.</li>
			<li><strong>Group user messages</strong> — when on, consecutive messages from the same chatter collapse into a single visual block.</li>
			<li><strong>Custom chat theme</strong> — paste a theme name to swap the chat box's visual frame (a handful are bundled; see Assets).</li>
			<li><strong>Text Style</strong> — opens the
				<HelpLink to="concepts.textSettings">Text Settings</HelpLink>
				modal (username color, text color, size, shadow).</li>
		</ul>
	</HelpSection>

	<HelpSection title="Commands">
		<p>
			None. Chat is purely a renderer for messages that come in
			naturally. If you want chat-driven on-screen interactions
			that read like Super Chats, see
			<HelpLink to="toys.shout">Shout</HelpLink>; for swarm-mode
			see <HelpLink to="toys.swarm">Swarm</HelpLink>.
		</p>
	</HelpSection>

	<HelpTrouble>
		<p><strong>Profile pictures don't show.</strong></p>
		<p>
			The "cache PFP images" setting should be on. PFP fetching
			depends on the chat source (YouTube exposes PFPs reliably;
			Twitch is fetched separately). If they're stuck on the
			default avatar, restart Chat-Toys so the cache rebuilds.
		</p>
	</HelpTrouble>

</template>
