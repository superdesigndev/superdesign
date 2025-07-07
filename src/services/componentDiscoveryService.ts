import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

interface ComponentInfo {
    name: string;
    path: string;
    relativePath: string;
    hasDefaultExport: boolean;
    hasNamedExports: string[];
    requiresProps: boolean;
    usesHooks: boolean;
    hasStories: boolean; // Storybook files
    projectType: 'next' | 'vite' | 'cra' | 'unknown';
}

export class ComponentDiscoveryService {
    private workspaceRoot: string;
    private projectType: 'next' | 'vite' | 'cra' | 'unknown' = 'unknown';

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.detectProjectType();
    }

    private detectProjectType(): void {
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                if (deps.next) {
                    this.projectType = 'next';
                } else if (deps.vite || deps['@vitejs/plugin-react']) {
                    this.projectType = 'vite';
                } else if (deps['react-scripts']) {
                    this.projectType = 'cra';
                }
            } catch (error) {
                Logger.warn('Failed to parse package.json for project type detection');
            }
        }
    }

    async discoverComponents(): Promise<ComponentInfo[]> {
        const components: ComponentInfo[] = [];
        const searchDirs = this.getSearchDirectories();

        for (const dir of searchDirs) {
            if (fs.existsSync(dir)) {
                await this.scanDirectory(dir, components);
            }
        }

        return this.filterValidComponents(components);
    }

    private getSearchDirectories(): string[] {
        const baseDirs = [
            path.join(this.workspaceRoot, 'src'),
            path.join(this.workspaceRoot, 'components'),
            path.join(this.workspaceRoot, 'lib', 'components'),
        ];

        // Project-specific directories
        switch (this.projectType) {
            case 'next':
                baseDirs.push(
                    path.join(this.workspaceRoot, 'app'),
                    path.join(this.workspaceRoot, 'pages'),
                    path.join(this.workspaceRoot, 'components')
                );
                break;
            case 'vite':
                baseDirs.push(
                    path.join(this.workspaceRoot, 'src', 'components'),
                    path.join(this.workspaceRoot, 'src', 'pages'),
                    path.join(this.workspaceRoot, 'src', 'views')
                );
                break;
            case 'cra':
                baseDirs.push(
                    path.join(this.workspaceRoot, 'src', 'components'),
                    path.join(this.workspaceRoot, 'src', 'pages')
                );
                break;
        }

        return baseDirs.filter(dir => fs.existsSync(dir));
    }

    private async scanDirectory(dir: string, components: ComponentInfo[]): Promise<void> {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Skip common non-component directories
                if (!['node_modules', '.git', 'dist', 'build', '__tests__', 'test'].includes(item)) {
                    await this.scanDirectory(fullPath, components);
                }
            } else if (this.isComponentFile(fullPath)) {
                const componentInfo = await this.analyzeComponentFile(fullPath);
                if (componentInfo) {
                    components.push(componentInfo);
                }
            }
        }
    }

    private isComponentFile(filePath: string): boolean {
        const ext = path.extname(filePath);
        const name = path.basename(filePath, ext);
        
        // Check extension
        if (!['.tsx', '.jsx'].includes(ext)) {
            return false;
        }

        // Skip test files, stories, and config files
        const skipPatterns = [
            /\.test\./,
            /\.spec\./,
            /\.stories\./,
            /\.config\./,
            /index\.(tsx|jsx)$/ // Usually re-exports
        ];

        return !skipPatterns.some(pattern => pattern.test(filePath));
    }

    private async analyzeComponentFile(filePath: string): Promise<ComponentInfo | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(this.workspaceRoot, filePath);
            const name = path.basename(filePath, path.extname(filePath));

            // Basic React component detection
            if (!this.looksLikeReactComponent(content)) {
                return null;
            }

            return {
                name,
                path: filePath,
                relativePath,
                hasDefaultExport: this.hasDefaultExport(content),
                hasNamedExports: this.getNamedExports(content),
                requiresProps: this.requiresProps(content),
                usesHooks: this.usesReactHooks(content),
                hasStories: this.hasStorybookStories(filePath),
                projectType: this.projectType
            };
        } catch (error) {
            Logger.warn(`Failed to analyze component file ${filePath}: ${error}`);
            return null;
        }
    }

    private looksLikeReactComponent(content: string): boolean {
        // Look for React imports and JSX/TSX patterns
        const reactPatterns = [
            /import\s+.*\s+from\s+['"]react['"]/,
            /import\s+React/,
            /<[A-Z][a-zA-Z0-9]*/, // JSX elements
            /React\.FC/,
            /function\s+[A-Z][a-zA-Z0-9]*.*\{[\s\S]*return[\s\S]*</
        ];

        return reactPatterns.some(pattern => pattern.test(content));
    }

    private hasDefaultExport(content: string): boolean {
        return /export\s+default/.test(content);
    }

    private getNamedExports(content: string): string[] {
        const exports: string[] = [];
        const namedExportRegex = /export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
        let match;

        while ((match = namedExportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        return exports;
    }

    private requiresProps(content: string): boolean {
        // Look for interface/type definitions that suggest required props
        const propsPatterns = [
            /interface\s+\w+Props\s*\{[\s\S]*?\}/,
            /type\s+\w+Props\s*=\s*\{[\s\S]*?\}/,
            /\(\s*\{\s*\w+.*\}\s*:\s*\w+Props\s*\)/,
            /\(\s*props\s*:\s*\w+/
        ];

        return propsPatterns.some(pattern => pattern.test(content));
    }

    private usesReactHooks(content: string): boolean {
        const hookPatterns = [
            /use[A-Z][a-zA-Z0-9]*/,
            /React\.use[A-Z]/
        ];

        return hookPatterns.some(pattern => pattern.test(content));
    }

    private hasStorybookStories(filePath: string): boolean {
        const dir = path.dirname(filePath);
        const name = path.basename(filePath, path.extname(filePath));
        const storyPatterns = [
            path.join(dir, `${name}.stories.tsx`),
            path.join(dir, `${name}.stories.jsx`),
            path.join(dir, `${name}.stories.ts`),
            path.join(dir, `${name}.stories.js`)
        ];

        return storyPatterns.some(storyPath => fs.existsSync(storyPath));
    }

    private filterValidComponents(components: ComponentInfo[]): ComponentInfo[] {
        return components.filter(component => {
            // Prioritize components with default exports
            if (!component.hasDefaultExport && component.hasNamedExports.length === 0) {
                return false;
            }

            // Prefer components that don't require complex props
            // (Could be made configurable)
            return true;
        });
    }
} 