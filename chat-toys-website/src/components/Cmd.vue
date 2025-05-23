<!--
	Cmd.vue
	-------

	Like span, but for showing CMD text.
-->
<template>
	<span class="cmd">
		!<slot/>
	</span>
</template>
<script setup>

</script>
<style lang="scss" scoped>

	.cmd {

		padding: 2px 4px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.5);
		font-weight: bold;
		font-family: 'Courier New', Courier, monospace;

	}// .bloc
	
</style>
