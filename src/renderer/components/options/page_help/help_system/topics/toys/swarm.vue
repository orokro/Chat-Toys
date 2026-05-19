<!--
	toys/swarm.vue
	--------------
-->
<script>
export const meta = {
	title: 'Swarm',
	tags: ['swarm', 'overlay', 'group'],
	keywords: ['flood', 'group chat', 'flood screen', 'mass message'],
	summary: 'When enough chatters use !swarm at once, their messages flood the screen.',
	order: 12,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A coordinated hype moment. Chatters run
			<HelpKbd>!swarm &lt;message&gt;</HelpKbd>; if enough of
			them do it inside a short window, every queued message
			erupts across the screen at once and lingers for a
			configurable duration.
		</p>
		<p>
			Unlike Shout, individual swarm messages don't show — only
			the collective burst once the threshold is met.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!swarm &lt;message&gt;</HelpKbd> — only command. Free or point-costed depending on your edit.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Swarm Size</strong> — how many chatters must use the command (within the threshold window) before the burst triggers.</li>
			<li><strong>Swarm Duration</strong> — how long the burst stays on screen.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink>.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Swarm is best as a full-screen overlay so the messages can
		visually crowd the canvas. Size the OBS browser source to your
		full canvas (1920×1080 etc.) for the intended effect.
	</HelpTip>

</template>
