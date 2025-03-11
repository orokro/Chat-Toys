<!--
	Test.vue
	--------

	Test component
-->
<template>

	<div class="testComp">
		<h1>{{ title }}</h1>
	</div>

</template>
<script setup>

const props = defineProps({
	title: String,
});

</script>
<style lang="scss" scoped>
// main wrapper
.testComp {

	border: 25px;
	background: #EFEFEF;
	padding: 10px;

	h1 {
		color: red;
	}
}
</style>
