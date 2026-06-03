<template>
	<div class="karaokeQueueManager" v-if="toyEnabled === true">
		<header class="managerHeader">
			<div class="headerLeft">
				<span class="material-icons">mic_external_on</span>
				<h1>Karaoke Queue Manager</h1>
			</div>
			<div class="headerRight">
				<span class="status" :class="currentVideo.state">{{ currentVideo.state.toUpperCase() }}</span>
			</div>
		</header>

		<!-- Top Row: YouTube Embed and Current Info -->
		<section class="playbackSection">
			<div class="videoContainer">
				<div v-if="currentVideo.videoId" class="embedWrapper">
					<iframe 
						width="320" 
						height="180" 
						:src="'https://www.youtube.com/embed/' + currentVideo.videoId" 
						frameborder="0" 
						allow="autoplay; encrypted-media" 
						allowfullscreen>
					</iframe>
					<a :href="'https://www.youtube.com/watch?v=' + currentVideo.videoId" target="_blank" class="ytLink">
						Open on YouTube <span class="material-icons">open_in_new</span>
					</a>
				</div>
				<div v-else class="placeholder">
					<span class="material-icons">smart_display</span>
					<p>Select a song to start playing</p>
				</div>
			</div>

			<div class="playbackControls" v-if="currentVideo.videoId">
				<h3>Now Playing: {{ currentVideo.title }}</h3>
				<div class="btnGroup">
					<button @click="playVideo" class="controlBtn play" :class="{ active: currentVideo.state === 'playing' }">
						<span class="material-icons">play_arrow</span> Play
					</button>
					<button @click="pauseVideo" class="controlBtn pause" :class="{ active: currentVideo.state === 'paused' }">
						<span class="material-icons">pause</span> Pause
					</button>
					<button @click="restartVideo" class="controlBtn">
						<span class="material-icons">replay</span> Restart
					</button>
				</div>
			</div>
		</section>

		<!-- Main Columns -->
		<section class="queueSection">
			<div class="column pendingColumn">
				<div class="colHeader">
					<h2>Pending Requests ({{ pendingRequests.length }})</h2>
				</div>
				<div class="songList">
					<div v-for="(element, index) in pendingRequests" :key="element.id" class="songItem" @click="selectVideo(element)">
						<img :src="element.thumbnail" class="thumb" />
						<div class="songInfo">
							<span class="title">{{ element.title }}</span>
							<span class="requester">By: {{ element.requestedBy }}</span>
						</div>
						<div class="actions">
							<button class="reorderBtn" @click.stop="moveItem(pendingRequests, index, -1, 'pending')" :disabled="index === 0">
								<span class="material-icons">arrow_upward</span>
							</button>
							<button class="reorderBtn" @click.stop="moveItem(pendingRequests, index, 1, 'pending')" :disabled="index === pendingRequests.length - 1">
								<span class="material-icons">arrow_downward</span>
							</button>
							<button class="approveBtn" @click.stop="approveRequest(element)">
								<span class="material-icons">check_circle</span>
							</button>
							<button class="denyBtn" @click.stop="removeRequest(element, 'pending')">
								<span class="material-icons">cancel</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="column approvedColumn">
				<div class="colHeader">
					<h2>Approved Queue ({{ approvedRequests.length }})</h2>
				</div>
				<div class="songList">
					<div v-for="(element, index) in approvedRequests" :key="element.id" class="songItem" :class="{ played: isPlayed(element) }" @click="selectVideo(element)">
						<img :src="element.thumbnail" class="thumb" />
						<div class="songInfo">
							<span class="title">{{ element.title }}</span>
							<span class="requester">By: {{ element.requestedBy }}</span>
						</div>
						<div class="actions">
							<button class="reorderBtn" @click.stop="moveItem(approvedRequests, index, -1, 'approved')" :disabled="index === 0">
								<span class="material-icons">arrow_upward</span>
							</button>
							<button class="reorderBtn" @click.stop="moveItem(approvedRequests, index, 1, 'approved')" :disabled="index === approvedRequests.length - 1">
								<span class="material-icons">arrow_downward</span>
							</button>
							<button class="playSongBtn" @click.stop="playSong(element)">
								<span class="material-icons">play_circle_filled</span>
							</button>
							<button class="denyBtn" @click.stop="removeRequest(element, 'approved')">
								<span class="material-icons">delete</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Bottom Bar: Manual Add -->
		<footer class="managerFooter">
			<div class="manualAdd">
				<input 
					type="text" 
					v-model="manualUrl" 
					placeholder="Enter YouTube URL or ID..." 
					@keyup.enter="addManualSong"
				/>
				<button @click="addManualSong">Add Song</button>
			</div>
		</footer>
	</div>
	<div v-else-if="toyEnabled === false" class="notEnabled">
		<span class="material-icons">warning</span>
		<p>The Karaoke Queue toy is currently disabled. Enable it from the Toy Box in the main window.</p>
	</div>
	<div v-else class="notEnabled">
		<span class="material-icons">sync</span>
		<p>Connecting&hellip;</p>
	</div>
