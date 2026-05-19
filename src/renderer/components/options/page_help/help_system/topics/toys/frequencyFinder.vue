<!--
	toys/frequencyFinder.vue
	------------------------
-->
<script>
export const meta = {
	title: 'Frequency Finder',
	tags: ['chat', 'analytics', 'repeats'],
	keywords: ['popular', 'trending', 'spam', 'repeated', 'phrase', 'common messages'],
	summary: 'Detects frequently repeated chat phrases and surfaces them on screen.',
	order: 25,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			Watches chat for repeated phrases and surfaces the popular
			ones on screen with a "x12" style count beside them. Great
			for catching live trends ("PogU", "F", chant-style hype)
			without you having to scroll the chat yourself.
		</p>
	</HelpSection>

	<HelpSection title="No commands">
		<p>
			Frequency Finder is passive. Just enable it, place the
			widget, and it watches everything that comes through chat.
		</p>
	</HelpSection>

	<HelpSection title="Key settings">
		<ul>
			<li><strong>Threshold</strong> — how many times a phrase must appear in the window before it surfaces.</li>
			<li><strong>Window length</strong> — how recent the repeats must be.</li>
			<li><strong>Decay</strong> — how quickly a once-popular phrase fades off the widget.</li>
			<li><strong>Text Style</strong> — opens <HelpLink to="concepts.textSettings">Text Settings</HelpLink>; uniquely, this toy has a separate color for the repeat-count badge.</li>
		</ul>
	</HelpSection>

</template>
