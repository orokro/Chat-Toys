<!--
	troubleshooting/serverPortConflict.vue
	--------------------------------------
-->
<script>
export const meta = {
	title: 'Widget server won\'t start (port in use)',
	tags: ['troubleshooting', 'server', 'port'],
	keywords: ['eaddrinuse', 'port in use', 'server failed', 'widget server', 'localhost'],
	summary: 'Chat-Toys can\'t start its local widget server because something else is on the port.',
	order: 6,
};
</script>
<template>

	<HelpSection title="Symptom">
		<p>
			Widget URLs don't load anywhere — neither in OBS nor in a
			regular browser tab. The Test Page URL on General Settings
			returns a connection error.
		</p>
	</HelpSection>

	<HelpSection title="Cause">
		<p>
			Something else on your machine is holding the port that
			Chat-Toys' widget server wants to bind to. Common culprits:
		</p>
		<ul>
			<li>A previous Chat-Toys process that didn't exit cleanly (check Task Manager / Activity Monitor for a stray <HelpKbd>Chat-Toys</HelpKbd> or <HelpKbd>electron</HelpKbd> entry and kill it).</li>
			<li>Another local dev server you forgot you had running.</li>
			<li>A second copy of Chat-Toys you accidentally launched.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Fix">
		<ol>
			<li>Close every Chat-Toys window.</li>
			<li>Kill any stray Chat-Toys / electron processes.</li>
			<li>Reopen Chat-Toys.</li>
		</ol>
		<p>
			If you really can't free the original port (something
			important is using it), change the port in General
			Settings, click "Restart Server", then restart the entire
			Chat-Toys app to make sure everything re-binds.
		</p>
		<HelpWarning>
			Changing the port means every widget URL in OBS changes
			too. Re-copy each one from the
			<HelpLink to="system.widgets">Widgets master page</HelpLink>
			after the port change.
		</HelpWarning>
	</HelpSection>

</template>
