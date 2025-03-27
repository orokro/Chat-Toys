<!--
	ButtonsBoardPage.vue
	--------------------

	This is the top level component for when the "Showtime Buttons Board" tab is active.
-->
<template>
	
	<VerticalItemsPage
		:verticalItems="verticalItems"
		:selectedTab="selectedPage"
		@changeTab="(tab)=>selectedPage = tab"
	>
		buttons
		<input type="text" v-model="myTestSocket"/>
	</VerticalItemsPage>
</template>
<script setup>

// vue
import { ref, computed } from 'vue';
import { socketRef } from '../../../../common/socketRefClient';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';

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
const selectedPage = ref('settings');

const myTestSocket = socketRef('test', 'bar');

</script>
<style lang="scss" scoped>


</style>
