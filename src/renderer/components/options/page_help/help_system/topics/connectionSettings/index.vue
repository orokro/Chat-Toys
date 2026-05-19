<!--
	connectionSettings/index.vue
	----------------------------

	Landing for the Connection Settings section, mirroring the layout
	of the actual Connection Settings tab in the app.
-->
<script>
export const meta = {
	title: 'Connection Settings',
	tags: ['connection', 'setup', 'integration'],
	keywords: ['connect', 'integration', 'authorize', 'login', 'oauth'],
	summary: 'Connecting Chat-Toys to your chat platform, OBS, VTubeStudio, and BTTV.',
	order: 2,
};
</script>
<template>

	<HelpSection title="What this section covers">
		<p>
			Chat-Toys plugs into the outside world through a handful
			of services. Each one is configured under
			<strong>Connection Settings</strong> on the top tab strip,
			and each has its own entry below.
		</p>
		<ul>
			<li><HelpLink to="connectionSettings.chatSettings">Chat Settings</HelpLink> — YouTube chat sources and the experimental auto-chat finder.</li>
			<li><HelpLink to="connectionSettings.twitch">Twitch Settings</HelpLink> — authenticate against Twitch to read chat.</li>
			<li><HelpLink to="connectionSettings.general">General Settings</HelpLink> — OBS WebSocket connection, demo mode, and the local widget server.</li>
			<li><HelpLink to="connectionSettings.vtubeStudio">VTubeStudio Settings</HelpLink> — optional, only needed for the VTS Tosser toy.</li>
			<li><HelpLink to="connectionSettings.bttv">BTTV Integration</HelpLink> — extra emoji support (experimental).</li>
		</ul>
	</HelpSection>

	<HelpSection title="You only need a couple of these">
		<p>
			Most streamers need exactly two: a chat connection (YouTube
			<em>or</em> Twitch) and an OBS connection. The rest are
			opt-in: VTubeStudio only matters if you want the VTS Tosser
			to throw items at your model, and BTTV only matters if you
			want extra Twitch emojis to render.
		</p>
	</HelpSection>

</template>
