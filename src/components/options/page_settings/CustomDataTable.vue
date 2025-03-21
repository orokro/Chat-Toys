<!--
	CustomDataTable.vue
	-------------------

	I tried primevue, vuetify and some others, but none of them worked.
	Just errors.

	So here's a custom solution for a sortable / customizable table.
-->
<template>
	<div class="table-container">

		<!-- good 'ol tables - can't beat 'em -->
		<table>

			<!-- generate the head -->
			<thead>
				<tr>
					<th
						v-for="key in filteredKeys"
						:key="key"
						@click="sort(key)"
					>
						{{ key }}
						<span v-if="sortKey === key">{{ sortOrder === 1 ? '▲' : '▼' }}</span>
					</th>
					<th v-if="showDeleteColumn"></th>
				</tr>
			</thead>

			<!-- generate the body -->
			<tbody>

				<!-- generate the rows -->
				<tr
					v-for="item in sortedData"
					:key="item.id"
					@click="$emit('rowClick', { id: item.id, data: item })"
					:class="{ 'selected-row': item.id === selected_id }"
				>
					<td 
						v-for="key in filteredKeys"
						:key="key"
						@click="$emit('cellClick', { id: item.id, key, value: item[key] })"
					>

						<!-- special case for the tag column -->
						<span v-if="key === 'tags'">
							<span class="tag" v-for="tagItem in item[key]" :key="tagItem">{{ tagItem }}</span>
						</span>
						<span v-else>{{ item[key] }}</span>
						<button v-if="editableFields.includes(key)" class="edit-btn" @click.stop="$emit('cellEdit', { id: item.id, data: item, key, value: item[key] })">Edit</button>
					</td>

					<!-- optional delete column -->
					<td v-if="showDeleteColumn" class="delete-column" @click.stop="$emit('deleteRow', item.id)">
						<span v-if="item.internal==false" class="material-icons">delete</span>
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
	selected_id: String,
	editableFields: { type: Array, default: () => [] },
	ignoreColumns: { type: Array, default: () => ['id'] },
	showDeleteColumn: Boolean,
});

// state
const sortKey = ref(null);
const sortOrder = ref(1);

const filteredKeys = computed(() => {
	return Object.keys(props.data[0]).filter(key => !props.ignoreColumns.includes(key));
});

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
	position: relative;
}

th {
	cursor: pointer;
}

th:hover {
	background-color: #ddd;
}

.selected-row {
	background-color: #e0f7fa;
}

.edit-btn {
	margin-left: 8px;
	padding: 2px 6px;
	cursor: pointer;
	background: #2196f3;
	color: white;
	border: none;
	border-radius: 4px;
}

.delete-column {
	text-align: center;
	cursor: pointer;
	color: red;
}

.material-icons {
	font-size: 18px;
}

.tag {
	display: inline-block;
	padding: 2px 6px;
	margin: 2px;
	background: #eee;
	border-radius: 4px;
}

</style>
