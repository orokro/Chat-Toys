<!--
	HelpPage.vue (inner — the "Help" entry in the Help tab's left strip)
	-------------------------------------------------------------------

	Hosts the in-app help SPA. The actual content + navigation lives in
	HelpBrowser, which auto-discovers every topic file under
	help_system/topics/. This file is just the mount point + minimal
	chrome that keeps the help page visually distinct from the rest of
	the app (it reads like a manual sitting inside a settings page).

	If you want to add or edit help content, do NOT touch this file -
	drop a new .vue topic into help_system/topics/ and it shows up
	automatically.
-->
<template>

	<div class="helpPageHost">
		<HelpBrowser />
	</div>

</template>
<script setup>

// the SPA-style help browser, fed by the auto-discovery topic registry
import HelpBrowser from '../help_system/HelpBrowser.vue';

</script>
<style lang="scss" scoped>

	.helpPageHost {

		// the host content area (.actualContent) gives us a white
		// background by default; we want the help browser to live
		// edge-to-edge inside that pane so the book-paper look isn't
		// chopped up by extra padding.
		margin: -20px -30px -30px -30px;

	}// .helpPageHost

</style>
