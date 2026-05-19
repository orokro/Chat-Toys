<!--
	system/index.vue
	----------------
-->
<script>
export const meta = {
	title: 'System',
	tags: ['system', 'overview'],
	keywords: ['cross-cutting', 'global', 'master pages'],
	summary: 'Cross-cutting views: every widget, every command, asset DB, user DB.',
	order: 3,
};
</script>
<template>

	<HelpSection title="What the System tab is for">
		<p>
			Each toy has its own settings page with its own widgets,
			commands, and so on. The System tab gathers all of that
			together in <em>cross-cutting</em> views — every widget in
			one place, every command in one place, the central asset
			library, the central user database.
		</p>
		<ul>
			<li><HelpLink to="system.widgets">Widgets</HelpLink> — master list of every widget URL across every enabled toy, with a live status light on each row.</li>
			<li><HelpLink to="system.commands">Commands</HelpLink> — master command table plus a copy/paste snippet of every enabled command for your stream description.</li>
			<li><HelpLink to="system.assets">Assets</HelpLink> — the local library of images, gifs, sounds, and 3D models that toys can use.</li>
			<li><HelpLink to="system.users">Users</HelpLink> — every chatter who has interacted with Chat-Toys, with their points, command history, and ban status.</li>
		</ul>
	</HelpSection>

	<HelpSection title="When to use these">
		<p>
			The toy-specific pages are best for setup-time work — when
			you're configuring a single toy, you want all of its widgets,
			commands, and settings together.
		</p>
		<p>
			The System pages are better for <em>operating</em> the
			stream — reviewing every command at once, snapshotting your
			Twitch ban list, or spot-checking that the right widgets
			are actually live in OBS during a stream.
		</p>
	</HelpSection>

</template>
