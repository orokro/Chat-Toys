<!--
	concepts/widgetsAndObs.vue
	--------------------------
-->
<script>
export const meta = {
	title: 'Widgets & OBS Browser Sources',
	tags: ['widgets', 'obs', 'concepts'],
	keywords: ['browser source', 'urls', 'localhost', 'embed', 'overlay'],
	summary: 'How Chat-Toys widgets become browser sources, and the recommended OBS settings.',
	order: 1,
};
</script>
<template>

	<HelpSection title="The web-server-in-a-box model">
		<p>
			Each Chat-Toys widget is a small web page. The app starts a
			local HTTP server when it launches and exposes every
			widget on its own URL of the form
			<HelpKbd>http://localhost:{port}/live/?single=true&amp;toy={slug}&amp;widget={widgetSlug}</HelpKbd>.
			OBS adds those URLs as browser sources; the widget renders
			inside OBS like any other webpage.
		</p>
		<p>
			You don't have to remember the URL shape. The
			<HelpLink to="system.widgets">Widgets master page</HelpLink>
			(and each toy's own settings page) has copy buttons.
		</p>
	</HelpSection>

	<HelpSection title="Recommended OBS browser-source settings">
		<ul>
			<li><strong>Width / Height:</strong> the on-screen pixel size you want the widget to occupy. Full-screen overlays (Tosser, Emoji Fountain) usually match your canvas size (e.g. 1920×1080). Boxy widgets (chat overlay, prize wheel) can be smaller.</li>
			<li><strong>Custom CSS:</strong> leave empty. Widgets ship with the styles they need.</li>
			<li><strong>Refresh browser when scene becomes active:</strong> off, in most cases. Widgets are designed to keep their state via the WebSocket connection; force-refreshing on scene activation throws away whatever was on screen.</li>
			<li><strong>Shutdown source when not visible:</strong> off, for the same reason — you want the widget to keep listening even when its scene isn't active.</li>
			<li><strong>Control audio via OBS:</strong> on for any widget that plays sound (Media, Donations, Help). Lets you mix it on your OBS audio bus.</li>
		</ul>
	</HelpSection>

	<HelpSection title="How widgets talk to the app">
		<p>
			Each widget opens its own WebSocket connection back to the
			Chat-Toys app. State changes (a Shout pop-up firing, a
			point balance updating, a horse race kicking off) are
			pushed over the socket. There is no polling — when the
			app's state changes, every connected widget gets the
			update immediately.
		</p>
		<HelpTip>
			This is also how the live status light works — the widget
			sends a heartbeat back to the app every few seconds while
			it's rendering, and the app uses those heartbeats to know
			that OBS (or a browser tab) has the widget open. See
			<HelpLink to="concepts.liveStatus">Live Status</HelpLink>.
		</HelpTip>
	</HelpSection>

	<HelpTrouble>
		<p><strong>Widget works in a browser tab but is blank in OBS.</strong></p>
		<p>
			OBS caches the URL contents. If you added the browser
			source before the toy was enabled (or while the widget
			server wasn't up), OBS may be holding onto a stale empty
			version. Right-click the source and pick
			<HelpKbd>Refresh cache of current page</HelpKbd>. Enabling
			"Auto Refresh Browser Sources Upon Connect" in
			<HelpLink to="connectionSettings.general">General Settings</HelpLink>
			makes Chat-Toys do this automatically.
		</p>
	</HelpTrouble>

	<HelpTrouble>
		<p><strong>Widget URL won't load in a regular browser either.</strong></p>
		<p>
			The widget server is probably down. Open
			<HelpLink to="connectionSettings.general">General Settings</HelpLink>
			and click the Test Page URL. If that fails, click "Restart
			Server" or restart the entire Chat-Toys app.
		</p>
	</HelpTrouble>

</template>
