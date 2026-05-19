<!--
	toys/karaokeQueue.vue
	---------------------
-->
<script>
export const meta = {
	title: 'Karaoke Queue',
	tags: ['karaoke', 'music', 'queue'],
	keywords: ['song request', 'youtube', 'playlist', 'sing', 'next song', 'request'],
	summary: 'A song-request queue that pulls YouTube videos for karaoke streams.',
	order: 34,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Viewers request songs by pasting a YouTube URL into a
			chat command. The toy queues them up, plays the current
			video in a built-in player widget, and shows the upcoming
			list as a separate "queue" widget your audience can see.
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!request &lt;YouTube URL&gt;</HelpKbd> — add a song to the queue.</li>
		</ul>
	</HelpSection>

	<HelpSection title="Two widgets">
		<p>
			Karaoke Queue ships two widget URLs:
		</p>
		<ul>
			<li><strong>Queue list</strong> — visible on stream, shows what's upcoming and recently played.</li>
			<li><strong>YouTube player</strong> — the actual video, also placed in OBS.</li>
		</ul>
		<p>
			Place the player on whichever scene is your karaoke
			layout, and the queue wherever you want the upcoming list
			to surface.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Queue capacity</strong> — max number of pending songs.</li>
			<li><strong>Played-song color</strong> — dimming tone for songs that have already played, so they read clearly as historical.</li>
			<li><strong>Auto-advance</strong> — whether to roll straight into the next song after the current finishes.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Out-of-process YouTube player. The video plays from inside the
		widget, not via OBS's media source — meaning you can do
		mid-song things in chat (skip, requeue) without OBS getting
		involved.
	</HelpTip>

</template>
