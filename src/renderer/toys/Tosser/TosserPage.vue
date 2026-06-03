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

				<!-- tracked sources: the collider follows the first present in the current scene -->
				<template v-if="trackingMode !== 'manual' && obsConnected">
					<SettingsRow>
						<h3>Tracked Avatar Source(s)</h3>
						<p>The collider follows the <strong>first</strong> of these that's present in the current scene — so switching scenes (or differently-named avatar sources) just works. Add the source(s) your avatar lives in.</p>

						<div class="trackedList">
							<div v-if="trackingObsSources.length === 0" class="emptyRow">No sources added yet — click &ldquo;Add Source&rdquo;.</div>
							<div
								v-for="name in trackingObsSources"
								:key="name"
								class="trackedRow"
								:class="{ active: name === activeTrackedSource, missing: isMissing(name) }"
							>
								<span v-if="isMissing(name)" class="badge warn" title="This source isn't in OBS anymore (renamed or removed)">⚠️</span>
								<span v-else-if="name === activeTrackedSource" class="badge dot" title="Currently tracking this source">●</span>
								<span v-else class="badge"></span>
								<span class="trackedName">{{ name }}</span>
								<button class="del" title="Remove" @click="removeSource(name)">✕</button>
							</div>
						</div>

						<button class="refreshBtn" @click="openAddModal">+ Add Source</button>
					</SettingsRow>
				</template>

				<!-- testing aid: overlay the tracked collider on the widget -->
				<SettingsInputRow
					v-if="trackingMode !== 'manual'"
					type="boolean"
					v-model="showColliderDebug"
				>
					<template #title>Show Collider Debug Box</template>
					<p>Overlays the tracked collider on the Tosser widget so you can see where hits will register — no need to toss items. Turn off before going live. Solid box = source rect; dotted box = the VTS hit area.</p>
				</SettingsInputRow>

				<!-- obsVts: tune the hit sub-box within the source -->
				<template v-if="trackingMode === 'obsVts'">
					<SettingsInputRow type="float" :min="0.05" :max="1" :step="0.05" v-model="vtsBoxWidth">
						<template #title>Hit Box Width</template>
						<p>Width of the avatar hit area within the source (fraction of the source).</p>
					</SettingsInputRow>
					<SettingsInputRow type="float" :min="0.05" :max="1" :step="0.05" v-model="vtsBoxHeight">
						<template #title>Hit Box Height</template>
						<p>Height of the avatar hit area within the source (fraction of the source).</p>
					</SettingsInputRow>
					<SettingsInputRow type="float" :min="0" :max="1" :step="0.02" v-model="vtsBoxAnchorY">
						<template #title>Hit Box Vertical Position</template>
						<p>0 = top, 0.5 = middle, 1 = bottom. Default is the upper area (head / chest), since VTubeStudio has no head-position API.</p>
					</SettingsInputRow>
					<SettingsInputRow type="float" :min="0" :max="4" :step="0.05" v-model="vtsFollowStrength">
						<template #title>Follow VTS Model</template>
						<p>How much the hit box shifts with your VTubeStudio model's position (0 = fixed in place). Crank this up until the dotted box tracks your model 1:1 horizontally — VTubeStudio's coordinate units don't map to OBS pixels by any fixed amount, so this needs calibrating by eye.</p>
					</SettingsInputRow>
				</template>

			</template>
		</div>

		<SectionHeader title="VTubeStudio Reaction"/>
		<p>
			When a tossed item lands on your avatar, give your VTubeStudio model a quick
			recoil &mdash; a little &ldquo;bonk&rdquo; tilt that springs back.
		</p>

		<div class="settingsBlock">

			<InfoBox v-if="!vtsReady" icon="info">
				Connect VTubeStudio to enable the recoil reaction. It's optional &mdash; the Tosser works without it.
			</InfoBox>

			<template v-else>
				<SettingsInputRow type="boolean" v-model="recoilOnHit">
					<template #title>Recoil on Hit</template>
					<p>Tilt your model when an item connects. Rapid hits are throttled so your model isn't spammed.</p>
				</SettingsInputRow>

				<SettingsInputRow
					v-if="recoilOnHit"
					type="float"
					:min="1"
					:max="45"
					:step="1"
					v-model="recoilAngle"
				>
					<template #title>Recoil Strength</template>
					<p>Peak tilt of the bonk, in degrees. The model is knocked away from the side the item came from, then springs back.</p>
				</SettingsInputRow>
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
import { computed, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// lib/misc
import { promptModal } from 'jenesius-vue-modal';

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
import ObsSourcePickerModal from './ObsSourcePickerModal.vue';

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
	trackingObsSources,
	showColliderDebug,
	vtsBoxWidth,
	vtsBoxHeight,
	vtsBoxAnchorY,
	vtsFollowStrength,
	recoilOnHit,
	recoilAngle,
} = toy.settings;

// which tracked source is currently driving the collider (for highlighting)
const activeTrackedSource = toy.activeTrackedSource;

// ---- collider tracking config ----

// live connection availability
const obsConnected = computed(() => !!ctApp.obsConnMgr?.isConnected?.value);
const vtsReady = computed(() => !!ctApp.vtsConnMgr?.readyToUse?.value);

// tracking modes offered, gated by what's connected
const trackingModeOptions = computed(() => {
	const opts = [{ value: 'manual', name: 'Manual collider (default)' }];
	if (obsConnected.value)
		opts.push({ value: 'obs', name: 'OBS auto-track' });
	if (obsConnected.value && vtsReady.value)
		opts.push({ value: 'obsVts', name: 'OBS + VTubeStudio auto-track' });
	return opts;
});

/**
 * True when a tracked source name is no longer present anywhere in OBS
 * (renamed or removed). Only flagged when we actually have a cache.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isMissing(name) {
	const all = ctApp.obsConnMgr?.sourceCache?.value?.allNames || [];
	return obsConnected.value && all.length > 0 && !all.includes(name);
}

/**
 * Remove a source from the tracked list.
 * @param {string} name
 */
function removeSource(name) {
	trackingObsSources.value = (trackingObsSources.value || []).filter((n) => n !== name);
}

/**
 * Open the scene/source picker and merge the chosen names into the list.
 */
async function openAddModal() {
	const result = await promptModal(ObsSourcePickerModal, {
		existing: [...(trackingObsSources.value || [])],
	});
	if (!result || !Array.isArray(result.names))
		return;

	const merged = [...(trackingObsSources.value || [])];
	for (const n of result.names)
		if (!merged.includes(n))
			merged.push(n);
	trackingObsSources.value = merged;
}

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

	// tracked OBS sources list
	.trackedList {
		max-width: 700px;
		margin: 10px 0;
		border: 2px solid black;
		border-radius: 8px;
		background: rgb(172, 172, 172);
		overflow: hidden;

		.emptyRow {
			padding: 12px;
			text-align: center;
			font-style: italic;
			color: #444;
		}

		.trackedRow {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-bottom: 1px solid rgba(0, 0, 0, 0.2);

			&:last-child { border-bottom: none; }
			&.active  { background: #d4f5d4; }
			&.missing { background: #f6d0d0; }

			.badge {
				width: 16px;
				text-align: center;

				&.dot { color: #1f9d3a; }
			}

			.trackedName {
				flex: 1;
				font-family: 'Courier New', Courier, monospace;
				font-size: 13px;
			}

			.del {
				width: 24px;
				height: 24px;
				border: none;
				border-radius: 4px;
				background: rgba(0, 0, 0, 0.15);
				cursor: pointer;

				&:hover { background: #e3556a; color: white; }
			}
		}
	}

</style>
