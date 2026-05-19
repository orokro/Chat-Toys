<!--
	toys/help.vue
	-------------
-->
<script>
export const meta = {
	title: 'Help Tips',
	tags: ['help', 'alert', 'tips'],
	keywords: ['hint', 'how to', 'tip text', 'remind viewers', 'discoverability'],
	summary: 'Periodically surfaces an on-screen card teaching chatters which commands you have.',
	order: 16,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Picks one of your enabled commands at random every so
			often, formats its "tip text" with the current command
			name, and shows it as a slide-in card on screen — so a
			viewer who just joined the stream can discover that
			<HelpKbd>!shout</HelpKbd> exists without you having to
			announce it.
		</p>
	</HelpSection>

	<HelpSection title="No commands of its own">
		<p>
			Help reads <em>other toys'</em> commands. There's nothing
			to type — enable Help, place the widget in OBS, and it
			drives itself off everything else you've got configured.
		</p>
	</HelpSection>

	<HelpSection title="Where tip text comes from">
		<p>
			Each command has an optional <strong>tipText</strong>
			field (set in the toy's source or, for custom commands,
			via the edit modal). Help substitutes <HelpKbd>{cmd}</HelpKbd>
			at render time with the current (possibly-renamed) command
			text, so renaming <HelpKbd>!shout</HelpKbd> to
			<HelpKbd>!yell</HelpKbd> updates the tip automatically.
		</p>
		<HelpExample>
			<p><strong>tipText:</strong> <code>Got something to say? {cmd} &lt;message&gt; shouts it on stream</code></p>
			<p><strong>Renders as:</strong> "Got something to say? !shout &lt;message&gt; shouts it on stream"</p>
		</HelpExample>
		<HelpTip>
			Commands without a tipText are skipped — Help only
			surfaces commands that have something useful to say. If
			you want a custom command to appear, give it a tipText in
			its edit dialog.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Interval</strong> — seconds between tip appearances.</li>
			<li><strong>Display Duration</strong> — seconds the card stays on screen.</li>
			<li><strong>Background / border / opacity</strong> — the card's chrome.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink>.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Omni integration">
		<p>
			Alert-eligible — drop it into an
			<HelpLink to="toys.omni">Omni</HelpLink> group so help tips
			don't overlap your other alerts.
		</p>
	</HelpSection>

</template>
