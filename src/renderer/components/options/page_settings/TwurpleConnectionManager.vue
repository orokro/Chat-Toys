<!--
	TwurpleConnectionManager.vue
	----------------------------

	UI for the new Twurple-based Twitch auth. Mirrors
	TwitchConnectionManager.vue's behavior but talks to window.twurpleAPI
	(twurple-* IPC channels) instead of window.twitchAPI.

	Lives side-by-side with the legacy connection manager during the
	Phase 1 migration. After cutover (Phase 4) this becomes the primary.
-->
<template>

	<div class="twurple-connection">

		<h2>Twurple Connection (new system)</h2>

		<!-- Status display -->
		<div class="status">
			<p v-if="loading">Checking Twurple connection...</p>
			<p v-else-if="error" class="error">⚠️ {{ error }}</p>
			<p v-else-if="status.authed">
				✅ Connected as <strong>@{{ status.user.display_name }}</strong>
			</p>
			<p v-else>❌ Not connected via Twurple</p>
		</div>

		<!-- Scope summary - only useful when connected -->
		<div class="scopes" v-if="status.authed && status.scopes?.length">
			<p class="scopes-label">Granted scopes:</p>
			<ul>
				<li v-for="s in status.scopes" :key="s"><code>{{ s }}</code></li>
			</ul>
		</div>

		<!-- Controls -->
		<div class="controls">
			<button
				v-if="!status.authed && !loading"
				@click="connect"
				class="btn connect"
			>
				Connect via Twurple
			</button>

			<button
				v-if="status.authed && !loading"
				@click="disconnect"
				class="btn disconnect"
			>
				Log out
			</button>

			<button
				v-if="!loading"
				@click="refreshStatus"
				class="btn refresh"
			>
				Refresh Status
			</button>
		</div>

		<!-- Info / instructions -->
		<div class="info" v-if="!status.authed && !loading">
			<p>
				This is the <strong>new</strong> Twitch integration, built on Twurple.
				It supports chat, channel point redeems, bits, follows, subs, and raids
				through a single auth session.
			</p>
			<p>
				While this is in beta, the legacy Twitch tab above also still works.
				Once verified, the legacy tab will be hidden.
			</p>
		</div>

		<div class="info" v-if="status.authed && !loading">
			<p>
				If you encounter issues, try <strong>Refresh Status</strong> or
				<strong>Log out</strong> and reconnect.
			</p>
			<p class="hint">
				Tokens refresh silently every ~4 hours - you should never need to re-auth manually.
			</p>
		</div>
	</div>

</template>
<script setup>
/**
 * @file TwurpleConnectionManager.vue
 * @description Vue 3 Composition API component that manages the new
 *              Twurple-based Twitch auth via window.twurpleAPI.
 */

import { ref, onMounted, onUnmounted } from 'vue';

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------

/** @type {import('vue').Ref<{authed?: boolean, user?: object, scopes?: string[]}>} */
const status = ref({ authed: false });

/** @type {import('vue').Ref<boolean>} */
const loading = ref(true);

/** @type {import('vue').Ref<string|null>} */
const error = ref(null);


// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

/**
 * On mount: pull current status, subscribe to twurple-update events
 * coming from the main process so we can re-render reactively when
 * auth state changes (login completes, refresh happens, etc).
 */
onMounted(() => {
	refreshStatus();

	if (window.twurpleAPI && typeof window.twurpleAPI.onUpdate === 'function') {
		window.twurpleAPI.onUpdate((data) => {
			if (data?.status) {
				status.value = data.status;
				loading.value = false;
			}
			if (data?.message) {
				console.log('[Twurple]', data.message);
			}
		});
	}
});


onUnmounted(() => {
	// Listeners on ipcRenderer are global; no per-component teardown needed.
});



// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

/**
 * Pull the current Twurple auth status from the main process.
 */
async function refreshStatus() {

	try {
		loading.value = true;
		error.value = null;
		const res = await window.twurpleAPI.getStatus();
		status.value = res;
	} catch (e) {
		error.value = e.message || 'Failed to refresh status.';
	} finally {
		loading.value = false;
	}
}


/**
 * Begin the Twurple OAuth code-grant flow (opens a popup, redirects
 * to Twitch, comes back to /auth/twurple/callback).
 */
async function connect() {

	try {
		loading.value = true;
		error.value = null;
		await window.twurpleAPI.connect();
		// Actual status update arrives asynchronously via twurple-update.
	} catch (e) {
		error.value = e.message || 'Failed to start Twurple connection.';
		loading.value = false;
	}
}


/**
 * Disconnect: tells main process to clear stored creds + tear down the
 * Twurple clients.
 */
async function disconnect() {

	try {
		loading.value = true;
		error.value = null;
		await window.twurpleAPI.disconnect();
		await refreshStatus();
	} catch (e) {
		error.value = e.message || 'Failed to disconnect.';
	} finally {
		loading.value = false;
	}
}
</script>
<style lang="scss" scoped>

	.twurple-connection {

		padding: 1rem 1.5rem;
		background: #202225;
		color: #fafafa;
		border-radius: 1rem;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);

		h2 {
			font-size: 1.4rem;
			margin-bottom: 0.75rem;
			color: #a970ff;
		}

		.status {
			margin-bottom: 1rem;
			.error {
				color: #ff5555;
			}
		}

		.scopes {
			background: #1a1c1e;
			border-radius: 0.5rem;
			padding: 0.5rem 0.75rem;
			margin-bottom: 1rem;
			font-size: 0.85rem;

			.scopes-label {
				color: #aaa;
				margin-bottom: 0.25rem;
			}

			ul {
				list-style: none;
				padding: 0;
				margin: 0;
				display: flex;
				flex-wrap: wrap;
				gap: 0.4rem;
			}

			li code {
				background: #2c2f33;
				color: #b8c2ff;
				padding: 0.15rem 0.5rem;
				border-radius: 0.25rem;
				font-size: 0.8rem;
			}
		}

		.controls {
			display: flex;
			gap: 0.75rem;
			margin-bottom: 1rem;

			.btn {
				padding: 0.5rem 1rem;
				border: none;
				border-radius: 0.5rem;
				font-weight: 600;
				cursor: pointer;
				transition: background 0.2s, transform 0.1s;

				&:hover {
					transform: translateY(-1px);
				}

				&.connect {
					background: #9146ff;
					color: white;
					&:hover { background: #7c3ae6; }
				}

				&.disconnect {
					background: #ff5555;
					color: white;
					&:hover { background: #e14b4b; }
				}

				&.refresh {
					background: #3a3d41;
					color: #fff;
					&:hover { background: #4b4e53; }
				}
			}// .btn

		}// .controls

		.info {
			font-size: 0.9rem;
			line-height: 1.4;
			color: #ccc;

			p {
				margin-bottom: 0.5rem;
			}

			.hint {
				color: #888;
				font-style: italic;
				font-size: 0.85rem;
			}
		}

	}// .twurple-connection

</style>
