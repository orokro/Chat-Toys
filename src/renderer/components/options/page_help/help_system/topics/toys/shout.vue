<!--
	toys/shout.vue
	--------------
-->
<script>
export const meta = {
	title: 'Shout',
	tags: ['shout', 'alert', 'channel points'],
	keywords: ['super chat', 'announcement', 'channel points', 'big message'],
	summary: 'Lets viewers spend points to display a message as a big on-screen pop-up.',
	order: 11,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A "channel-points Super Chat" — a viewer runs
			<HelpKbd>!shout your message here</HelpKbd>, pays the
			configured cost in points, and their message gets a big
			pop-up card on screen with their name and an optional
			sound effect.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!shout &lt;message&gt;</HelpKbd> — the only command. The full text after <HelpKbd>!shout</HelpKbd> becomes the displayed message.</li>
		</ul>
		<p>
			Set the cost on the command's row in the command editor.
			Set the duration the card stays on screen via the
			<strong>Display Duration</strong> setting.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Enable sound / Shout Sound</strong> — picks the SFX from the assets library that plays when a shout fires.</li>
			<li><strong>Display Duration</strong> — seconds the card stays visible.</li>
			<li><strong>Text Style</strong> — opens the <HelpLink to="concepts.textSettings">Text Settings</HelpLink> modal.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Omni integration">
		<p>
			Shout is alert-eligible. Drop it into an
			<HelpLink to="toys.omni">Omni</HelpLink> group with other
			alert toys and they'll serialize through a single visual
			slot — no overlapping pop-ups.
		</p>
	</HelpSection>

	<HelpExample>
		<p><strong>Chatter:</strong> <code>!shout I love this stream</code></p>
		<p><strong>On stream:</strong> a card slides in showing the chatter's name and the message, plays the chosen SFX, stays for the configured duration, then slides out.</p>
	</HelpExample>

</template>
