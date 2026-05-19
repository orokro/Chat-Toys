<!--
	concepts/channelPointsEconomy.vue
	---------------------------------
-->
<script>
export const meta = {
	title: 'Channel Points Economy',
	tags: ['points', 'channel points', 'economy', 'concepts'],
	keywords: ['rewards', 'earning', 'spending', 'cost', 'balance', 'loyalty', 'currency'],
	summary: 'How points are earned, spent, and what happens when costs are off.',
	order: 4,
};
</script>
<template>

	<HelpSection title="Points are the in-stream currency">
		<p>
			When the <HelpLink to="tools.channelPoints">Channel Points
			tool</HelpLink> is enabled, every chatter gets a points
			balance. They earn points just by chatting, by being live
			during a stream, by hitting milestones — all configurable
			on the Channel Points settings page — and they spend
			points by running commands that charge a cost.
		</p>
	</HelpSection>

	<HelpSection title="What happens when a paid command fires">
		<ol>
			<li>The command processor validates the chatter has enough points.</li>
			<li>If yes, the toy is notified.</li>
			<li>The chatter's balance is debited by the command's cost.</li>
			<li>If no, the command is silently rejected (no toy gets the message, no points are spent).</li>
		</ol>
		<HelpTip>
			"Silently" is by design — telling chat "you don't have
			enough points" every time someone fat-fingers a high-cost
			command would be unbearable spam. Power users will
			generally know.
		</HelpTip>
	</HelpSection>

	<HelpSection title="When Channel Points is disabled">
		<p>
			With the tool disabled, every command's <strong>cost</strong>
			field is ignored. Commands still fire normally, they just
			don't charge anyone. The <em>Cost</em> column in the
			command editor shows a small warning indicator in this
			state to remind you the value is currently inert.
		</p>
	</HelpSection>

	<HelpSection title="Admin bypass and testing">
		<p>
			Channel owners and moderators (on the source chat platform)
			don't pay costs and don't trigger cooldowns. This lets you
			test high-cost commands in your own chat without resetting
			your balance.
		</p>
	</HelpSection>

	<HelpSection title="Adjusting balances by hand">
		<p>
			The <HelpLink to="system.users">Users database</HelpLink>
			lets you edit any chatter's balance directly. Useful for
			refunds, contests, or kickstarting a new viewer's stash.
		</p>
	</HelpSection>

</template>
