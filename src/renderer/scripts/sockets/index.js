/*
	sockets/index.js
	----------------

	Public entry for synced refs. Import from '@sockets':

		import { socketShallowRef, socketShallowRefReadOnly } from '@sockets';

	Replaces the old `socket-ref` npm package (same API, new transport).
	The server half lives in src/main/system/sockets/SocketServer.js.
*/

export {
	setGlobalSocketRefPort, enableConnectionLogs,
	socketRef, socketShallowRef,
	socketRefReadOnly, socketShallowRefReadOnly,
	socketRefAsync, socketShallowRefAsync,
	disposeSocketRef, getSocketStats,
} from './socketRef.js';

export { bindRef, bindRefs } from './bindRefs.js';
