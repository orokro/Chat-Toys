/*
	AutoChatChecker.js
	------------------

	This class describes the system to automatically check when a channel has gone live and attempt to find the live chat
*/

// vue
import { ref, watch } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';
import ChatToysApp from './ChatToysApp';

// main export
export class AutoChatChecker {

	// the modes we can detect for OBS
	static MODE = {
		NOT_AVAILABLE: 'NOT AVAILABLE',
		OBS_OFFLINE: 'OFFLINE',
		OBS: 'DETECTED',
		OBS_LIVE: 'LIVE'
	};

	/**
	 * Makes a new AutoChatChecker object
	 * 
	 * @param {ChatToysApp} chatToysApp - our main app
	 */
	constructor(chatToysApp) {

		// save our ref
		this.chatToysApp = chatToysApp;

		// this will be written to by the toy widgets, if they detect they're in OBS
		this.obsSocket = socketShallowRefReadOnly('obsStatus', '0:false');

		// determine our OBS mode / live mode
		this.mode = ref(AutoChatChecker.MODE.NOT_AVAILABLE);

		// maybe I'll expose these settings later, but for now it's hardcoded

		// the number of retries to attempt to find a live stream after we've detected we're live
		this.retries = 10;

		// the number of seconds to wait between retries
		this.secondsBetweenRetries = 30;

		// if we're in the detection loop, setting this true will stop it
		this.cancelRetries = false;

		// watch the socket's value so we can recompute the mode
		watch(this.obsSocket, (newVal) => {
			this.updateMode(newVal);
		});
	}


	/**
	 * Check the socket value when it changes to see if we can get mode insight from OBS
	 * 
	 * @param {String} socketValue - something like "1234567890:true"
	 */
	updateMode(socketValue) {

		// split & parse the value
		const [timestampStr, statusStr] = socketValue.split(":");
		const timestamp = parseInt(timestampStr, 10);
		const isLive = statusStr === 'true';
		const now = Date.now();
		let newMode;

		// if the timestamp is 0, we don't have a value because we just have the default value
		if (timestamp === 0) {
			newMode = AutoChatChecker.MODE.NOT_AVAILABLE;

		// if the timestamp is older than 2 seconds, we can assume OBS was available at some point, but is now off line
		} else if (now - timestamp > 2000) {
			newMode = AutoChatChecker.MODE.OBS_OFFLINE;

		// if the timestamp is less than 2 seconds, we can assume OBS is available
		} else if (!isLive) {
			newMode = AutoChatChecker.MODE.OBS;

		// if the timestamp is less than 2 seconds and OBS is live, we can assume we're in a live stream
		} else {
			newMode = AutoChatChecker.MODE.OBS_LIVE;
		}

		// check if our mode changed
		if (this.mode.value !== newMode) {

			// save the new mode
			this.mode.value = newMode;

			// for debug
			console.log("New auto-chat mode detected:", newMode, socketValue);

			// if we changed into OBS_LIVE mode, we need to start checking for a live stream
			if (newMode === AutoChatChecker.MODE.OBS_LIVE) {
				this.handleObsLive();
			} else {
				this.clearRetries();
			}
		}
	}


	/**
	 * Starts checking for a live chat stream ID if when the user becomes live
	 */
	async handleObsLive() {

		// if the user has this option disabled, we can just GTFO
		if (!this.chatToysApp.enableAutoAdd.value)
			return;

		// check if they provided a channel URL & if it's a URL
		// NOTE: this feature is experimental and not fully tested
		// Perhaps in the future I'll put more robust URL validation in here and error handling
		const channelURL = this.chatToysApp.autoChatChannel.value;
		if (!channelURL || typeof channelURL !== 'string' || !channelURL.startsWith('http'))
			return;

		// try to get the live stream ID a number of times, unless cancelRetries becomes true
		this.cancelRetries = false;
		for (let i = 0; i < this.retries; i++) {

			// if cancelRetries is true, we can stop
			if (this.cancelRetries)
				return;

			// If the user is no longer live in OBS while we're attempting to get the stream ID, we can stop
			if (this.mode.value !== AutoChatChecker.MODE.OBS_LIVE)
				return;

			// try to get the live stream ID
			try {

				// use our backend test-url function to get the live stream ID
				const liveStreamID = await electronAPI.invoke('test-url', channelURL, 'getLive');
				if (liveStreamID && liveStreamID!=null) {

					// add it to our chat sources!
					await window.chatSourceAPI.add(liveStreamID);
					this.clearRetries();
					return;
				}

			} catch (err) {
				console.error('Error checking live stream:', err);
			}

			// wait till the next retry
			await this.sleep(this.secondsBetweenRetries * 1000);
		
		}// next i
	}


	/**
	 * Helper function to sleep for a specified amount of time
	 * 
	 * @param {Number} ms - the number of milliseconds to sleep for
	 * @returns {Promise} - a promise that resolves after the specified time
	 */
	sleep(ms) {
		return new Promise(resolve => {
			const timeout = setTimeout(resolve, ms);
			this.retryTimeouts.push(timeout);
		});
	}


	/**
	 * set our clear flag true, which will exit the retry loop
	 */
	clearRetries() {
		this.cancelRetries = true;
	}
	
}

