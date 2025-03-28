import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
	sendMessage: (message: string) => ipcRenderer.send('message', message),
	onChatMessage: (callback) => ipcRenderer.on('chat-message', (event, data) => callback(data))
});
