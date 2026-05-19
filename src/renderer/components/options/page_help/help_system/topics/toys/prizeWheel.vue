<!--
	toys/prizeWheel.vue
	-------------------
-->
<script>
export const meta = {
	title: 'Prize Wheel',
	tags: ['game', 'wheel', 'random'],
	keywords: ['spin', 'wedge', 'randomizer', 'rng', 'prizes', 'lottery'],
	summary: 'A wheel chatters spin for randomized rewards with configurable wedges.',
	order: 22,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Classic prize wheel. Configure the wedges (labels, weights,
			optional point payouts, optional Media-style results), and
			any viewer can spin it. Spin strength is optional — passing
			a higher number gives the wheel more momentum (and slightly
			more visual chaos).
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!spin</HelpKbd> [strength] — spin the wheel; strength defaults to a moderate value, max around 100 for a hard spin.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Wedges array</strong> — your prize list. Each row has a label, weight (relative probability), and optional payouts.</li>
			<li><strong>Result handling</strong> — what happens on a landing: pay points, fire a Media item, just announce, etc.</li>
			<li><strong>Spin physics</strong> — friction, spin time, idle visuals.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Omni integration">
		<p>
			The result-reveal moment is alert-eligible — drop the
			Prize Wheel into an <HelpLink to="toys.omni">Omni</HelpLink>
			group so its big payout reveal doesn't fight other alerts.
		</p>
	</HelpSection>

</template>
