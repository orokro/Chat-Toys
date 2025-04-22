<!--
	PluginPage.vue
	--------------

	Page to show plugin details.
-->
<template>

	<PageBox
		title="Plugin Settings"
		themeColor="#262262"
		themeImage="assets/bg_tiles/plugin.png"
	>
		<p>
			General settings
		</p>

		<SectionHeader title="Live Raw Chat"/>
		<pre>

			{{ ctApp.chatProcessor.screenMessages.value }}
		</pre>
	</PageBox>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

</script>
<style lang="scss" scoped>	


</style>
