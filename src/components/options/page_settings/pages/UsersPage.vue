<!--
	UsersPage.vue
	-------------

	Let's the user browse all the users that have interacted with the extension.
-->
<template>

	<PageBox
		title="Users Database"
		themeColor="lightblue"
	>
		<p>
			Users
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
