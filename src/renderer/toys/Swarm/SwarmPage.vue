<!--
	SwarmPage.vue
	-------------

	This is the settings page for the Swarm system.
-->
<template>

	<PageBox
		title="Swarm Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgSize="140px"
		bgThemePos="40px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/chat.png" height="300px" style="float:right"/>
		</div>
		<br><br>
		<p>The <span class="cmd">!{{ swarm_command }} &lt;message&gt;</span> command by itself, does nothing.</p>
		<p>But if a critical number of chatters all start typing
		<span class="cmd">!{{ swarm_command }} &lt;message&gt;</span> at the same time,
		then the messages will appear randomly on screen, like a swarm of chat.</p>
		<br></br>
		<p>
			This provides a widget that is designed to be full screen, to show off the swarm of messages over the screen.
		</p>
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Swarm system.
		</p>
		<CommandsConfigBox :toy="toy" />
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				:min="1"
				v-model="swarmSize"
			>
				<template #title>Swarm Size</template>
				<p>
					If the <span class="cmd">!{{ swarm_command }}</span> command is enabled, how many users need to use it
					in a short period of time for a swarm to start?
				</p>
				<p>The time period can be customized below...</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				:min="1"
				v-model="swarmDuration"
			>
				<template #title>Swarm Time Window</template>
				<p>
					Used with the above setting, how long of window should be used to
					count the number of users using the <span class="cmd">!{{ swarm_command }}</span> command?
				</p>
				<p>The number of users can be customized above...</p>
			</SettingsInputRow>


			<SettingsInputRow
				type="boolean"
				v-model="showChatterNames"
			>
				<template #title>Show Chatter Names</template>
				<p>Disable to show messages only.</p>
			</SettingsInputRow>
			<!-- Consolidated text-style settings. -->
			<SettingsTextRow
				v-for="group in toy.static.textSettings"
				:key="group.groupKey"
				:toy="toy"
				:groupKey="group.groupKey"
			/>

		</div>
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/kc-181dg2M8"
			width="100%"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, computed, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import CatsumIpsum from '@components/CatsumIpsum.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import Swarm from './Swarm';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Swarm.slug];

// our local refs state
const {
	swarmSize,
	swarmDuration,

	showChatterNames,
	chatNameColor,
	chatTextColor,
	chatTextShadow,
	chatTextSize,

} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

const swarm_command = computed(() => {
       return commandsRef.value.swarm__swarm?.command || '';
});

</script>
<style lang="scss" scoped>	


</style>
