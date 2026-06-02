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

		<SectionHeader title="Collider Tracking"/>
		<p>
			By default you place the collider by hand on the Tosser browser source in OBS.
			Connect OBS and/or VTubeStudio and the collider can follow your avatar automatically.
		</p>

		<div class="settingsBlock">

			<!-- nothing available -->
			<InfoBox v-if="!obsConnected && !vtsReady" icon="info">
				Auto-tracking is unavailable until you connect OBS and/or VTubeStudio.
				It's optional — the manual collider still works without it.
			</InfoBox>

			<template v-else>

				<SettingsInputRow
					type="options"
					:options="trackingModeOptions"
					v-model="trackingMode"
				>
					<template #title>Tracking Mode</template>
					<p>How the collider locates your avatar. Auto modes need the matching connection.</p>
				</SettingsInputRow>

				<!-- per-connection availability notes -->
				<InfoBox v-if="!obsConnected" icon="info">
					OBS isn't connected, so OBS-based tracking is unavailable. <strong>Not required</strong> — manual still works.
				</InfoBox>
				<InfoBox v-if="!vtsReady" icon="info">
					VTubeStudio isn't connected, so VTS tracking is unavailable. <strong>Optional</strong> — OBS-only or manual still work.
				</InfoBox>

				<!-- OBS source picker for the auto modes -->
				<template v-if="trackingMode !== 'manual' && obsConnected">
					<SettingsInputRow
						type="options"
						:options="obsSourceOptions"
						v-model="trackingObsSource"
					>
						<template #title>Avatar OBS Source</template>
						<p>Which OBS source is your avatar / VTubeStudio capture. The collider follows this source's position &amp; size.</p>
					</SettingsInputRow>
					<SettingsRow>
						<button class="refreshBtn" @click="refreshObsSources">Refresh source list</button>
						<span v-if="obsSourceOptions.length === 0" class="hint">No sources found in the current scene yet — click refresh.</span>
					</SettingsRow>
				</template>

			</template>
		</div>

		<SectionHeader title="Settings"/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="boolean"
				v-model="randomTossMode"
			>
				<template #title>Random Toss Mode</template>
				<p>If no item is tossed with the <span class="cmd">!{{ toss_command }} &lt;item&gt;</span>
					command, a random will be picked if this is mode is enabled.
				</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0.1"
				:max="4"
				:step="0.1"
				v-model="tossSpeed"
			>
				<template #title>Toss Speed</template>
				<p>How quick objects should fly on screen</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="allEmojisToBeTossed"
			>
				<template #title>Allow Emojis to be Tossed</template>
				<p>If the toss command is provided an emoji, like: <span class="cmd">!{{ toss_command }} 🤣</span>
					instead of throwing a 3d model below, it will throw a 2d emoji image instead!
				</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0.0"
				:max="1"
				:step="0.1"
				v-model="soundVolume"
			>
				<template #title>Sound Volume</template>
				<p>How loud hit sounds should be</p>
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
		</div>
		
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/B4YfacihXjc"
			width="100%"
		/>

	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject, onMounted } from 'vue';
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
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import Tosser from './Tosser';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Tosser.slug];

// get our local refs to use in template
const {
	tosserAssets,
	randomTossMode,
	tossSpeed,
	soundVolume,
	allEmojisToBeTossed,
	trackingMode,
	trackingObsSource,
} = toy.settings;

// ---- collider tracking config ----

// live connection availability
const obsConnected = computed(() => !!ctApp.obsConnMgr?.isConnected?.value);
const vtsReady = computed(() => !!ctApp.vtsConnMgr?.readyToUse?.value);

// tracking modes offered, gated by what's connected
const trackingModeOptions = computed(() => {
	const opts = [{ value: 'manual', label: 'Manual collider (default)' }];
	if (obsConnected.value)
		opts.push({ value: 'obs', label: 'OBS auto-track' });
	if (obsConnected.value && vtsReady.value)
		opts.push({ value: 'obsVts', label: 'OBS + VTubeStudio auto-track' });
	return opts;
});

// OBS source list for the picker
const obsSources = ref([]);
const obsSourceOptions = computed(() => obsSources.value.map((n) => ({ value: n, label: n })));

/**
 * Pull the current scene's source names from OBS into the picker.
 */
async function refreshObsSources() {
	obsSources.value = obsConnected.value
		? await ctApp.obsConnMgr.getSceneSourceNames()
		: [];
}

onMounted(() => {
	if (obsConnected.value)
		refreshObsSources();
});

// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for tossing items
const toss_command = computed(() => {
	return commandsRef.value.tosser__toss?.command || '';
});

</script>
<style lang="scss" scoped>

	.refreshBtn {
		padding: 5px 12px;
		border-radius: 40px;
		border: 2px solid black;
		background: #EFEFEF;
		font-weight: bolder;
		cursor: pointer;

		&:hover { background: #fff; }
	}

	.hint {
		margin-left: 10px;
		font-size: 12px;
		font-style: italic;
		color: #555;
	}

</style>
