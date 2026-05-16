<!--
	DonationsPage.vue
	-----------------

	Settings page for the Donations toy. Tier table (7 fixed rows: image,
	sound, label, bits threshold, enabled), display options, text settings,
	and a "test this tier" preview row.
-->
<template>

	<PageBox
		title="Donations Popup Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/donations.png"
		bgThemePos="35px"
	>
		<div class="picBox" :style="{ height: '350px' }">
			<img src="/assets/icons/donations.png" height="300px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br>
		<p>
			Displays an on-screen popup whenever a YouTube super chat or
			Twitch bits cheer comes in. Each tier can have its own image,
			sound, and label.
			<br><br>
			YouTube super chats are mapped to tiers by their color (just
			like the Points 4 SuperChats toy). Twitch bits cheers are mapped
			by their amount - each tier has a <strong>min bits</strong>
			threshold and the highest-matching tier wins.
		</p>

		<WidgetSection :toy="toy" />

		<SectionHeader title="Display"/>
		<div class="settingsBlock">

			<SettingsInputRow
				type="number"
				:min="2"
				:max="60"
				v-model="displaySeconds"
			>
				<template #title>Display Duration (seconds)</template>
				<p>How long each donation popup stays on screen.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="showUsername">
				<template #title>Show Username</template>
				<p>Display the donor's username on the popup.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="showMessage">
				<template #title>Show Message</template>
				<p>Display the donor's accompanying message (if any).</p>
			</SettingsInputRow>

			<SettingsTextRow
				v-for="group in toy.static.textSettings"
				:key="group.groupKey"
				:toy="toy"
				:groupKey="group.groupKey"
			/>

		</div>

		<SectionHeader title="Tiers"/>
		<p>
			Each row controls a tier. <strong>Min bits</strong> is the lowest
			cheer amount that triggers this tier - the system will always
			pick the highest tier whose threshold a cheer clears. Min-bits
			values must increase down the table; entering a value below the
			previous row will clamp up automatically.
		</p>
		<SettingsRow>
			<ArrayEdit
				v-model="tierSettings"
				:component="ArrayDonationTierEdit"
				:rowProps="{ assetManager: ctApp.assetsMgr, minBits: 0 }"
				:allow-new-items="false"
			/>
		</SettingsRow>

		<SectionHeader title="Test"/>
		<div class="testButtons">
			<button
				v-for="t in 7"
				:key="t"
				class="test-btn"
				:style="{ background: TIER_COLORS[t] }"
				@click="handleTest(t)"
			>
				Test Tier {{ t }}
			</button>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject, watch, nextTick } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayDonationTierEdit from './ArrayDonationTierEdit.vue';

// our app
import Donations from './Donations';


// Same color table the toy + row component use.
const TIER_COLORS = [
	'#888',     // 0 unused
	'#1565C0',  // 1: blue
	'#00E5FF',  // 2: light blue
	'#0F9D58',  // 3: green
	'#FFCA28',  // 4: yellow
	'#F57C00',  // 5: orange
	'#E91E63',  // 6: magenta
	'#E62117',  // 7: red
];


const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Donations.slug];

const {
	displaySeconds,
	showUsername,
	showMessage,
	tierSettings,
} = toy.settings;


/**
 * Bits-threshold monotonicity enforcement. If the streamer edits a row's
 * threshold below the row above it, clamp up so the cheer-to-tier mapping
 * stays well-defined (otherwise a smaller cheer could match a higher tier).
 * Runs after every change to the tier list, with a re-entry guard to avoid
 * infinite loops when our own clamp triggers the watcher again.
 */
let skipMonotonicCheck = false;
watch(tierSettings, (newTiers) => {

	if (skipMonotonicCheck) return;
	if (!Array.isArray(newTiers)) return;

	let fixed = false;
	const adjusted = newTiers.map((row) => ({ ...row }));
	for (let i = 1; i < adjusted.length; i++) {
		const prev = adjusted[i - 1].bitsThreshold ?? 0;
		if ((adjusted[i].bitsThreshold ?? 0) < prev) {
			adjusted[i].bitsThreshold = prev;
			fixed = true;
		}
	}

	if (fixed) {
		skipMonotonicCheck = true;
		tierSettings.value = adjusted;
		nextTick(() => { skipMonotonicCheck = false; });
	}

}, { deep: true });


/** Fire a fake dono into the queue to preview the tier's styling / sound. */
function handleTest(tier) {
	toy.simulateDono(tier);
}

</script>
<style lang="scss" scoped>

	.testButtons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		padding: 20px;

		.test-btn {
			padding: 10px 16px;
			border-radius: 10px;
			cursor: pointer;
			color: white;
			border: 2px solid black;
			text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
			font-weight: bold;

			&:hover {
				filter: brightness(1.1);
			}
		}
	}

</style>
