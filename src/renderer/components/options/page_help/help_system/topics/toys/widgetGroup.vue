<!--
	toys/widgetGroup.vue
	--------------------
-->
<script>
export const meta = {
	title: 'Widget Group',
	tags: ['widgetGroup', 'layout', 'consolidate'],
	keywords: ['combine', 'multiple widgets', 'single source', 'one browser source', 'pack widgets'],
	summary: 'Combine multiple widgets into a single consolidated OBS browser source.',
	order: 36,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Where Omni serializes <em>alerts</em>, Widget Group
			<em>visually packs</em> multiple widgets into a single
			browser source so you only need one OBS source for what
			would otherwise be several. Useful when your overlay
			budget is tight (a lot of browser sources can hurt OBS
			performance) or when you want a known layout that doesn't
			require positioning each widget separately.
		</p>
	</HelpSection>

	<HelpSection title="Defining a group">
		<ol>
			<li>Add the Widget Group toy.</li>
			<li>Create a new sub-group on its settings page.</li>
			<li>Drop the widgets you want bundled into the sub-group's layout area, sizing each to taste.</li>
			<li>Copy the sub-group's widget URL into OBS as a single browser source.</li>
		</ol>
		<HelpTip>
			Each sub-group has its own URL, so you can define several
			Widget Groups with different bundles for different scenes.
			New sub-groups appear automatically on the
			<HelpLink to="system.widgets">Widgets master page</HelpLink>.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Widget Group vs Omni">
		<p>
			Widget Group is spatial — it lays multiple widgets out in
			a fixed grid that all renders at once. Omni is temporal —
			it queues alert content through a single visual slot.
			Different problems, sometimes you want both.
		</p>
	</HelpSection>

</template>
