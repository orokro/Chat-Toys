<!--
	toys/omni.vue
	-------------
-->
<script>
export const meta = {
	title: 'Omni Widget',
	tags: ['omni', 'alerts', 'queue'],
	keywords: ['bundle', 'serialize', 'queue', 'alert lane', 'one at a time'],
	summary: 'Bundle multiple alert-style widgets into a single OBS source that takes turns.',
	order: 35,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Omni is a meta-widget: rather than rendering its own
			alert content, it gates and serializes other alert toys
			through a single OBS browser source. Donations,
			Shouts, Help tips, Media, HeadPat chatter-mode, Prize
			Wheel result reveals — all the alert-style toys can be
			dropped into an Omni group, and Omni shows them one at a
			time in a single visual slot.
		</p>
	</HelpSection>

	<HelpSection title="Multiple Omnis, multiple lanes">
		<p>
			You can have <em>several</em> Omni groups, each with its
			own URL and its own queue. Useful if you want, say, a
			"social alerts" lane in your top-left (donations, subs)
			and a "fun alerts" lane in your bottom-right (shouts, head
			pats). Each lane serializes independently.
		</p>
		<HelpTip>
			Add a new Omni sub-group on the Omni settings page; a new
			widget URL appears immediately on the
			<HelpLink to="system.widgets">Widgets master page</HelpLink>.
		</HelpTip>
	</HelpSection>

	<HelpSection title="The drag-and-drop pool">
		<p>
			Each toy can belong to at most one Omni group at a time
			(physically — the settings UI moves the toy from group to
			group rather than letting it sit in two). The pool shows
			every alert-eligible toy and lets you drop them into the
			group of your choice.
		</p>
	</HelpSection>

	<HelpSection title="Standalone toys still work">
		<p>
			Alert toys not assigned to any Omni group fire immediately
			as before. Omni is opt-in — leave a toy unassigned and it
			behaves exactly like it did pre-Omni.
		</p>
	</HelpSection>

	<HelpSection title="See also">
		<p>
			<HelpLink to="concepts.omniAlerts">Omni Alerts (concepts)</HelpLink>
			for the gating mechanics and the registry's design.
		</p>
	</HelpSection>

</template>
