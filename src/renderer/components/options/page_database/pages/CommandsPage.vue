<!--
	CommandsPage.vue
	----------------

	Master command repository. One CommandsConfigBox per currently-enabled
	toy that exposes (or accepts) chat commands - all in one place, so the
	streamer can review and tweak every command without bouncing between
	the various toy settings pages.

	Reactivity: the toy list is a `computed` that walks
	`chatToysApp.enabledToys.value` and pulls the live toy instances out of
	`toyManager.toys`. Because we read those reactive sources inside the
	computed, the page auto-refreshes when a toy is enabled or removed
	from the chat-toys app.

	Inclusion rule (see `relevantToys` below):
	  - Toy has at least one built-in command (toy.commands.length > 0), OR
	  - Toy declares `static enableCustomCommands = true`
	    (Media, Tosser, VTSTosser - they ship empty but the user can add
	    their own).

	Below the per-toy boxes we show the copy-and-pasteable command list
	snippet that used to live under Connection Settings as "Commands Desc"
	- a more natural home for it now that there's a "Commands" tab.
-->
<template>

	<PageBox
		title="Commands"
		themeColor="#262262"
		:limitWidth="true"
		themeImage="assets/bg_tiles/commands.png"
	>
		<div class="picBox" :style="{ height: '350px' }">
			<img src="/assets/icons/copy_details.png" height="300px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br><br>
		<p>
			Every chat command across every toy you've added to chat-toys,
			in one place. Tweak a command's text, cooldown, member-only
			flag, or channel-points cost here and the change applies
			everywhere - this is the same editor each toy's own settings
			page uses, just collected together for convenience.
		</p>
		<p>
			Toys like <strong>Media</strong>, <strong>Tosser</strong>, and
			<strong>VTS Tosser</strong> ship without any built-in commands
			but let you add your own - use the <em>Add Command</em> button
			on their box to wire up new triggers.
		</p>

		<SectionHeader title="All Active Commands" />

		<div v-if="relevantToys.length === 0" class="empty-state">
			You haven't added any toys with commands yet. Pop over to the
			<strong>Toy Box</strong> or <strong>Tool Box</strong> tab to add
			some - their command tables will show up here.
		</div>

		<div v-else class="commands-list">
			<div
				v-for="toy in relevantToys"
				:key="toy.slug"
				class="toy-block"
			>
				<CommandsConfigBox
					:toy="toy"
					:enableCustomCommands="!!toy.static.enableCustomCommands"
				/>
			</div>
		</div>

		<SectionHeader title="Copy / Paste Command List" />
		<p>
			Below is a text snippet you can copy and paste into your chat
			(or a video description) to show viewers what commands you
			support. The list is generated dynamically from your enabled
			commands - if you change a command's text, super-chat status,
			etc, just re-copy.
		</p>
		<p>
			Make sure to copy the latest text!
		</p>

		<textarea
			class="copyPasteBox"
			rows="36"
			cols="122"
			readonly
		>{{ generateYouTubeCommandList(ctApp.commands.value) }}</textarea>

	</PageBox>

</template>
<script setup>

// vue
import { inject, computed } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';


const ctApp = inject('ctApp');


/**
 * Live list of currently-enabled toys that have commands worth showing.
 *
 * Returns the real Toy instances (not their static metadata) because
 * CommandsConfigBox expects `toy.localCommandsList.value`, the
 * `reconcileCommandsList()` method, etc - all of which live on the
 * instance.
 *
 * A toy is included when EITHER:
 *   - it ships with at least one built-in command, OR
 *   - it declared `static enableCustomCommands = true` (Media et al.)
 *
 * @returns {Array<Object>} ordered list of toy instances
 */
const relevantToys = computed(() => {

	const out = [];

	// Walk enabledToys (reactive) so this re-runs on toy add / remove.
	const enabledSlugs = ctApp?.enabledToys?.value || [];
	const toys = ctApp?.toyManager?.toys || {};

	for (const slug of enabledSlugs) {
		const toy = toys[slug];
		if (!toy) continue;

		const hasBuiltIns = Array.isArray(toy.commands) && toy.commands.length > 0;
		const allowsCustom = !!toy.static?.enableCustomCommands;
		if (!hasBuiltIns && !allowsCustom) continue;

		out.push(toy);
	}

	return out;
});


/**
 * Generates a pretty text command list for users to copy-and-paste into
 * chat or YouTube descriptions. Migrated verbatim (minus the comment
 * style) from the old CommandsDescPage that used to live under
 * Connection Settings.
 *
 * @param {Object} commandsObj - The commands object containing command details.
 * @returns {string} - Formatted command list, newline-delimited.
 */
function generateYouTubeCommandList(commandsObj) {

	let lines = [];
	let lastGroup = null;

	// Sort keys to make output ordered and stable
	const sortedKeys = Object.keys(commandsObj).sort();

	// Loop through each command in the sorted commandsObj
	for (const key of sortedKeys) {

		const cmd = commandsObj[key];

		// Skip disabled commands
		if (!cmd.enabled)
			continue;

		// Get group name from slug (before first __)
		const group = (cmd.slug && cmd.slug.includes('__')) ? cmd.slug.split('__')[0] : '';

		// check if this group's toy is active. If it's not, skip it
		if (ctApp.toyManager.getToyBySlug(group) === null)
			continue;

		// Insert a blank line if the group changes
		if (group !== lastGroup && lastGroup !== null)
			lines.push('');

		lastGroup = group;

		// Start with !command
		let line = `!${cmd.command}`;

		// Add [params] if any
		if (Array.isArray(cmd.params)) {
			cmd.params.forEach(param => {
				line += (param.optional) ? ` [(${param.name})]` : ` [${param.name}]`;
			});
		}

		// Add emdash separator
		line += ' ——';

		// Add memberOnly/superOnly flags
		let flags = [];
		if (cmd.superOnly && cmd.memberOnly)
			flags.push('(SC+Member Only)');
		else if (cmd.superOnly)
			flags.push('(SC Only)');
		else if (cmd.memberOnly)
			flags.push('(Member Only)');

		if (flags.length > 0)
			line += ` ${flags.join(' ')}`;

		// Add userDesc if available, or generate one only for the "media" / "tosser" groups
		if (cmd.userDesc) {
			line += ` ${cmd.userDesc}`;
		} else if (group === 'media') {
			line += ` Show the ${cmd.command} media item!`;
		} else if (group === 'tosser') {
			line += ` Toss the ${cmd.command} item!`;
		}

		lines.push(line);
	}

	// Join lines with real newlines
	return lines.join('\n');
}

</script>
<style lang="scss" scoped>

	.empty-state {
		padding: 20px;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 8px;
		color: #444;
		font-size: 0.95em;
		line-height: 1.5;
	}

	// Stack the per-toy command boxes with a bit of breathing room.
	// Matches the spacing pattern used by WidgetsPage so this page feels
	// like a sibling to it.
	.commands-list {

		display: flex;
		flex-direction: column;
		gap: 20px;

		.toy-block {
			// CommandsConfigBox provides its own card chrome (border +
			// shadow) - no extra wrapper styling needed here.
		}

	}

	// Mirror the textarea styling from the old CommandsDescPage so the
	// snippet still feels framed even though we moved it.
	.copyPasteBox {
		padding: 15px;

		border: 2px solid black;
		border-radius: 10px;
		box-shadow: inset 4px 4px 6px rgba(0, 0, 0, 0.2);

		// readable mono so the table-style alignment shows through
		font-family: 'Courier New', Courier, monospace;
		font-size: 12px;
		resize: vertical;
		width: 100%;
		box-sizing: border-box;
	}

</style>
