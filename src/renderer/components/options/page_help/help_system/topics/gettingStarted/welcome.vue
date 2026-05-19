<!--
	gettingStarted/welcome.vue
	--------------------------

	Tour of the main window's top tabs. Anchors the reader's mental
	model so the rest of the docs make sense.
-->
<script>
export const meta = {
	title: 'Welcome & What Chat-Toys Does',
	tags: ['intro', 'tour', 'overview'],
	keywords: ['start', 'introduction', 'tabs', 'sections', 'layout', 'where is'],
	summary: 'A tour of the top tabs and how Chat-Toys is organized.',
	order: 1,
};
</script>
<template>

	<HelpSection title="The big picture">
		<p>
			Chat-Toys sits between your chat (YouTube or Twitch) and OBS.
			It listens to every chat message that comes in, watches for
			commands (<HelpKbd>!shout</HelpKbd>, <HelpKbd>!race</HelpKbd>,
			<HelpKbd>!gamba</HelpKbd>, etc), runs the matching toy's
			logic, and broadcasts the result to widgets that you've added
			as browser sources in OBS.
		</p>
		<p>
			You configure everything from this one main window. Each top
			tab is a different job:
		</p>
	</HelpSection>

	<HelpSection title="The top tabs">

		<p>
			<strong>Help</strong> — where you are right now. The Welcome
			and Help pages are reference material; Videos has walkthroughs
			and Contact / Credits are exactly what they say on the tin.
		</p>

		<p>
			<strong>Connection Settings</strong> — connect Chat-Toys to
			the outside world. Choose YouTube or Twitch as your chat
			source, give OBS its WebSocket details, set up VTubeStudio,
			and so on. You'll usually configure these once and forget
			about them. See <HelpLink to="connectionSettings">Connection Settings</HelpLink>.
		</p>

		<p>
			<strong>Toy Box</strong> — pick which toys you want enabled
			on this stream and configure each one. A "toy" is anything
			visible to the audience: chat overlays, shout pop-ups,
			donation alerts, the horse race, the claw game, etc. Each
			toy has its own settings page and one or more widgets.
		</p>

		<p>
			<strong>Tool Box</strong> — same idea as Toy Box, but for
			things that don't put graphics on screen by themselves —
			the Channel Points economy, the SuperChat conversion rules,
			and a few utility behaviors.
		</p>

		<p>
			<strong>System</strong> — cross-cutting views that span
			every toy. A master list of every widget URL (so you can
			grab any of them for OBS), a master command table (every
			command across every toy in one editor), the Assets database
			(your uploaded images, gifs, and sounds), and the Users
			database (your viewers, their points, their command history).
		</p>

	</HelpSection>

	<HelpSection title="The two kinds of windows">
		<p>
			This main window is where <em>you</em> live — configuration,
			tables, settings. There's a second world that's invisible to
			you: a tiny local web server that hosts every widget as a
			separate URL. OBS opens those URLs as browser sources.
		</p>
		<p>
			You'll usually never need to think about the web server
			directly. The
			<HelpLink to="system.widgets">Widgets master page</HelpLink>
			gives you the URL for every active widget — copy, paste into
			OBS, done.
		</p>
		<HelpTip>
			A "widget" can be a full-screen layer (the Tosser, Emoji
			Fountain) or a small box you place wherever you want (a chat
			overlay, the prize wheel). The toy decides.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Where to go next">
		<p>
			Head to <HelpLink to="gettingStarted.quickStart">Quick Start</HelpLink>
			to actually wire things up and get a toy on screen, or skim
			<HelpLink to="gettingStarted.commonWorkflow">Common Workflow</HelpLink>
			for a feel of the day-to-day.
		</p>
	</HelpSection>

</template>
