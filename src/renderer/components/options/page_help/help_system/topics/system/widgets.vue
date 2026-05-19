<!--
	system/widgets.vue
	------------------
-->
<script>
export const meta = {
	title: 'Widgets',
	tags: ['widgets', 'system', 'obs'],
	keywords: ['urls', 'browser source', 'master list', 'all widgets', 'status light'],
	summary: 'Master list of every widget URL across every enabled toy.',
	order: 1,
};
</script>
<template>

	<HelpSection title="What this page shows">
		<p>
			One row per widget across every toy and tool you've enabled.
			Each row has the same three pieces: a live status light, a
			short label that says which toy the widget belongs to, and
			the widget's URL with a copy button.
		</p>
		<p>
			Drop any of these URLs into OBS as a browser source — or
			into a regular browser tab for testing — and the widget
			lights up.
		</p>
	</HelpSection>

	<HelpSection title="The status light">
		<p>
			Every widget periodically pings the app to say "I'm alive
			over here". The light reflects what the app has heard from
			that widget in the last few seconds:
		</p>
		<ul>
			<li><strong>Gray</strong> — silence. Nobody is rendering the widget anywhere.</li>
			<li><strong>Yellow</strong> — a regular browser tab is rendering it. Useful while you're testing.</li>
			<li><strong>Green</strong> — OBS is rendering it. The viewer-facing path is live.</li>
		</ul>
		<HelpTip>
			During a stream, glance at this page to confirm every widget
			you expect to be on screen has a green light. A gray light
			on a widget you thought was live is usually OBS having
			cached an empty page from before the toy was enabled — see
			the troubleshooting note below.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Auto-updating list">
		<p>
			The master list rebuilds itself whenever:
		</p>
		<ul>
			<li>You add or remove a toy.</li>
			<li>You add a new sub-group on the
				<HelpLink to="toys.widgetGroup">Widget Group</HelpLink> or
				<HelpLink to="toys.omni">Omni</HelpLink> toys
				(both expose one widget URL per configured sub-group).</li>
			<li>The widget server port changes (rare, but covered).</li>
		</ul>
	</HelpSection>

	<HelpTrouble>
		<p><strong>OBS shows a blank source but the status light is gray.</strong></p>
		<p>
			Right-click the browser source in OBS and pick
			<HelpKbd>Refresh cache of current page</HelpKbd>. If you
			enabled "Auto Refresh Browser Sources Upon Connect" in
			<HelpLink to="connectionSettings.general">General Settings</HelpLink>,
			restarting OBS or Chat-Toys will also force a refresh.
		</p>
	</HelpTrouble>

</template>
