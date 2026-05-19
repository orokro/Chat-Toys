<!--
	HelpKbd.vue
	-----------

	Inline `<kbd>`-style chip for keys and chat commands. Tiny, just a
	rounded mono-font pill, but reads way better than wrapping every
	command in <code>.

	Usage:
	  Type <HelpKbd>!shout</HelpKbd> in chat.
	  Press <HelpKbd>Ctrl</HelpKbd> + <HelpKbd>R</HelpKbd>.
-->
<template>
	<kbd class="helpKbd"><slot /></kbd>
</template>
<script setup>
// no props - pure presentational
</script>
<style lang="scss" scoped>

	.helpKbd {

		display: inline-block;
		padding: 1px 7px;
		margin: 0 1px;

		// book chip styling - subtle drop shadow, rounded corners
		font-family: 'Courier New', Courier, monospace;
		font-size: 12.5px;
		line-height: 1.4;
		color: #1f2240;

		background: #f4f4f8;
		border: 1px solid #c8c8d4;
		border-bottom-width: 2px;
		border-radius: 4px;

		// looks pressable
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
		white-space: nowrap;

	}// .helpKbd

</style>
