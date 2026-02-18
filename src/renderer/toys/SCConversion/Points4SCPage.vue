<!--
	Points4SCPage.vue
	-----------------

	Options page for the Points 4 SuperChats toy.
-->
<template>

	<PageBox
		title="Points 4 SuperChats"
		themeColor="darkred"
		themeImage="assets/bg_tiles/main.png"
		bgSize="120px"
		bgThemePos="-25px"
	>
		
		<br><br>
		<p>
			Award channel points to users when they send a Super Chat on YouTube.
			Points are awarded automatically based on the Super Chat tier (determined by its header color).
		</p>

		<SectionHeader title="General Settings" />

		<div class="settingsBlock">
			
			<SettingsInputRow type="boolean" v-model="settings.enabled">
				<template #title>Enable Points 4 SuperChats</template>
				<p>When enabled, Chat-Toys will monitor for YouTube Super Chats and award points.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="settings.showPointsInChat">
				<template #title>Show earned points in chat</template>
				<p>When enabled, a system message will be added to the live chat announcing the points earned.</p>
			</SettingsInputRow>

		</div>

		<SectionHeader title="Tier Rewards" />
		<p>
			Configure how many points each Super Chat tier awards. 
			You can disable specific tiers if you don't want them to award any points.
		</p>

		<div class="settingsBlock">
			<TierEdit 
				v-for="(tier, index) in tiersInfo" 
				:key="tier.tier"
				:tier="tier.tier"
				:name="tier.name"
				:color="tier.color"
				v-model="settings.tierSettings.value[index]"
			/>
		</div>

	</PageBox>

</template>

<script setup>

// vue
import { inject, computed } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import TierEdit from './TierEdit.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// get the toy instance
const toy = ctApp.toyManager.getToyBySlug('scConversion');
const settings = toy.settings;

/**
 * Static info about the tiers for display
 */
const tiersInfo = [
	{ tier: 1, name: "Blue", color: "#1565C0" },
	{ tier: 2, name: "Light Blue", color: "#00E5FF" },
	{ tier: 3, name: "Green", color: "#0F9D58" },
	{ tier: 4, name: "Yellow", color: "#FFCA28" },
	{ tier: 5, name: "Orange", color: "#F57C00" },
	{ tier: 6, name: "Magenta", color: "#E91E63" },
	{ tier: 7, name: "Red", color: "#E62117" },
];

</script>

<style lang="scss" scoped>

	.settingsBlock {
		margin-bottom: 30px;
	}

</style>
