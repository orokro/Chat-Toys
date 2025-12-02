/*
	WindowTests.js
	--------------

	Right, so the idea behind this file is to provide some functionality we can reuse in various ways.
	We want to make a window that can load arbitrary URLS, and run some JavaScript on them.
	Then we will capture the result of the JavaScript, and return it to the calling function.

	This is pretty Jank but it works.
*/

// electron & node
const { BrowserWindow, ipcMain, app } = require('electron');
const { join } = require('path');

// we will build a reusable browser window to test URLs with here:
let testerWindow = null;

// true while we're processing a test
let isBusy = false;

// array of potential tests to run
const testQueue = [];

// how long before we should give up on a test for whatever reason
const TEST_TIMEOUT = 15000; // 15 seconds

// Simple test scripts
const testScripts = {

	// when in injected, will check for the presence of a h1 tag
	checkForHeaderTags: `
		const hasH1 = document.querySelectorAll('h1').length > 0;
		console.log('result:' + hasH1);
	`,

	// when injected, will check for the presence of an img tag
	checkForImages: `
		const hasImg = document.querySelectorAll('img').length > 0;
		console.log('result:' + hasImg);
	`,

	// my original live video detection script
	getLive: `
		(() => {
			try {
				setTimeout(()=>{
					const liveVideo = Array.from(document.querySelectorAll('a'))
						.find(a => {
							const href = a.getAttribute('href') || '';
							const hasVideo = href.includes('/watch?v=');
							const label = a.getAttribute('aria-label')?.toLowerCase() || '';
							const text = a.textContent?.toLowerCase() || '';
							const isLive = label.includes('live now') || text.includes('live now') || label.includes('streaming') || text.includes('streaming');
							return hasVideo && isLive;
						});

					if (liveVideo) {
						const url = new URL('https://www.youtube.com' + liveVideo.getAttribute('href'));
						const videoId = url.searchParams.get('v');
						console.log('result:' + JSON.stringify(videoId));
					} else {
						// fallback: check for yt-img-shadow with LIVE badge
						const badge = Array.from(document.querySelectorAll('span, ytd-badge-supported-renderer')).find(el => {
							const txt = el.textContent?.toLowerCase() || '';
							return txt.includes('live now') || txt.trim() === 'live';
						});

						if (badge) {
							const container = badge.closest('a[href*="/watch?v="]');
							if (container) {
								const url = new URL('https://www.youtube.com' + container.getAttribute('href'));
								const videoId = url.searchParams.get('v');
								console.log('result:' + JSON.stringify(videoId));
								return;
							}
						}
						console.log('result:null');
					}
				}, 1000);

			} catch (e) {
				console.log('result:null');
			}
		})()
	`,

	// improved live video detection script via chatGPT
	getLive2: `
		(() => {
			try {
				// Work directly on the initial HTML; we don't depend on dynamic DOM content.
				const html = document.documentElement.innerHTML;
				let videoId = null;

				// 1) Try JSON "canonicalUrl":"https://www.youtube.com/watch?v=VIDEO_ID"
				const jsonCanonicalMatch = html.match(/"canonicalUrl":"https:\\/\\/www\\.youtube\\.com\\/watch\\?v=([^"]+)"/);
				if (jsonCanonicalMatch && jsonCanonicalMatch[1]) {
					videoId = jsonCanonicalMatch[1];
				}

				// 2) Fallback: <link rel="canonical" href="https://www.youtube.com/watch?v=VIDEO_ID">
				if (!videoId) {
					const canonicalLink = document.querySelector('link[rel="canonical"]');
					if (canonicalLink) {
						const href = canonicalLink.getAttribute('href') || '';
						const m = href.match(/[?&]v=([^&]+)/);
						if (m && m[1]) {
							videoId = m[1];
						}
					}
				}

				// If we still don't have a video id, it's not a watch page / live stream.
				if (!videoId) {
					console.log('result:null');
					return;
				}

				// 3) Decide if it's actually live
				let isLive = false;

				// a) Try JS globals if they're there
				try {
					if (
						window.ytInitialPlayerResponse &&
						window.ytInitialPlayerResponse.videoDetails &&
						window.ytInitialPlayerResponse.videoDetails.isLiveContent
					) {
						isLive = true;
					}
				} catch (e) {
					// ignore
				}

				// b) Fallback: search for isLive flags in the HTML itself
				if (!isLive) {
					if (
						html.includes('"isLive":true') ||
						html.includes('"isLiveContent":true')
					) {
						isLive = true;
					}
				}

				if (!isLive) {
					console.log('result:null');
					return;
				}

				// Return JSON so your existing parser can JSON.parse it cleanly
				console.log('result:' + JSON.stringify(videoId));
			} catch (e) {
				console.log('result:null');
			}
		})()
	`,

	// further improved live video detection script
	getLive3: `
		(() => {
			try {
				let videoId = null;

				// 1) If we're already on a watch page, just use v= directly
				const currentUrl = new URL(location.href);
				if (currentUrl.pathname === '/watch') {
					videoId = currentUrl.searchParams.get('v');
				}

				const html = document.documentElement.innerHTML;

				// 2) If not, try JSON canonicalUrl in the page
				if (!videoId) {
					const jsonCanonicalMatch = html.match(
						/"canonicalUrl":"https:\\/\\/www\\.youtube\\.com\\/watch\\?v=([^"]+)"/
					);
					if (jsonCanonicalMatch && jsonCanonicalMatch[1]) {
						videoId = jsonCanonicalMatch[1];
					}
				}

				// 3) Fallback: <link rel="canonical" href="https://www.youtube.com/watch?v=VIDEO_ID">
				if (!videoId) {
					const canonicalLink = document.querySelector('link[rel="canonical"]');
					if (canonicalLink) {
						const href = canonicalLink.getAttribute('href') || '';
						const m = href.match(/[?&]v=([^&]+)/);
						if (m && m[1]) {
							videoId = m[1];
						}
					}
				}

				// If we still don't have an ID, it's not a watch/live page
				if (!videoId) {
					console.log('result:null');
					return;
				}

				// 4) Decide if it's actually live
				let isLive = false;

				// a) Prefer ytInitialPlayerResponse if present
				try {
					const player = window.ytInitialPlayerResponse;
					const details = player && player.videoDetails;
					if (details && (details.isLiveContent || details.isLive)) {
						isLive = true;
					}
				} catch (e) {
					// ignore, we'll fall back to HTML scan
				}

				// b) Fallback: search for isLive flags in the HTML itself
				if (!isLive) {
					if (
						html.includes('"isLive":true') ||
						html.includes('"isLiveContent":true')
					) {
						isLive = true;
					}
				}

				if (!isLive) {
					console.log('result:null');
					return;
				}

				console.log('result:' + JSON.stringify(videoId));
			} catch (e) {
				console.log('result:null');
			}
		})()
	`,

	// instead of checking public page, this will check if a users yt studio page is live
	getUserLive: `
		(() => {
			try {

				const MAX_WAIT_MS = 5000;
				const POLL_INTERVAL_MS = 150;

				/**
				 * Recursively search an object graph for a live videoId.
				 *
				 * @param {any} root
				 * @returns {string|null}
				 */
				const findLiveVideoId = (root) => {

					if (!root || typeof root !== 'object')
						return null;

					const visited = new Set();
					const stack = [root];

					while (stack.length) {

						const obj = stack.pop();

						if (!obj || typeof obj !== 'object')
							continue;

						if (visited.has(obj))
							continue;

						visited.add(obj);

						// Direct hit: has a videoId and looks live-ish
						if (obj.videoId && typeof obj.videoId === 'string') {

							const vd = obj;
							const liveFlag =
								vd.isLive === true ||
								vd.isLiveContent === true ||
								(vd.liveStreamability && typeof vd.liveStreamability === 'object') ||
								(vd.badges && JSON.stringify(vd.badges).toLowerCase().includes('live'));

							if (liveFlag) {
								return vd.videoId;
							}
						}

						// Sometimes live-ness is stored on videoDetails
						if (obj.videoDetails && typeof obj.videoDetails === 'object') {

							const vd = obj.videoDetails;
							if (vd.videoId && typeof vd.videoId === 'string') {

								const liveFlag =
									vd.isLiveContent === true ||
									vd.isLive === true ||
									(vd.author && String(vd.author).toLowerCase().includes('live'));

								if (liveFlag) {
									return vd.videoId;
								}
							}
						}

						for (const key in obj) {
							if (!Object.prototype.hasOwnProperty.call(obj, key))
								continue;
							const val = obj[key];
							if (val && typeof val === 'object') {
								stack.push(val);
							}
						}
					}

					return null;
				};

				/**
				 * Fallback: scan HTML for a videoId near live flags.
				 *
				 * @returns {string|null}
				 */
				const scanHtmlForLiveVideoId = () => {

					const html = document.documentElement.innerHTML;

					// Look for a segment with isLive true and a nearby videoId
					const liveSegmentMatch = html.match(/"isLive(?:Content)?":true[\\s\\S]{0,500}?"videoId":"([^"]+)"/);
					if (liveSegmentMatch && liveSegmentMatch[1]) {
						return liveSegmentMatch[1];
					}

					// Or videoDetails with isLiveContent
					const vdMatch = html.match(/"videoDetails":[\\s\\S]{0,500}?"videoId":"([^"]+)"[\\s\\S]{0,500}?"isLiveContent":true/);
					if (vdMatch && vdMatch[1]) {
						return vdMatch[1];
					}

					return null;
				};

				const tryExtract = () => {

					try {

						const candidates = [];

						if (window.ytInitialPlayerResponse)
							candidates.push(window.ytInitialPlayerResponse);

						if (window.ytInitialData)
							candidates.push(window.ytInitialData);

						// Some Studio pages tuck data under "response" or "contents"
						if (window.ytInitialData && window.ytInitialData.response)
							candidates.push(window.ytInitialData.response);

						let videoId = null;

						for (let i = 0; i < candidates.length && !videoId; i++) {
							videoId = findLiveVideoId(candidates[i]);
						}

						if (!videoId) {
							videoId = scanHtmlForLiveVideoId();
						}

						if (videoId) {
							console.log('result:' + JSON.stringify(videoId));
						} else if (Date.now() - startTime >= MAX_WAIT_MS) {
							// Ran out of time, give up
							console.log('result:null');
						} else {
							// Not ready yet, poll again
							setTimeout(tryExtract, POLL_INTERVAL_MS);
						}

					} catch (err) {
						console.log('result:null');
					}
				};

				const startTime = Date.now();
				tryExtract();

			} catch (e) {
				console.log('result:null');
			}
		})()
	`,

	// my original check if the live chat is live
	chatIsLive: `
		(() => {
			try {
				// YouTube's live chat will have a ytc-live-chat-frame element
				const disabledText = Array.from(document.querySelectorAll('yt-formatted-string'))
					.map(el => el.textContent)
					.find(text => text?.toLowerCase().includes('chat is disabled'));

				const isChatContainerPresent = document.querySelector('yt-live-chat-renderer') !== null;

				const result = (!disabledText && isChatContainerPresent);
				console.log('result:' + JSON.stringify(result));
			} catch (e) {
				console.log('result:false');
			}
		})()
	`,

	// improved live chat detection script
	chatIsLive2: `
		(() => {
			try {
				setTimeout(() => {
					// look for the main chat renderer
					const hasChatRenderer = !!document.querySelector('yt-live-chat-renderer');

					// look for text indicating chat is explicitly disabled
					const disabledText = Array
						.from(document.querySelectorAll('yt-formatted-string'))
						.map(el => el.textContent?.toLowerCase() || '')
						.find(text =>
							text.includes('chat is disabled') ||
							text.includes('live chat is disabled') ||
							text.includes('live chat replay is not available')
						);

					const result = !!(hasChatRenderer && !disabledText);
					console.log('result:' + JSON.stringify(result));
				}, 1000);
			} catch (e) {
				console.log('result:false');
			}
		})()
	`,	

};


