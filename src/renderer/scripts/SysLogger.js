/*
	SysLogger.js
	------------

	This will store the state for the system logs that will appear
	on screen when certain commands are run that show output,
	or if a command has an error that needs to be displayed to users.
*/

// vue
import { ref } from 'vue';
import { socketShallowRef } from 'socket-ref';

// our app
import { ToyManager } from "./ToyManager";

// main export
export class SysLogger {

	/**
	 * Builds the SysLogger object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// save reference to the toy manager
		this.toyManager = toyManager;

		// the amount of messages to keep in the log
		this.logLength = 10;

		// our list of messages
		this.messages = socketShallowRef('syslog', []);

		// buffer for batching info messages to the chat system
		this.bufferedInfoMsgs = [];

		// timer handle for buffered info message flushing
		this.bufferedMsgTimer = null;
	}


	/**
	 * Reusable trim function for the log
	 */
	trimLog() {
		if (this.messages.value.length > this.logLength) {
			
			// remove the first item
			this.messages.value = this.messages.value.slice(1);
		}
	}


	/**
	 * Pushes a message to the log
	 * 
	 * @param {String} type - type of message (log, error, info)
	 * @param {String} text - message text
	 */
	pushMessage(type, text) {

		// generate a unique ID for the message
		const id = Date.now().toString(36) + Math.random().toString(36).substr(2);

		this.messages.value = [			
			...this.messages.value,
			{
				id,
				type,
				text
			}
		];
		this.trimLog();
	}


	/**
	 * Adds a message to the log
	 * 
	 * @param {string} message - the message to add
	 */
	msg(message) {
		this.pushMessage('log', message);
	}


	/**
	 * Adds error message to the log
	 * 
	 * @param {string} message - the error message to add
	 */
	err(message) {		
		this.pushMessage('error', message);

		// also push to the buffered info messages for forwarding to chat
		this.pushBuffer(message);
	}


	/**
	 * Adds error message to the log
	 * 
	 * @param {string} message - the error message to add
	 */
	error(message) {		
		this.pushMessage('error', message);

		// also push to the buffered info messages for forwarding to chat
		this.pushBuffer(message);
	}


	/**
	 * Log info message
	 */
	info(message) {
		// always log to the main syslog
		this.pushMessage('info', message);

		// also push to the buffered info messages for forwarding to chat
		this.pushBuffer(message);
		
	}


	/**
	 * Push message to the buffered info messages for batched forwarding to chat
	 * 
	 * @param {string} message - the message to buffer
	 */
	pushBuffer(message){

		// also buffer info messages for batched forwarding to the chat system
		this.bufferedInfoMsgs.push(message);

		// if no timer is active, start one to flush after a short delay
		if (!this.bufferedMsgTimer) {
			this.bufferedMsgTimer = setTimeout(() => {

				// make a unique ID for this batch
				const batchID = Date.now().toString(36) + Math.random().toString(36).substr(2);

				// forward batched info messages
				electronAPI.invoke('local-chat-forward', {
					syslogger: true,
					id: batchID,
					infoMessages: this.bufferedInfoMsgs
				});

				// clear buffer and reset timer
				this.bufferedInfoMsgs = [];

				this.bufferedMsgTimer = null;
			}, 5000);
		}
	}
}
