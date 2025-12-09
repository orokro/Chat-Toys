/*
	ChatProcessor.js
	----------------

	Listens for incoming chat messages & processes them for display in the UI.
	and for future command processing.
*/

// vue
import { shallowRef } from 'vue';

// our app
import { ABMap } from './ABMap';

/**
 * Class to process incoming chat messages
 */
export class ChatProcessor {

	/**
	 * Builds a new ChatProcessor
	 * 
	 * @param {Object} options - OPTIONAL; like { rollingIDListLength: 1000, displayCount: 10 }	
	 */
	constructor(options = {}) {

		// handle our optional options
		this.rollingIDListLength = options.rollingIDListLength || 1000;
		this.displayCount = options.displayCount || 10;

		// this will be used externally to render the chat messages if need be
		this.screenMessages = shallowRef([]);

		// true to show msgs
		this._showDebugLogs = false;

		// keep track of seen messages so we don't repeat them
		this._seenMessageIDs = new Set();

		// callbacks for when new messages come in
		this._onNewChatsCallbacks = [];

		// Bind method for handling chat messages
		this._handleChatMessage = this._handleChatMessage.bind(this);

		// as we process chat messages we'll keep track of which
		// userName:userUniqueID pairs we've seen
		this.seenAuthors = new ABMap();

		// cache for Twitch avatar URLs so we don't hammer external services
		this._twitchAvatarCache = new Map();
		this._twitchAvatarInFlight = new Map();

		// Hook up to Electron API
		window.electronAPI.onChatMessage(this._handleChatMessage);
	}


	/**
	 * Add a callback to run when new messages come in
	 * 
	 * @param {Function} callback - Callback to run when new messages come in
	 */
	onNewChats(callback) {
		this._onNewChatsCallbacks.push(callback);
	}


	/**
	 * For clean up / prevent memory leaks, remove a callback from the list
	 * 
	 * @param {Function} callback - Callback to remove from the list of callbacks
	 */
	removeNewChatsListener(callback) {
		this._onNewChatsCallbacks = this._onNewChatsCallbacks.filter((cb) => cb !== callback);
	}


