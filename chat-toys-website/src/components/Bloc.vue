<!--
	Bloc.vue
	--------

	Like span, but instead of a span, it's an inline-block div element.
-->
<template>
	<div class="bloc">
		<slot/>
	</div>
</template>
<script setup>

</script>
<style lang="scss" scoped>

	.bloc {
		display: inline-block;
		font-weight: inherit;
	}// .bloc
	
</style>
