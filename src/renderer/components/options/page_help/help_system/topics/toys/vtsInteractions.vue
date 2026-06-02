<!--
	toys/vtsInteractions.vue
	------------------------
-->
<script>
export const meta = {
	title: 'VTS Interactions',
	tags: ['vtsInteractions', 'vts', 'vtubestudio', 'hotkeys', 'expressions'],
	keywords: ['vtuber', 'hotkey', 'expression', 'sequence', 'model', 'avatar', 'live2d'],
	summary: 'Let chatters trigger VTubeStudio hotkeys & expressions with custom command sequences.',
	order: 30,
};
</script>
<template>

	<HelpSection title="What it does">
		<p>
			VTS Interactions lets your chat trigger things inside
			VTubeStudio — hotkeys, expressions, or timed sequences of
			them — using custom commands you define. A command like
			<HelpKbd>!bald</HelpKbd> can fire a hotkey, wait a moment,
			then fire another, all on your live avatar. It has no OBS
			widget; everything happens inside VTubeStudio.
		</p>
	</HelpSection>

	<HelpSection title="Before you start">
		<HelpWarning>
			This toy needs the VTubeStudio plugin connection. Set it up
			once under
			<HelpLink to="connectionSettings.vtubeStudio">VTubeStudio Settings</HelpLink>,
			and make sure the plugin is authenticated.
		</HelpWarning>
		<p>
			With VTubeStudio connected, <strong>load the avatar model you
			want to configure</strong>, then press <HelpKbd>Scan Current
			Model</HelpKbd> on the toy's page. That reads the model's
			available hotkeys and expressions and remembers them. Every
			model you scan is saved, so you can configure commands even
			when that model isn't currently loaded.
		</p>
	</HelpSection>

	<HelpSection title="Creating commands">
		<p>
			This toy ships with no built-in commands — you create your
			own, the same way the Media toy works. Add a command in the
			<strong>Command Triggers</strong> box (for example
			<HelpKbd>!bald</HelpKbd>), then map it to a sequence below.
		</p>
	</HelpSection>

	<HelpSection title="Building sequences">
		<p>
			The <strong>Sequence Configuration</strong> grid lists your
			commands down the side and your scanned models across the
			top. Each cell is the sequence that runs for that command on
			that model. Hover a cell and click the pencil to open the
			editor.
		</p>
		<p>
			The editor is a vertical block stack. Drag blocks from the
			palette into the chain:
		</p>
		<ul>
			<li><strong>Hotkey</strong> — fire one of the model's hotkeys.</li>
			<li><strong>Expression</strong> — activate, deactivate, or toggle an expression.</li>
			<li><strong>Wait</strong> — pause a number of seconds before the next block.</li>
		</ul>
		<HelpExample>
			Hotkey [Bald On] › Wait [3s] › Hotkey [Bald Off] — a toggle
			with a delay in between.
		</HelpExample>
	</HelpSection>

	<HelpSection title="One command, many models">
		<p>
			A command name can only exist once across Chat-Toys, but you
			likely have more than one avatar. That's why sequences are
			stored <em>per model</em>: <HelpKbd>!bald</HelpKbd> can run a
			different sequence on each model. When the command fires,
			Chat-Toys runs the sequence for whichever model is
			<strong>currently loaded</strong> — your chatters never pick
			a model, your live avatar decides.
		</p>
	</HelpSection>

	<HelpSection title="Queueing & switching models mid-stream">
		<p>
			Sequences run one at a time, in order — fire
			<HelpKbd>!bald</HelpKbd> twice and it runs back-to-back, never
			overlapping.
		</p>
		<p>
			If you swap your model while a sequence is running, that
			sequence is aborted immediately (its remaining hotkeys might
			not exist on the new model). Anything still queued waits for a
			model it's configured for: if you switch back within about a
			minute it still runs, otherwise it's dropped.
		</p>
	</HelpSection>

	<HelpSection title="Gotchas">
		<HelpTrouble>
			<p><strong>A cell shows a ⚠️ warning.</strong></p>
			<p>
				That sequence references a hotkey or expression that no
				longer exists on the model (you renamed or removed it in
				VTubeStudio). Broken sequences won't run. Press
				<HelpKbd>Re-scan Current Model</HelpKbd> after changing
				hotkeys, and fix the affected blocks.
			</p>
		</HelpTrouble>
		<HelpTip>
			Channel-point cost is charged when the command is queued. If a
			queued sequence is later dropped because you never loaded a
			matching model, those points aren't refunded — a known
			limitation for now.
		</HelpTip>
	</HelpSection>

</template>
