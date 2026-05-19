<!--
	HelpWarning.vue
	---------------

	Amber "heads up" callout for gotchas the reader needs to know
	BEFORE they try something. Thin wrapper around HelpCallout.

	Usage:
	  <HelpWarning>
	    Twitch bits don't fire unless your chat source is set to
	    Twitch in Connection Settings.
	  </HelpWarning>
-->
<template>
	<HelpCallout kind="warning" :label="label" :icon="icon">
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
