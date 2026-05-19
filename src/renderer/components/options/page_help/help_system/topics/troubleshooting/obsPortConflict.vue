<!--
	troubleshooting/obsPortConflict.vue
	-----------------------------------
-->
<script>
export const meta = {
	title: 'OBS WebSocket won\'t connect',
	tags: ['troubleshooting', 'obs', 'websocket'],
	keywords: ['obs not connecting', 'websocket failed', 'wrong password', 'port'],
	summary: 'The OBS connection status stays red.',
	order: 5,
};
</script>
<template>

	<HelpSection title="The three values must all match">
		<p>
			OBS's WebSocket server has a port and a password. Chat-Toys'
			General Settings page has fields for both. The values must
			match exactly:
		</p>
		<ol>
			<li>In OBS, open <HelpKbd>Tools → WebSocket Server Settings</HelpKbd>. Note the port. Click "Show Connect Info" and copy the password.</li>
			<li>In Chat-Toys' General Settings, paste both. The host stays as <HelpKbd>localhost</HelpKbd> unless OBS is on a different machine.</li>
			<li>Toggle "Enable OBS Connection" on — the status line will report success or failure.</li>
		</ol>
	</HelpSection>

	<HelpSection title="Common failure modes">
		<ul>
			<li><strong>Wrong password.</strong> Copy it fresh from OBS — passwords are case-sensitive and easy to mistype.</li>
			<li><strong>WebSocket server disabled in OBS.</strong> Some streamers leave it off by default. Check the "Enable WebSocket server" box in OBS.</li>
			<li><strong>Firewall blocking the port.</strong> If you've locked down localhost (rare), the WebSocket can't reach OBS.</li>
		</ul>
		<HelpWarning>
			The WebSocket password is not your OBS password or stream
			key. It's a separate password set inside OBS's WebSocket
			server panel.
		</HelpWarning>
	</HelpSection>

</template>
