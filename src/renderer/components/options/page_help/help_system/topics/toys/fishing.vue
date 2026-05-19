<!--
	toys/fishing.vue
	----------------
-->
<script>
export const meta = {
	title: 'Fishing',
	tags: ['game', 'fishing'],
	keywords: ['cast', 'reel', 'lake', 'fish', 'mini-game', 'rod'],
	summary: 'A timing-based fishing mini-game playable from chat.',
	order: 24,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Viewers cast a virtual fishing line into a grid-based
			lake, wait for a fish to bite, and reel it in at the right
			moment. Catch quality depends on luck and reaction time.
			Some catches award points; rare catches award a lot.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!cast</HelpKbd> [x] [y] — cast your rod. Bare <HelpKbd>!cast</HelpKbd> picks a random spot; with coordinates, you aim at a specific grid cell (each axis is 0–4 by default).</li>
			<li><HelpKbd>!reel</HelpKbd> — attempt to reel in. Timing matters — too early misses, too late and the fish gets away.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Catch table</strong> — array of possible catches with weights and point payouts.</li>
			<li><strong>Bite window</strong> — how long after casting before a fish bites, and how long the bite remains catchable.</li>
			<li><strong>Lake size</strong> — grid resolution for the targeting coordinates.</li>
		</ul>
	</HelpSection>

</template>
