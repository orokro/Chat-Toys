<!--
	CommandsDescPage.vue
	--------------------

	Page to show copy & paste-able list of commands.
-->
<template>

	<PageBox title="Commands List" themeColor="#262262" themeImage="assets/bg_tiles/copy_details.png">
		<br>
		<p>
			Below is a text snippet you can copy and paste into your chat to show the list of commands.
		</p>
		<p>
			This list is generated dynamically from your enabled commands, and if you changed
			the command text, it's super chat / member only status, etc.
		</p>
		<p>
			Make sure to copy the latest text!
		</p>

		<textarea
			rows="36"
			cols="122"
			resize="none"
		>{{ generateYouTubeCommandList(ctApp.commands.value) }}</textarea>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';

// fetch the main app state context
const ctApp = inject('ctApp');


/**
 * Generates a pretty text command list for users to copy-and-paste into YouTube descriptions.
 * 
 * @param commandsObj {Object} - The commands object containing command details.
 * @returns {string} - Formatted command list.
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

		// check if we this group's toy is active. If it's not, skip it
		if(ctApp.toyManager.getToyBySlug(group) === null)
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
        line += " ——";

        // Add memberOnly/superOnly flags
        let flags = [];
        if (cmd.superOnly && cmd.memberOnly)
            flags.push("(SC+Member Only)");
        else if (cmd.superOnly)
            flags.push("(SC Only)");
        else if (cmd.memberOnly)
            flags.push("(Member Only)");

        if (flags.length > 0)
            line += ` ${flags.join(' ')}`;

        // Add userDesc if available, or generate one only for the "media" group
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
    return lines.join(`\n`);
}


</script>
<style lang="scss" scoped>

	textarea {
		padding: 15px;

		border: 2px solid black;
		border-radius: 10px;
		box-shadow: inset 4px 4px 6px rgba(0, 0, 0, 0.2);
	}// textarea
	
</style>
