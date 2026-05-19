<!--
	tools/channelPoints.vue
	-----------------------
-->
<script>
export const meta = {
	title: 'Channel Points',
	tags: ['channelPoints', 'tool', 'economy'],
	keywords: ['points', 'currency', 'rewards', 'loyalty', 'earn', 'claim', 'leaderboard'],
	summary: 'The in-stream channel-points economy: how points are earned, given, and spent.',
	order: 1,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Channel Points is the in-stream currency. Every viewer
			has a balance; they earn points passively while you're
			live and explicitly via the
			<HelpKbd>!get</HelpKbd> command. They spend points by
			running any command that has a cost set.
		</p>
		<p>
			Without this tool enabled, every command's cost field is
			ignored across the entire app — see
			<HelpLink to="concepts.channelPointsEconomy">Channel Points Economy</HelpLink>.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!get</HelpKbd> — claim points. The widget periodically shows a claimable batch on stream; running <HelpKbd>!get</HelpKbd> while it's visible adds those points to the chatter's balance.</li>
			<li><HelpKbd>!me</HelpKbd> — shows the chatter their current points total via the Output Log.</li>
			<li><HelpKbd>!give &lt;amount&gt; @user</HelpKbd> — transfer points from one viewer to another.</li>
			<li><HelpKbd>!leaderboard</HelpKbd> — prints the top point earners.</li>
		</ul>
	</HelpSection>

	<HelpSection title="The claim widget">
		<p>
			Channel Points ships with a small widget that periodically
			appears on screen showing the current claimable amount.
			Place it somewhere visible in OBS — viewers who run
			<HelpKbd>!get</HelpKbd> while it's up grab the points.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Earn rate</strong> — passive earning while the stream is live.</li>
			<li><strong>Claim amount / interval</strong> — how much each <HelpKbd>!get</HelpKbd> drop is worth and how often the widget appears.</li>
			<li><strong>Initial balance</strong> — starting points for a brand-new viewer.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Admin bypass">
		<p>
			Channel owners and moderators don't pay costs and don't
			trigger cooldowns — handy for testing high-cost commands
			in your own chat. See
			<HelpLink to="concepts.commandSchema">Command Schema</HelpLink>.
		</p>
	</HelpSection>

</template>
