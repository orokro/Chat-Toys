<!--
	HelpExample.vue
	---------------

	Neutral "example" callout, typically for showing what a chat
	exchange or command sequence looks like in practice.

	Usage:
	  <HelpExample>
	    <p><strong>Chatter:</strong> <code>!shout hello world</code></p>
	    <p><strong>On stream:</strong> a big "HELLO WORLD" banner</p>
	  </HelpExample>
-->
<template>
	<HelpCallout kind="example" :label="label" :icon="icon">
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
