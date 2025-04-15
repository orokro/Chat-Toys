<!--
	ChatPage.vue
	------------

	Page to show scraping details.
-->
<template>

	<PageBox
		title="Chat Settings"
		themeColor="black"
	>
		<br><br>
		<p>
			General settingsz
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
import { chromeShallowRef } from '@scripts/chromeRef';

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
