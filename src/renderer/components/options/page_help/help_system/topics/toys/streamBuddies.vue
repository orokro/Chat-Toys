<!--
	toys/streamBuddies.vue
	----------------------
-->
<script>
export const meta = {
	title: 'Stream Buddies',
	tags: ['streamBuddies', 'avatar', 'character'],
	keywords: ['buddy', 'avatar', 'walk', 'jump', 'hug', 'dance', 'on-stream character', 'mascot'],
	summary: 'Viewers control little 3D characters that walk around your stream.',
	order: 33,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Viewers opt in with <HelpKbd>!join</HelpKbd> and get a
			little 3D character on your stream that they can walk,
			jump, hug, attack, dance, and fart with. The characters
			persist between commands so chatters can build little
			ongoing on-screen presences.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!join</HelpKbd> — spawn your character on stream.</li>
			<li><HelpKbd>!leave</HelpKbd> — remove your character.</li>
			<li><HelpKbd>!left</HelpKbd> [amount] — walk left, optionally a specific distance.</li>
			<li><HelpKbd>!right</HelpKbd> [amount] — walk right, optionally a specific distance.</li>
			<li><HelpKbd>!jump</HelpKbd> [direction] — jump, optionally directional.</li>
			<li><HelpKbd>!hug</HelpKbd> @user — hug another on-screen buddy.</li>
			<li><HelpKbd>!attack</HelpKbd> @user — attack another buddy.</li>
			<li><HelpKbd>!dance</HelpKbd> — dance.</li>
			<li><HelpKbd>!sit</HelpKbd> — sit down.</li>
			<li><HelpKbd>!fart</HelpKbd> — exactly what you think.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Character roster</strong> — the FBX characters available for buddies to wear.</li>
			<li><strong>Ground level / camera</strong> — the on-stream stage where buddies live.</li>
			<li><strong>Idle behaviors</strong> — what buddies do when their chatter isn't actively commanding them.</li>
		</ul>
		<HelpWarning>
			Character imports are sensitive. FBX with a Mixamo rig in
			T-pose is the format that's most likely to work. See
			<HelpLink to="system.assets">Assets Database</HelpLink>.
		</HelpWarning>
	</HelpSection>

</template>
