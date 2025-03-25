const Path = require('path');
const vuePlugin = require('@vitejs/plugin-vue');
const { defineConfig } = require('vite');

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
    root: Path.join(__dirname, 'src', 'renderer'),
    publicDir: 'public',
    server: {
        port: 8080,
    },
    open: false,
    build: {
        outDir: Path.join(__dirname, 'build', 'renderer'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: Path.join(__dirname, 'src', 'renderer', 'index.html'),
                live: Path.join(__dirname, 'src', 'renderer', 'live.html'),
            },
        },
    },
    plugins: [vuePlugin()],
});

module.exports = config;
