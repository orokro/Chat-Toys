<!--
	BTTVBrowser.vue
	--------------

	Allows browsing and searching for BTTV shared emojis.
	Users can manually enable specific emojis to be used in Chat-Toys.
-->
<template>
	<div class="bttv-browser">
		
		<!-- Search and controls -->
		<div class="browser-header">
			<div class="search-box">
				<span class="material-icons search-icon">search</span>
				<input 
					type="text" 
					v-model="searchQuery" 
					placeholder="Search for BTTV shared emojis..."
					@input="handleSearch"
				/>
				<button v-if="searchQuery" class="clear-btn" @click="clearSearch">
					<span class="material-icons">close</span>
				</button>
			</div>
			<div class="status-info">
				<span v-if="loading">Searching...</span>
				<span v-else>{{ results.length }} results found</span>
			</div>
		</div>

		<!-- Results Grid -->
		<div class="results-container">
			<div v-if="results.length > 0" class="grid-container">
				<div 
					v-for="emoji in results" 
					:key="emoji.id" 
					class="emoji-card"
					:class="{ 'is-selected': isEmojiSelected(emoji.id) }"
					@click="toggleEmoji(emoji)"
				>
					<div class="emoji-image">
						<img :src="getEmojiUrl(emoji.id)" :alt="emoji.code" />
					</div>
					<div class="emoji-info">
						<span class="emoji-code">{{ emoji.code }}</span>
						<span class="emoji-author" v-if="emoji.user">by {{ emoji.user.displayName }}</span>
					</div>
					<div class="checkbox-overlay">
						<span class="material-icons">{{ isEmojiSelected(emoji.id) ? 'check_box' : 'check_box_outline_blank' }}</span>
					</div>
				</div>
			</div>
			
			<div v-else-if="!loading" class="no-results">
				<p>No emojis found for "{{ searchQuery }}".</p>
			</div>

			<!-- Pagination -->
			<div v-if="hasMore && !loading" class="load-more">
				<button @click="loadMore">Load More</button>
			</div>
		</div>

	</div>
</template>

<script setup>
import { ref, onMounted, inject, watch } from 'vue';

const ctApp = inject('ctApp');

const searchQuery = ref('');
const results = ref([]);
const loading = ref(false);
const offset = ref(0);
const limit = 100;
const hasMore = ref(true);

const API_BASE = 'https://api.betterttv.net/3/emotes/shared';
const CDN_BASE = 'https://cdn.betterttv.net/emote';

let searchTimeout = null;

onMounted(() => {
	fetchEmojis();
});

/**
 * Unified fetch for emojis (Top or Search)
 * 
 * @param {boolean} append - Whether to append to existing results
 */
