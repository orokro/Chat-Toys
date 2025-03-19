<!--
	CustomDataTable.vue
	-------------------

	I tried primevue, vuetify and some others, but none of them worked.
	Just errors. Completely trash.

	So I asked ChatGPT to make me a custom table component, this is the result.
-->
<template>

	<div class="p-4">
		<table class="w-full border border-gray-300 rounded-lg">

			<thead>
				<tr class="bg-gray-100 text-left">
					<th v-for="key in Object.keys(props.data[0])" :key="key" class="p-2 cursor-pointer" @click="sort(key)">
						{{ key }}
						<span v-if="sortKey === key">{{ sortOrder === 1 ? '▲' : '▼' }}</span>
					</th>
				</tr>
			</thead>

			<tbody>
				<tr v-for="item in sortedData" :key="item.id" class="border-t">
					<td v-for="key in Object.keys(item)" :key="key" class="p-2">
						{{ item[key] }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';

// props
const props = defineProps({
	data: Array,
});

const sortKey = ref(null);
const sortOrder = ref(1);

const sortedData = computed(() => {
	if (!sortKey.value) return props.data;
	return [...props.data].sort((a, b) => {
		if (a[sortKey.value] < b[sortKey.value]) return -1 * sortOrder.value;
		if (a[sortKey.value] > b[sortKey.value]) return 1 * sortOrder.value;
		return 0;
	});
});

const sort = (key) => {
	if (sortKey.value === key) {
		sortOrder.value *= -1;
	} else {
		sortKey.value = key;
		sortOrder.value = 1;
	}
};
</script>
<style scoped>

	th:hover {
		background-color: #ddd;
	}
	
</style>
