<!--
	concepts/index.vue
	------------------
-->
<script>
export const meta = {
	title: 'Concepts',
	tags: ['concepts', 'reference'],
	keywords: ['how it works', 'architecture', 'why', 'reference'],
	summary: 'Deeper reference on widgets, commands, points, alerts, and the omni system.',
	order: 6,
};
</script>
<template>

	<HelpSection title="Reference, not setup">
		<p>
			The toy-by-toy docs cover what you need to use each toy.
			This section covers the moving parts that show up
			everywhere — how widgets become OBS sources, how the
			command schema actually works under the hood, the
			channel-points economy, the text-settings modal, and how
			the Omni alert system gates one alert per stream beat.
		</p>
	</HelpSection>

	<HelpSection title="Topics in this section">
		<ul>
			<li><HelpLink to="concepts.widgetsAndObs">Widgets &amp; OBS Browser Sources</HelpLink> — the OBS-side mechanics.</li>
			<li><HelpLink to="concepts.liveStatus">Live Status (Heartbeats)</HelpLink> — what the green/yellow/gray light means.</li>
			<li><HelpLink to="concepts.commandSchema">Command Schema</HelpLink> — fields, cooldowns, member/super, custom commands.</li>
			<li><HelpLink to="concepts.channelPointsEconomy">Channel Points Economy</HelpLink> — how points are earned, spent, and admin-bypassed.</li>
			<li><HelpLink to="concepts.textSettings">Text Settings</HelpLink> — the unified text-style modal used across most toys.</li>
			<li><HelpLink to="concepts.omniAlerts">Omni Alerts</HelpLink> — gating multiple alert toys into a single visual queue.</li>
		</ul>
	</HelpSection>

</template>