	/**
	 * Formats chat messages from the chat platform & triggers callbacks
	 * 
	 * @param {Object|String} data - Data from the chat platform
	 * @returns {Promise<Array<Object>>} - Array of formatted chat messages
	 */
	async _handleChatMessage(data) {

		// parse if it's a string
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data);
			} catch (err) {
				console.warn('Could not parse chat message string:', err);
				return;
			}
		}

		// we don't know if the message block is from Twitch, YouTube, or potentially other
		// streaming services in the future. We'll pass the data block into different parsers
		// and just merge results
		let parsedMessages = [];

		// Twitch parsing may need to hit decapi, so it's async
		const twitchMessages = await this._parseTwitchMessages(data);
		parsedMessages = [...parsedMessages, ...twitchMessages];
		parsedMessages = [...parsedMessages, ...this._parseYouTubeMessages(data)];
		parsedMessages = [...parsedMessages, ...this._parseSysLoggerMessages(data)];

		if(parsedMessages.length > 0 && this._showDebugLogs)
			console.log('Parsed Messages: ', parsedMessages);

		// if we got any new messages, trigger callbacks
		if (parsedMessages.length > 0) {

			// Trigger callbacks
			this._onNewChatsCallbacks.forEach((cb) => cb(parsedMessages));

			// Update reactive screenMessages
			const updated = [...this.screenMessages.value, ...parsedMessages];
			this.screenMessages.value = updated.slice(-this.displayCount);
		}
	}


	/**
	 * Checks and parses SysLogger chat messages
	 * 
	 * @param {Object} data - Data from chat platform
	 * @returns {Array<Object>} - Array of formatted chat messages
	 */
	_parseSysLoggerMessages(data) {

		// verify it's a SysLogger message
		const isSysLoggerMessage = (data?.syslogger === true);
		if (!isSysLoggerMessage)
			return [];

		// sanity check: if we've already seen this message, skip
		if (this._seenMessageIDs.has(data.id))
			return [];

		if(this._showDebugLogs)
			console.log('[ChatProcessor] ⚙️ Received SysLogger chat message:', data);

		// msg text
		const adjustedMessage = data.infoMessages.join('\n');

		// repack the data into our standard format
		const formatted = {
			id: data.id,
			authorUniqueID: 'Chat Toys',
			author: 'Chat Toys',
			authorPFPUrl: '/builtin/ct_pfp.jpg',
			messageText: adjustedMessage || '',
			raws: data.infoMessages || [],
			emojis: [],
			time: Date.now(),
			isMember: true,
			streamID: 'Chat Toys',
			isSuper: false,
			syslogger: true,
		};

		return [formatted];
	}


	/**
	 * Checks and parses Twitch chat messages
	 * 
	 * @param {Object} data - Data from chat platform
	 * @returns {Promise<Array<Object>>} - Array of formatted chat messages
	 */
	async _parseTwitchMessages(data) {

		// verify it's a Twitch message
		const isTwitchMessage = (data?.twitch === true);
		if (!isTwitchMessage)
			return [];

		// sanity check: if we've already seen this message, skip
		if (this._seenMessageIDs.has(data.id))
			return [];

		if (this._showDebugLogs)
			console.log('[ChatProcessor] 🟣 Received Twitch chat message:', data);

		// parse out any emotes and adjust the message text accordingly
		const { adjustedMessage, emojis } = this._parseTwitchEmojis(data);

		// try to pick the best username we can for avatar lookup
		const rawAuthor =
			data.author ||
			data.data?.tags?.['display-name'] ||
			data.data?.tags?.username ||
			'';

		// repack the data into our standard format
		const formatted = {
			id: data.id,
			authorUniqueID: data.author || '',
			author: rawAuthor || '',
			authorPFPUrl: undefined,
			messageText: adjustedMessage || '',
			emojis,
			time: Date.now(),
			isMember: !!data.isMember,
			streamID: 'twitch',
			isSuper: false,
			twitch: true,
		};

		// mark seen immediately so duplicates during a slow network call don't re-process
		this._markMessageAsSeen(formatted.id);

		// update relationships
		this.seenAuthors.set(formatted.author, formatted.authorUniqueID);

		// resolve avatar URL via decapi.me, but only once per username
		try {
			const avatarUrl = await this._getTwitchAvatarUrl(rawAuthor);
			if (avatarUrl) {
				formatted.authorPFPUrl = avatarUrl;
			}
		} catch (e) {
			console.warn('[ChatProcessor] Failed to resolve Twitch avatar URL for', rawAuthor, e);
		}

		// return the message (twitch is just one at a time)
		return [formatted];		
	}


	/**
     * Extracts emotes, generates URLs, and formats the message with colons.
     * * @param {Object} data - The raw Twitch data object
     * @returns {Object} - { emojis: Array, adjustedMessage: String }
     */
    _parseTwitchEmojis(data) {

        const message = data.message || "";

        // Access emotes from the deep structure based on your JSON
        const emotes = data.data?.tags?.emotes;

        // 1. If no emotes or empty message, return defaults
        if (!emotes || !message) {
            return {
                emojis: [],
                adjustedMessage: message
            };
        }

        const emojisMap = new Map();
        const allOccurrences = [];

        // 2. First Pass: Parse all emote instances and build the unique list
        Object.entries(emotes).forEach(([id, ranges]) => {

            // ranges is an array like ["0-4", "12-16"]
            
            // We only need to grab the code from the text ONCE per ID
            // to get the clean name (e.g., "LUL")
            const firstRange = ranges[0].split('-').map(Number);
            const code = message.substring(firstRange[0], firstRange[1] + 1);
            
            // Construct the URL
            const url = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`;

            // Add to our unique map if we haven't seen this specific emote ID yet
            if (!emojisMap.has(id)) {
                emojisMap.set(id, {
                    code: code,
                    url: url,
                    pos: ranges // Keep the original Twitch format ["start-end"]
                });
            }

            // Add every single occurrence to a flat list for the string replacement step
            ranges.forEach(range => {
                const [start, end] = range.split('-').map(Number);
                allOccurrences.push({
                    start,
                    end,
                    code
                });
            });
        });

        // 3. Second Pass: Create the adjustedMessage
        // We sort by 'start' index in DESCENDING order (High -> Low).
        // By replacing text from the end of the string backwards, we don't 
        // mess up the indices of the earlier emotes.
        allOccurrences.sort((a, b) => b.start - a.start);

        let adjustedMessage = message;

        allOccurrences.forEach(occ => {
            // Grab text before the emote
            const before = adjustedMessage.substring(0, occ.start);
            // Grab text after the emote
            const after = adjustedMessage.substring(occ.end + 1);
            
            // Stitch them together with the colon-wrapped code
            adjustedMessage = `${before}&${occ.code};${after}`;
        });

        // 4. Return the result
        return {
            emojis: Array.from(emojisMap.values()),
            adjustedMessage: adjustedMessage
        };
    }


	/**
	 * Checks and parses YouTube chat messages
	 * 
	 * @param {Object} data - Data from chat platform
	 * @returns {Array<Object>} - Array of formatted chat messages
	 */
	_parseYouTubeMessages(data) {

		// verify it's a YouTube message
		const isYouTubeData = (data?.youtube === true);
		if (!isYouTubeData)
			return [];

		// check for the data we need
		if (
			!data?.continuationContents?.liveChatContinuation?.actions ||
			!Array.isArray(data.continuationContents.liveChatContinuation.actions)
		) return [];

		// for debug
		if (this._showDebugLogs)
			console.log('[ChatProcessor] 🔴 Received YouTube chat data:', data);

		// get the chat messages, which are stored as 'actions'
		// because originally they're intended to be things like 'addChatItemAction'
		const actions = data.continuationContents.liveChatContinuation.actions;

		// as we process the raw data, we'll populate this array with formatted messages (if any)
		const newMessages = [];

		// loop through the actions
		for (const action of actions) {

			// get the renderer, which will be either liveChatPaidMessageRenderer or liveChatTextMessageRenderer
			let rendererA = action?.addChatItemAction?.item?.liveChatPaidMessageRenderer;
			let rendererB = action?.addChatItemAction?.item?.liveChatTextMessageRenderer;
			const renderer = rendererA || rendererB;

			// gtfo if we don't have a renderer
			if (!renderer)
				continue;

			// based on which renderer we used, determine if super
			const isSuper = renderer == rendererA;

			// get the message ID
			const id = renderer.id;

			// if we've already seen this message, skip it
			if (this._seenMessageIDs.has(id))
				continue;

			// get the author, message, and timestamp, and whether they're a member
			let authorName = renderer.authorName?.simpleText || '';
			const authorChannelId = renderer.authorExternalChannelId || '';
			const timestampUsec = renderer.timestampUsec;
			const isMember = !!renderer.authorBadges?.some(
				(b) => b?.liveChatAuthorBadgeRenderer?.customThumbnail
			);

			// get the author avatar URL, if present
			let authorPFPUrl;
			try {
				const pfpThumbs = renderer.authorPhoto?.thumbnails;
				if (Array.isArray(pfpThumbs) && pfpThumbs.length > 0) {
					// use the last / largest thumbnail
					const bestThumb = pfpThumbs[pfpThumbs.length - 1];
					if (bestThumb?.url) {
						authorPFPUrl = bestThumb.url;
					}
				}
			} catch (e) {
				console.warn('[ChatProcessor] Could not extract YouTube author photo URL:', e);
			}

			// get the message text and emojis
			const runs = renderer.message?.runs || [];
			let messageText = '';
			const emojis = [];

			// loop through the runs to get the message text and emojis
			for (const run of runs) {

				if (run.text) {
					messageText += run.text;
				} else if (run.emoji) {
					const emoji = run.emoji;

					// if the user used a custom channel emoji / or youtube emoji
					if (emoji.isCustomEmoji && emoji.image?.thumbnails?.length) {

						// get the URL & code
						const url = emoji.image.thumbnails[emoji.image.thumbnails.length - 1].url;
						const justCode = `${emoji.shortcuts?.[0] || emoji.emojiId}`;
						const shortcode = `&${justCode};`;
						messageText += shortcode;
						emojis.push({
							code: justCode,
							url: url,
							pos: [], // YouTube doesn't provide position info
						});

					} else if (emoji.emojiId) {
						messageText += emoji.emojiId; // Unicode emoji
					}
				}

			}// next run

			// attempt to extract stream ID
			let streamID = undefined;
			try {
				const topic = data?.continuationContents?.liveChatContinuation?.continuations?.[0]?.invalidationContinuationData?.invalidationId?.topic;
				if (typeof topic === 'string' && topic.startsWith('chat~')) {
					streamID = topic.split('chat~')[1];
				}
			} catch (e) {
				console.warn('Could not extract streamID from payload:', e);
			}

			// if there's a leading @ in the author name, remove it
			if (authorName.startsWith('@'))
				authorName = authorName.slice(1);
			
			// the final formatted message
			const formatted = {
				id,
				authorUniqueID: authorChannelId,
				author: authorName,
				authorPFPUrl: authorPFPUrl,
				messageText,
				emojis,
				time: timestampUsec ? Number(timestampUsec) : undefined,
				isMember,
				streamID,
				isSuper,
			};

			if (isSuper) {
				console.log('Superchat', formatted);
			}

			// always reset this relationship because either side could change
			this.seenAuthors.set(authorName, authorChannelId);

			// add it to our list & mark it as seen so we don't repeat it
			newMessages.push(formatted);
			this._markMessageAsSeen(id);

		}// next action

		return newMessages;
	}



	/**
	 * Keep a list of seen message IDs, so we don't repeat them
	 * 
	 * @param {String} id - ID of a message
	 */
	_markMessageAsSeen(id) {

		// add the ID to our list
		this._seenMessageIDs.add(id);

		// if our list is too long, trim it
		if (this._seenMessageIDs.size > this.rollingIDListLength) {
			const ids = Array.from(this._seenMessageIDs);
			this._seenMessageIDs = new Set(ids.slice(-this.rollingIDListLength));
		}
	}


	/**
	 * Resolve and cache Twitch avatar URLs using decapi.me
	 * 
	 * @param {String} username - Twitch username
	 * @returns {Promise<String|null>} - Avatar URL or null if unavailable
	 */
	async _getTwitchAvatarUrl(username) {

		if (!username)
			return null;

		const key = username.toLowerCase();

		// if we've already resolved this user, use the cached value
		if (this._twitchAvatarCache.has(key)) {
			return this._twitchAvatarCache.get(key);
		}

		// if there's already an in-flight fetch for this user, share it
		if (this._twitchAvatarInFlight.has(key)) {
			return this._twitchAvatarInFlight.get(key);
		}

		// otherwise, start a new fetch & remember the promise
		const promise = (async () => {
			try {
				const url = `https://decapi.me/twitch/avatar/${encodeURIComponent(key)}`;
				const res = await fetch(url, { method: 'GET' });

				if (!res.ok) {
					console.warn('[ChatProcessor] decapi.me returned non-OK for', key, res.status);
					this._twitchAvatarCache.set(key, null);
					return null;
				}

				const text = (await res.text() || '').trim();

				// decapi.me returns the avatar URL as plain text
				const avatarUrl = text && text.startsWith('http') ? text : null;

				this._twitchAvatarCache.set(key, avatarUrl || null);
				return avatarUrl || null;

			} catch (e) {
				console.warn('[ChatProcessor] Error fetching Twitch avatar for', key, e);
				this._twitchAvatarCache.set(key, null);
				return null;
			} finally {
				this._twitchAvatarInFlight.delete(key);
			}
		})();

		this._twitchAvatarInFlight.set(key, promise);
		return promise;
	}

}
