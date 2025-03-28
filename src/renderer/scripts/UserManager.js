/*
	UserManager.js
	--------------

	Handles the user data we get from the chat platform.
*/

import { ref, shallowRef } from 'vue';

export class UserManager {

	constructor(chatToysApp) {

		this.chatToysApp = chatToysApp;
		this.userMap = new Map();
		this.userList = [];
		this.userListRef = ref(this.userList);
		this.userMapRef = shallowRef(this.userMap);

		// bind our methods
		// this._handleChatMessage = this._handleChatMessage.bind(this);

		// // Hook up to Electron API
		// window.electronAPI.onChatMessage(this._handleChatMessage);

	}

	

	getUserByID(id) {
		// return this.userMap.get(id);

		return {
			id: id,
			name: 'User ' + id,
			points: 1000,
			roles: [],
			avatar: 'https://via.placeholder.com/150',
		}
	}
	
}