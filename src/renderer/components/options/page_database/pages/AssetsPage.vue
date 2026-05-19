<!--
	AssetsPage.vue
	--------------

	System -> Assets entry. Hosts the new AssetBrowser (vuefinder-powered
	virtual filesystem) so the user can organize, import, rename, move,
	and delete their library in one place.

	The browser is backed by:
	  - a side-table `asset_paths` (created + seeded in database.js) that
	    overlays a virtual folder tree on top of the existing flat
	    `custom_assets` table and the bundled built-in assets.
	  - the express route /api/files which speaks the vuefinder API
	    (see src/main/system/assetFsAPI.js).

	"Restore Defaults" re-runs the canonical built-in folder seeding
	(idempotent - won't touch anything you've reorganized).
-->
<template>

	<PageBox
		title="Assets Database"
		themeColor="#69457f"
		:limitWidth="true"
		themeImage="assets/bg_tiles/assets.png"
	>
		<div class="picBox" :style="{ height: '200px' }">
			<img src="/assets/chat_solid/assets_db.png" height="160px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br><br>
		<p>
			Your asset library, organized into virtual folders. Drag and
			drop files from your computer to upload, drag rows between
			folders to reorganize, search by name from the toolbar.
			Right-click an item for rename / delete / move.
		</p>
		<p>
			Toy settings refer to assets by their underlying id, so moving
			or renaming an asset here does <em>not</em> break any toy that
			points at it.
		</p>

		<InfoBox icon="info">
			Built-in assets shipped with Chat-Toys live under
			<strong>Built-in/</strong> and your imported assets land in
			<strong>My Assets/</strong> by default. You can reorganize
			either freely. Deleting a built-in only removes its virtual
			entry — the bundled file stays available and can be restored.
		</InfoBox>

		<InfoBox icon="warning">
			3D model support is limited. GLTF with materials and textures
			packed in is preferred for the Tosser; an FBX with a Mixamo
			rig in T-pose is preferred for Stream Buddies. Other formats
			may load but won't necessarily render or animate correctly.
		</InfoBox>

		<SectionHeader title="Asset Library"/>

		<div class="browserBar">
			<button class="restoreBtn" @click="onRestoreDefaults" title="Re-seed missing built-in folders and assets">
				<span class="material-icons">restart_alt</span>
				Restore Built-in Defaults
			</button>
		</div>

		<div class="browserHost">
			<AssetBrowser finder-id="assetsPage" />
		</div>

		<SectionHeader title="Video Help"/>
		<YTVideoBox
			url="https://youtu.be/x8Pf10d15BM"
			width="100%"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import AssetBrowser from '../../AssetBrowser.vue';
import YTVideoBox from '@components/YTVideoBox.vue';


// fetch the main app state context (for the assets manager refresh + the
// asset DB API exposed via preload).
const ctApp = inject('ctApp');


/**
 * Re-seed the canonical built-in folder layout. INSERT-OR-IGNORE only -
 * never overwrites user reorganizations, but does put back anything the
 * user deleted from the built-in catalog. After it runs we refresh the
 * AssetManager's flat-list shadow so picker-mode dropdowns are accurate.
 */
function onRestoreDefaults() {
	if (typeof window.assetDB?.restoreAssetDefaultLayout !== 'function') {
		console.warn('[AssetsPage] restoreAssetDefaultLayout not available - rebuild needed?');
		return;
	}
	window.assetDB.restoreAssetDefaultLayout();
	ctApp?.assetsMgr?.refreshAssetsFromDB?.();
	// The vuefinder UI will re-fetch its current folder on the next
	// user action (click into a folder, search, etc.). If we wanted to
	// force-refresh now, we'd need a global event - punted for v1.
}

</script>
<style lang="scss" scoped>

	.browserBar {
		display: flex;
		gap: 10px;
		margin: 0 0 10px 0;

		.restoreBtn {

			display: inline-flex;
			align-items: center;
			gap: 6px;

			padding: 6px 12px;
			border: 1px solid rgba(0, 0, 0, 0.18);
			border-radius: 6px;
			background: #f6f7f9;
			cursor: pointer;

			font-size: 13px;
			color: #2b2b35;

			.material-icons {
				font-size: 18px;
			}

			&:hover {
				background: white;
				border-color: rgba(0, 0, 0, 0.3);
			}
		}
	}

	// Asset browser needs a sized host or vuefinder collapses to 0px tall.
	.browserHost {

		width: 100%;
		height: 600px;

		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 8px;
		overflow: hidden;

		// dark theme contrast to match the rest of the page chrome
		background: white;

	}

</style>
