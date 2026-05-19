<!--
	tools/index.vue
	---------------
-->
<script>
export const meta = {
	title: 'Tools',
	tags: ['tools'],
	keywords: ['utility', 'tool box', 'no widget', 'invisible'],
	summary: 'Toys that don\'t put graphics on screen by themselves — economy, conversion rules, etc.',
	order: 5,
};
</script>
<template>

	<HelpSection title="What's a tool">
		<p>
			Tools are toys that don't render anything on stream by
			themselves. They underpin the visible toys — keeping
			balances, converting Super Chat amounts into points,
			gating costs. You enable them just like toys, but they
			live in their own <strong>Tool Box</strong> top tab in
			the main window.
		</p>
		<ul>
			<li><HelpLink to="tools.channelPoints">Channel Points</HelpLink> — the in-stream currency economy that backs every command's cost field.</li>
			<li><HelpLink to="tools.scConversion">SC Conversion</HelpLink> — turns YouTube Super Chats and Twitch bits cheers into channel points (and routes them into the Donations alert).</li>
		</ul>
	</HelpSection>

</template>
