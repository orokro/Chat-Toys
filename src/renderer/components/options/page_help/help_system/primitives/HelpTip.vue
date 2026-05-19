<!--
	HelpTip.vue
	-----------

	Friendly tip box for "did you know" / shortcut hints / nice-to-know
	information. Thin wrapper around HelpCallout pre-set to kind="tip".

	Usage:
	  <HelpTip>
	    You can drag-reorder commands on the Toy Box page.
	  </HelpTip>
-->
<template>
	<HelpCallout kind="tip" :label="label" :icon="icon">
		<slot />
	</HelpCallout>
</template>
<script setup>

// components
import HelpCallout from './HelpCallout.vue';


// props - pass-throughs to HelpCallout for the occasional override
defineProps({
	label: { type: String, default: null },
	icon:  { type: String, default: null },
});

</script>