async function fetchEmojis(append = false) {
	loading.value = true;
	try {
		const isSearch = !!searchQuery.value;
		let url = '';
		
		if (isSearch) {
			url = `${API_BASE}/search?query=${encodeURIComponent(searchQuery.value)}&offset=${offset.value}&limit=${limit}`;
		} else {
			// URL A: Top popular emojis (no offset/limit params)
			url = `${API_BASE}/top`;
		}
		
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Failed to fetch emojis (${isSearch ? 'search' : 'top'})`);
		
		const data = await res.json();
		
		// Normalize data: URL A (top) wraps in { emote, total, id }, URL B (search) is direct
		const items = Array.isArray(data) ? data : (data.emotes || []);
		const normalizedData = items.map(item => {
			// If it's the "top" structure, the emote info is in item.emote
			if (item.emote && typeof item.emote === 'object') {
				return item.emote;
			}
			// Otherwise assume it's the "search" structure or already normalized
			return item;
		}).filter(item => item && item.id && item.code);

		if (append) {
			results.value = [...results.value, ...normalizedData];
		} else {
			results.value = normalizedData;
		}
		
		// Only search endpoint supports pagination properly
		hasMore.value = isSearch && data.length === limit;
		offset.value += limit;
	} catch (err) {
		console.error('[BTTVBrowser] fetchEmojis error', err);
	} finally {
		loading.value = false;
	}
}

function handleSearch() {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(() => {
		offset.value = 0;
		fetchEmojis();
	}, 500);
}

function clearSearch() {
	searchQuery.value = '';
	offset.value = 0;
	fetchEmojis();
}

function loadMore() {
	fetchEmojis(true);
}

function getEmojiUrl(id) {
	return `${CDN_BASE}/${id}/2x`;
}

function isEmojiSelected(id) {
	return ctApp.bttvMgr.isManualEmoji(id);
}

function toggleEmoji(emoji) {
	if (isEmojiSelected(emoji.id)) {
		ctApp.bttvMgr.removeManualEmoji(emoji.id);
	} else {
		ctApp.bttvMgr.addManualEmoji({
			id: emoji.id,
			code: emoji.code
		});
	}
}

</script>

<style lang="scss" scoped>
.bttv-browser {
	border: 2px solid black;
	border-radius: 10px;
	background: #acacac;
	display: flex;
	flex-direction: column;
	max-height: 600px;
	overflow: hidden;

	.browser-header {
		background: #222;
		padding: 15px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-bottom: 2px solid black;

		.search-box {
			position: relative;
			display: flex;
			align-items: center;

			.search-icon {
				position: absolute;
				left: 10px;
				color: #888;
			}

			input {
				width: 100%;
				background: #333;
				border: 1px solid #444;
				border-radius: 20px;
				padding: 10px 40px;
				color: white;
				font-size: 16px;

				&:focus {
					outline: none;
					border-color: #00aa00;
				}
			}

			.clear-btn {
				position: absolute;
				right: 10px;
				background: none;
				border: none;
				color: #888;
				cursor: pointer;
				padding: 0;

				&:hover {
					color: white;
				}
			}
		}

		.status-info {
			color: #888;
			font-size: 12px;
			text-align: right;
		}
	}

	.results-container {
		flex: 1;
		overflow-y: auto;
		padding: 15px;

		.grid-container {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 15px;
		}

		.emoji-card {
			background: #222;
			border-radius: 8px;
			padding: 10px;
			display: flex;
			flex-direction: column;
			align-items: center;
			position: relative;
			border: 2px solid #444;
			cursor: pointer;
			transition: transform 0.2s, border-color 0.2s;

			&:hover {
				transform: translateY(-2px);
				border-color: #666;
			}

			&.is-selected {
				border-color: #00aa00;
				background: #002200;

				.checkbox-overlay {
					color: #00aa00;
				}
			}

			.emoji-image {
				width: 64px;
				height: 64px;
				display: flex;
				align-items: center;
				justify-content: center;
				margin-bottom: 8px;

				img {
					max-width: 100%;
					max-height: 100%;
					object-fit: contain;
				}
			}

			.emoji-info {
				display: flex;
				flex-direction: column;
				align-items: center;
				width: 100%;
				overflow: hidden;

				.emoji-code {
					color: #eee;
					font-size: 14px;
					font-weight: bold;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					width: 100%;
					text-align: center;
				}

				.emoji-author {
					color: #888;
					font-size: 10px;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					width: 100%;
					text-align: center;
				}
			}

			.checkbox-overlay {
				position: absolute;
				top: 5px;
				right: 5px;
				color: #444;

				.material-icons {
					font-size: 20px;
				}
			}
		}

		.no-results {
			text-align: center;
			padding: 40px;
			color: #444;
			font-style: italic;
		}

		.load-more {
			display: flex;
			justify-content: center;
			margin-top: 20px;
			padding-bottom: 20px;

			button {
				background: black;
				color: white;
				border: 2px solid #444;
				border-radius: 20px;
				padding: 8px 24px;
				font-weight: bold;
				cursor: pointer;

				&:hover {
					background: #222;
					border-color: #eee;
				}
			}
		}
	}
}
</style>
