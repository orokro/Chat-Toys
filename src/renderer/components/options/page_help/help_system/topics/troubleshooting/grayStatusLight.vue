<!--
	troubleshooting/grayStatusLight.vue
	-----------------------------------
-->
<script>
export const meta = {
	title: 'Widget status light stays gray',
	tags: ['troubleshooting', 'status', 'gray'],
	keywords: ['gray light', 'offline', 'not connected', 'heartbeat', 'silent widget'],
	summary: 'What it means when a widget\'s status light won\'t turn yellow or green.',
	order: 1,
};
</script>
<template>

	<HelpSection title="What gray means">
		<p>
			Gray means the app hasn't heard a heartbeat from the
			widget in the last ~10 seconds. Either nothing is loading
			the URL, or what's loading it isn't actually rendering
			the widget — so no heartbeats get sent back.
		</p>
		<p>
			Possible causes, in roughly the order to check:
		</p>
	</HelpSection>

	<HelpSection title="1. OBS hasn't actually loaded the URL yet">
		<p>
			A common case: you added the toy after OBS already opened.
			The browser source was created with an empty / placeholder
			URL and never refreshed. In OBS, right-click the source
			and pick <HelpKbd>Refresh cache of current page</HelpKbd>.
		</p>
	</HelpSection>

	<HelpSection title="2. The URL is wrong">
		<p>
			Maybe you changed the widget server port (in
			<HelpLink to="connectionSettings.general">General Settings</HelpLink>)
			but didn't update the OBS source URL. Or the URL points
			at a slug that no longer exists (a Widget Group sub-group
			you deleted). Re-copy the URL from the toy's settings
			page or from the
			<HelpLink to="system.widgets">Widgets master page</HelpLink>
			and paste it fresh.
		</p>
	</HelpSection>

	<HelpSection title="3. The widget server is down">
		<p>
			Open the Test Page URL on the General Settings page. If
			that loads "Chat Toys - Works!", the server is fine.
			Otherwise, click "Restart Server" and, if needed, restart
			Chat-Toys.
		</p>
	</HelpSection>

	<HelpSection title="4. The toy is disabled">
		<p>
			A disabled toy still surfaces its widget row in the UI
			but the rendering side will refuse to mount. Make sure
			the toy is in your enabled list (Toy Box / Tool Box).
		</p>
	</HelpSection>

	<HelpTip>
		"Auto Refresh Browser Sources Upon Connect" (in General
		Settings) automates the OBS refresh after reconnects. Leave
		it on — it solves the #1 cause above.
	</HelpTip>

</template>
