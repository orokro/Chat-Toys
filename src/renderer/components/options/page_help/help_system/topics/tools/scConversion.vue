<!--
	tools/scConversion.vue
	----------------------
-->
<script>
export const meta = {
	title: 'SC Conversion',
	tags: ['scConversion', 'tool', 'super chat', 'bits'],
	keywords: ['super chat', 'sc', 'cheer', 'bits', 'tip', 'conversion', 'cents per bit', 'usd per point'],
	summary: 'Convert YouTube Super Chats and Twitch bit cheers into channel points (and donation alerts).',
	order: 2,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Wires paid chat events (YouTube Super Chats, YouTube Super
			Stickers, Twitch bit cheers) into the in-app economy. Two
			outputs:
		</p>
		<ul>
			<li><strong>Channel points</strong> — the paying viewer's
				balance is bumped by an amount derived from the
				conversion rules.</li>
			<li><strong>Donation alert</strong> — the event is routed
				into <HelpLink to="toys.donations">Donations</HelpLink>
				so the matching tier popup fires.</li>
		</ul>
	</HelpSection>

	<HelpSection title="No commands">
		<p>
			SC Conversion is passive — it doesn't expose a command. It
			just hooks into chat-platform events and converts them.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>USD-to-points ratio</strong> — how many channel points each dollar of Super Chat is worth.</li>
			<li><strong>Cents-per-bit</strong> — how many cents one Twitch bit represents, so 100-bit cheers route to the dollar-tier popup.</li>
			<li><strong>Per-tier overrides</strong> — optionally pin specific Super Chat amounts to specific point payouts that don't follow the linear formula.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Enabling SC Conversion is what turns Twitch bits into a
		donation alert — if bits aren't firing the donation popup,
		check that this tool is enabled in the Tool Box. See
		<HelpLink to="toys.donations">Donations</HelpLink> for the
		full Twitch-bits troubleshooting path.
	</HelpTip>

</template>
