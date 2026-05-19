<!--
	gettingStarted/commonWorkflow.vue
	---------------------------------

	The "what does a typical session look like" page. Aims to give
	the reader a mental model of the configure-vs-stream loop so the
	rest of the docs feel less like a manual.
-->
<script>
export const meta = {
	title: 'Common Workflow',
	tags: ['workflow', 'usage'],
	keywords: ['day to day', 'how to use', 'routine', 'process'],
	summary: 'How a typical add-a-toy session goes once you\'re set up.',
	order: 3,
};
</script>
<template>

	<HelpSection title="Configure once, stream often">
		<p>
			Most of Chat-Toys is one-time configuration. You authorize
			your chat account, you authorize OBS, and you set those
			credentials aside. From there, the rhythm is:
		</p>
		<ol>
			<li>Decide what new thing you want to add to your stream.</li>
			<li>Add the matching toy from the Toy Box.</li>
			<li>Tweak its settings, commands, costs.</li>
			<li>Copy its widget URL to OBS as a browser source.</li>
			<li>Test it.</li>
			<li>Stream.</li>
		</ol>
	</HelpSection>

	<HelpSection title="A real example: adding the Prize Wheel">
		<p>
			Say you want a wheel viewers can spin for a channel-points
			cost. Here's the path:
		</p>
		<ol>
			<li>Open <strong>Tool Box → Channel Points</strong> and make
				sure points are enabled. If you haven't set them up yet,
				see <HelpLink to="tools.channelPoints">the Channel Points docs</HelpLink>.</li>
			<li>Open <strong>Toy Box → Prize Wheel</strong> and add it.</li>
			<li>On the Prize Wheel settings page, edit the wedges (labels,
				weights, optional payouts).</li>
			<li>Open the <strong>Commands</strong> table on the same page,
				find the <HelpKbd>!spin</HelpKbd> command, and edit its
				channel-points cost.</li>
			<li>Copy the Prize Wheel widget URL into OBS as a browser
				source the size you want the wheel to occupy.</li>
			<li>In your own chat, run <HelpKbd>!spin</HelpKbd> to test.</li>
		</ol>
		<p>
			The same pattern applies to every toy. Some toys have richer
			settings (the Tosser lets you upload 3D models, Horse Racing
			has tunable betting windows), but the workflow is the same.
		</p>
	</HelpSection>

	<HelpSection title="Editing commands centrally">
		<p>
			Every toy's settings page has its own command editor for
			that toy. If you'd rather see — and edit — every command
			from every toy in one place, head to
			<HelpLink to="system.commands">System → Commands</HelpLink>.
			It's the same editor, just gathered together.
		</p>
		<p>
			That page is also where you grab the
			<strong>copy/paste command list</strong> — a clean text
			snippet listing every enabled command, ready to paste into
			your stream description or pin in chat so viewers know what
			they can run.
		</p>
	</HelpSection>

	<HelpSection title="Finding widget URLs">
		<p>
			Every toy's settings page has its own widget rows, but
			<HelpLink to="system.widgets">System → Widgets</HelpLink>
			gives you a master list across every enabled toy. Same
			URLs, just consolidated. Pick whichever view you prefer.
		</p>
		<HelpTip>
			The status light on each row updates live. Glance at the
			Widgets master page during a stream to see which widgets
			OBS is actually rendering (green) versus the ones it's
			ignoring (gray).
		</HelpTip>
	</HelpSection>

	<HelpSection title="Persisted everything">
		<p>
			Settings, command edits, channel-points balances, your
			users database — all of it lives in local storage on this
			machine. Closing and reopening Chat-Toys puts you back
			exactly where you left off.
		</p>
		<p>
			If you ever need to nuke and start over, every settings
			page has its defaults documented, and the
			<HelpLink to="system.users">Users database</HelpLink> and
			<HelpLink to="system.assets">Assets database</HelpLink>
			pages let you reset their respective stores.
		</p>
	</HelpSection>

</template>
