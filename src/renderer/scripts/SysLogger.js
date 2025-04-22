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
		this.messages.value = [
			...this.messages.value,
			{
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
	}


	/**
	 * Adds error message to the log
	 * 
	 * @param {string} message - the error message to add
	 */
	error(message) {		
		this.pushMessage('error', message);
	}



	/**
	 * Log info message
	 */
	info(message) {
		this.pushMessage('info', message);
	}
}
