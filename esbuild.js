const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        plugins: [
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin,
        ],
    });

    // Webview build context
    const webviewCtx = await esbuild.context({
        entryPoints: ['src/webview/index.tsx'],
        bundle: true,
        format: 'esm',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'browser',
        outfile: 'dist/webview.js',
        logLevel: 'silent',
        plugins: [esbuildProblemMatcherPlugin],
        loader: {
            '.css': 'text',
            '.png': 'file',
            '.jpg': 'file',
            '.svg': 'file',
        },
        define: {
            'process.env.NODE_ENV': production ? '"production"' : '"development"',
        },
        jsx: 'automatic', // This enables JSX support
    });

    if (watch) {
        await Promise.all([ctx.watch(), webviewCtx.watch()]);
        console.log('Watching for changes...');
    } else {
        await Promise.all([ctx.rebuild(), webviewCtx.rebuild()]);
        await ctx.dispose();
        await webviewCtx.dispose();

        // Copy Claude Code SDK to dist for runtime access
        const fs = require('fs');
        const path = require('path');
        const srcPath = path.join(__dirname, 'node_modules', '@anthropic-ai', 'claude-code');
        const destPath = path.join(
            __dirname,
            'dist',
            'node_modules',
            '@anthropic-ai',
            'claude-code'
        );

        // Create directory structure
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        // Copy files
        function copyDir(src, dest) {
            fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (let entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);
                entry.isDirectory()
                    ? copyDir(srcPath, destPath)
                    : fs.copyFileSync(srcPath, destPath);
            }
        }

        copyDir(srcPath, destPath);
        console.log('Claude Code SDK copied to dist/');

        // Copy assets to dist folder
        const assetsSrcPath = path.join(__dirname, 'src', 'assets');
        const assetsDestPath = path.join(__dirname, 'dist', 'src', 'assets');

        if (fs.existsSync(assetsSrcPath)) {
            copyDir(assetsSrcPath, assetsDestPath);
            console.log('Assets copied to dist/src/assets/');
        } else {
            console.log('Assets directory not found at:', assetsSrcPath);
        }

        console.log('Build complete!');
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
