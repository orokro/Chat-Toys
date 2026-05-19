<!--
	troubleshooting/chatNotReading.vue
	----------------------------------
-->
<script>
export const meta = {
	title: 'Chat isn\'t being read',
	tags: ['troubleshooting', 'chat', 'youtube', 'twitch'],
	keywords: ['no chat', 'commands not firing', 'chat dead', 'silent', 'not receiving'],
	summary: 'Nothing happens when chat runs commands, and the raw-chat preview is empty.',
	order: 3,
};
</script>
<template>

	<HelpSection title="First: confirm raw chat is empty">
		<p>
			On either Connection Settings sub-tab (Chat Settings for
			YouTube, Twitch Settings for Twitch) there's a Live Raw
			Chat panel at the bottom. Post a test message in your own
			chat — does it appear?
		</p>
		<ul>
			<li><strong>Yes</strong> — chat is reaching Chat-Toys. The problem is downstream (a specific toy isn't enabled or its command is disabled).</li>
			<li><strong>No</strong> — keep reading.</li>
		</ul>
	</HelpSection>

	<HelpSection title="YouTube checklist">
		<ol>
			<li>Open Chat Settings. Is your live stream's URL in the YT Chat Sources list?</li>
			<li>Is its toggle <em>enabled</em>? An unavailable source can't be re-enabled until the stream is actually live and chat is open.</li>
			<li>If you're using Auto Chat, is OBS connected and reporting streaming?</li>
			<li>Member-only or private streams: did you click "Log Into YouTube" so the app has the right auth?</li>
		</ol>
	</HelpSection>

	<HelpSection title="Twitch checklist">
		<ol>
			<li>Open Twitch Settings. Is the auth status green?</li>
			<li>If not, re-run "Authenticate with Twitch".</li>
			<li>Twitch occasionally rolls credentials — re-auth periodically if chats stop arriving.</li>
		</ol>
	</HelpSection>

</template>
