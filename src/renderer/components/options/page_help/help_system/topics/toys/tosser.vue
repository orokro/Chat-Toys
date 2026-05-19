<!--
	toys/tosser.vue
	---------------
-->
<script>
export const meta = {
	title: 'Tosser',
	tags: ['tosser', 'physics', 'overlay'],
	keywords: ['throw', 'toss', 'projectile', '3d', 'tomato', 'item', 'physics'],
	summary: 'Chat throws 3D items onto your stream that collide with a target.',
	order: 30,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A full-screen physics overlay where chatters throw 3D items
			at a collider. The default
			<HelpKbd>!toss</HelpKbd> throws something at the streamer's
			"target" position; <HelpKbd>!toss @user</HelpKbd> targets a
			specific chatter instead. Items have collision so they
			pile up and bounce realistically.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!toss</HelpKbd> [@user] [itemName] — throw the default item at the streamer; optionally target a chatter, optionally specify which item.</li>
		</ul>
		<p>
			Tosser also <strong>supports custom commands</strong> — you
			can wire up <HelpKbd>!tomato</HelpKbd>,
			<HelpKbd>!egg</HelpKbd>, etc., each tied to a specific 3D
			asset. See <HelpLink to="concepts.commandSchema">Command Schema</HelpLink>.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Item array</strong> — your tossable models, weights, optional sound effects, custom command bindings.</li>
			<li><strong>Target position</strong> — where the streamer "stands" so chats know where they're throwing.</li>
			<li><strong>Physics tuning</strong> — gravity, initial velocity, spin variance.</li>
		</ul>
	</HelpSection>

	<HelpWarning>
		Asset format matters. GLTF with materials and textures packed
		in is the most reliable. FBX may load but not render. See
		<HelpLink to="system.assets">Assets Database</HelpLink>.
	</HelpWarning>

	<HelpSection title="Tosser vs VTS Tosser">
		<p>
			Tosser is OBS-native: it's a browser source that overlays
			your stream. <HelpLink to="toys.vtsTosser">VTS Tosser</HelpLink>
			runs <em>inside VTubeStudio</em>, so the items live in the
			same 3D space as your model and physics line up with where
			your avatar actually is. Pick one based on whether you
			want a flat OBS layer or in-model physics.
		</p>
	</HelpSection>

</template>
