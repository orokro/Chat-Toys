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
		>
			<!-- the main money -->
			<LayoutScreen :activeTab="selectedTab" />

			<SectionHeader title="About Layout Configuration"/>
			<p>
				Above you will find a screen full of widgets for the Chat Toy's you've enabled
				and configured in the Toy Box tab.
			</p>
			<p>
				The screen is not to scale, but the aspect ratio is correct based on the resolution
				of the stage you've set in the settings above the screen box. Note that, this is not where you capture,
				a separate popup window will be used for that.
			</p>
			<p>
				This screen is simply for laying out the widgets.
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

// lib/ misc
import { toysData } from '../../../scripts/ToysData';

// fetch the main app state context
const ctApp = inject('ctApp');

// list of items to show in the vertical strip
const verticalItems = computed(() => {
	const system = {
		name: "system",
		slug: "settings",
		desc: "System Widget.",
	}
	const toys = ctApp.enabledToys.value.map((slug)=>(toysData.asObject[slug]));
	return [system, ...toys];
});

// what's the selected tab?
const selectedTab = ref('settings');

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
