<!--
	connectionSettings/vtubeStudio.vue
	----------------------------------
-->
<script>
export const meta = {
	title: 'VTubeStudio Settings',
	tags: ['vtubestudio', 'vts', 'vtuber'],
	keywords: ['live2d', 'avatar', 'vtuber', 'plugin', 'tosser'],
	summary: 'Optional VTubeStudio integration, mainly for the VTS Tosser toy.',
	order: 4,
};
</script>
<template>

	<HelpSection title="Why this exists">
		<p>
			Chat-Toys can speak VTubeStudio's plugin protocol over a
			local WebSocket. The main use case today is the
			<HelpLink to="toys.vtsTosser">VTS Tosser</HelpLink> — a
			variant of the regular Tosser that hurls items at your
			VTubeStudio avatar inside VTS rather than as a flat
			overlay in OBS, so the model can react and the collision
			lines up with where your face actually is.
		</p>
		<p>
			Other future toys may also tap this connection. If you
			don't use VTubeStudio, you can ignore this whole tab.
		</p>
	</HelpSection>

	<HelpSection title="Enabling the plugin">
		<ol>
			<li>In VTubeStudio, enable the API under
				<HelpKbd>Settings → Plugin Settings</HelpKbd>.</li>
			<li>Note the port (default 8001).</li>
			<li>In Chat-Toys' VTubeStudio Settings, enter the same port
				and toggle "Enable VTubeStudio Connection".</li>
			<li>Switch back to VTubeStudio — a permission prompt will
				appear asking whether to allow the Chat-Toys plugin.
				Approve it.</li>
		</ol>
		<p>
			Once approved, the status lines on the page should show
			"Connected" and "Plugin Authenticated".
		</p>
	</HelpSection>

	<HelpSection title="The output log">
		<p>
			Some VTS interactions need files placed in VTubeStudio's
			StreamAssets folder. When that fails — wrong path,
			permission issue, missing asset — the failures land in the
			Output Log at the bottom of the page. Skim it if a VTS-
			dependent toy isn't behaving.
		</p>
	</HelpSection>

</template>
