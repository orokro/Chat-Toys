/*
	useToySettings.js
	-----------------

	Uhh, idk, this is sorta in the 'hook' pattern which this project
	doesn't really use anywhere else, but I felt like it kinda made sense here.

	This is totally an afterthought, especially since I decide that the
	multi-browser-source option in OBS is probably the way to go anyhow.

	Anyway, the purpose here is to let the various widgets call useToySettings
	to automatically get the settings for the toy they are a part of.

	This includes setting up the socket to access the settings.
*/

import { ref, watch } from 'vue';
import { socketRef, socketShallowRefReadOnly, socketShallowRefAsync } from 'socket-ref';

export function useToySettings(slug, key, emits, ready){

	// get the string for our settings socket
	const blockNameKebab = slug.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	const settingsName = blockNameKebab + '-settings'

	// build the socket for our settings
	const settingsSocket = socketShallowRefReadOnly(settingsName, 'uninitialized');

	// the box info we'll manage when we get it from the socket
	let boxInfo = {
		x: 100,
		y: 100,
		width: 200,
		height: 200
	};

	// fn to emit the box data from the socket
	const emitBoxData = ()=> {

		// get the box info from the settings
		const data = settingsSocket.value;
		boxInfo = data[key];

		// emit the box change
		emits('boxChange', {
			value: boxInfo
		});
	}

	// watch the socket for box updates
	watch(settingsSocket, (newVal) => {

		// gtfo if this ever happens
		if (newVal === 'uninitialized'){
			return;
		}
		emitBoxData();		
	});

	// wait until we definitely have the settings
	const checkInterval = setInterval(()=>{

		// if we have the settings, stop the interval
		if (settingsSocket.value !== 'uninitialized'){
			clearInterval(checkInterval);
			if(ready)
				ready();
			emitBoxData();
		}

	}, 100);

	// return socket
	return settingsSocket;
}
