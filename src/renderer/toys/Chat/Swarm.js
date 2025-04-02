/*
	Swarm.js
	--------

	We'll handle the state logic for the !swarm command here.
*/

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// main class
export class Swarm {

	/**
	 * Builds a new Swarm object
	 * 
	 * @param {Number} maxVisible - how many swarm messages to keep in the visible list
	 * @param {Ref<Number>} swarmSize - how many unique users to trigger a swarm
	 * @param {Ref<Number>} swarmTime - the window of time to consider for a swarm
	 * @param {Function} onVisibleMessagesChange - callback for when new messages are shown/removed
	 * @param {Function} onSwarmStateChange  - callback for when the swarm state changes
	 */
    constructor(maxVisible, swarmSize, swarmTime, onVisibleMessagesChange, onSwarmStateChange) {

		// save our settings
        this.maxVisible = maxVisible;
        this.swarmSize = swarmSize;
        this.swarmTime = swarmTime; // in seconds

		// save our callbacks
        this.onNewMessagesShown = onVisibleMessagesChange;
        this.onSwarmStateChange = onSwarmStateChange;

		// our message queues
		// { id, userName, userID, message, timestamp, seen }
        this.swarmQueue = []; 
        this.visibleMessages = [];

		// true if we're in a swarm
        this.inSwarm = false;
    }


	/**
	 * Add a new message to the swarm
	 * 
	 * @param {String} userName - the user name
	 * @param {String} userID - the user ID
	 * @param {String} message - the message
	 */
    newMessage(userName, userID, message) {

		// we'll add a timestamp and a unique ID
        const timestamp = Date.now();
        const id = uuidv4();
        this.swarmQueue.push({
            id,
            userName,
            userID,
            message,
            timestamp,
            seen: false
        });
    }


	/**
	 * Remove old visible messages if they're older than double the swarm time
	 */
	pruneOldVisibleMessages() {
		const now = Date.now();
		const cutoff = now - this.swarmTime.value * 1000 * 2;
		this.visibleMessages = this.visibleMessages.filter(msg => msg.timestamp >= cutoff);
	}


	/**
	 * Check the state of the swarm
	 */
    tick() {

		// Prune old messages from the visible queue
		this.pruneOldVisibleMessages();

		// Prune old messages
        const now = Date.now();
        const cutoff = now - this.swarmTime.value * 1000;
        this.swarmQueue = this.swarmQueue.filter(msg => msg.timestamp >= cutoff);

        // Count unique users
        const uniqueUsers = new Set(this.swarmQueue.map(msg => msg.userID));
        const isSwarm = uniqueUsers.size >= this.swarmSize.value;

        // Swarm state change
        if (isSwarm !== this.inSwarm) {
            this.inSwarm = isSwarm;
            this.onSwarmStateChange(this.inSwarm);
        }

		// if we're in a swarm, show new messages
        if (isSwarm) {
            const newVisible = [];

            for (const msg of this.swarmQueue) {
                if (!msg.seen) {
                    msg.seen = true;
                    newVisible.push({
                        id: msg.id,
						timestamp: msg.timestamp,
                        userName: msg.userName,
                        userID: msg.userID,
                        message: msg.message
                    });
                }
            }// next msg

			// mix in the new messages
            if (newVisible.length > 0) {
                this.visibleMessages.push(...newVisible);

                // Keep only the latest maxVisible messages
                if (this.visibleMessages.length > this.maxVisible) {
                    this.visibleMessages = this.visibleMessages.slice(-this.maxVisible);
                }

				// trigger the callback
                this.onNewMessagesShown(this.visibleMessages);
            }
        }
    }
	
}
