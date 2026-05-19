<!--
	troubleshooting/widgetBlankInObs.vue
	------------------------------------
-->
<script>
export const meta = {
	title: 'Widget shows blank in OBS',
	tags: ['troubleshooting', 'obs', 'blank'],
	keywords: ['blank obs', 'empty browser source', 'not showing', 'invisible widget'],
	summary: 'OBS shows the source as blank even though the widget works in a browser tab.',
	order: 2,
};
</script>
<template>

	<HelpSection title="Symptom">
		<p>
			You can load the widget URL in a regular browser tab and
			it works (the toy is rendering, the status light goes
			yellow). The same URL in an OBS browser source shows up
			as transparent / blank.
		</p>
	</HelpSection>

	<HelpSection title="Most likely cause: OBS cached an empty page">
		<p>
			OBS aggressively caches browser source contents. If you
			added the source while the widget server wasn't up, or
			before the toy was enabled, OBS may be holding onto an
			empty version. Right-click the source and pick
			<HelpKbd>Refresh cache of current page</HelpKbd>.
		</p>
		<HelpTip>
			Turn on "Auto Refresh Browser Sources Upon Connect" in
			<HelpLink to="connectionSettings.general">General Settings</HelpLink>
			so Chat-Toys does this for you on every reconnect.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Other things to check">
		<ul>
			<li><strong>Source size</strong> — if the source is sized 0×0 or scaled to nothing, the widget's there but invisible.</li>
			<li><strong>Z-order</strong> — another opaque source above it could be covering it.</li>
			<li><strong>Scene</strong> — make sure the source is in the scene you're previewing.</li>
		</ul>
	</HelpSection>

</template>
