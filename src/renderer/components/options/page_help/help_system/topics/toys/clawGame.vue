<!--
	toys/clawGame.vue
	-----------------
-->
<script>
export const meta = {
	title: 'Claw Game',
	tags: ['game', 'claw', 'prize'],
	keywords: ['claw machine', 'arcade', 'grab', 'drop', 'ride the claw'],
	summary: 'A claw machine — chat picks a horizontal position and a chatter rides the claw down to grab a prize.',
	order: 21,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A chat-controlled claw machine. The first viewer to run
			<HelpKbd>!drop &lt;0-100&gt;</HelpKbd> picks a horizontal
			lane (0 = far left, 100 = far right) and gets their
			profile picture pinned to the claw. The claw descends,
			closes on whatever's at that position, and lifts back up
			with the result.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!drop &lt;0-100&gt;</HelpKbd> — drop the claw at the chosen position. The chatter "rides" the claw as their PFP.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Prize pool</strong> — array of prize items with weights, optional point payouts, optional Media-style assets.</li>
			<li><strong>Misses / empty space</strong> — chance the claw grabs nothing.</li>
			<li><strong>Drop speed / lift speed</strong> — pacing of the animation.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Each <HelpKbd>!drop</HelpKbd> is a single round — the toy
		opens to accept the next drop only after the current one
		finishes. Use cooldown on the command if your audience would
		otherwise flood it.
	</HelpTip>

</template>
