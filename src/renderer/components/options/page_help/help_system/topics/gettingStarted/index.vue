<!--
	gettingStarted/index.vue
	------------------------

	Landing for the "Getting Started" top-level section. Sets the tone
	and points at the three first-time-user topics.
-->
<script>
export const meta = {
	title: 'Getting Started',
	tags: ['intro', 'overview', 'setup'],
	keywords: ['start', 'begin', 'first time', 'new user', 'install'],
	summary: 'Welcome page, quick-start setup, and the day-to-day workflow.',
	order: 1,
};
</script>
<template>

	<HelpSection title="Welcome to Chat-Toys">
		<p>
			Chat-Toys turns your livestream chat into things that happen
			on screen. Viewers type commands, send tips, and rack up
			channel points; the app reads all of it and drives a small
			zoo of animated widgets in OBS — fish leaping out of the
			water, horses racing across the stage, donation pop-ups,
			head-pats, prize wheels, claw machines, and a few dozen
			more.
		</p>
		<p>
			Everything runs locally on your machine. No third-party
			servers, no per-stream fees, no plugin store.
		</p>
	</HelpSection>

	<HelpSection title="If you're brand new, start here">
		<p>
			These three pages will get you from a fresh install to a
			live stream with working toys.
		</p>
		<ul>
			<li><HelpLink to="gettingStarted.welcome">Welcome &amp; What Chat-Toys Does</HelpLink> — a quick tour of the main app tabs and what lives in each.</li>
			<li><HelpLink to="gettingStarted.quickStart">Quick Start</HelpLink> — connect your chat, hook up OBS, and add your first toy.</li>
			<li><HelpLink to="gettingStarted.commonWorkflow">Common Workflow</HelpLink> — how a typical "add a toy and ship it to OBS" session goes.</li>
		</ul>
	</HelpSection>

</template>
