<!--
	VTSInteractionsPage.vue
	-----------------------

	Settings page for the VTS Interactions toy.

	Gating (see misc/vts-command-toy-plan.md):
	  - State A "notSetup": VTS connection isn't usable AND we've never cached
	    a model. Show only a prompt to set up the VTS connection, with a
	    button that hotlinks to the VTubeStudio connection tab.
	  - State B "onboarding": VTS is connected/authenticated but we have no
	    cached models yet. Prompt the user to load a model and scan it.
	  - State C "full": at least one model has been cached. Show the full
	    config UI (even if currently disconnected), with a live status banner.

	Phase 2 renders States A/B and the State-C scaffold (commands + detected
	models list). The commands x models matrix lands in Phase 3.
-->
<template>

	<PageBox
		title="VTS Interactions Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/vts.png"
		bgThemePos="-20px"
	>
		<br>
		<p>
			VTS Interactions lets chatters trigger your VTube Studio hotkeys and
			expressions with custom commands. Each command can run a different
			sequence per avatar model, so one command (like <span class="cmd">!bald</span>)
			can work across all your models.
		</p>

		<!-- ============================ STATE A: not set up ============================ -->
		<template v-if="state === 'notSetup'">
			<SectionHeader title="Set Up VTubeStudio First"/>
			<InfoBox icon="warning">
				This toy needs an active VTubeStudio connection before you can
				configure anything.
				<ol>
					<li><strong>Enable the VTS Connection</strong> on the VTubeStudio Settings tab</li>
					<li><strong>Authenticate</strong> the ChatToys plugin inside VTubeStudio</li>
					<li>Come back here and load a model to scan it</li>
				</ol>
				<button class="primaryBtn" @click="goToVTSConnection">
					Go to VTubeStudio Settings
				</button>
			</InfoBox>
		</template>

		<!-- ============================ STATE B: onboarding ============================ -->
		<template v-else-if="state === 'onboarding'">
			<SectionHeader title="Scan Your First Model"/>
			<InfoBox icon="lightbulb">
				You're connected to VTubeStudio! To get started, <strong>load the
				avatar model</strong> you want to configure inside VTubeStudio,
				then scan it so ChatToys can see its hotkeys and expressions.
			</InfoBox>

			<div class="statusBanner" :class="bannerClass">
				{{ bannerText }}
			</div>

			<div class="scanRow">
				<button
					class="primaryBtn"
					:disabled="!ctApp.vtsConnMgr.readyToUse.value"
					@click="rescan"
				>
					Scan Current Model
				</button>
				<span v-if="scanning" class="scanHint">Scanning…</span>
				<span v-else-if="lastScanMsg" class="scanHint">{{ lastScanMsg }}</span>
			</div>
		</template>

		<!-- ============================ STATE C: full UI ============================ -->
		<template v-else>

			<!-- live connection status banner -->
			<div class="statusBanner" :class="bannerClass">
				{{ bannerText }}
			</div>

			<SectionHeader title="Command Triggers"/>
			<p>
				Create the commands chatters will use. Then map each one to a
				per-model sequence in the configuration below.
			</p>
			<CommandsConfigBox
				:toy="toy"
				:enable-custom-commands="true"
			/>

			<SectionHeader title="Detected Models"/>
			<p>
				Models ChatToys has scanned. Re-scan after you change hotkeys or
				expressions in VTubeStudio so the lists stay current.
			</p>

			<div class="scanRow">
				<button
					class="primaryBtn"
					:disabled="!ctApp.vtsConnMgr.readyToUse.value"
					@click="rescan"
				>
					Re-scan Current Model
				</button>
				<span v-if="scanning" class="scanHint">Scanning…</span>
				<span v-else-if="lastScanMsg" class="scanHint">{{ lastScanMsg }}</span>
			</div>

			<div class="modelList">
				<div
					v-for="m in cachedModels"
					:key="m.modelID"
					class="modelCard"
					:class="{ active: m.modelID === currentModelID }"
				>
					<div class="modelName">
						{{ m.modelName }}
						<span v-if="m.modelID === currentModelID" class="activeTag">ACTIVE</span>
					</div>
					<div class="modelStats">
						{{ m.hotkeys.length }} hotkeys &middot; {{ m.expressions.length }} expressions
					</div>
				</div>
			</div>

			<InfoBox icon="lightbulb">
				The command &times; model configuration matrix and sequence editor
				are coming next. For now this confirms scanning works and your
				models are being remembered.
			</InfoBox>

		</template>

	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject } from 'vue';
