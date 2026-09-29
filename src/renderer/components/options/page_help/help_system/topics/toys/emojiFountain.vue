<!--
	toys/emojiFountain.vue
	----------------------
-->
<script>
export const meta = {
	title: 'Emoji Fountain',
	tags: ['emoji', 'animation', 'overlay'],
	keywords: ['rain', 'fountain', 'firework', 'dance', 'floss', 'emoji', 'particles', 'physics', 'spray'],
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
			<li><HelpKbd>!firework 🎃</HelpKbd> — the emoji launches as a rocket and bursts into a giant copy of itself.</li>
			<li><HelpKbd>!dance 😎 🐸</HelpKbd> — a crew of stick-figure dancers is tossed in, one per emoji, with the
				emoji as the head and clothes colored from it. They dance, then hop off. Chat can name a dance:
				<HelpKbd>!dance 😎 floss</HelpKbd>.</li>
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
			<li><strong>Dance settings</strong> — whether a crew dances in sync, how long, dancer size, floor height,
				outline, how many dancers, and which dances can be picked.</li>
		</ul>
	</HelpSection>

	<HelpTip>
		Best as a full-screen overlay. Size the OBS browser source to
		your full canvas so the particles can roam freely.
	</HelpTip>

</template>
