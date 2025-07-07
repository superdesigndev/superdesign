import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

interface BundleOptions {
    componentPath: string;
    outputDir: string;
    componentName?: string;
    propsExample?: any;
    wrapWithProviders?: string[];
    mockData?: { [key: string]: any };
    includeStorybook?: boolean;
}

interface ComponentAnalysis {
    hasDefaultExport: boolean;
    namedExports: string[];
    usesRouter: boolean;
    usesTheme: boolean;
    usesContext: string[];
    requiredProps: string[];
    optionalProps: string[];
}

export class EnhancedBundleService {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async bundleComponent(options: BundleOptions): Promise<void> {
        const analysis = await this.analyzeComponent(options.componentPath);
        const wrapperContent = this.generateSmartWrapper(options, analysis);
        
        const tempWrapperPath = path.join(options.outputDir, 'temp_wrapper.tsx');
        fs.mkdirSync(options.outputDir, { recursive: true });
        fs.writeFileSync(tempWrapperPath, wrapperContent);

        try {
            const bundleResult = await this.buildWithEsbuild(tempWrapperPath, options);
            const html = this.generateHTML(bundleResult, options, analysis);
            
            fs.writeFileSync(path.join(options.outputDir, 'index.html'), html);
            Logger.info(`Component bundled successfully: ${options.componentPath}`);
        } finally {
            if (fs.existsSync(tempWrapperPath)) {
                fs.unlinkSync(tempWrapperPath);
            }
        }
    }

    private async analyzeComponent(componentPath: string): Promise<ComponentAnalysis> {
        const content = fs.readFileSync(componentPath, 'utf8');
        
        return {
            hasDefaultExport: /export\s+default/.test(content),
            namedExports: this.extractNamedExports(content),
            usesRouter: /useRouter|useNavigate|Router|BrowserRouter/.test(content),
            usesTheme: /useTheme|ThemeProvider|styled/.test(content),
            usesContext: this.extractContextUsage(content),
            requiredProps: this.extractRequiredProps(content),
            optionalProps: this.extractOptionalProps(content)
        };
    }

