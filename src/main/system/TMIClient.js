// services/TMIClient.js
import tmi from 'tmi.js'
import { v4 as uuidv4 } from 'uuid'

export class TMIClient {
	constructor(username, token, onChat) {
		this.username = username
		this.token = token
		this.onChat = onChat
		this.client = null
	}

	async connect() {
		this.client = new tmi.Client({
			options: { debug: false },
			connection: { reconnect: true, secure: true },
			identity: {
				username: this.username,
				password: `oauth:${this.token}`
			},
			channels: [this.username]
		})

		this.client.on('message', (channel, tags, message, self) => {
			if (self) return // ignore our own messages

			const chatObj = {
				id: uuidv4(),
				author: tags['display-name'] || tags.username,
				message,
				isMember: !!tags.subscriber
			}

			if (typeof this.onChat === 'function')
				this.onChat(chatObj)
		})

		await this.client.connect()
		console.log(`[TMI] Connected to chat as ${this.username}`)
	}

	async disconnect() {
		if (this.client) {
			await this.client.disconnect()
			this.client = null
		}
	}
}
