<!--
	toys/emojiFountain.vue
	----------------------
-->
<script>
export const meta = {
	title: 'Emoji Fountain',
	tags: ['emoji', 'animation', 'overlay'],
	keywords: ['rain', 'fountain', 'emoji', 'particles', 'physics', 'spray'],
	summary: 'Animated emoji rain or fountain triggered by chatters.',
	order: 32,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Chatters drop emojis into their message with a command
			prefix; the toy yeets those emojis onto your stream with
			fun particle physics. Two modes: rain (falls from the top)
			and fountain (shoots up from the bottom).
		</p>
	</HelpSection>

	<HelpSection title="Commands">
		<ul>
			<li><HelpKbd>!rain 🌧️ 💜 🎉</HelpKbd> — emojis rain down from the top of the screen.</li>
			<li><HelpKbd>!fountain 🎉 ✨</HelpKbd> — emojis shoot up from the bottom.</li>
		</ul>
		<p>
			Any emojis in the message become particles. Plain text in
			the message is ignored.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Particle count limits</strong> — caps so a wall of emojis doesn't grind OBS to a halt.</li>
			<li><strong>Physics tuning</strong> — gravity, lifetime, spin.</li>
			<li><strong>Source position</strong> — where rain originates / where the fountain shoots from.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Best as a full-screen overlay. Size the OBS browser source to
		your full canvas so the particles can roam freely.
	</HelpTip>

</template>
