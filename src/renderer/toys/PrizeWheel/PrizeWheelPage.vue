<!--
	PrizeWheelPage.vue
	------------------

	This is the settings page for the prize wheel system.
-->
<template>

	<PageBox
		title="Prize Wheel Settings"
		:themeColor="toy.static.themeColor"
		class="prizeWheelPage"
	>
		<p>
			The Prize Wheel is a fun way to reward your viewers with points, prizes, and more!
		</p>
		<p>
			On this page you can configure the settings for the Prize Wheel system.
		</p>
		<p>
			You can either keep the prize wheel always active, available to be spun at any time, 
			or you can toggle in on/off in the show time page.
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Prize Wheel system.
		</p>
		<CommandsConfigBox :toy="toy" />
			
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		<SettingsRow>
			<h3>Item Slots</h3>
			<p>Add Items to the wheel!</p>
			<p><strong>NOTE: if no items are added, the spin command will not work in chat.</strong></p>
			
			<ArrayEdit
				v-model="wheelItems"
				:component="ArrayTextInput"
				:schema="itemSchema"
				:createItem="() => ''"
			/>
		
		</SettingsRow>

		<SettingsRow>
			<h3>Wheel Colors</h3>
			<p>These will be repeated throughout the wheel based on the number of items you have above.</p>
			
			<ArrayEdit
				v-model="wheelColors"
				:component="ArrayColorInput"
				:schema="colorSchema"
				:createItem="() => '#00ABAE'"
			/>
		
		</SettingsRow>

		<SettingsAssetRow
			v-model="wheelImageId"
			:kind-filter="'image'"
		>
			<h3>Image File for Wheel</h3>
			<p>You can Photoshop or commission a custom theme to use for the wheel.</p>
		</SettingsAssetRow>
		
		<SettingsAssetRow
			v-model="wheelSoundId"
			:kind-filter="'sound'"
		>
			<h3>Click Sound for Wheel</h3>
			<p>What sound to use for the spinning clicks.</p>
		</SettingsAssetRow>

		<SettingsInputRow
			type="boolean"
			v-model="alwaysShowWheel"
		>
			<h3>Always Show Wheel</h3>
			<p>If enabled, the wheel widget will always be visible.</p>
			<p>If not enabled (default), the wheel will only appear when spun.</p>
		</SettingsInputRow>

		<SectionHeader title="Widget Preview"/>
		<p>Below is an example of the points widget as it will appear on the stage.</p>
		<div class="previewBox">

			<div class="widgetBox">
				<PrizeWheelWidget
					:demoMode="true"
				/>
			</div>
			
		</div>
		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import CatsumIpsum from '@components/options/../CatsumIpsum.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayTextInput from '@components/options/ArrayTextInput.vue';
import ArrayColorInput from '@components/options/ArrayColorInput.vue';
import PrizeWheelWidget from './PrizeWheelWidget.vue';
import WidgetSection from '@components/options/WidgetSection.vue';

// lib/misc
import * as yup from 'yup';

// our app
import PrizeWheel from './PrizeWheel';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[PrizeWheel.slug];

// make a yup schema that disallows escape characters, as well as one to validate color strings
const itemSchema = yup.string().matches(/^[^\\]+$/, 'Escape characters are not allowed');
const colorSchema = yup.string().matches(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color');

// our local ref settings for this system
const { 
	wheelItems, 
	wheelColors, 
	wheelImageId, 
	wheelSoundId, 
	alwaysShowWheel,
} = toy.settings;


</script>
<style lang="scss" scoped>	

	// main page scoping
	.prizeWheelPage {

		// random area where we'll show the widget over a bg image
		.previewBox {
			
			position: relative;
			
			width: 600px;
			height: 400px;
			border: 2px solid black;
			border-radius: 10px;

			background-image: url('../assets/channel_points/demo_bg.png');

			// flex center
			display: flex;
			justify-content: center;
			align-items: center;

			// box to spawn the widget in
			.widgetBox {
				
				width: 300px;
				height: 200px;
			
			}// .widgetBox

		}// .previewBox

	}// .prizeWheelPage

</style>
