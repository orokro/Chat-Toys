<!--
	HelpTrouble.vue
	---------------

	Red-tinted "troubleshooting" callout for the inline failure-mode
	notes ("if the status light stays gray, check that…"). The
	standalone Troubleshooting topic uses these as well for its
	cross-cutting entries.

	Usage:
	  <HelpTrouble>
	    <strong>The widget shows in a browser tab but not in OBS.</strong>
	    Most likely OBS cached the page from before you enabled the toy…
	  </HelpTrouble>
-->
<template>
	<HelpCallout kind="trouble" :label="label" :icon="icon">
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
