const esbuild = require("esbuild");

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
		build.onEnd((result) => {
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
		entryPoints: [
			'src/extension.ts'
		],
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

	// Design webview build context
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

	// Chat webview build context
	const chatCtx = await esbuild.context({
		entryPoints: ['src/webview/chat/index.tsx'],
		bundle: true,
		format: 'esm',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/chat.js',
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
		jsx: 'automatic',
	});

	if (watch) {
		await Promise.all([
			ctx.watch(),
			webviewCtx.watch(),
			chatCtx.watch()
		]);
		console.log('Watching for changes...');
	} else {
		await Promise.all([
			ctx.rebuild(),
			webviewCtx.rebuild(),
			chatCtx.rebuild()
		]);
		await ctx.dispose();
		await webviewCtx.dispose();
		await chatCtx.dispose();
		console.log('Build complete!');
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
