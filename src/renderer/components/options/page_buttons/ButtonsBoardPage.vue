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
		buttons<br>
		<input v-if="myTestSocket" type="text" v-model="myTestSocket"/><br>
		<input type="text" v-model="myTestSocket2"/>
		
	</VerticalItemsPage>
</template>
<script setup>

// vue
import { ref, computed, inject } from 'vue';
import { chromeRef } from '../../../scripts/chromeRef';
import { socketRef, socketShallowRef, socketRefAsync, bindRef, bindRefs } from 'socket-ref';

// components
import VerticalItemsPage from '../VerticalItemsPage.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// list of items to show in the vertical strip
const verticalItems = computed(() => {
	const system = {
		name: "system",
		slug: "settings",
		desc: "System Widget.",
	}
	const toys = ctApp.enabledToys.value.map((slug)=>(ctApp.toysData.asObject[slug]));
	return [system, ...toys];
});

// what's the selected tab?
const selectedPage = ref('settings');


let myTestSocket = null;
async function setupSocketsTest(){

	const syncRef = chromeRef('test', 'foo');
	window.sr = syncRef;
	myTestSocket = await socketRefAsync('test', 'foo');
	bindRef(myTestSocket).to(syncRef);

	
}
setupSocketsTest();

const myTestSocket2 = socketRef('test2', 'bar');

</script>
<style lang="scss" scoped>


</style>
