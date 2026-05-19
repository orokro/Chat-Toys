<!--
	troubleshooting/twitchBitsNotFiring.vue
	---------------------------------------
-->
<script>
export const meta = {
	title: 'Twitch bits don\'t fire the donation alert',
	tags: ['troubleshooting', 'twitch', 'bits', 'donations'],
	keywords: ['cheer', 'bits not working', 'donation no popup', 'cents per bit'],
	summary: 'A viewer cheers bits on Twitch but the Donations popup doesn\'t appear.',
	order: 4,
};
</script>
<template>

	<HelpSection title="All three of these must be true">
		<ol>
			<li>Your chat source is <strong>Twitch</strong> (see <HelpLink to="connectionSettings.twitch">Twitch Settings</HelpLink>). Bits don't exist on YouTube.</li>
			<li>The <HelpLink to="toys.donations">Donations</HelpLink> toy is <strong>enabled</strong> in the Toy Box.</li>
			<li>The <HelpLink to="tools.scConversion">SC Conversion</HelpLink> tool is <strong>enabled</strong> in the Tool Box — this is what translates bits into a tier so the popup knows which one to show.</li>
		</ol>
	</HelpSection>

	<HelpSection title="If all three are on">
		<ul>
			<li>Check the SC Conversion settings for a sensible cents-per-bit ratio. A misconfigured ratio could be routing bits into a $0 tier that has no visible popup.</li>
			<li>Confirm the donation widget itself is rendering (look for the row in <HelpLink to="system.widgets">Widgets master page</HelpLink> — it should be green during your stream).</li>
			<li>Confirm bits are reaching the app at all — the Twitch raw-chat preview shows incoming events.</li>
		</ul>
	</HelpSection>

</template>