</template>

<script setup>

/*
	KaraokeQueueManager.vue
	-----------------------

	Pop-out management UI for the Karaoke Queue toy.

	This window deliberately does NOT instantiate the whole app. The toy's
	queue state lives in cross-window socket refs (the same WebSocket bus the
	OBS widgets use), so this manager binds directly to those keys and reads /
	writes them as a peer of the main-window toy instance. The main window
	remains the sole owner that processes !request chat commands; this is just
	another client of the shared state.

	It also watches the shared `general-settings` socket (which carries the
	enabledToys list): if the streamer disables the Karaoke Queue toy in the
	main window, this pop-out auto-closes.
*/

// vue
import { ref, computed, watch } from 'vue';
import { socketShallowRef, socketShallowRefReadOnly } from 'socket-ref';

// our app
import KaraokeQueue from './KaraokeQueue';

// helper to build this toy's socket-ref keys. MUST match Toy.slugify(), which
// lowercases the suffix: `slug + '__' + text.toLowerCase()`. The OBS widgets
// build their keys the same way - without the .toLowerCase() the manager binds
// to non-existent keys and silently fails to sync (no reads, no writes reach
// OBS).
const slug = KaraokeQueue.slug;
const key = (name) => `${slug}__${name.toLowerCase()}`;

// -----------------------------------------------------------------------
// Shared cross-window state (read-write; same keys the toy owns)
// -----------------------------------------------------------------------
const pendingRequests = socketShallowRef(key('pendingRequests'), []);
const approvedRequests = socketShallowRef(key('approvedRequests'), []);
const playedSongs = socketShallowRef(key('playedSongs'), []);
const currentVideo = socketShallowRef(key('currentVideo'), {
	videoId: null,
	title: '',
	state: 'idle',
	timestamp: 0,
});

// local-only input field for the manual-add box
const manualUrl = ref('');

// -----------------------------------------------------------------------
// Enabled-state tracking + auto-close
// -----------------------------------------------------------------------

// The main window broadcasts general app settings (including the enabledToys
// list) over the 'general-settings' socket; we read it to know whether the
// Karaoke Queue toy is still enabled.
const generalSettings = socketShallowRefReadOnly('general-settings', 'uninitialized');

/**
 * Whether the Karaoke Queue toy is enabled in the main window.
 *  - true / false once we've received a real settings payload
 *  - null while still waiting for the first payload
 *
 * @type {import('vue').ComputedRef<boolean|null>}
 */
const toyEnabled = computed(() => {
	const s = generalSettings.value;
	if (s === 'uninitialized' || !s || typeof s !== 'object')
		return null;
	return Array.isArray(s.enabledToys) ? s.enabledToys.includes(slug) : false;
});

// Auto-close when the toy is disabled in the main window. We only close on a
// real enabled -> disabled transition: `sawEnabled` guards against closing
// during the brief 'uninitialized' window at startup (toyEnabled === null) and
// against the edge case of the pop-out opening while the toy is already off
// (we show a passive notice for that instead).
let sawEnabled = false;
watch(toyEnabled, (enabled) => {
	if (enabled === true)
		sawEnabled = true;
	else if (enabled === false && sawEnabled)
		window.close();
}, { immediate: true });


/**
 * Move an item up/down within one of the queue lists.
 *
 * @param {Array<Object>} list - the current list (pending or approved)
 * @param {number} index - index of the item to move
 * @param {number} direction - -1 to move up, +1 to move down
 * @param {string} listName - 'pending' or 'approved'
 */
