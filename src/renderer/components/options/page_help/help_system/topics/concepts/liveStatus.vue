<!--
	concepts/liveStatus.vue
	-----------------------
-->
<script>
export const meta = {
	title: 'Live Status (Heartbeats)',
	tags: ['status', 'live', 'heartbeat', 'concepts'],
	keywords: ['gray', 'yellow', 'green', 'light', 'indicator', 'is it running'],
	summary: 'What the colored status light next to each widget means.',
	order: 2,
};
</script>
<template>

	<HelpSection title="The three colors">
		<p>
			Every widget row — both on each toy's settings page and on
			the <HelpLink to="system.widgets">Widgets master page</HelpLink>
			— shows a small colored light. The light tells you whether
			that widget is currently being rendered somewhere, and
			where.
		</p>
		<ul>
			<li><strong>Gray</strong> — nobody's rendering this widget. No OBS source, no browser tab.</li>
			<li><strong>Yellow</strong> — a regular browser tab is rendering it. Useful while you test in Chrome / Firefox.</li>
			<li><strong>Green</strong> — OBS is rendering it. The viewer-facing path is live.</li>
		</ul>
	</HelpSection>

	<HelpSection title="How it works under the hood">
		<p>
			Each widget sends a heartbeat back to the app every second
			or so, including a tag identifying its host (OBS vs
			browser). The app keeps a "last heard from" timestamp per
			widget. If a heartbeat hasn't arrived in the last ~10
			seconds, the widget is considered gray.
		</p>
		<HelpTip>
			The same heartbeat mechanism is what some toys use to
			decide whether to fire — there's no point queuing up a
			donation alert if nothing is rendering the donation widget.
			See <HelpLink to="concepts.omniAlerts">Omni Alerts</HelpLink>
			for how this interacts with the alert-gating system.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Why it lags a second or two">
		<p>
			The status reflects what the app heard, not real-time
			activity. Closing OBS will leave the light green for a few
			seconds before it falls back to gray, because the app is
			still inside its heartbeat-staleness window. This is by
			design — we'd rather tolerate brief network blips than
			flicker the light on every dropped packet.
		</p>
	</HelpSection>

</template>
