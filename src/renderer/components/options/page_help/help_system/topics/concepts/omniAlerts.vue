<!--
	concepts/omniAlerts.vue
	-----------------------
-->
<script>
export const meta = {
	title: 'Omni Alerts',
	tags: ['omni', 'alerts', 'concepts'],
	keywords: ['queue', 'gating', 'alert stack', 'one at a time', 'donations help shout'],
	summary: 'How the Omni toy gates multiple alert toys into a single serialized stream.',
	order: 6,
};
</script>
<template>

	<HelpSection title="The problem Omni solves">
		<p>
			A bunch of toys are <em>alert-style</em>: Donations, Help
			hints, Shout pop-ups, Head Pats, Media items, Prize Wheel
			results. Each one happily fires on its own timer when its
			condition is met. The problem is that without coordination
			they all stack on top of each other — a donation comes in
			while a shout is on screen and now you've got two
			overlapping pop-ups and a chatter is confused.
		</p>
	</HelpSection>

	<HelpSection title="The Omni mental model">
		<p>
			<HelpLink to="toys.omni">The Omni toy</HelpLink> is a
			container. You drag the alert toys you want serialized
			into one of its groups (you can have multiple groups for
			different stream zones). Toys that join an Omni group
			yield to that group's traffic-cop logic:
		</p>
		<ol>
			<li>Toy A is about to fire its alert.</li>
			<li>It asks the registry, "is my owning Omni busy with another included toy right now?"</li>
			<li>Yes → hold. Re-check on the next tick.</li>
			<li>No → fire, taking the Omni's "currently showing" slot until the alert finishes.</li>
		</ol>
		<p>
			So if you put Donations and Shout in the same Omni group,
			a shout that lands during a donation alert will queue and
			fire when the donation finishes, instead of overlapping it.
		</p>
	</HelpSection>

	<HelpSection title="Toys that opt in">
		<p>
			Currently <HelpLink to="toys.shout">Shout</HelpLink>,
			<HelpLink to="toys.donations">Donations</HelpLink>,
			<HelpLink to="toys.help">Help</HelpLink>,
			<HelpLink to="toys.media">Media</HelpLink>, and
			<HelpLink to="toys.headPat">HeadPat (chatter mode)</HelpLink>,
			plus <HelpLink to="toys.prizeWheel">Prize Wheel</HelpLink>'s
			result reveal, all support the Omni include list.
		</p>
	</HelpSection>

	<HelpSection title="Standalone is still fine">
		<p>
			You don't <em>have</em> to use Omni. A toy that isn't
			included by any Omni group fires immediately, the same as
			before — it just won't coordinate with anything else.
			Omni is an opt-in layer for streamers who want a clean
			single-channel alert lane.
		</p>
		<HelpTip>
			Multiple Omnis are supported. Each Omni group has its own
			widget URL and its own queue, so you can have a separate
			"chatter alerts" group in the top-left of your overlay
			and a "donations" group in the bottom-right — each
			serialized independently.
		</HelpTip>
	</HelpSection>

</template>