    private extractNamedExports(content: string): string[] {
        const exports: string[] = [];
        const regex = /export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            exports.push(match[1]);
        }
        return exports;
    }

    private extractContextUsage(content: string): string[] {
        const contexts: string[] = [];
        const contextRegex = /use(?:Context|State)\(([A-Za-z_$][A-Za-z0-9_$]*Context)\)/g;
        let match;
        while ((match = contextRegex.exec(content)) !== null) {
            contexts.push(match[1]);
        }
        return contexts;
    }

    private extractRequiredProps(content: string): string[] {
        // Extract props from interface/type definitions
        const propsInterfaceMatch = content.match(/interface\s+\w*Props\s*\{([^}]*)\}/s);
        if (!propsInterfaceMatch) return [];
        
        const propsContent = propsInterfaceMatch[1];
        const required: string[] = [];
        
        // Look for properties without ? modifier
        const propRegex = /(\w+)(?!\?)\s*:/g;
        let match;
        while ((match = propRegex.exec(propsContent)) !== null) {
            required.push(match[1]);
        }
        
        return required;
    }

    private extractOptionalProps(content: string): string[] {
        const propsInterfaceMatch = content.match(/interface\s+\w*Props\s*\{([^}]*)\}/s);
        if (!propsInterfaceMatch) return [];
        
        const propsContent = propsInterfaceMatch[1];
        const optional: string[] = [];
        
        // Look for properties with ? modifier
        const propRegex = /(\w+)\?\s*:/g;
        let match;
        while ((match = propRegex.exec(propsContent)) !== null) {
            optional.push(match[1]);
        }
        
        return optional;
    }

    private generateSmartWrapper(options: BundleOptions, analysis: ComponentAnalysis): string {
        const componentImport = this.generateComponentImport(options.componentPath, analysis);
        const providersWrapper = this.generateProvidersWrapper(analysis, options.wrapWithProviders);
        const propsGeneration = this.generatePropsExample(analysis, options.propsExample);
        
        return `
import React from 'react';
import { createRoot } from 'react-dom/client';
${this.generateAdditionalImports(analysis)}

${componentImport}

${providersWrapper}

const PropsExample = ${propsGeneration};

function App() {
    return (
        <ProvidersWrapper>
            <div style={{ padding: '20px', minHeight: '100vh' }}>
                <ComponentToRender {...PropsExample} />
            </div>
        </ProvidersWrapper>
    );
}

const container = document.getElementById('root');
if (container) {
    try {
        const root = createRoot(container);
        root.render(<App />);
        console.log('✅ Component rendered successfully');
    } catch (error) {
        console.error('❌ Render error:', error);
        container.innerHTML = \`
            <div style="padding: 20px; color: red; font-family: monospace;">
                <h3>Component Render Error</h3>
                <pre>\${error.toString()}</pre>
                <p><strong>Required props:</strong> ${analysis.requiredProps.join(', ') || 'None'}</p>
                <p><strong>Optional props:</strong> ${analysis.optionalProps.join(', ') || 'None'}</p>
            </div>
        \`;
    }
} else {
    console.error('❌ Root container not found');
}
        `;
    }

    private generateComponentImport(componentPath: string, analysis: ComponentAnalysis): string {
        const relativePath = path.relative(path.dirname(path.join(this.workspaceRoot, 'temp_wrapper.tsx')), componentPath).replace(/\\/g, '/');
        
        if (analysis.hasDefaultExport) {
            return `import ComponentToRender from '${relativePath}';`;
        } else if (analysis.namedExports.length > 0) {
            // Use the first named export that looks like a component
            const componentExport = analysis.namedExports.find(exp => /^[A-Z]/.test(exp)) || analysis.namedExports[0];
            return `import { ${componentExport} as ComponentToRender } from '${relativePath}';`;
        } else {
            return `import * as ComponentModule from '${relativePath}';
const ComponentToRender = ComponentModule.default || ComponentModule;`;
        }
    }

    private generateAdditionalImports(analysis: ComponentAnalysis): string {
        const imports: string[] = [];
        
        if (analysis.usesRouter) {
            imports.push(`import { BrowserRouter } from 'react-router-dom';`);
        }
        
        if (analysis.usesTheme) {
            imports.push(`// Add your theme provider imports here`);
        }
        
        return imports.join('\n');
    }

    private generateProvidersWrapper(analysis: ComponentAnalysis, customProviders?: string[]): string {
        const providers: string[] = [];
        
        if (analysis.usesRouter) {
            providers.push('BrowserRouter');
        }
        
        if (customProviders) {
            providers.push(...customProviders);
        }
        
        if (providers.length === 0) {
            return `const ProvidersWrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>;`;
        }
        
        const wrappedProviders = providers.reduce((acc, provider) => {
            return `<${provider}>${acc}</${provider}>`;
        }, '{children}');
        
        return `const ProvidersWrapper = ({ children }: { children: React.ReactNode }) => ${wrappedProviders};`;
    }

    private generatePropsExample(analysis: ComponentAnalysis, customProps?: any): string {
        if (customProps) {
            return JSON.stringify(customProps, null, 2);
        }
        
        // Generate reasonable defaults based on prop analysis
        const exampleProps: any = {};
        
        for (const prop of analysis.requiredProps) {
            switch (prop.toLowerCase()) {
                case 'title':
                case 'label':
                case 'text':
                    exampleProps[prop] = 'Sample Text';
                    break;
                case 'onclick':
                case 'onchange':
                case 'onsubmit':
                    exampleProps[prop] = `() => console.log('${prop} triggered')`;
                    break;
                case 'children':
                    exampleProps[prop] = 'Sample Content';
                    break;
                case 'id':
                    exampleProps[prop] = 'sample-id';
                    break;
                case 'className':
                case 'class':
                    exampleProps[prop] = 'sample-class';
                    break;
                default:
                    exampleProps[prop] = `sample_${prop}`;
            }
        }
        
        return JSON.stringify(exampleProps, null, 2);
    }

    private async buildWithEsbuild(entryPath: string, options: BundleOptions): Promise<esbuild.BuildResult> {
        const workingDir = this.findPackageJsonDir(options.componentPath);
        const originalCwd = process.cwd();
        
        try {
            process.chdir(workingDir);
            
            return await esbuild.build({
                entryPoints: [entryPath],
                bundle: true,
                write: false,
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
                nodePaths: [
                    path.join(workingDir, 'node_modules'),
                    path.join(this.workspaceRoot, 'node_modules')
                ],
                resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
                define: {
                    'process.env.NODE_ENV': '"development"',
                    'global': 'globalThis'
                },
                external: [],
                minify: false,
                sourcemap: false,
                metafile: true,
                logLevel: 'info'
            });
        } finally {
            process.chdir(originalCwd);
        }
    }

    private findPackageJsonDir(startPath: string): string {
        let dir = path.dirname(startPath);
        while (dir !== path.dirname(dir)) {
            if (fs.existsSync(path.join(dir, 'package.json'))) {
                return dir;
            }
            dir = path.dirname(dir);
        }
        return this.workspaceRoot;
    }

    private generateHTML(buildResult: esbuild.BuildResult, options: BundleOptions, analysis: ComponentAnalysis): string {
        const bundledJs = buildResult.outputFiles?.[0]?.text || '';
        const globalStyles = this.extractGlobalStyles();
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.componentName || 'Component'} Preview</title>
    <style>
        ${globalStyles}
        
        /* Component preview styles */
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: #f8f9fa;
            color: #333;
        }
        
        #root {
            min-height: 100vh;
        }
        
        .component-info {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: monospace;
            max-width: 300px;
            z-index: 1000;
        }
        
        .component-info h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        
        .component-info ul {
            margin: 4px 0;
            padding-left: 16px;
        }
    </style>
