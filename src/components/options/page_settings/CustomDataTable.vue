<!--
	CustomDataTable.vue
	-------------------

	I tried primevue, vuetify and some others, but none of them worked.
	Just errors. Completely trash.

	So I asked ChatGPT to make me a custom table component, this is the result.
-->
<template>
	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th v-for="key in Object.keys(props.data[0])" :key="key" @click="sort(key)">
						{{ key }}
						<span v-if="sortKey === key">{{ sortOrder === 1 ? '▲' : '▼' }}</span>
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="item in sortedData" :key="item.id">
					<td v-for="key in Object.keys(item)" :key="key">
						{{ item[key] }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue';

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
.table-container {
	padding: 16px;
}

table {
	width: 100%;
	border-collapse: collapse;
	border: 1px solid #ccc;
	border-radius: 8px;
}

thead {
	background-color: #f3f3f3;
	text-align: left;
}

th, td {
	padding: 8px;
	border: 1px solid #ccc;
}

th {
	cursor: pointer;
}

th:hover {
	background-color: #ddd;
}
</style>
