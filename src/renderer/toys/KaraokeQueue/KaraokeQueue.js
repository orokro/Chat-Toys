/*
	KaraokeQueue.js
	---------------

	This class handles the state for the Karaoke Queue system.
	It manages pending, approved, and played song requests from YouTube.
*/

// vue
import { ref, shallowRef } from 'vue';
import { socketShallowRef } from 'socket-ref';

// our app
import Toy from "../Toy";

// components
import KaraokeQueuePage from './KaraokeQueuePage.vue';
import KaraokeListWidget from './KaraokeListWidget.vue';
import KaraokeVideoWidget from './KaraokeVideoWidget.vue';

export default class KaraokeQueue extends Toy {

	// static info
	static name = 'Karaoke Queue';
	static slug = 'karaokeQueue';
	static desc = 'Manage a karaoke song queue with YouTube video requests.';
	static optionsPageComponent = KaraokeQueuePage;
	static themeColor = '#9B59B6'; // Purple theme
	static widgetComponents = [
		{
			component: KaraokeListWidget,
			key: 'listWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows the list of upcoming and pending songs.',
			slug: 'list'
		},
		{
			component: KaraokeVideoWidget,
			key: 'videoWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'The actual YouTube video player for the current song.',
			slug: 'video'
		}
	];

	// Descriptor for the consolidated text-settings modal. `playedSongsColor`
	// is the muted color used for songs that have already played, so it gets
	// its own field rather than collapsing into the base text color.
	static textSettings = [
		{
			groupKey: 'list',
			groupLabel: 'Queue Text',
			groupDescription: 'Style for the song-queue list shown in the karaoke widget.',
			fields: [
				{ key: 'fontSize',         label: 'Font size',          type: 'number', min: 8, max: 72 },
				{ key: 'fontColor',        label: 'Text color',         type: 'color' },
				{ key: 'playedSongsColor', label: 'Played-songs color', type: 'color',
					description: 'Color used for songs that have already played and are dimmed in the list.' },
				{ key: 'fontShadow',       label: 'Text shadow',        type: 'boolean' },
			],
			defaults: {
				fontSize:         24,
				fontColor:        '#FFFFFF',
				playedSongsColor: '#888888',
				fontShadow:       true,
			},
		},
	];

	/**
	 * Constructs the KaraokeQueue object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {
		super(toyManager);

		// Shared state refs
		this.pendingRequests = socketShallowRef(this.static.slugify('pendingRequests'), []);
		this.approvedRequests = socketShallowRef(this.static.slugify('approvedRequests'), []);
		this.playedSongs = socketShallowRef(this.static.slugify('playedSongs'), []);
		
		// Current playback state
		this.currentVideo = socketShallowRef(this.static.slugify('currentVideo'), {
			videoId: null,
			title: '',
			state: 'idle', // idle, playing, paused
			timestamp: 0
		});
	}

	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {
		this.buildSettingsBlock({
			fontSize: ref(24),
			fontColor: ref('#FFFFFF'),
			fontShadow: ref(true),
			playedSongsColor: ref('#888888'),
			showPendingCount: ref(true),
			showPendingList: ref(true),
			showRequesterName: ref(true),
			hidePlayedSongs: ref(false),
			
			listWidgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 300,
				height: 500
			}),
			videoWidgetBox: shallowRef({
				x: 340,
				y: 20,
				width: 640,
				height: 360
			})
		});
	}

	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {
		super.buildCommands([
			{
				command: 'request',
				params: [
					{ name: 'videoId', type: 'string', optional: false, desc: 'The YouTube Video ID or URL' },
				],
				description: 'Request a song for the karaoke queue',
				userDesc: 'Request a song!',
				costEnabled: true,
				cost: 500,
			}
		]);
	}

	/**
	 * Handle incoming commands
	 */
	async onCommand(commandSlug, msg, user, params, handshake) {
		if (commandSlug === 'request') {
			await this.handleRequest(msg, params.videoId, handshake);
		}
	}

	/**
	 * Logic for !request
	 */
	async handleRequest(msg, input, handshake) {
		let videoId = input.trim();

		// Basic regex to extract ID from URL if user pasted a full link
		const urlMatch = videoId.match(/(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w-]{11})/);
		if (urlMatch) {
			videoId = urlMatch[1];
		}

		// Validate Video ID format (standard 11 chars)
		if (!/^[\w-]{11}$/.test(videoId)) {
			this.logAndChat(`@${msg.author}: Invalid YouTube Video ID.`, 'err');
			handshake.reject('Invalid Video ID');
			return;
		}

		// Check for duplicates in all lists
		const isDuplicate = [...this.pendingRequests.value, ...this.approvedRequests.value, ...this.playedSongs.value]
			.some(item => item.videoId === videoId);

		if (isDuplicate) {
			this.logAndChat(`@${msg.author}: That song is already in the queue or has been played.`, 'info');
			handshake.reject('Duplicate request');
			return;
		}

		// Fetch metadata via oEmbed
		try {
			const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
			if (!response.ok) throw new Error('Video not found');
			
			const data = await response.json();

			const newRequest = {
				id: Date.now() + Math.random().toString(36).substr(2, 9),
				videoId: videoId,
				title: data.title,
				thumbnail: data.thumbnail_url,
				author: msg.author,
				requestedBy: msg.author,
				status: 'pending'
			};

			this.pendingRequests.value = [...this.pendingRequests.value, newRequest];
			this.logAndChat(`@${msg.author}: Request accepted! "${data.title}" added to pending.`, 'msg');
			handshake.accept();

		} catch (err) {
			this.logAndChat(`@${msg.author}: Could not find that video on YouTube.`, 'err');
			handshake.reject('Video lookup failed');
		}
	}

	/**
	 * Helper to log to system and inform chat
	 */
	logAndChat(text, type = 'info') {
		if (type === 'err') this.chatToysApp.log.err(text);
		else if (type === 'msg') this.chatToysApp.log.msg(text);
		else this.chatToysApp.log.info(text);
	}
}