/**
 * Create and configure the hidden test window
 */
function createTestWindow() {

	// build a browser window to test various URLs with
	testerWindow = new BrowserWindow({
		width: 500,
		height: 700,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: join(__dirname, 'chatPreload.js'),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false
		}
	});

	testerWindow.on('closed', () => {
		testerWindow = null;
	});
}


// Provide a way to test a URL with our of our predefined test scripts
// This will be called from the renderer process
ipcMain.handle('test-url', async (event, url, testName) => {
	return await testURL(url, testName);
});


/**
 * Queues up one of our tests
 * 
 * @param {String} urlToTest - a URL to run a JavaScript test on
 * @param {String} testName - the name of our of our predefined test scripts
 * @returns {Promise} - a promise that resolves with the result of the test
 */
function testURL(urlToTest, testName) {

	// return a promise that will resolve when the test is done
	return new Promise((resolve, reject) => {

		// add to our queue & call processQueue which will recursively process the queue
		// if it isn't already working
		testQueue.push({ urlToTest, testName, resolve, reject });
		processQueue();
	});
}


/**
 * Processes the queue of tests
 * 
 * @returns {Promise} - a promise that resolves with the result of the test
 */
async function processQueue() {

	// if we're busy, or the queue is empty (or the window is closed), we can't do anything
	if (isBusy || testQueue.length === 0 || !testerWindow)
		return;

	// get the URL to test and the test name, as well as our original promise's resolve and reject
	const { urlToTest, testName, resolve, reject } = testQueue.shift();

	// true until the test finishes, or times out
	isBusy = true;

	// true if we've resolved the result
	let resultResolved = false;

	// set a timeout to reject the test if it takes too long
	const timeout = setTimeout(() => {

		// if we haven't resolved the result yet, reject the promise & resolve with an error
		if (!resultResolved) {

			console.error('Test timed out');

			// we done, reject the og promise
			resultResolved = true;
			reject(new Error('Test timed out'));

			// no longer busy & we can clear the window to about:blank so we don't waste resources on 
			// whatever the test page was
			isBusy = false;
			testerWindow.loadURL('about:blank');

			// there may be more items in the queue, so keep processing
			processQueue();
		}
	}, TEST_TIMEOUT);

	/*
		Right, so - we are going to be injecting a raw JavaScript string directly into the loaded page.

		This means that, it's "JavaScript" context will be on the webpage itself, and not the Electron / Preload context.

		This means it will not have access to communicate to us (us=electron context) directly.

		So instead, we'll do a filthy-hack: we'll check if the window does a console log that starts with "result:"
		and if we find one, we'll parse the result and resolve the promise with it.

		This will totally fail if the window we load prints 'result: something' on it's own.

		This could be made more robust by using sockets to communicate, or by using a more complex string.
		But for now, this is good enough.
	*/
	/*
		Right, so - we are going to be injecting a raw JavaScript string directly into the loaded page.
		...
	*/
	const logListener = (event, logType, args) => {
		// check if we got a log message that's a string that starts with "result:"
		if (logType === 'log' && args.length && typeof args[0] === 'string' && args[0].startsWith('result:')) {

			const resultString = args[0].split('result:')[1];
			let parsedResult = resultString;

			try {
				parsedResult = JSON.parse(resultString);
			} catch (e) {
				if (resultString === 'true')
					parsedResult = true;
				else if (resultString === 'false')
					parsedResult = false;
			}

			if (!resultResolved) {
				resultResolved = true;
				clearTimeout(timeout);

				// remove the actual listener we registered below
				testerWindow.webContents.removeListener('console-message', consoleListener);

				resolve(parsedResult);

				isBusy = false;
				testerWindow.loadURL('about:blank');
				processQueue();
			}
		}
	};

	// this is the function we actually attach & later remove
	const consoleListener = (event, level, message, line, sourceId) => {
		// we only care about normal console.log
		logListener(event, 'log', [message]);
	};

	// subscribe before we load the test-URL
	testerWindow.webContents.on('console-message', consoleListener);


	try {

		// load the URL to test and then inject our script by name after it's loaded
		await testerWindow.loadURL(urlToTest);
		await testerWindow.webContents.executeJavaScript(testScripts[testName]);

	} catch (err) {

		// if there was an error, lets reject & reset things
		if (!resultResolved) {

			// we're resolved, lets clear our timeout because we got an error
			resultResolved = true;
			clearTimeout(timeout);
			testerWindow.webContents.removeListener('console-message', consoleListener);

			// reject the OG promise with the error
			reject(err);

			// we're no longer busy, and we can clear the window to about:blank so we don't waste resources on
			isBusy = false;
			testerWindow.loadURL('about:blank');

			// there may be more items in the queue, so keep processing
			processQueue();
		}
	}
}


// Initialize everything immediately once this file is included in main.js
app.whenReady().then(() => {
	createTestWindow();
});


// Clean up on exit
app.on('before-quit', () => {
	if (testerWindow) {
		testerWindow.destroy();
	}
});


// Export the testURL function so we can call it from the renderer process
module.exports = {
	testURL,
	testScripts
};
