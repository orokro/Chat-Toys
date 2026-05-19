<!--
	toys/gamba.vue
	--------------
-->
<script>
export const meta = {
	title: 'Gamba',
	tags: ['game', 'betting', 'gambling'],
	keywords: ['bet', 'wager', 'odds', 'prompt', 'streamer poll', 'pool', 'channel points'],
	summary: 'Streamer-driven betting on arbitrary outcomes, paid in channel points.',
	order: 23,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			You set up a prompt ("Will I beat this boss?") with named
			options ("Yes / No" or whatever you want), open betting,
			and chatters wager their points on one of the options.
			When you call it, the winning side splits the pool
			proportionally.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!bet &lt;option&gt; &lt;amount&gt;</HelpKbd> — place a bet of the given amount on the named option. Fails if betting is closed, insufficient points, or invalid option.</li>
			<li><HelpKbd>!cancel_bet</HelpKbd> — revoke an in-progress bet. Only works while betting is still open.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Streamer flow">
		<ol>
			<li>Open the Gamba toy's settings page.</li>
			<li>Enter the prompt and the list of options.</li>
			<li>Click "Open Betting" — the widget reveals the options to chat.</li>
			<li>Wait for bets to roll in.</li>
			<li>Click "Close Betting" once you're ready to lock the pool.</li>
			<li>Resolve the outcome by clicking the winning option. Points are distributed automatically.</li>
		</ol>
	</HelpSection>

	<HelpTip>
		Gamba requires <HelpLink to="tools.channelPoints">Channel Points</HelpLink>
		to be enabled. Without points, there's nothing to bet.
	</HelpTip>

</template>
