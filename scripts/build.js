const Path = require('path');
const Chalk = require('chalk');
const FileSystem = require('fs');
const Vite = require('vite');
const compileTs = require('./private/tsc');

function buildRenderer() {
    return Vite.build({
        configFile: Path.join(__dirname, '..', 'vite.config.js'),
        base: './',
        mode: 'production'
    });
}

function buildMain() {
    const mainPath = Path.join(__dirname, '..', 'src', 'main');
    return compileTs(mainPath);
}

/**
 * Copy `src/shared/` into `build/shared/` so the main-process code can
 * `require()` the same JSON catalogs the renderer imports. tsc only
 * emits .js files - non-TS sources have to be ferried over manually.
 */
function copyShared() {
    const from = Path.join(__dirname, '..', 'src', 'shared');
    const to   = Path.join(__dirname, '..', 'build', 'shared');
    if (FileSystem.existsSync(from)) {
        FileSystem.cpSync(from, to, { recursive: true });
    }
}

/**
 * Copy the plugin SDK (ct-api.js) into build/renderer/plugins/ so the main
 * process can read + serve it at /plugins/_sdk/ct-api.js in production. Vite
 * never bundles it (it's served raw to sandboxed iframes, not imported), so
 * it has to be ferried over manually like the shared catalogs.
 */
function copyPluginSdk() {
    const from = Path.join(__dirname, '..', 'src', 'renderer', 'plugins', 'ct-api.js');
    const toDir = Path.join(__dirname, '..', 'build', 'renderer', 'plugins');
    if (FileSystem.existsSync(from)) {
        FileSystem.mkdirSync(toDir, { recursive: true });
        FileSystem.copyFileSync(from, Path.join(toDir, 'ct-api.js'));
    }
}

FileSystem.rmSync(Path.join(__dirname, '..', 'build'), { recursive: true, force: true });
FileSystem.rmSync(Path.join(__dirname, '..', 'dist'), { recursive: true, force: true });

console.log(Chalk.blueBright('Transpiling renderer & main...'));

Promise.allSettled([
    buildRenderer(),
    buildMain(),
]).then(() => {
    // shared/ is copied AFTER tsc finishes so its emit doesn't clobber
    // freshly-copied JSON. Renderer side handles this through Vite's
    // build-time JSON inlining (no on-disk file needed at runtime).
    copyShared();
    copyPluginSdk();
    console.log(Chalk.greenBright('Renderer & main successfully transpiled! (ready to be built with electron-builder)'));
});
