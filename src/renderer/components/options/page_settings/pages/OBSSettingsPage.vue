<!--
	GeneralSettingsPage.vue
	-----------------------

	Page to show settings that don't fit more specifically anywhere else.
-->
<template>

	<PageBox
		title="OBS Settings"
		themeColor="#262262"
		themeImage="assets/bg_tiles/obs.png"
		bgSize="120px"
		bgThemePos="35px"
	>
		<br/><br/>
		<p>
			Chat Toys works by creating a local webserver on your machine to host the widgets, as regular web pages.
		</p>
		<p>
			In OBS, you can add these widgets to your scenes via Browser Sources, and this app will communciate to them.
		</p>
		<p>
			Below you can configure and test the server settings.
		</p>

		<SectionHeader title="Test Page URL"/>
		<SettingsRow>
			<h3>Test Page URL</h3>
			<p>To test the local OBS widget server, copy the URL below and load it in your Web Browser.</p>
			<p>Or try it out in an OBS Browser source.</p>
			<p>It should show a page that says "<strong>Chat Toys - Works!</strong>"</p>
			<URLCopyBox :url="testPageURL" />
		</SettingsRow>

		<SectionHeader title="Widget Demo Mode"/>
		<SettingsInputRow
			type="boolean"
			v-model="ctApp.demoMode.value"
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
			<p>
				<strong>ALSO NOTE:</strong> Changing the port number will break the URL's for the widgets,
				so you will have to edit the browser sources in OBS to the new port number.
			</p>
			<p>
				<strong>FINAL NOTE:</strong> Changing the port number is glitchy. It's recommended you change
				the number, click "Restart Server" then restart the entire app.
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
		<p>
			Below you can see the output from the server.
			This is useful for debugging and testing.
			<br>
			You do not need to understand this log, it's just there for your information.
			<br>
			If you are having issues with the server, you can check this log to see if there are any errors.
			<br>
			You can also use this log to see if the server is running and if it is receiving data.
		</p>
		<RawLogPreview 
			:messages="ctApp.obsServerMessages.value"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject, shallowRef, onMounted, watch, computed } from 'vue';
import { socketShallowRef } from 'socket-ref';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import RawLogPreview from '../RawLogPreview.vue';
import URLCopyBox from '@components/options/URLCopyBox.vue';

// fetch the main app state context
const ctApp = inject('ctApp');


// figure out which URL to show for the test page based on our mode
const testPageURL = computed(() => {
	
	if (window.env.isDev) {
		return 'http://localhost:8080/obsTestPage.html';
	} else {
		const port = ctApp.serverPort.value;
		return `http://localhost:${port}/obsTestPage/`;
	}
});


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
		
	}// .restartButton

</style>
