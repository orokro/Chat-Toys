<!--
	GeneralSettingsPage.vue
	-----------------------

	Page to show settings that don't fit more specifically anywhere else.
-->
<template>

	<PageBox
		title="OBS Connection & Widget Server Settings"
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
			In OBS, you can add these widgets to your scenes via Browser Sources, and this app will communicate to them.
		</p>
		<p>
			Additionally, OBS provides a WebSocket interface that allows external apps to interface with it.<br/>
			In order for Chat Toys to
			detect your live status, chat toys can be connected to OBS. This will be required for detecting YouTube live chat
			automatically.
		</p>

		<SectionHeader title="OBS Connection"/>

		If you want Chat Toys to automatically detect when you go live on YouTube, you need to connect it to OBS via WebSockets.
		<br/>
		This will allow Chat Toys to monitor your streaming status, and start looking for your YouTube live chat to read.
		<br/><br/>
		Below are the setting for the OBS Websocket server, which you will need to enable in OBS, see screens:

		<br/><br/>
		First, goto <strong>Tools &gt; WebSocket Server Settings</strong> in OBS:<br/>
		<small>(Click to enlarge)</small><br/>
		<a href="/assets/obs_screens/01_obs_tools_menu.png" target="_blank">
			<img 
				src="/assets/obs_screens/01_obs_tools_menu.png" 
				style="border-radius: 10px; height: 80px; cursor: pointer;" 
			/>
		</a>
		

		<br/><br/>
		Then, enable the server, set a port number, and a password.<br/>
		Make sure to remember these, as you will need to enter them below:<br/>
		<small>(Click to enlarge)</small><br/>
		<a href="/assets/obs_screens/02_obs_socket_server.png" target="_blank">
			<img 
				src="/assets/obs_screens/02_obs_socket_server.png" 
				style="border-radius: 10px; height: 80px; cursor: pointer;"  
			/>
		</a>
		<br/><br/>

		<div class="settingsBlock">
			<template v-if="ctApp.obsConnMgr.enabled.value">
				<SettingsRow>
					{{ ctApp.obsConnMgr.isConnected.value ? '✅ Connected to OBS' : '❌ Not Connected to OBS' }}
				</SettingsRow>
				<SettingsRow>
					{{ ctApp.obsConnMgr.isStreaming.value ? '✅ OBS is Streaming' : '❌ OBS is Not Streaming' }}
				</SettingsRow>
			</template>
			<template v-else>
				<SettingsRow>
					OBS Connection is Disabled.
				</SettingsRow>
			</template>

			<SettingsInputRow
				type="boolean"
				v-model="ctApp.obsConnMgr.enabled.value"
			>
				<template #title>Enable OBS Connection</template>
				<p>Set this on if you wish to try to connect to OBS,
					so ChatToys can find your live YouTube chat when you go live.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				v-model="ctApp.obsConnMgr.port.value"
			>
				<template #title>OBS WS Port Number</template>
				<p>The port number from your OBS Websockets setup.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="password"
				v-model="ctApp.obsConnMgr.password"
			>
				<template #title>OBS WS Password</template>
				<p>The password text from your OBS Websockets setup.</p>
			</SettingsInputRow>
			<SettingsRow>
				Connecting Status:
				<div class="obsStatusBox">
					{{ ctApp.obsConnMgr.statusMessage.value }}
				</div>
			</SettingsRow>
		</div>

		<SectionHeader title="Widget Server Settings"/>

		<div class="settingsBlock">
			<SettingsRow>
				<h3>Test Page URL</h3>
				<p>To test the local OBS widget server, copy the URL below and load it in your preferred desktop Web Browser<br/>
				(e.g. Chrome, Firefox, etc). Or try it out in an OBS Browser source.</p>
				<br/>
				<p>It should show a page that says "<strong>Chat Toys - Works!</strong>"</p>
				<URLCopyBox :url="testPageURL" />
			</SettingsRow>
		</div>

		<br/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="boolean"
				v-model="ctApp.demoMode.value"
			>
				<template #title>Widget Demo Mode</template>
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
		</div>

		<br/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				v-model="ctApp.serverPort"
			>
				<template #title>Server Port</template>
				<p>If you don't know what this is, feel free to ignore it.</p>
				<p>
					Otherwise, if you need to configure the port number that Chat Toys will use to
					serve the Toy Widgets, set below.
				</p><br/>
				<p>
					<strong>NOTE:</strong> This is NOT the same port as your OBS WebSocket port.
					This will be for browsersource web pages.
					You probably should not touch this at all unless you have something else running on this port.
					<strong><em>({{ ctApp.serverPort }})</em></strong>
				</p><br/>
				<p>
					<strong>ALSO NOTE:</strong> The widgets you use in OBS Browser sources will use this port number.
					If you change it, you will need to update the URL in your OBS Browser sources to match.
				</p><br/>
				<p>
					<strong>FINAL NOTE:</strong> Changing the port number is fickle. It's recommended you change
					the number, click "Restart Server" then restart the entire app.
				</p>
			</SettingsInputRow>
		</div>

		<button 
			type="button"
			class="restartButton"
			@click="restartServer"
		>
			Restart Server
		</button>

		<!-- eh this was kinda pointless, gonna hide it for now -->
		<!-- 
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
		-->

		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/XyfmKtksFIg"
			width="100%"
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
import YTVideoBox from '@components/YTVideoBox.vue';

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

	// shows status message as obs tries to connect
	.obsStatusBox {

		margin-top: 10px;
		padding: 10px;
		border: 1px solid #4444aa;
		border-radius: 5px;
		background-color: #222244;
		color: white;
		font-family: monospace;
		font-size: 14px;

	}// .obsStatusBox

</style>
