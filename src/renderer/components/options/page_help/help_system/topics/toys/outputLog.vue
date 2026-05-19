<!--
	toys/outputLog.vue
	------------------
-->
<script>
export const meta = {
	title: 'Output Log',
	tags: ['log', 'output', 'feedback'],
	keywords: ['echo', 'console', 'on-screen log', 'system messages', 'feedback'],
	summary: 'On-screen log showing system messages, command feedback, and chatter-driven echo lines.',
	order: 17,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			A small scrolling log overlay that shows:
		</p>
		<ul>
			<li>System feedback ("Prize Wheel spun by X, won 200 points")</li>
			<li>Errors ("Insufficient points")</li>
			<li>Anything a chatter prints via <HelpKbd>!echo</HelpKbd></li>
		</ul>
		<p>
			Useful as a status console viewers can glance at to know
			what's happening behind the scenes, and as a debugging
			aid when you're trying to figure out why a toy isn't
			firing.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!echo &lt;message&gt;</HelpKbd> — chatter writes a message that appears in the log. Cost-able if you want chatters to pay for the privilege.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Max lines</strong> — how many log entries to keep before older ones scroll off.</li>
			<li><strong>Show error messages</strong> — toggle visibility of system errors on the overlay vs. only in the app.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink>; the log uniquely supports a per-line drop shadow (logTextShadow) so it stays readable over busy backgrounds.</li>
		</ul>
	</HelpSection>

</template>
