<!--
	GeneralSettingsPage.vue
	-----------------------

	Page to show settings that don't fit more specifically anywhere else.
-->
<template>

	<PageBox
		title="General Settings"
		themeColor="lightblue"
	>
		<p>
			General settings
		</p>

		<SectionHeader title="CatsumIpsum"/>
		<p>
			{{ ctApp.chatProcessor.screenMessages.value }}
		</p>
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
