<!--
	connectionSettings/chatSettings.vue
	-----------------------------------

	YouTube chat configuration. The actual tab in the app is called
	just "Chat Settings" but in practice it's the YouTube page - the
	Twitch flow is on its own sub-tab.
-->
<script>
export const meta = {
	title: 'Chat Settings (YouTube)',
	tags: ['youtube', 'chat', 'connection'],
	keywords: ['yt', 'live chat', 'video id', 'auto chat', 'live stream', 'channel'],
	summary: 'Adding YouTube live chats as sources and the optional auto-finder.',
	order: 1,
};
</script>
<template>

	<HelpSection title="Adding chat sources">
		<p>
			Chat-Toys reads YouTube live chat through a chat-source
			system: every active source is a live-stream chat the app
			is currently listening to. You can have more than one open
			at the same time — useful for multi-stream events — but for
			most streamers a single source per live stream is the norm.
		</p>
		<p>
			In the <strong>YT Chat Sources</strong> section, paste the
			URL of a live YouTube stream and click add. Toggle the
			source's enabled switch to start listening.
		</p>
		<HelpWarning>
			A chat source must be <strong>enabled</strong> for commands
			to fire. If a live stream ends or chat is disabled, the
			source goes "unavailable" and you won't be able to re-enable
			it from this state — you'll need to re-add the new stream's
			URL once you're live again.
		</HelpWarning>
		<HelpTip>
			For member-only or unlisted streams, you'll need to log
			into YouTube in the browser the app uses for chat. There's
			a "Log Into YouTube" button on the page that opens the
			YouTube login flow.
		</HelpTip>
	</HelpSection>

	<HelpSection title="Auto Chat (experimental)">
		<p>
			The Auto Chat section is a convenience: if you give
			Chat-Toys your channel URL, the app will look at OBS to see
			when you start streaming, then try to find the matching
			live chat on your channel and add it as a source for you.
		</p>
		<p>
			For this to work, you must have already connected Chat-Toys
			to OBS via WebSocket (see
			<HelpLink to="connectionSettings.general">General Settings</HelpLink>),
			because the app uses OBS's streaming state as the trigger.
		</p>
		<HelpWarning>
			Auto Chat is exactly what the page warns you about: a
			<em>convenience</em>, not a guarantee. YouTube's discovery
			endpoints are not always reachable, and the auto-finder
			can miss a stream entirely. If chat isn't coming through,
			just add the source manually.
		</HelpWarning>
		<p>
			"Delete Chat Sources when Offline" cleans up the sources
			Auto Chat added once OBS reports you're no longer streaming,
			so your list doesn't accumulate stale entries.
		</p>
	</HelpSection>

	<HelpSection title="The raw-chat preview">
		<p>
			At the bottom of the page you'll find a Live Raw Chat
			preview that mirrors everything the app is receiving from
			every active source. You don't need to read this on a
			normal day — it's there so you can verify chat is reaching
			Chat-Toys at all (post in your own chat, see if the message
			lands here).
		</p>
		<HelpTrouble>
			<p><strong>Raw chat shows nothing even though people are chatting.</strong></p>
			<p>
				First make sure your chat source is in the list and
				the toggle is on. Then check that the URL points at
				the right live stream (not the channel page). If it
				still doesn't work, see
				<HelpLink to="troubleshooting.chatNotReading">chat is not reading</HelpLink>.
			</p>
		</HelpTrouble>
	</HelpSection>

</template>
