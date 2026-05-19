<!--
	toys/donations.vue
	------------------
-->
<script>
export const meta = {
	title: 'Donations',
	tags: ['donations', 'alert', 'super chat', 'bits'],
	keywords: ['super chat', 'sc', 'cheers', 'tips', 'sub', 'membership', 'paid'],
	summary: 'On-screen popup for YouTube Super Chats and Twitch bits cheers.',
	order: 15,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A popup that appears whenever a viewer drops real money:
			YouTube Super Chats and Super Stickers, or Twitch bits
			cheers. Each tier has its own configurable image, sound,
			and color, so a small tip is visually different from a
			larger one.
		</p>
	</HelpSection>

	<HelpSection title="No commands">
		<p>
			Donations doesn't run on a chat command — it fires when
			the chat platform reports a paid event. Just enable the toy,
			place the widget in OBS, and it triggers on its own.
		</p>
	</HelpSection>

	<HelpSection title="Tiers and customization">
		<p>
			The Donations settings page has a tier editor: define
			brackets (e.g. $1–$4, $5–$9, $10+) and assign each one a
			tier color, an image, and an SFX. The popup picks the
			matching tier at render time.
		</p>
		<ul>
			<li><strong>Bg / border / opacity</strong> — controls the popup card's chrome so it matches your overlay aesthetic.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink>.</li>
			<li><strong>Display Duration</strong> — seconds the card stays visible.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Twitch bits routing">
		<p>
			On Twitch, bit cheers are routed into the Donations toy
			using a configurable cents-per-bit conversion (so a
			"100-bit cheer" maps onto your $1 tier). The conversion
			rate is set on the
			<HelpLink to="tools.scConversion">SC Conversion</HelpLink>
			tool's page.
		</p>
		<HelpTrouble>
			<p><strong>Bits cheer doesn't fire the donation alert.</strong></p>
			<p>
				Confirm three things: (1) your chat source is set to
				Twitch in <HelpLink to="connectionSettings.twitch">Twitch Settings</HelpLink>,
				(2) the Donations toy is enabled, and (3) the SC
				Conversion tool is enabled. All three need to be true.
			</p>
		</HelpTrouble>
	</HelpSection>

	<HelpSection title="Omni integration">
		<p>
			Alert-eligible. Drop it into an
			<HelpLink to="toys.omni">Omni</HelpLink> group to serialize
			donations with shouts, head pats, etc.
		</p>
	</HelpSection>

</template>
