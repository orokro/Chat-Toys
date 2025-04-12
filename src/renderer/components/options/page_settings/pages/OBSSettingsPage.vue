<!--
	GeneralSettingsPage.vue
	-----------------------

	Page to show settings that don't fit more specifically anywhere else.
-->
<template>

	<PageBox
		title="OBS Settings"
		themeColor="black"
	>
		<br/><br/>
		<p>
			Chat Toys uses a local web-server to provide custom Browser Sources for OBS.
		</p>
		<p>
			Below you can configure and test the server settings.
		</p>
		<SectionHeader title="Widget Demo Mode"/>
		<SettingsInputRow
			type="boolean"
			v-model="ctApp.demoMode"
		>
			<h3>Widget Demo Mode</h3>
			<p>When enabled, the various Chat Toy's Widgets will display in "<strong>demo mode</strong>".</p>
			<p>
				This can help you adjust your layout in OBS.
				For example, some components like Media Items, or the Prize wheel will only appear when
				they are activated by the chatters. With <strong>demo mode</strong> enabled, they will
				be visible so you can see how they look on screen.
			</p>
			<p>
				<strong>NOTE:</strong> make sure you disable <strong>demo mode</strong> before you go live!
			</p>
		</SettingsInputRow>


		<SectionHeader title="Server Settings"/>
		<SettingsInputRow
			type="number"
			v-model="ctApp.serverPort"
		>
			<h3>Server Port</h3>
			<p>If you don't know what this is, feel free to ignore it.</p>
			<p>
				Otherwise, if you need to configure the port number that Chat Toys will use to
				serve the Toy Widgets, set below.
			</p>
			<p>
				<strong>NOTE:</strong> This is the port that OBS will connect to, and it must be
				available on your system. If you are using a firewall, you may need to allow this port.
			</p>
			<p>
				<strong>NOTE:</strong> You will need to click the <strong>Restart Server</strong> button
				or restart the entire application for port change to take effect.
			</p>
		</SettingsInputRow>

		<button 
			type="button"
			class="restartButton"
			@click="restartServer"
		>
			Restart Server
		</button>

		<SectionHeader title="Server Output Log"/>
		<div class="logBox">
			<div 
				v-for="(line, index) in ctApp.obsServerMessages.value"
				:key="index"
			>
				{{ line }}
			</div>
		</div>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject, shallowRef, onMounted, watch } from 'vue';
import { socketShallowRef } from 'socket-ref';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// get server port from the app
async function getServerPort() {
	const port = await window.electronAPI.invoke('get-server-port');
	ctApp.serverPort.value = port;
}

// when server port changes from our model, tell the backend
watch(ctApp.serverPort, (newPort) => {
	if (newPort !== 0) {
		window.electronAPI.invoke('set-server-port', newPort);
	}
});

onMounted(() => {

	// get the server port when the component is mounted
	getServerPort();
});


/**
 * Tells our electron thread to restart the server.
 */
function restartServer(){

	// restart the server
	window.electronAPI.invoke('restart-servers');

	setTimeout(() => {
		// get the server port when the server is restarted
		window.location.reload();
	}, 1000);
}


</script>
<style lang="scss" scoped>	

	// restart button
	.restartButton {

		// button style
		background: black;
		color: white;
		font-size: 30px;
		border: 1px solid white;
		border-radius: 5px;
		padding: 10px 20px;
		margin: 30px 0px;

		// hover style
		&:hover {
			background: white;
			color: black;
			cursor: pointer;
		}
	}


	// box to show the server output log
	.logBox {

		background: black;
		color: white;
		font-family: 'Courier New', Courier, monospace;
		font-size: 12px;

		padding: 30px;
		margin: 30px 0px;
		min-height: 300px;
		max-height: 600px;
		overflow-y: auto; // 'auto' instead of 'scroll' is usually better UX
		margin-bottom: 300px;

		// REMOVE flex settings
		// Instead, use this trick:
		display: block;

	}// .logBox

</style>
