/*
	ChatPointsHelper.js
	-------------------

	In order to show users current points next to their chat messages, we need to hit the database.

	But, I don't wanna hammer it, so this helper class batches up recent chat users and fetches their
	point balances in small batches, debounced via the Electron timeout API.

	This only needs to be instantiated once per Chat instance.
*/

import { chromeShallowRef } from "../../scripts/chromeRef";

/**
 * Helper class to keep track of recent chat users and fetch their point balances
 * in small batches, debounced via the Electron timeout API.
 */
export class ChatPointsHelper {

	/**
	 * @param {Object} chatInstance - Instance of the Chat class
	 * @param {Function} onPointsUpdate - Callback to receive updated points
	 *  Signature: (pointsData: Array<{ id: string, points: number }>) => void
	 */
	constructor(chatInstance, onPointsUpdate) {

		// save our chat app instance & call back for when we get new points data
		this.chat = chatInstance;
		this.onPointsUpdate = typeof onPointsUpdate === 'function' ? onPointsUpdate : () => {};

		// FIFO list of the last 100 user IDs seen in chat.
		this._recentUserIds = chromeShallowRef('chatPointsHelper_recentUserIds', []);

		// Handle to the active Electron timeout, if any.
		this._timeoutId = null;

		//Debounce duration in milliseconds for batching requests.
		this._debounceMs = 3000;

		// Whether this helper has been destroyed.
		this._destroyed = false;

		// Bind listener for "any command successfully run"
		this._handleAnyCommandRunSuccessfully = this._handleAnyCommandRunSuccessfully.bind(this);

		// Attach listener to command processor (if available)
		if (this.chat && this.chat.chatToysApp && this.chat.chatToysApp.commandProcessor) {
			this.chat.chatToysApp.commandProcessor.onCommandRun(this._handleAnyCommandRunSuccessfully);
		}

		// schedule check once at init to get points for any existing users in chat
		this._ensureTimeoutScheduled();
	}

	
	/**
	 * Add a new chat message to the internal tracking.
	 * Called from Chat.handleChatMessage after `chatLogMessages.push(chatData);`
	 * 
	 * @param {Object} chatData - The processed chatData object
	 * @param {string} chatData.id - Message ID (unused here, kept for reference)
	 * @param {string} chatData.author - User ID / author name
	 */
	addMessage(chatData) {

		// Early outs
		if (this._destroyed)
			return;
		if (!chatData)
			return;

		// We consider the "user id" to be the author identifier (e.g. youtube_id)
		const userId = chatData.authorUniqueID;
		if (!userId) 
			return;

		// Push to FIFO array
		this._recentUserIds.value = [...this._recentUserIds.value, userId];

		// Trim to last 100 entries
		while (this._recentUserIds.value.length > 100) {
			this._recentUserIds.value.shift();
		}

		// Schedule a debounced points refresh
		this._ensureTimeoutScheduled();
	}


	/**
	 * Internal: Ensure a timeout is scheduled if one is not already active.
	 */
	_ensureTimeoutScheduled() {

		// Early outs
		if (this._destroyed)
			return;
		if (this._timeoutId !== null)
			return;

		if (!window || typeof window.setElectronTimeout !== 'function') {
			// Fallback: no electron timeout available; you could optionally log here.
			return;
		}

		this._timeoutId = window.setElectronTimeout(async () => {

            // Clear our handle first, so any new trigger after this can schedule again
			this._timeoutId = null;

			// Process current IDs
			try {
				await this._processRecentUserIds();
			} catch (err) {
				// Optionally log; avoid throwing
				console.error('[ChatsPointsHelper] Error while processing recent user IDs:', err);
			}
		}, this._debounceMs);
	}


	/**
	 * Internal: Process the current recent user IDs, fetch their points,
	 * and invoke the callback with the results.
	 */
	async _processRecentUserIds() {

		if (this._destroyed)
			return;

		// Build a unique set of IDs (but keep the main array intact)
		const uniqueIds = Array.from(new Set(this._recentUserIds.value)).filter(Boolean);
		if (!uniqueIds.length) 
			return;


		if (!window || !window.ytctDB || typeof window.ytctDB.getUsers !== 'function') {
			console.warn('[ChatsPointsHelper] window.ytctDB.getUsers is not available.');
			return;
		}

		// Fetch users from DB
		const users = await window.ytctDB.getUsers(uniqueIds);
		if (!Array.isArray(users)) 
			return;
		
		// Map DB rows to { id, points }
		const pointsData = users.map((user) => {
			const id = user.youtube_id;
			const points = Number(user.points) || 0;
			return { id, points };
		});

		// Notify consumer
		this.onPointsUpdate(pointsData);
	}


	/**
	 * Listener for "any command run successfully".
	 * This is attached to chat.chatToysApp.commandProcessor via onCommandRun.
	 * 
	 * @param {string} commandSlug
	 * @param {Object} msgData
	 * @param {Object} commandData
	 */
	_handleAnyCommandRunSuccessfully(commandSlug, msgData, commandData) {

		if (this._destroyed)
			return;
		if (!commandData)
			return;

		const cost = Number(commandData.cost);
		
		// commenting out for now, we want to refresh points on any command run
		// maybe later we can optimize to only do it on point-spending commands
		// if (!Number.isFinite(cost) || cost <= 0) {
		// 	// No points spent; nothing to do
		// 	return;
		// }

		// Someone spent points; we should refresh the point data
		this._ensureTimeoutScheduled();
	}


	/**
	 * Clean up listeners, timeouts, and references.
	 */
	destroy() {

		if (this._destroyed)
			return;
		this._destroyed = true;

		// Clear any pending timeout
		if (this._timeoutId !== null && window && typeof window.clearElectronTimeout === 'function') {
			window.clearElectronTimeout(this._timeoutId);
		}
		this._timeoutId = null;

		// Remove listener from command processor
		if (this.chat && this.chat.chatToysApp && this.chat.chatToysApp.commandProcessor) {
			this.chat.chatToysApp.commandProcessor.offCommandRun(this._handleAnyCommandRunSuccessfully);
		}

		// Clear references
		this.chat = null;
		this.onPointsUpdate = null;
	}
}
