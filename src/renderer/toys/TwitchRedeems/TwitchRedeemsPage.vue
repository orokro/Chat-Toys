<!--
	TwitchRedeemsPage.vue
	---------------------

	Settings page for the TwitchRedeems tool toy. Scaffold stage:
	just the toggle + a placeholder for the mapping UI. The real
	mapping table (with Helix-fetched rewards dropdown + empty
	state + manual entry) lands in Task #14.
-->
<template>

	<PageBox
		title="Twitch Redeems"
		themeColor="darkviolet"
		themeImage="assets/bg_tiles/channelPoints.png"
	>
		<br><br>
		<p>
			Map your Twitch channel point redeems to ChatToys commands.
			When a viewer redeems a configured reward, ChatToys will fire
			the mapped command as if they had typed it in chat.
		</p>
		<p class="hint">
			Requires the new <strong>Twitch (Twurple)</strong> connection from the
			Connection Settings tab. Channel Points must also be enabled on your
			Twitch channel (Affiliate or higher, or Monetization for All if rolled out
			to your account).
		</p>

		<SectionHeader title="General Settings" />

		<div class="settingsBlock">

			<SettingsInputRow type="boolean" v-model="enabled">
				<template #title>Enable Twitch Redeems</template>
				<p>When enabled, ChatToys will route Twitch channel point redemptions to their mapped commands.</p>
			</SettingsInputRow>

		</div>

		<SectionHeader title="Redeem Mappings" />

		<div class="mappingsPlaceholder">
			<p><em>Mapping UI lands in Phase 3 Task #14.</em></p>
			<p>For now, this is a scaffold to verify the toy registers correctly in the Tool Box.</p>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// Pull the toy instance + its reactive settings refs
const toy = ctApp.toyManager.getToyBySlug('twitchRedeems');
const { enabled } = toy.settings;

</script>
<style lang="scss" scoped>

	.hint {
		font-size: 0.9rem;
		color: #888;
		font-style: italic;
		margin-bottom: 1rem;
	}

	.settingsBlock {
		margin-bottom: 1.5rem;
	}

	.mappingsPlaceholder {
		padding: 1rem 1.25rem;
		background: #f7f4ff;
		border: 1px dashed #c4b5fd;
		border-radius: 0.5rem;
		color: #6b21a8;

		p {
			margin: 0 0 0.4rem 0;
		}
	}

</style>
