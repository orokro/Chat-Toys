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
		<CatsumIpsum :paragraphs="5" :sentences="10"/>
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

const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

</script>
<style lang="scss" scoped>	


</style>
