<!--
	troubleshooting/index.vue
	-------------------------
-->
<script>
export const meta = {
	title: 'Troubleshooting',
	tags: ['troubleshooting', 'help'],
	keywords: ['problem', 'broken', 'not working', 'fix', 'why'],
	summary: 'Cross-cutting "what do I do when X" entries.',
	order: 7,
};
</script>
<template>

	<HelpSection title="When things don't work">
		<p>
			Individual toy docs cover toy-specific gotchas inline.
			This section is for problems that span the system: OBS
			showing nothing, chat not coming through, the widget
			server being down, port conflicts, etc.
		</p>
		<ul>
			<li><HelpLink to="troubleshooting.grayStatusLight">Widget status light stays gray</HelpLink></li>
			<li><HelpLink to="troubleshooting.widgetBlankInObs">Widget shows blank in OBS</HelpLink></li>
			<li><HelpLink to="troubleshooting.chatNotReading">Chat isn't being read</HelpLink></li>
			<li><HelpLink to="troubleshooting.twitchBitsNotFiring">Twitch bits don't fire the donation alert</HelpLink></li>
			<li><HelpLink to="troubleshooting.obsPortConflict">OBS WebSocket won't connect</HelpLink></li>
			<li><HelpLink to="troubleshooting.serverPortConflict">Widget server won't start (port in use)</HelpLink></li>
		</ul>
	</HelpSection>

	<HelpTip>
		Most common causes, in rough order: (1) OBS cached an empty
		page, (2) the right toy isn't enabled, (3) the chat source
		isn't enabled, (4) something needs a refresh.
	</HelpTip>

</template>
