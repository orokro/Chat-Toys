<!--
	toys/media.vue
	--------------
-->
<script>
export const meta = {
	title: 'Media',
	tags: ['media', 'images', 'gifs', 'sounds', 'alert'],
	keywords: ['picture', 'gif', 'audio', 'soundboard', 'custom command', 'meme'],
	summary: 'Custom commands that trigger an image, gif, or sound on screen.',
	order: 13,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Pair a chat command with a media asset (image, GIF, or
			sound — or any combo) and viewers can trigger it on
			demand. Media is the toy you reach for when you want a
			soundboard, meme buttons, or simple animated reactions.
		</p>
	</HelpSection>

	<HelpSection title="Custom commands only">
		<p>
			Media ships with <strong>no commands</strong>. You add them
			yourself via the "Add Command" button — one per media
			item. Each command points at an asset from the
			<HelpLink to="system.assets">Assets database</HelpLink>.
		</p>
		<HelpExample>
			<p>Create a custom command <HelpKbd>!bonk</HelpKbd>. Assign it the
			"bonk.gif" asset and the "bonk.mp3" SFX. Cost it at 50 points. Now
			any viewer can spend 50 points to play it on screen.</p>
		</HelpExample>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Item array</strong> — your media assignments. Each row binds an asset (or two) to a command and lets you set duration.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink> for the chatter-name label that appears with the media.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Omni integration">
		<p>
			Media is alert-eligible. Drop it into an
			<HelpLink to="toys.omni">Omni</HelpLink> group to serialize
			it with shouts, donations, and head pats. Without Omni,
			multiple media commands at once will overlap.
		</p>
	</HelpSection>

	<HelpTrouble>
		<p><strong>I added a command but nothing happens when chat runs it.</strong></p>
		<p>
			Double-check the command is enabled (the Enabled checkbox
			on its row) and that the assigned asset still exists in
			the Assets database. A deleted asset leaves the command
			pointing at nothing.
		</p>
	</HelpTrouble>

</template>