</head>
<body>
    <div id="root">Loading component...</div>
    
    <div class="component-info">
        <h4>${options.componentName || 'Component'}</h4>
        <div>
            <strong>Export:</strong> ${analysis.hasDefaultExport ? 'Default' : 'Named'}
        </div>
        ${analysis.requiredProps.length > 0 ? `
        <div>
            <strong>Required Props:</strong>
            <ul>
                ${analysis.requiredProps.map(prop => `<li>${prop}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        ${analysis.usesRouter ? '<div><strong>Uses:</strong> React Router</div>' : ''}
        ${analysis.usesTheme ? '<div><strong>Uses:</strong> Theme Provider</div>' : ''}
    </div>
    
    <script>
        try {
            ${bundledJs}
        } catch (error) {
            console.error('❌ Bundle execution failed:', error);
            document.getElementById('root').innerHTML = 
                '<div style="padding: 20px; color: red;">Bundle execution failed: ' + error.message + '</div>';
        }
    </script>
</body>
</html>`;
    }

    private extractGlobalStyles(): string {
        // Try to find and include global styles from the project
        const possibleStyleFiles = [
            path.join(this.workspaceRoot, 'src/index.css'),
            path.join(this.workspaceRoot, 'src/App.css'),
            path.join(this.workspaceRoot, 'src/globals.css'),
            path.join(this.workspaceRoot, 'src/styles/globals.css'),
            path.join(this.workspaceRoot, 'public/globals.css')
        ];
        
        for (const styleFile of possibleStyleFiles) {
            if (fs.existsSync(styleFile)) {
                try {
                    return fs.readFileSync(styleFile, 'utf8');
                } catch (error) {
                    Logger.warn(`Failed to read style file ${styleFile}: ${error}`);
                }
            }
        }
        
        return '/* No global styles found */';
    }
} 