import { chromeRef } from '@scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';

// our app
import VTSInteractions from './VTSInteractions';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[VTSInteractions.slug];

// local UI state
const scanning = ref(false);
const lastScanMsg = ref('');

// number of cached models drives the gating state
const cacheCount = computed(() => Object.keys(toy.modelCache.value || {}).length);

/**
 * The current gating state: 'notSetup' | 'onboarding' | 'full'.
 * Cache-non-empty wins so a previously-configured user always sees the full
 * page, even while temporarily disconnected.
 */
const state = computed(() => {
	if (cacheCount.value > 0)
		return 'full';
	if (ctApp.vtsConnMgr.readyToUse.value)
		return 'onboarding';
	return 'notSetup';
});

// cached models as a sorted array (most recently seen first)
const cachedModels = computed(() => {
	const cache = toy.modelCache.value || {};
	return Object.values(cache).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
});

// id of the model currently loaded in VTS (if any)
const currentModelID = computed(() => ctApp.vtsConnMgr.currentModel.value?.modelID || null);

// live status banner text + style
const bannerText = computed(() => {
	const vts = ctApp.vtsConnMgr;
	if (!vts.enabled.value)
		return 'VTubeStudio connection is disabled.';
	if (!vts.isConnected.value)
		return 'Not connected to VTubeStudio - commands will not fire until reconnected.';
	if (!vts.isAuthenticated.value)
		return 'Connected, waiting for plugin authentication…';
	const cur = vts.currentModel.value;
	return cur?.loaded
		? `Connected. Active model: ${cur.modelName}`
		: 'Connected. No model currently loaded in VTubeStudio.';
});
const bannerClass = computed(() => {
	const vts = ctApp.vtsConnMgr;
	return vts.readyToUse.value ? 'ok' : 'warn';
});


/**
 * Hotlink to the VTubeStudio connection settings tab.
 * mainTab index 1 = "Connection Settings"; settingsPageTab 'vtsSettings'.
 */
function goToVTSConnection() {
	chromeRef('mainTab', 0).value = 1;
	chromeRef('settingsPageTab', 'chatSettings').value = 'vtsSettings';
}


/**
 * Trigger a scan of the currently-loaded model.
 */
async function rescan() {

	scanning.value = true;
	lastScanMsg.value = '';
	try {
		const ok = await toy.scanCurrentModel();
		lastScanMsg.value = ok
			? 'Scan complete.'
			: 'No model loaded to scan - load a model in VTubeStudio first.';
	} catch (err) {
		lastScanMsg.value = `Scan failed: ${err?.message || err}`;
	} finally {
		scanning.value = false;
	}
}

</script>
<style lang="scss" scoped>

	// shared primary button
	.primaryBtn {

		margin-top: 10px;
		padding: 8px 16px;
		border-radius: 40px;
		border: 2px solid black;
		cursor: pointer;

		background: linear-gradient(180deg, #b98bff, #9B5DE5);
		color: white;
		font-weight: bolder;
		text-transform: uppercase;

		&:hover {
			background: linear-gradient(180deg, #cba8ff, #a96ff0);
		}

		&:disabled {
			pointer-events: none;
			opacity: 0.5;
			cursor: not-allowed;
		}
	}// .primaryBtn

	// live status banner
	.statusBanner {

		margin: 15px 0px;
		padding: 10px 15px;
		border-radius: 5px;
		font-family: monospace;
		font-size: 14px;
		color: white;

		&.ok {
			background: #1f7a3d;
		}
		&.warn {
			background: #8a1f2b;
		}
	}// .statusBanner

	// scan row (button + hint)
	.scanRow {
		display: flex;
		align-items: center;
		gap: 12px;

		.scanHint {
			font-size: 13px;
			font-style: italic;
			color: #444;
		}
	}// .scanRow

	// detected models list
	.modelList {

		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 15px;

		.modelCard {

			min-width: 200px;
			padding: 12px 15px;
			border: 2px solid black;
			border-radius: 10px;
			background: rgb(172, 172, 172);

			&.active {
				background: #d8c4ff;
				border-color: #9B5DE5;
			}

			.modelName {
				font-weight: bold;
				font-size: 15px;

				.activeTag {
					margin-left: 8px;
					padding: 1px 8px;
					border-radius: 10px;
					background: #9B5DE5;
					color: white;
					font-size: 10px;
					vertical-align: middle;
				}
			}// .modelName

			.modelStats {
				margin-top: 4px;
				font-size: 12px;
				color: #222;
			}
		}// .modelCard
	}// .modelList

</style>
