<!--
	CreditsPage.vue
	---------------

	Shows page with plugin credits.
-->
<template>

	<PageBox
		title="Credits"
		themeColor="#00ABAE"
		themeImage="assets/bg_tiles/credits.png"
	>
		<br/>
		<p>
			Below are a list of the sources for things I've used, via category.
			<br><br>
			Not all of these things required attribution, but sure why not!
		</p>

		<SectionHeader title="Sound Effects"/>

		<div
			class="fakeLink"
			@click="openLink(`https://www.myinstants.com/en/instant/pop-sfx-75405/`)">
			<h3>Pop Sound</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.myinstants.com/`)">myinstants</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.myinstants.com/en/instant/yaaaaaaaay/`)">
			<h3>Yaaaaay!!</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.myinstants.com/`)">myinstants</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.myinstants.com/en/instant/sad-violin-the-meme-one/`)">
			<h3>Sad Violin</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.myinstants.com/`)">myinstants</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.myinstants.com/en/instant/click-4/`)">
			<h3>Click</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.myinstants.com/`)">myinstants</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.myinstants.com/en/instant/splat-sound-42753/`)">
			<h3>Splat</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.myinstants.com/`)">myinstants</span></div>

		<SectionHeader title="Image Sources"/>

		<div
			class="fakeLink"
			@click="openLink(`https://www.vecteezy.com/png/21278938-boot-isolated-on-transparent`)">
			<h3>Boot</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.vecteezy.com/`)">Vecteezy</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.vecteezy.com/vector-art/2935007-seamless-fish-scale-pattern-vector-illustration`)">
			<h3>Fish Scales</h3>			
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.vecteezy.com/`)">Vecteezy</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://gifer.com/en/3s0F`)">
			<h3>Water Caustics Gif</h3>			
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://gifer.com//`)">Gifer</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.freepik.com/icon/twitter_5968830#fromView=keyword&page=1&position=15&uuid=8b88acba-8b50-4826-b785-ca098e27a233`)">
			<h3>X Icon</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.freepik.com/`)">Freepik</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.freepik.com/icon/email_3694289#fromView=search&page=1&position=2&uuid=2092029c-0b59-408c-b158-a6e721aef2cb`)">
			<h3>Email Icon</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.freepik.com/`)">Freepik</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.freepik.com/icon/discord_5968759#fromView=search&page=1&position=6&uuid=b3a1c6cd-ef48-40a3-9821-ea0db271f04b`)">
			<h3>Discord Icon</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.freepik.com/`)">Freepik</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.freepik.com/icon/web_3694300#fromView=search&page=1&position=1&uuid=62f90bbc-2fcc-4767-ac7b-a7fe0364751c`)">
			<h3>Internet Icon</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.freepik.com/`)">Freepik</span></div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.freepik.com/icon/github_3291695#fromView=search&page=1&position=0&uuid=9e17bf8b-198f-4f6b-96e3-a4bc095b9b63`)">
			<h3>Github Icon</h3>
		</div>
		<div class="moveUp">Via <span class="fakeLink" @click="openLink(`https://www.freepik.com/`)">Freepik</span></div>

		<SectionHeader title="Tools"/>

		<div
			class="fakeLink"
			@click="openLink(`https://www.blender.org/`)">
			<h3>Blender</h3>
		</div>
		<div
			class="fakeLink"
			@click="openLink(`https://www.mixamo.com/#/?page=1&type=Character`)">
			<h3>Mixamo</h3>
		</div>
		<div
			class="fakeLink"
			@click="openLink(`https://tylify.app/`)">
			<h3>Tylify</h3>
		</div>

		<SectionHeader title="NPM Libraries"/>
		<pre>
├── @ngneat/falso@7.3.0
├── @types/three@0.174.0
├── @vitejs/plugin-vue@4.6.2
├── better-sqlite3@11.9.1
├── chalk@4.1.2
├── chokidar@3.6.0
├── chroma-js@3.1.2
├── cors@2.8.5
├── electron-builder@25.1.8
├── electron-interval-system@0.0.1
├── electron-rebuild@3.2.9
├── electron-store@8.2.0
├── electron@32.3.3
├── examples@0.1.0
├── express@4.21.2
├── gdraghelper@1.0.3
├── http-terminator@3.2.0
├── idb@8.0.2
├── jenesius-vue-modal@1.11.9
├── material-icons@1.13.14
├── node-gyp@11.1.0
├── sass@1.86.0
├── seedrandom@3.0.5
├── serve-index@1.9.1
├── socket-ref@0.0.5
├── three@0.174.0
├── typescript@5.8.2
├── uuid@11.1.0
├── vite@4.5.10
├── vue-tippy@6.7.0
├── vue@3.5.13
├── ws@8.18.1
└── yup@1.6.1
		</pre>
	</PageBox>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';


/**
 * Open a link in the default browser
 * 
 * @param url {string} - The URL to open
 */
const openLink = (url) => {
	electronAPI.openExternal(url);
};


</script>
<style lang="scss" scoped>	

	.fakeLink {
			
		margin-top: 1px;
		color: rgb(0, 47, 255);
		font-style: italic;
		cursor: pointer;
		
		&:hover {
			text-decoration: underline;
		}    
	
	}// .fakeLink

	.moveUp {
		position: relative;
		top: -20px;

		font-size: 12px;
	}

</style>
