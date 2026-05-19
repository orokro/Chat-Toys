<!--
	toys/vtsTosser.vue
	------------------
-->
<script>
export const meta = {
	title: 'VTS Tosser',
	tags: ['vtsTosser', 'tosser', 'vtubestudio', 'physics'],
	keywords: ['vts', 'vtuber', 'yeet', 'live2d', 'avatar collision'],
	summary: 'Tosser variant that throws items inside VTubeStudio for in-model collision.',
	order: 31,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Same idea as the regular Tosser, but the items live inside
			VTubeStudio rather than as an OBS browser source. Your
			VTuber avatar can then physically react to incoming items
			and the collision lines up with where your face actually
			is on screen.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!yeet</HelpKbd> [@user] [itemName] — throw at the streamer (or a chatter target).</li>
		</ul>
		<p>
			Like the regular Tosser, VTS Tosser supports custom
			commands — bind <HelpKbd>!brick</HelpKbd> to a specific
			3D asset.
		</p>
	</HelpSection>

	<HelpSection title="Setup gotchas">
		<HelpWarning>
			VTS Tosser requires the VTubeStudio plugin connection. See
			<HelpLink to="connectionSettings.vtubeStudio">VTubeStudio Settings</HelpLink>
			for the one-time setup, and make sure the plugin is
			authenticated before expecting tosses to land.
		</HelpWarning>
		<HelpTrouble>
			<p><strong>Items appear way off from my model.</strong></p>
			<p>
				VTS Tosser has a calibration step that captures your
				model's current position so it knows where to aim.
				Recalibrate any time you scale or reposition your model
				inside VTubeStudio.
			</p>
		</HelpTrouble>
	</HelpSection>

</template>
