<!--
	WelcomePage.vue
	---------------

	Shows welcome page for the plugin.
-->
<template>

	<PageBox
		title="Welcome"
		themeColor="#00ABAE"
		themeImage="assets/bg_tiles/welcome.png"
		bgSize="120px"
		bgThemePos="0px"
	>
		<p>
			<br>
			Welcome to the Chat Toys!
			<br>
			If this is your first time, watch the video below to get started!
			<br><br>
		</p>

		<YTVideoBox 
			url="https://youtu.be/iR3jYHwa6OM"
			width="100%"
		/>
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
import YTVideoBox from '@components/YTVideoBox.vue';

</script>
<style lang="scss" scoped>	


</style>
