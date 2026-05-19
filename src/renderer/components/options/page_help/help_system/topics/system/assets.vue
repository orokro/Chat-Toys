<!--
	system/assets.vue
	-----------------
-->
<script>
export const meta = {
	title: 'Assets Database',
	tags: ['assets', 'system', 'media'],
	keywords: ['images', 'gifs', 'sounds', 'audio', '3d models', 'tosser items', 'characters', 'gltf', 'fbx'],
	summary: 'Local library of images, gifs, sounds, and 3D models used by toys.',
	order: 3,
};
</script>
<template>

	<HelpSection title="What lives here">
		<p>
			Anything visual or audible that a toy can reference: chat
			emoji images, Media items, Tosser items, Stream Buddies
			characters, sound effects, and so on. Some assets are
			built in and ship with the app — those can't be deleted —
			and you can import your own at any time.
		</p>
	</HelpSection>

	<HelpSection title="Importing assets">
		<p>
			Click "Import Assets" at the top of the table to add new
			files. Once an asset is in the library, it shows up in the
			pickers on the toys that use it (e.g. the Tosser's item
			editor, Media's asset picker, Stream Buddies' character
			selector).
		</p>
		<HelpWarning>
			<strong>3D model support is limited.</strong> For the
			Tosser, GLTF files with materials and textures packed in
			work best. For Stream Buddies, an FBX with a Mixamo rig in
			T-pose is preferred. Other formats may load but won't
			necessarily render or animate the way you'd hope.
		</HelpWarning>
		<HelpWarning>
			The preview window for 3D models is best-effort. A model
			that previews wrong can still render correctly inside its
			toy's widget — and vice versa. Try it in the actual widget
			before giving up on an asset.
		</HelpWarning>
	</HelpSection>

	<HelpSection title="Deleting assets">
		<p>
			Custom (imported) assets show a delete button on their row.
			Built-in assets can't be deleted. The asset itself isn't
			actually wiped until it's no longer referenced anywhere —
			the system handles cleanup for you.
		</p>
		<HelpWarning>
			Deleting an asset that a toy is using will break that
			toy's reference. If you're not sure who's using it, leave
			it alone.
		</HelpWarning>
	</HelpSection>

</template>
