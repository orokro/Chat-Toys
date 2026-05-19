<!--
	gettingStarted/quickStart.vue
	-----------------------------

	The first-time setup checklist. Designed to be readable on a second
	monitor while the user actually clicks through the app.
-->
<script>
export const meta = {
	title: 'Quick Start',
	tags: ['intro', 'setup', 'install'],
	keywords: ['first stream', 'how do i', 'getting started', 'configure', 'setup wizard'],
	summary: 'Go from a fresh install to a working toy on stream in five steps.',
	order: 2,
};
</script>
<template>

	<HelpSection title="What you'll need">
		<ul>
			<li><strong>A YouTube or Twitch account</strong> you stream from.</li>
			<li><strong>OBS Studio</strong> (or Streamlabs OBS / equivalent) with the
				<em>obs-websocket</em> plugin enabled. Modern OBS ships it built-in;
				just make sure the WebSocket server is turned on under
				<HelpKbd>Tools → WebSocket Server Settings</HelpKbd>.</li>
			<li><strong>About five minutes.</strong></li>
		</ul>
	</HelpSection>

	<HelpSection title="Step 1 — Pick your chat source">
		<p>
			Open the <strong>Connection Settings</strong> top tab and
			pick the <strong>Chat Settings</strong> entry on the left.
			Choose <strong>YouTube</strong> or <strong>Twitch</strong>
			as your chat source. Each has its own sub-tab where you
			authorize Chat-Toys against your account.
		</p>
		<ul>
			<li>If you picked <strong>YouTube</strong>, head to the
				<HelpLink to="connectionSettings.chatSettings">YouTube chat settings</HelpLink>
				page and follow the connection steps there.</li>
			<li>If you picked <strong>Twitch</strong>, head to
				<HelpLink to="connectionSettings.twitch">Twitch settings</HelpLink>.</li>
		</ul>
		<HelpTip>
			You don't have to commit. Chat-Toys keeps both sets of
			credentials around — you can flip between platforms with
			the Chat Settings selector.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Step 2 — Tell Chat-Toys about OBS">
		<p>
			Still in Connection Settings, click <strong>General Settings</strong>.
			Set the host, port, and password that match the WebSocket
			server you enabled in OBS. Hit Connect — you'll see a green
			status indicator when the handshake succeeds.
		</p>
		<HelpWarning>
			OBS's WebSocket password is <em>not</em> your OBS password
			or your stream key. It's a separate password specific to
			the WebSocket server, set in
			<HelpKbd>Tools → WebSocket Server Settings → Show Connect Info</HelpKbd>.
		</HelpWarning>
	</HelpSection>

	<HelpSection title="Step 3 — Add a toy">
		<p>
			Switch to the <strong>Toy Box</strong> tab. You'll see a
			gallery of every toy Chat-Toys ships with. Click one — say,
			<HelpLink to="toys.shout">Shout</HelpLink> for your first
			experiment, it's the simplest — and click the <strong>+</strong>
			button to add it. The toy's settings page appears in the
			main area.
		</p>
		<p>
			Every toy's settings page has a <strong>Widgets</strong>
			section near the top. Each row there shows a status light, a
			short description, and a URL. That URL is what you'll paste
			into OBS.
		</p>
	</HelpSection>

	<HelpSection title="Step 4 — Drop the widget into OBS">
		<p>
			In OBS, add a <strong>Browser Source</strong> to whatever
			scene you want the toy to appear in. Paste the widget URL
			from the toy's settings page into the source's URL field.
			Set the source size to match the size you want the widget
			to occupy on screen (most toys default to your canvas size,
			usually 1920×1080).
		</p>
		<HelpTip>
			Check <HelpLink to="concepts.widgetsAndObs">Widgets &amp; OBS Browser Sources</HelpLink>
			for the recommended OBS source settings, refresh-on-scene
			tips, and what to do when a widget doesn't show up.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Step 5 — Test it">
		<p>
			With OBS still open, switch back to Chat-Toys and look at
			the status light on the widget row for the toy you just
			added.
		</p>
		<ul>
			<li><strong>Gray</strong> — nobody is rendering the widget yet. OBS hasn't loaded the URL.</li>
			<li><strong>Yellow</strong> — a regular browser tab is rendering it (good for testing).</li>
			<li><strong>Green</strong> — OBS is rendering it. You're live.</li>
		</ul>
		<p>
			Now type the toy's command in your chat. For Shout, that's
			<HelpKbd>!shout hello world</HelpKbd>. You should see the
			pop-up appear in OBS.
		</p>
		<HelpTrouble>
			<p><strong>Widget shows gray, OBS source looks blank?</strong></p>
			<p>
				Right-click the browser source in OBS and pick
				<HelpKbd>Refresh cache of current page</HelpKbd>. OBS
				sometimes caches an old empty version of a URL it
				loaded before the toy was enabled.
			</p>
			<p>
				If that doesn't help, see
				<HelpLink to="troubleshooting.grayStatusLight">"Status light stays gray"</HelpLink>.
			</p>
		</HelpTrouble>
	</HelpSection>

	<HelpSection title="What's next">
		<p>
			Read <HelpLink to="gettingStarted.commonWorkflow">Common Workflow</HelpLink>
			for the rhythm of adding more toys, or pick something off
			the <HelpLink to="toys">Toys</HelpLink> section to set up
			something more ambitious.
		</p>
	</HelpSection>

</template>
