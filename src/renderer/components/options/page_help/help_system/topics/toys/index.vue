<!--
	toys/index.vue
	--------------
-->
<script>
export const meta = {
	title: 'Toys',
	tags: ['toys'],
	keywords: ['toy box', 'all toys', 'overview'],
	summary: 'Per-toy docs for every toy that ships with Chat-Toys.',
	order: 4,
};
</script>
<template>

	<HelpSection title="The Toys section">
		<p>
			Each entry here covers one toy in detail — what it does,
			its commands and settings, the gotchas, and where it fits
			with the rest of the system. Toys are the things your
			audience sees: chat overlays, pop-ups, games, ambient
			animations.
		</p>
		<p>
			For toys that don't put pixels on screen on their own (the
			Channel Points economy, SuperChat conversion rules), see
			<HelpLink to="tools">Tools</HelpLink>.
		</p>
	</HelpSection>

	<HelpTip>
		If a toy is missing from this section it's because it isn't
		shipped in your current build. The list rebuilds automatically
		from the topic files in <HelpKbd>help_system/topics/toys/</HelpKbd>.
	</HelpTip>

</template>
