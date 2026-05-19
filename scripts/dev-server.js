process.env.NODE_ENV = 'development';

const Vite = require('vite');
const ChildProcess = require('child_process');
const Path = require('path');
const Chalk = require('chalk');
const Chokidar = require('chokidar');
const Electron = require('electron');
const compileTs = require('./private/tsc');
const FileSystem = require('fs');
const { EOL } = require('os');

let viteServer = null;
let electronProcess = null;
let electronProcessLocker = false;
let rendererPort = 0;

async function startRenderer() {
    viteServer = await Vite.createServer({
        configFile: Path.join(__dirname, '..', 'vite.config.js'),
        mode: 'development',
    });

    return viteServer.listen();
}

async function startElectron() {
    if (electronProcess) { // single instance lock
        return;
    }

    try {
        await compileTs(Path.join(__dirname, '..', 'src', 'main'));
    } catch {
        console.log(Chalk.redBright('Could not start Electron because of the above typescript error(s).'));
        electronProcessLocker = false;
        return;
    }

    const args = [
        Path.join(__dirname, '..', 'build', 'main', 'main.js'),
        rendererPort,
    ];
    electronProcess = ChildProcess.spawn(Electron, args);
    electronProcessLocker = false;

    electronProcess.stdout.on('data', data => {
        if (data == EOL) {
            return;
        }

        process.stdout.write(Chalk.blueBright(`[electron] `) + Chalk.white(data.toString()))
    });

    electronProcess.stderr.on('data', data => 
        process.stderr.write(Chalk.blueBright(`[electron] `) + Chalk.white(data.toString()))
    );

    electronProcess.on('exit', () => stop());
}

function restartElectron() {
    if (electronProcess) {
        electronProcess.removeAllListeners('exit');
        electronProcess.kill();
        electronProcess = null;
    }

    if (!electronProcessLocker) {
        electronProcessLocker = true;
        startElectron();
    }
}

function copyStaticFiles() {
    copy('static');
}

/*
The working dir of Electron is build/main instead of src/main because of TS.
tsc does not copy static files, so copy them over manually for dev server.
*/
function copy(path) {
    FileSystem.cpSync(
        Path.join(__dirname, '..', 'src', 'main', path),
        Path.join(__dirname, '..', 'build', 'main', path),
        { recursive: true }
    );
}

/**
 * Copy `src/shared/` -> `build/shared/` for the dev runtime. The main
 * process `require()`s JSON catalogs from there (asset_paths seeding,
 * etc.); the renderer reads the same files via Vite's import-time JSON
 * inlining, so this only matters for main. Called on dev-server start
 * and whenever a file under src/shared changes.
 */
function copySharedFiles() {
    const from = Path.join(__dirname, '..', 'src', 'shared');
    const to   = Path.join(__dirname, '..', 'build', 'shared');
    if (FileSystem.existsSync(from)) {
        FileSystem.cpSync(from, to, { recursive: true });
    }
}

function stop() {
    viteServer.close();
    process.exit();
}

async function start() {
    console.log(`${Chalk.greenBright('=======================================')}`);
    console.log(`${Chalk.greenBright('Starting Electron + Vite Dev Server...')}`);
    console.log(`${Chalk.greenBright('=======================================')}`);

    const devServer = await startRenderer();
    rendererPort = devServer.config.server.port;

    copyStaticFiles();
    copySharedFiles();
    startElectron();

    const path = Path.join(__dirname, '..', 'src', 'main');
    Chokidar.watch(path, {
        cwd: path,
    }).on('change', (path) => {
        console.log(Chalk.blueBright(`[electron] `) + `Change in ${path}. reloading... 🚀`);

        if (path.startsWith(Path.join('static', '/'))) {
            copy(path);
        }

        restartElectron();
    });

    // Separate watcher for src/shared - any change to a JSON catalog
    // (e.g. adding a built-in asset entry) triggers a re-copy + electron
    // restart so the main-process require()s the fresh contents.
    const sharedPath = Path.join(__dirname, '..', 'src', 'shared');
    if (FileSystem.existsSync(sharedPath)) {
        Chokidar.watch(sharedPath, { cwd: sharedPath }).on('change', (p) => {
            console.log(Chalk.blueBright(`[electron] `) + `Change in shared/${p}. recopying... 🚀`);
            copySharedFiles();
            restartElectron();
        });
    }
}

start();
