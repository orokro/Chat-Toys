<!--
	TwitchConnectionManager.vue
	----------------------------

	Simple manager UI for handling Twitch authentication state
	within the Electron app's main window.

	Features:
	- Checks Twitch auth status on mount
	- Allows user to connect, disconnect, and refresh
	- Displays current connection info
	- Uses window.twitchAPI bridge (from preload.js)
-->
<template>

	<div class="twitch-connection">

		<h2>Twitch Connection</h2>

		<!-- Status display -->
		<div class="status">
			<p v-if="loading">Checking Twitch connection...</p>
			<p v-else-if="error" class="error">⚠️ {{ error }}</p>
			<p v-else-if="status.authed">
				✅ Connected as <strong>@{{ status.user.display_name }}</strong>
			</p>
			<p v-else>❌ Not connected to Twitch</p>
		</div>

		<!-- Controls -->
		<div class="controls">
			<!-- Login -->
			<button
				v-if="!status.authed && !loading"
				@click="connect"
				class="btn connect"
			>
				Connect to Twitch
			</button>

			<!-- Logout -->
			<button
				v-if="status.authed && !loading"
				@click="disconnect"
				class="btn disconnect"
			>
				Log out
			</button>

			<!-- Refresh -->
			<button
				v-if="!loading"
				@click="refreshStatus"
				class="btn refresh"
			>
				Refresh Status
			</button>
		</div>

		<!-- Optional info / instructions -->
		<div class="info" v-if="!status.authed && !loading">
			<p>
				To connect your Twitch account, click
				<strong>Connect to Twitch</strong> and authorize the app.
			</p>
			<p>
				Once connected, you'll be able to read and respond to Twitch chat
				in your widgets.
			</p>
		</div>

		<div class="info" v-if="status.authed && !loading">
			<p>
				If you encounter issues, try
				<strong>Refresh Status</strong> or
				<strong>Log out</strong> and reconnect.
			</p>
		</div>
	</div>

</template>
<script setup>
/**
 * @file TwitchConnectionManager.vue
 * @description Vue 3 Composition API component that manages Twitch authentication
 * through the Electron preload bridge (window.twitchAPI).
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
 * Check Twitch status on mount and subscribe to twitch-update events.
 */
onMounted(() => {
	refreshStatus();

	// Listen for Twitch updates sent from the main process
	if (window.twitchAPI && typeof window.twitchAPI.onUpdate === 'function') {
		window.twitchAPI.onUpdate((data) => {
			if (data?.status) {
				status.value = data.status;
				loading.value = false;
			}
			if (data?.message) {
				console.log('[Twitch]', data.message);
			}
		});
	}
});


onUnmounted(() => {
	// No need to remove listeners since they are global and harmless,
	// but could be added here if you use an off() method later.
});



// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

/**
 * Refresh current Twitch authentication status.
 */
async function refreshStatus() {
	try {
		loading.value = true;
		error.value = null;
		const res = await window.twitchAPI.getStatus();
		status.value = res;
	} catch (e) {
		error.value = e.message || 'Failed to refresh status.';
	} finally {
		loading.value = false;
	}
}


/**
 * Begin Twitch OAuth connection flow.
 */
async function connect() {
	try {
		loading.value = true;
		error.value = null;
		await window.twitchAPI.connect();
		// Actual update comes asynchronously via twitch-update event
	} catch (e) {
		error.value = e.message || 'Failed to connect to Twitch.';
		loading.value = false;
	}
}


/**
 * Log out from Twitch and clear credentials.
 */
async function disconnect() {
	try {
		loading.value = true;
		error.value = null;
		await window.twitchAPI.disconnect();
		await refreshStatus();
	} catch (e) {
		error.value = e.message || 'Failed to disconnect.';
	} finally {
		loading.value = false;
	}
}
</script>
<style lang="scss" scoped>

	.twitch-connection {
		
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
					&:hover {
						background: #7c3ae6;
					}
				}

				&.disconnect {
					background: #ff5555;
					color: white;
					&:hover {
						background: #e14b4b;
					}
				}

				&.refresh {
					background: #3a3d41;
					color: #fff;
					&:hover {
						background: #4b4e53;
					}
				}// .refresh

			}// .btn

		}// .controls

		.info {
			font-size: 0.9rem;
			line-height: 1.4;
			color: #ccc;
			p {
				margin-bottom: 0.25rem;
			}
		}// .info

	}// .twitch-connection

</style>
