<!--
	concepts/textSettings.vue
	-------------------------
-->
<script>
export const meta = {
	title: 'Text Settings',
	tags: ['text', 'styling', 'fonts', 'colors', 'concepts'],
	keywords: ['font size', 'color', 'shadow', 'border', 'styling', 'username color'],
	summary: 'The unified text-styling modal shared across most toys.',
	order: 5,
};
</script>
<template>

	<HelpSection title="One modal, many toys">
		<p>
			Most visual toys (Chat, Shout, Donations, Help, Media,
			HeadPat, Output Log, …) need very similar text controls —
			font size, color for the chatter's name, color for the
			message body, drop shadow on / off. Rather than each toy
			rolling its own UI, those controls live in a single
			<em>Text Settings</em> modal that any toy can opt into.
		</p>
		<p>
			You'll find a "Text Style" row on each affected toy's
			settings page. Click <strong>Edit</strong> and the modal
			opens with the relevant field group for that toy.
		</p>
	</HelpSection>

	<HelpSection title="What's editable">
		<p>
			Each toy declares which fields apply to it. Common ones:
		</p>
		<ul>
			<li><strong>Font size</strong> — pixels for the relevant text class.</li>
			<li><strong>Username color</strong> — color of the chatter's display name.</li>
			<li><strong>Text color</strong> — color of the message body.</li>
			<li><strong>Text shadow</strong> — drop shadow on / off for readability over busy backgrounds.</li>
			<li><strong>Background opacity</strong> / <strong>border</strong> — on toys that have a visible card (Donations, Help).</li>
		</ul>
		<HelpTip>
			Settings are saved per-toy. Changing a Shout color won't
			affect Donations. If you want consistent styling across
			the whole stream, set each toy individually.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Where the values are stored">
		<p>
			Like every other setting, these live in local storage
			(persisted across restarts). They sync into the widget
			over WebSocket — change a color in the main window and
			the OBS browser source updates without needing a refresh.
		</p>
	</HelpSection>

</template>
