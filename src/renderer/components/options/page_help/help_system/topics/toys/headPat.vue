<!--
	toys/headPat.vue
	----------------
-->
<script>
export const meta = {
	title: 'Head Pat / Bonk / Slap',
	tags: ['headPat', 'alert', 'reaction'],
	keywords: ['pat', 'bonk', 'slap', 'streamer', 'avatar', 'reaction'],
	summary: 'Pat, bonk, or slap the streamer (or any chatter) with on-screen reactions.',
	order: 14,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A trio of reaction commands. The chatter runs
			<HelpKbd>!pat</HelpKbd>, <HelpKbd>!bonk</HelpKbd>, or
			<HelpKbd>!slap</HelpKbd> and a hand-graphic plays over
			the streamer's avatar or webcam feed. Add
			<HelpKbd>@username</HelpKbd> and the reaction targets that
			chatter instead, with their profile picture as the recipient.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!pat</HelpKbd> [@user] — give head pats.</li>
			<li><HelpKbd>!bonk</HelpKbd> [@user] — give bonks.</li>
			<li><HelpKbd>!slap</HelpKbd> [@user] — give slaps.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Two widget targets">
		<p>
			HeadPat has <strong>two</strong> widget URLs:
		</p>
		<ul>
			<li><strong>Streamer overlay</strong> — for placing over your avatar or webcam feed. Triggered when no <HelpKbd>@user</HelpKbd> is specified.</li>
			<li><strong>Chatter overlay</strong> — shows the reaction over a generic chatter profile picture. Place this anywhere on screen.</li>
		</ul>
		<p>
			Both URLs are listed on the toy's settings page or on the
			<HelpLink to="system.widgets">Widgets master page</HelpLink>.
		</p>
	</HelpSection>

	<HelpSection title="Omni integration">
		<p>
			The chatter-target variant is Omni-eligible — it shares
			the alert lane with shouts, donations, etc. The streamer
			variant plays over your avatar and doesn't interrupt
			alert flow, so it doesn't participate in Omni gating.
		</p>
	</HelpSection>

</template>
