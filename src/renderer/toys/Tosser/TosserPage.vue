<!--
	TosserPage.vue
	--------------

	This is the settings page for the Tosser system.
-->
<template>

	<PageBox
		title="Tosser Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/tosser.png"
		bgThemePos="50px"
	>
		<div class="picBox" :style="{ height: '500px',}">
			<img src="/assets/chat_solid/tosser.png" height="300px" style="float:right"/>
		</div>
		
		<br>
		<p>
			The Tosser system lets chatters throw things at you, like tomatoes, pies, and more!
		</p>
		<p>
			Users optionally can use the <span class="cmd">!{{ toss_command }}</span> command to throw the first item in the list..
		</p>
		<p>
			Or, if the items have a "slug" set, such as "tomato" they can specify the item to throw,
			like <span class="cmd">!{{ toss_command }} tomato</span>.
		</p>
		<p>
			You can also enable a random toss mode, where the system will randomly select an item to toss if no item is specified.
		</p>
		<p>
			Lastly, with this Toy, you can actually add custom commands. If you do, you must specify the 
			command name to use for each of the tossable items below.
		</p>
		
		<InfoBox icon="lightbulb">
			ON THE TOPIC OF CUSTOM COMMANDS:<br>
			In order to add custom commands, first add the command in the "Command Triggers" section, below.<br>
			Then, set the "command" field for specific 3D objects to match the custom command.<br>
			<i>This is unrelated to the slug</i>
		</InfoBox>

		<InfoBox icon="lightbulb">
			ON THE TOPIC OF SLUGS:<br>
			"slugs" are optional and unrelated to custom commands.<br>
			They are used to specify the item to toss when the user types the command.<br>
			<span class="cmd">!{{ toss_command }} &lt;slug&gt;</span>
		</InfoBox>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Tosser system.
		</p>
		<CommandsConfigBox
			:toy="toy"
			:enableCustomCommands="true"
		/>

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>
		<SettingsInputRow
			type="boolean"
			v-model="randomTossMode"
		>
			<h3>Random Toss Mode</h3>
			<p>If no item is tossed with the <span class="cmd">!{{ toss_command }} &lt;item&gt;</span>
				command, a random will be picked if this is mode is enabled.
			</p>
		</SettingsInputRow>

		<SettingsRow>
			<h3>Tossable Objects</h3>
			<p>Add/Edit 3d Models to Toss!</p>
			<p><strong>NOTE: if no items are added, the toss command will not work in chat.</strong></p>
			<p>You with the Asset Picker dialog, you can also import custom models from your computer.</p>
			<br>
			<ArrayEdit
				v-model="tosserAssets"
				:component="ArrayTosserEdit"
				:rowProps="{ assetManager: ctApp.assetsMgr }"
				:createItem="() => {
					return {
						model: '16',
						modelPath: toy.getAssetPath('16'),
						sound: '15',
						soundPath: toy.getAssetPath('15'),
						scale: 1,
						slug: '',
						cmd: '',
					};
				}"
			/>
		
		</SettingsRow>

		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import CatsumIpsum from '@components/options/../CatsumIpsum.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayTosserEdit from './ArrayTosserEdit.vue';
import WidgetSection from '@components/options/WidgetSection.vue';

// our app
import Tosser from './Tosser';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Tosser.slug];

// get our local refs to use in template
const { 
	tosserAssets, 
	randomTossMode
} = toy.settings;

// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for tossing items
const toss_command = computed(() => {
	return commandsRef.value.tosser__toss?.command || '';
});

</script>
<style lang="scss" scoped>	


</style>
