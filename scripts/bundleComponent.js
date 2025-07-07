const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function bundleComponent(entryFile, outDir, componentName = 'ComponentPreview') {
  console.log(`🔧 Bundling component: ${entryFile}`);
  console.log(`📁 Output directory: ${outDir}`);
  
  // Store original working directory for restoration
  const originalCwd = process.cwd();
  
  try {
    // Determine the working directory - should be the directory containing package.json near the component
    const componentDir = path.dirname(path.resolve(entryFile));
    let workingDir = componentDir;
    
    // Look for package.json in component dir and parent dirs
    let searchDir = componentDir;
    while (searchDir !== path.dirname(searchDir)) { // While not at root
      const packageJsonPath = path.join(searchDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        workingDir = searchDir;
        break;
      }
      searchDir = path.dirname(searchDir);
    }
    
    console.log(`📂 Working directory: ${workingDir}`);
    console.log(`📦 Component directory: ${componentDir}`);
    
    // Change to the working directory for dependency resolution
    process.chdir(workingDir);
    
    // Create output directory
    fs.mkdirSync(outDir, { recursive: true });

    // Calculate relative path from temp wrapper to the component
    const tempWrapperPath = path.join(outDir, 'temp_wrapper.tsx');
    const relativePath = path.relative(path.dirname(tempWrapperPath), entryFile).replace(/\\/g, '/');
    
    console.log(`🔗 Component relative path: ${relativePath}`);

    // Create a temporary wrapper file that renders the component
    const wrapperContent = `
import React from 'react';
import { createRoot } from 'react-dom/client';

// Debug: Log import attempt
console.log('🚀 Wrapper starting - importing component from: ${relativePath}');

// Import the component - try both default and named exports
import * as ComponentModule from '${relativePath}';

// Handle different export patterns
const Component = ComponentModule.default || ComponentModule;

console.log('✅ Component module imported:', ComponentModule);
console.log('✅ Component resolved:', Component);

// Create root and render component
const container = document.getElementById('root');
if (container) {
  try {
    console.log('📦 Creating React root...');
    const root = createRoot(container);
    
    // Check if Component is a valid React component
    if (typeof Component !== 'function') {
      throw new Error(\`Component is not a function. Got: \${typeof Component}. Available exports: \${Object.keys(ComponentModule).join(', ')}\`);
    }
    
    console.log('🎨 Rendering component...');
    root.render(React.createElement(Component));
    console.log('✅ Component rendered successfully');
  } catch (renderError) {
    console.error('❌ Render error:', renderError);
    container.innerHTML = \`
      <div style="padding: 20px; color: red; font-family: monospace;">
        <h3>Component Render Error</h3>
        <pre>\${renderError.toString()}</pre>
        <p><strong>Component type:</strong> \${typeof Component}</p>
        <p><strong>Component name:</strong> \${Component?.name || 'unknown'}</p>
        <p><strong>Available exports:</strong> \${Object.keys(ComponentModule).join(', ')}</p>
      </div>
    \`;
  }
} else {
  console.error('❌ Root container not found');
}
`;

    fs.writeFileSync(tempWrapperPath, wrapperContent);

    // Enhanced CSS discovery - scan for various CSS files
    let globalStyles = '';
    
    // Expanded list of possible CSS files including CSS modules and component-specific styles
    const possibleCssFiles = [
      // Global styles in common locations
      path.join(workingDir, 'src/app/globals.css'),
      path.join(workingDir, 'src/globals.css'),
      path.join(workingDir, 'styles/globals.css'),
      path.join(workingDir, 'src/styles/globals.css'),
      path.join(workingDir, 'src/index.css'),
      path.join(workingDir, 'public/styles.css'),
      // Tailwind CSS
      path.join(workingDir, 'src/app/tailwind.css'),
      path.join(workingDir, 'src/tailwind.css'),
      path.join(workingDir, 'tailwind.css'),
      // Next.js specific
      path.join(workingDir, 'styles/Home.module.css'),
      path.join(workingDir, 'src/app/page.module.css')
    ];
    
    // Also look for component-specific CSS files
    const componentBasename = path.basename(entryFile, path.extname(entryFile));
    const componentDirname = path.dirname(entryFile);
    const componentSpecificCss = [
      path.join(componentDirname, `${componentBasename}.css`),
      path.join(componentDirname, `${componentBasename}.module.css`),
      path.join(componentDirname, `${componentBasename}.scss`),
      path.join(componentDirname, `${componentBasename}.module.scss`),
      path.join(componentDirname, 'styles.css'),
      path.join(componentDirname, 'index.css')
    ];
    
    possibleCssFiles.push(...componentSpecificCss);
    
    for (const cssFile of possibleCssFiles) {
      if (fs.existsSync(cssFile)) {
        console.log(`🎨 Found styles: ${cssFile}`);
        const cssContent = fs.readFileSync(cssFile, 'utf8');
        // Remove @import statements for processing (esbuild will handle them)
        const processedCss = cssContent.replace(/@import\s+[^;]+;/g, '');
        globalStyles += processedCss + '\n';
      }
    }
    
    // Bundle with esbuild with enhanced CSS handling
    const bundleResult = await esbuild.build({
      entryPoints: [tempWrapperPath],
      bundle: true,
      write: false, // Don't write to file, return result in memory
      format: 'iife',
      platform: 'browser',
      loader: { 
        '.js': 'jsx', 
        '.jsx': 'jsx', 
        '.ts': 'tsx', 
        '.tsx': 'tsx', 
        '.css': 'css',
        '.scss': 'css',
        '.sass': 'css',
        '.less': 'css',
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.jpeg': 'dataurl',
        '.gif': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
        '.ttf': 'dataurl'
      },
      jsx: 'automatic',
      target: 'es2020',
      // Look for node_modules in the user's project
      nodePaths: [
        path.join(workingDir, 'node_modules'),
        path.join(process.cwd(), 'node_modules') // Fallback to current directory
      ],
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.sass', '.json'],
      define: {
        'process.env.NODE_ENV': '"development"',
        'global': 'globalThis'
      },
      external: [], // Bundle everything for standalone operation
      minify: false, // Keep readable for debugging
      sourcemap: false, // Disable sourcemap for inline approach
      metafile: true, // Generate metadata for debugging
      logLevel: 'info'
    });

    // Extract bundled JavaScript and CSS from output files
    let bundledJs = '';
    let bundledCss = '';
    
    console.log(`📦 esbuild output files: ${bundleResult.outputFiles.length}`);
    
    bundleResult.outputFiles.forEach((file, index) => {
      console.log(`📄 Output file ${index}: ${file.path}`);
      
      if (file.path.endsWith('.js')) {
        bundledJs = file.text;
        console.log(`✅ JavaScript bundle: ${(file.text.length / 1024).toFixed(1)} KB`);
      } else if (file.path.endsWith('.css')) {
        bundledCss = file.text;
        console.log(`🎨 CSS bundle: ${(file.text.length / 1024).toFixed(1)} KB`);
      }
    });
    
    // If no separate CSS file was generated, CSS might be inlined in JS
    if (!bundledCss && bundledJs.includes('style')) {
      console.log('ℹ️ CSS appears to be inlined in JavaScript bundle');
    }
    
    // Additional check: if no bundled JS found, use the first output file
    if (!bundledJs && bundleResult.outputFiles.length > 0) {
      bundledJs = bundleResult.outputFiles[0].text;
      console.log(`✅ Using first output file as JavaScript bundle: ${(bundledJs.length / 1024).toFixed(1)} KB`);
    }
    
    // Combine all CSS sources
    const allStyles = `
      /* Global styles from discovered files */
      ${globalStyles}
      
      /* CSS extracted from esbuild bundle */
      ${bundledCss}
      
      /* Essential utility classes for common UI patterns */
      .max-w-md { max-width: 28rem; }
      .max-w-lg { max-width: 32rem; }
      .max-w-xl { max-width: 36rem; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      .mt-10 { margin-top: 2.5rem; }
      .mt-8 { margin-top: 2rem; }
      .mt-6 { margin-top: 1.5rem; }
      .mt-4 { margin-top: 1rem; }
      .mt-2 { margin-top: 0.5rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .mr-2 { margin-right: 0.5rem; }
      .ml-2 { margin-left: 0.5rem; }
      .p-6 { padding: 1.5rem; }
      .p-4 { padding: 1rem; }
      .p-2 { padding: 0.5rem; }
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .text-2xl { font-size: 1.5rem; line-height: 2rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-base { font-size: 1rem; line-height: 1.5rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
      .font-medium { font-weight: 500; }
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-md { border-radius: 0.375rem; }
      .rounded { border-radius: 0.25rem; }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
      .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
      .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
      .flex { display: flex; }
      .inline-flex { display: inline-flex; }
      .flex-col { flex-direction: column; }
      .flex-row { flex-direction: row; }
      .flex-1 { flex: 1 1 0%; }
      .flex-shrink-0 { flex-shrink: 0; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .items-end { align-items: flex-end; }
      .justify-center { justify-content: center; }
      .justify-between { justify-content: space-between; }
      .justify-start { justify-content: flex-start; }
      .justify-end { justify-content: flex-end; }
      .gap-4 { gap: 1rem; }
      .gap-3 { gap: 0.75rem; }
      .gap-2 { gap: 0.5rem; }
      .gap-1 { gap: 0.25rem; }
      .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }
      .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
      .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
      .border { border-width: 1px; border-style: solid; border-color: #d1d5db; }
      .border-2 { border-width: 2px; }
      .border-gray-300 { border-color: #d1d5db; }
      .border-gray-200 { border-color: #e5e7eb; }
      .border-blue-500 { border-color: #3b82f6; }
      .bg-white { background-color: #ffffff; }
      .bg-gray-50 { background-color: #f9fafb; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-blue-500 { background-color: #3b82f6; }
      .bg-blue-600 { background-color: #2563eb; }
      .bg-red-500 { background-color: #ef4444; }
      .bg-red-600 { background-color: #dc2626; }
      .bg-green-500 { background-color: #10b981; }
      .bg-green-600 { background-color: #059669; }
      .text-white { color: #ffffff; }
      .text-black { color: #000000; }
      .text-gray-900 { color: #111827; }
      .text-gray-800 { color: #1f2937; }
      .text-gray-700 { color: #374151; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-500 { color: #6b7280; }
      .text-blue-600 { color: #2563eb; }
      .text-red-600 { color: #dc2626; }
      .text-green-600 { color: #059669; }
      .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px var(--focus-ring, #3b82f6); }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px #3b82f6; }
      .focus\\:border-blue-500:focus { border-color: #3b82f6; }
      .hover\\:bg-blue-600:hover { background-color: #2563eb; }
      .hover\\:bg-red-600:hover { background-color: #dc2626; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb; }
      .hover\\:opacity-90:hover { opacity: 0.9; }
      .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
      .active\\:bg-blue-700:active { background-color: #1d4ed8; }
      .disabled\\:opacity-50:disabled { opacity: 0.5; }
      .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed; }
      .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .transition-colors { transition-property: color, background-color, border-color; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .transition-opacity { transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .duration-200 { transition-duration: 200ms; }
      .ease-in-out { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
      .cursor-pointer { cursor: pointer; }
      .cursor-not-allowed { cursor: not-allowed; }
      .select-none { user-select: none; }
      .overflow-hidden { overflow: hidden; }
      .overflow-auto { overflow: auto; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .w-full { width: 100%; }
      .w-auto { width: auto; }
      .h-full { height: 100%; }
      .h-auto { height: auto; }
      .min-h-screen { min-height: 100vh; }
      .object-cover { object-fit: cover; }
      .object-contain { object-fit: contain; }
      .relative { position: relative; }
      .absolute { position: absolute; }
      .fixed { position: fixed; }
      .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
      .top-0 { top: 0; }
      .right-0 { right: 0; }
      .bottom-0 { bottom: 0; }
      .left-0 { left: 0; }
      .z-10 { z-index: 10; }
      .z-20 { z-index: 20; }
      .z-50 { z-index: 50; }
      .opacity-0 { opacity: 0; }
      .opacity-50 { opacity: 0.5; }
      .opacity-75 { opacity: 0.75; }
      .opacity-100 { opacity: 1; }
      .visible { visibility: visible; }
      .invisible { visibility: hidden; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .not-sr-only { position: static; width: auto; height: auto; padding: 0; margin: 0; overflow: visible; clip: auto; white-space: normal; }
      
      /* Component preview base styles */
      body { 
        margin: 0; 
        padding: 20px;
        background: var(--background, #f8f8f8); 
        color: var(--foreground, #333);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif);
        line-height: 1.6;
      }
      #root {
        background: transparent;
        border-radius: 8px;
        padding: 0;
        box-shadow: none;
        min-height: 100px;
      }
      .debug-info {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        max-width: 300px;
        z-index: 1000;
      }
    `;
    
    // Enhanced HTML wrapper with comprehensive CSS and inlined JavaScript
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${componentName} Preview</title>
    <style>
      ${allStyles}
    </style>
  </head>
  <body>
    <div id="root">Loading component...</div>
    <div class="debug-info" id="debug">
      Initializing...
    </div>
    
    <script>
      // Debug logging
      console.log('🌐 HTML loaded with inlined bundle');
      console.log('🎨 CSS sources loaded: Global files, esbuild bundle, utility classes');
      
      // Update debug info
      const debugEl = document.getElementById('debug');
      if (debugEl) {
        debugEl.innerHTML = \`
          Component: ${componentName}<br/>
          Status: Running inlined bundle...<br/>
          CSS: ${bundledCss ? 'Bundle + Global + Utils' : 'Global + Utils'}<br/>
          Time: \${new Date().toLocaleTimeString()}
        \`;
      }
      
      // Execute the bundled component code
      try {
        ${bundledJs}
        
        // Update debug info on success
        if (debugEl) {
          debugEl.innerHTML = \`
            Component: ${componentName}<br/>
            Status: <span style="color: #4ade80;">Bundle executed successfully</span><br/>
            CSS: ${bundledCss ? 'Bundle + Global + Utils' : 'Global + Utils'}<br/>
            Time: \${new Date().toLocaleTimeString()}
          \`;
        }
      } catch (error) {
        console.error('❌ Bundle execution failed:', error);
        document.getElementById('root').innerHTML = '<div style="color: red; padding: 20px;">Bundle execution failed: ' + error.message + '</div>';
        
        if (debugEl) {
          debugEl.innerHTML = \`
            Component: ${componentName}<br/>
            Status: <span style="color: red;">Bundle execution failed</span><br/>
            Error: \${error.message}<br/>
            Time: \${new Date().toLocaleTimeString()}
          \`;
        }
      }
    </script>
  </body>
</html>`;

    fs.writeFileSync(path.join(outDir, 'index.html'), html);

    // Clean up temp file
    fs.unlinkSync(tempWrapperPath);

    console.log(`✅ Bundle created successfully with comprehensive CSS support!`);
    console.log(`📄 HTML: ${path.join(outDir, 'index.html')}`);
    console.log(`📦 JavaScript bundle: ${(bundledJs.length / 1024).toFixed(1)} KB`);
    console.log(`🎨 CSS bundle: ${bundledCss ? (bundledCss.length / 1024).toFixed(1) + ' KB' : 'Inlined in JS'}`);
    console.log(`📊 Global CSS: ${(globalStyles.length / 1024).toFixed(1)} KB`);
    
    // Check total HTML size
    const htmlStats = fs.statSync(path.join(outDir, 'index.html'));
    console.log(`📊 Total HTML size: ${(htmlStats.size / 1024).toFixed(1)} KB`);

  } catch (error) {
    console.error('❌ Bundling failed:', error);
    
    // Try to clean up temp file on error
    const tempWrapperPath = path.join(outDir, 'temp_wrapper.tsx');
    if (fs.existsSync(tempWrapperPath)) {
      fs.unlinkSync(tempWrapperPath);
    }
    
    throw error;
  } finally {
    // Restore the original working directory
    try {
      process.chdir(originalCwd);
    } catch (chdirError) {
      console.warn('⚠️ Failed to restore working directory:', chdirError);
    }
  }
}

// CLI usage
if (require.main === module) {
  const [,, entryFile, outDir, componentName] = process.argv;
  
  if (!entryFile || !outDir) {
    console.error('Usage: node bundleComponent.js <entryFile> <outDir> [componentName]');
    process.exit(1);
  }
  
  bundleComponent(entryFile, outDir, componentName)
    .then(() => {
      console.log('🎉 Component bundling completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Component bundling failed:', error.message);
      process.exit(1);
    });
}

module.exports = bundleComponent; 