function moveItem(list, index, direction, listName) {
	const newIndex = index + direction;
	if (newIndex < 0 || newIndex >= list.length) return;

	const newList = [...list];
	const item = newList[index];
	newList.splice(index, 1);
	newList.splice(newIndex, 0, item);

	if (listName === 'pending')
		pendingRequests.value = newList;
	else
		approvedRequests.value = newList;
}


/**
 * Approve a pending request, moving it into the approved queue.
 *
 * @param {Object} song - the pending song request
 */
function approveRequest(song) {
	pendingRequests.value = pendingRequests.value.filter(s => s.id !== song.id);
	approvedRequests.value = [...approvedRequests.value, { ...song, status: 'approved' }];
}


/**
 * Remove a request from a list (and from played history if it was approved).
 *
 * @param {Object} song - the song to remove
 * @param {string} list - 'pending' or 'approved'
 */
function removeRequest(song, list) {
	if (list === 'pending') {
		pendingRequests.value = pendingRequests.value.filter(s => s.id !== song.id);
	} else {
		approvedRequests.value = approvedRequests.value.filter(s => s.id !== song.id);
		// also remove from played history if it was there
		playedSongs.value = playedSongs.value.filter(s => s.videoId !== song.videoId);
	}
}


/**
 * Preview a song in the embed without changing global play state.
 *
 * @param {Object} song
 */
function selectVideo(song) {
	currentVideo.value = {
		...currentVideo.value,
		videoId: song.videoId,
		title: song.title,
	};
}


/**
 * Start playing a song and mark it as played.
 *
 * @param {Object} song
 */
function playSong(song) {
	currentVideo.value = {
		videoId: song.videoId,
		title: song.title,
		state: 'playing',
		timestamp: Date.now(),
	};
	markAsPlayed(song);
}


/**
 * Add a song to the top of the played history (if not already there).
 *
 * @param {Object} song
 */
function markAsPlayed(song) {
	if (!song || !song.videoId) return;
	if (!isPlayed(song))
		playedSongs.value = [song, ...playedSongs.value];
}


/**
 * Whether a song is already in the played history.
 *
 * @param {Object} song
 * @returns {boolean}
 */
function isPlayed(song) {
	if (!song) return false;
	return playedSongs.value.some(s => s.videoId === song.videoId);
}


/**
 * Resume / start playback of the current video.
 */
function playVideo() {
	currentVideo.value = { ...currentVideo.value, state: 'playing', timestamp: Date.now() };

	// mark the current video as played if it's in the approved list
	const song = approvedRequests.value.find(s => s.videoId === currentVideo.value.videoId);
	if (song)
		markAsPlayed(song);
}


/**
 * Pause the current video.
 */
function pauseVideo() {
	currentVideo.value = { ...currentVideo.value, state: 'paused' };
}


/**
 * Toggle between play and pause.
 */
function togglePlay() {
	const newState = currentVideo.value.state === 'playing' ? 'paused' : 'playing';
	currentVideo.value = { ...currentVideo.value, state: newState };
}


/**
 * Restart the current video from the beginning.
 */
function restartVideo() {
	currentVideo.value = { ...currentVideo.value, state: 'playing', timestamp: Date.now() };

	const song = approvedRequests.value.find(s => s.videoId === currentVideo.value.videoId);
	if (song)
		markAsPlayed(song);
}


/**
 * Manually add a song by YouTube URL or 11-char video id. Fetches the title
 * and thumbnail via YouTube's public oEmbed endpoint.
 */
async function addManualSong() {
	let videoId = manualUrl.value.trim();
	const urlMatch = videoId.match(/(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w-]{11})/);
	if (urlMatch) videoId = urlMatch[1];

	if (!/^[\w-]{11}$/.test(videoId)) return;

	try {
		const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
		const data = await response.json();
		const newSong = {
			id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
			videoId: videoId,
			title: data.title,
			thumbnail: data.thumbnail_url,
			requestedBy: 'Streamer',
			status: 'approved',
		};
		approvedRequests.value = [...approvedRequests.value, newSong];
		manualUrl.value = '';
	} catch (e) {
		console.error('Manual add failed', e);
	}
}
</script>

