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

// how long before we should give up on a test for whatever reast
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
	`
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
	const logListener = (event, logType, args) => {

		// check if we got a log message that's a string that starts with "result:"
		if (logType === 'log' && args.length && typeof args[0] === 'string' && args[0].startsWith('result:')) {

			// split the entire log message on the "result:" string & parse the result
			const resultString = args[0].split('result:')[1];
			let parsedResult = resultString;

			// try to parse the result as JSON
			try {
				parsedResult = JSON.parse(resultString);
			} catch (e) {

				// Fallback to raw string if not JSON
				if (resultString === 'true')
					parsedResult = true;
				else if (resultString === 'false')
					parsedResult = false;
			}

			// if we haven't resolved the result yet, resolve the promise with the parsed result
			if (!resultResolved) {

				// we're resolved, lets clear our timeout because we got an answerr
				resultResolved = true;
				clearTimeout(timeout);

				// clean up the listener for the console messages
				testerWindow.webContents.removeListener('console-message', logListener);

				// resolve the OG promise with the parsed result
				resolve(parsedResult);

				// we're no longer busy, and we can clear the window to about:blank so we don't waste resources on
				// whatever the test page was
				isBusy = false;
				testerWindow.loadURL('about:blank');

				// there may be more items in the queue, so keep processing
				processQueue();
			}
		}
	};


	// because we built our function above to read console log messages, let's subscribe it now before we load the test-URL
	testerWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
		logListener(event, 'log', [message]);
	});

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
			testerWindow.webContents.removeListener('console-message', logListener);

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
