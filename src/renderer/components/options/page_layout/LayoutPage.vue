<!--
	LayoutPage.vue
	--------------

	This is the top level component for when the "layout" tab is active.
-->
<template>
	
	<VerticalItemsPage
		class="mainArea layoutPage"
		:verticalItems="verticalItems"
		:selectedTab="selectedTab"
		@changeTab="(tab)=>selectedTab = tab"
	>
		<PageBox
			title="Layout"
			theme="#777"
			class="layoutPageBox"
			themeImage="assets/bg_tiles/layout.png"
		>
			<!-- the main money -->
			<LayoutScreen :activeTab="selectedTab" />

			<SectionHeader title="Single Page URL"/>
			<div class="settingsBlock">
				<SettingsRow>
					<p>
						As described below, this URL can be loaded into an OBS Browser source
						as a way to layout multiple toy widgets in a single browser source.
					</p>
					<p>
						You can also copy the URL below and load it in your Web Browser to test the layout.
						The layout should reflect what you configured in the screen above.
					</p>
					<URLCopyBox :url="livePageURL" />
				</SettingsRow>
			</div>
			
			<SectionHeader title="About Layout Configuration"/>
			<p>
				When incorporating the Chat Toys widgets into your stream, you have two options:
			</p>
			<ul>
				<li><strong>Preferred Method:</strong> Use the Widget URLs provided on the Toy pages directly as browser sources</li>
				<li><strong>Single Source Method:</strong> Use this page to layout all the widgets on a single OBS Browser Source</li>
			</ul>
			<p>
				<br/>
				Using each widget as a separate browser source is the preferred method, as it allows for more flexibility in OBS,
				as you can lay them out using OBS tools, and you can have different widgets for different scenes.
			</p>
			<p>
				However, using multiple browser sources for each widget may affect performance on some systems.
				This page allows you to lay out all your widgets, and load them in OBS with a single Browser source.
				This may work better in OBS, but the lay out controls are limited, and every scene will have the same layout.
			</p>
			<p>
				You can use this page to configure the layout for the single source.<br> <strong><em>If you don't plan on using
				the single source, you don't need to use this layout system at all.</em></strong>
			</p>
			<p>
				The above screen is not to scale, but the aspect ratio is correct based on the resolution
				of the stage you've set in the settings above the screen box.
			</p>
			<p>
				Click the tabs on the left to enable-editing of a specific toy's widgets.
				Keep in mind that not all widgets will be on screen all the time:
			</p>
			<table>
				<tbody>
					<tr>
						<td width="50%">The following items will only appear when they're triggered, for instance:</td>
						<td width="50%">Meanwhile, others like the following will be on screen as long as they're enabled:</td>
					</tr>
					<tr>
						<td>
							<ul>
								<li>Head Pats</li>
								<li>Media</li>
								<li>Shouts</li>
								<li>Channel Points</li>
							</ul>
						</td>
						<td>
							<ul>
								<li>System Output</li>
								<li>Chat Box</li>
								<li>Fishing</li>
								<li>Gamba</li>
							</ul>
						</td>
					</tr>
				</tbody>
			</table>
			<p>
				<br>
				Therefore, you can uncheck "Show All Widgets" to see only the item you're working on.
			</p>
			
			<SectionHeader title="Widget Demo Mode"/>
			<div class="settingsBlock">
				<SettingsInputRow
					type="boolean"
					v-model="ctApp.demoMode.value"
				>
					<template #title>Widget Demo Mode</template>
					<p>When enabled, the various Chat Toy's Widgets will display in "<strong>demo mode</strong>".</p>
					<p>
						This can help you adjust your layout in OBS or on this screen.
						For example, some components like Media Items, or the Prize wheel will only appear when
						they are activated by the chatters. With <strong>demo mode</strong> enabled, they will
						be visible so you can see how they look on screen.
					</p>
					<p>
						<strong>NOTE:</strong> make sure you disable <strong>demo mode</strong> before you go live!
					</p>
				</SettingsInputRow>
			</div>
			<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
		</PageBox>
	</VerticalItemsPage>

</template>
<script setup>

// vue
import { ref, computed, inject } from 'vue';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';
import LayoutScreen from './LayoutScreen.vue';
import PageBox from '../PageBox.vue';
import SectionHeader from '../SectionHeader.vue';
import SettingsInputRow from '../SettingsInputRow.vue';
import SettingsRow from '../SettingsRow.vue';
import URLCopyBox from '../URLCopyBox.vue';
import CatsumIpsum from '@components/CatsumIpsum.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// list of items to show in the vertical strip
const verticalItems = computed(() => {
	const toys = ctApp.enabledToys.value.map((slug)=>(ctApp.toysData.asObject[slug]));
	return [...toys];
});

// what's the selected tab?
const selectedTab = ref(verticalItems.value[0]?.slug || '');

// figure out which URL to show for the test page based on our mode
const livePageURL = computed(() => {
	
	if (window.env.isDev) {
		return 'http://localhost:8080/live.html';
	} else {
		const port = ctApp.serverPort.value;
		return `http://localhost:${port}/live/`;
	}
});


</script>
<style lang="scss" scoped>

	// the main page wrapper
	.layoutPage {


		// make 1px border for table items
		table {
			border-collapse: collapse;
			width: 100%;
		}
		td {
			border: 1px solid #555;
			padding: 5px;
		}
			

	}// .layoutPage

</style>