<style lang="scss" scoped>
.karaokeQueueManager {
	display: flex;
	flex-direction: column;
	height: 100vh;
	font-family: sans-serif;
	background: #1a1a1a;
	color: #efefef;

	.managerHeader {
		padding: 10px 20px;
		background: #2c3e50;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 2px solid #34495e;

		.headerLeft {
			display: flex;
			align-items: center;
			gap: 10px;
			h1 { font-size: 18px; margin: 0; }
		}

		.status {
			padding: 4px 8px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: bold;
			&.playing { background: #27ae60; }
			&.paused { background: #f39c12; }
			&.idle { background: #7f8c8d; }
		}
	}

	.playbackSection {
		padding: 20px 20px 40px 20px;
		background: #222;
		display: flex;
		gap: 20px;
		border-bottom: 1px solid #333;

		.videoContainer {
			width: 320px;
			height: 180px;
			background: black;
			display: flex;
			justify-content: center;
			align-items: center;

			.placeholder {
				text-align: center;
				color: #555;
				.material-icons { font-size: 48px; }
			}

			.embedWrapper {
				position: relative;
				.ytLink {
					position: absolute;
					bottom: -35px;
					left: 0;
					font-size: 12px;
					color: #3498db;
					text-decoration: none;
					display: flex;
					align-items: center;
					gap: 4px;
					&:hover { text-decoration: underline; }
					.material-icons { font-size: 14px; }
				}
			}
		}

		.playbackControls {
			flex: 1;
			h3 { margin-top: 0; font-size: 16px; color: #9b59b6; }
			.btnGroup {
				display: flex;
				gap: 10px;
				.controlBtn {
					display: flex;
					align-items: center;
					gap: 5px;
					padding: 8px 16px;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					background: #34495e;
					color: white;
					&:hover { background: #4e6a85; }

					&.active {
						&.play { background: #27ae60; }
						&.pause { background: #f39c12; }
					}
				}
			}
		}
	}

	.queueSection {
		flex: 1;
		display: flex;
		overflow: hidden;

		.column {
			flex: 1;
			min-width: 0; // CRITICAL: Allow columns to shrink below content size
			display: flex;
			flex-direction: column;
			border-right: 1px solid #333;
			&:last-child { border-right: none; }

			.colHeader {
				padding: 10px;
				background: #252525;
				h2 { font-size: 14px; margin: 0; color: #888; }
			}

			.songList {
				flex: 1;
				overflow-y: auto;
				padding: 10px;

				.songItem {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px;
					background: #2c2c2c;
					margin-bottom: 8px;
					border-radius: 4px;
					cursor: pointer;
					transition: transform 0.1s;
					min-width: 0; // Allow item to shrink

					&:hover { background: #333; }
					&.played { opacity: 0.6; filter: grayscale(0.5); border-left: 4px solid #555; }

					.thumb { 
						width: 60px; 
						height: 45px; 
						object-fit: cover; 
						border-radius: 2px;
						flex-shrink: 0; // Don't squash the thumb
					}
					
					.songInfo {
						flex: 1;
						display: flex;
						flex-direction: column;
						overflow: hidden; // Truncate content
						min-width: 0; 

						.title { 
							font-size: 13px; 
							font-weight: bold; 
							white-space: nowrap; 
							overflow: hidden; 
							text-overflow: ellipsis; 
						}
						.requester { font-size: 11px; color: #888; }
					}

					.actions {
						display: flex;
						gap: 5px;
						flex-shrink: 0; // Don't squash buttons
						button {
							background: none; border: none; padding: 0; cursor: pointer;
							.material-icons { font-size: 20px; }
							&.approveBtn { color: #27ae60; }
							&.denyBtn { color: #e74c3c; }
							&.playSongBtn { color: #3498db; }
							&.reorderBtn { 
								color: #888; 
								&:hover:not(:disabled) { color: white; }
								&:disabled { opacity: 0.3; cursor: default; }
							}
						}
					}
				}
			}
		}
	}

	.managerFooter {
		padding: 15px 20px;
		background: #252525;
		border-top: 1px solid #333;

		.manualAdd {
			display: flex;
			gap: 10px;
			input {
				flex: 1;
				background: #111;
				border: 1px solid #444;
				padding: 8px 12px;
				color: white;
				border-radius: 4px;
			}
			button {
				background: #9b59b6;
				color: white;
				border: none;
				padding: 8px 16px;
				border-radius: 4px;
				cursor: pointer;
				&:hover { background: #8e44ad; }
			}
		}
	}

	.notEnabled {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: #888;
		.material-icons { font-size: 64px; margin-bottom: 20px; color: #e67e22; }
		button {
			margin-top: 20px;
			padding: 10px 20px;
			background: #27ae60;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}
	}
}
</style>