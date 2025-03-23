<!--
	LayoutPage.vue
	--------------

	This is the top level component for when the "layout" tab is active.
-->
<template>
	
	<div class="page layoutPage">
		
		<!-- the column on the left where toys can be added, removed, or selected to configure -->
		<VerticalItemStrip
			class="vItemsStrip"
			:vItems="verticalItems"
			:selectedItemSlug="selectedTab"
			:showAdd="false"
			:iconPath="'../assets/icons'"
			@selectItem="(tab)=>selectedTab = tab.slug"
		/>

		<!-- the main area where the selected toys appear -->
		<div ref="mainArea" class="mainArea">

			<PageBox
				title="Layout"
				theme="#777"
				class="layoutPageBox"
			>
				<!-- the main money -->
				<LayoutScreen
					:optionsApp="props.optionsApp"
					:selectedTab="selectedTab"
				/>

				<SectionHeader title="About Layout Configuration"/>
				<p>
					Below you will find a screen full of widgets for the Chat Toy's you've enabled
					and configured in the Toy Box tab.
				</p>
				<p>
					The screen is not to scale, but the aspect ratio is correct based on the resolution
					of the stage you've set in the settings below. Note that, this is not where you capture,
					a separate popup window will be used for that.
				</p>
				<p>
					This screen is simply for laying out the widgets.
				</p>
				<p>
					Click the tabs on the left to enable-editing of a specific toy's widgets.
					Keep in mind that not all widgets will be on screen all the time.					
					
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
					Therefore, you can uncheck "Show All" to see only the item you're working on.
				</p>

			</PageBox>

		</div>

	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, markRaw, watch, computed } from 'vue';

// components
import VerticalItemStrip from '../VerticalItemStrip.vue';
import LayoutScreen from './LayoutScreen.vue';
import PageBox from '../PageBox.vue';
import InfoBox from '../InfoBox.vue';
import SectionHeader from '../SectionHeader.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"
import { toysData } from '../../../scripts/ToysData';

// accept some props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// list of items to show in the vertical strip
const verticalItems = computed(() => {
	const system = {
		name: "system",
		slug: "settings",
		desc: "System Widget.",
	}
	const toys = props.optionsApp.enabledToys.value.map((slug)=>(toysData.asObject[slug]));
	return [system, ...toys];
});

// what's the selected tab?
const selectedTab = ref('settings');

</script>
<style lang="scss" scoped>

	// the main page wrapper
	.layoutPage {

		// fill page area
		position: absolute;
		inset: 0;

		// force tool strip on left side
		.vItemsStrip {
			position: absolute;
			inset: 0px auto 0px 0px;
		}

		// fill on right
		.mainArea {

			// fill right side of screen
			position: absolute;
			inset: 0px 0px 0px 100px;
			overflow: hidden;
			overflow-y: auto;

			// padding for contents (which will always be a PageBox, etc)
			padding: 20px 30px 30px 30px;

			// image to guide user to add their first item
			.clickToAddFirstToy{

				position: relative;
				top: 30px;
				left: 30px;

			}// .clickToAddFirstToy


			// make 1px border for table items
			table {
				border-collapse: collapse;
				width: 100%;
			}
			td {
				border: 1px solid #555;
				padding: 5px;
			}
		}// .mainArea

	}// .layoutPage

</style>
