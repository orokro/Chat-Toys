<!--
	toys/horseRacing.vue
	--------------------
-->
<script>
export const meta = {
	title: 'Horse Racing',
	tags: ['game', 'race', 'betting'],
	keywords: ['horse', 'race', 'mutuel', 'wager', 'odds', 'pari-mutuel', 'gambling'],
	summary: 'A multi-horse race with optional pari-mutuel betting paid in channel points.',
	order: 20,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A round-based horse race. Viewers join as racers, optionally
			place bets on each other, and the race kicks off once
			enough horses are at the gate. While the race is on, racers
			can do periodic actions to nudge their horse along.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!joinrace</HelpKbd> — enter the current race as a horse. Once 2+ joiners are queued, the race starts.</li>
			<li><HelpKbd>!horsebet &lt;racer&gt; &lt;amount&gt;</HelpKbd> — bet channel points on a specific racer. Pari-mutuel: payouts depend on the total pool and the betting on each horse.</li>
			<li><HelpKbd>!eat</HelpKbd> — periodically usable mid-race; eats an apple for a small speed bump (or points, depending on the rules you've configured).</li>
			<li><HelpKbd>!exitrace</HelpKbd> — drop out of the race early. Bets on you typically lose.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Lobby / betting windows</strong> — seconds the gate is open for joins and bets before the race fires.</li>
			<li><strong>Race speed / variance</strong> — pacing of the horses.</li>
			<li><strong>Win / show payouts</strong> — how bet rewards are distributed.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink>.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Horse Racing pairs naturally with
		<HelpLink to="tools.channelPoints">Channel Points</HelpLink>.
		Without points enabled the betting commands still parse but
		don't move any balances, so the betting layer becomes purely
		cosmetic.
	</HelpTip>

</template>
