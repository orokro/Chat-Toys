<!--
	ArrayGroupEdit.vue
	------------------

	A component used with ArrayEdit to edit group names in the WidgetGroup settings.
-->
<template>
	<div class="arrayGroupEdit relative">
		<input
			type="text"
			v-model="inputValue"
			@input="handleChange"
			placeholder="Group Name"
			class="input"
		/>
	</div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
	value: {
		type: Object,
		required: true
	}
});

const emit = defineEmits(['change']);

const inputValue = ref(props.value.name);

watch(() => props.value.name, (newName) => {
	inputValue.value = newName;
});

const handleChange = () => {
	emit('change', { ...props.value, name: inputValue.value });
};
</script>

<style lang="scss" scoped>
.arrayGroupEdit {
	position: relative;
	width: 500px;
	height: 40px;
	padding: 6px 10px;

	input {
		border: 1px solid black;
		outline: 1px solid black;
		border-radius: 5px;
		padding: 5px 10px;
		width: 100%;
		box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
	}
}
</style>
