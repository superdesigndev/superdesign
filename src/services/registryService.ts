import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RegistryConfig, RegistryComponent, RegistryPage } from '../webview/types/canvas.types';

export class RegistryService {
    private static readonly REGISTRY_FILE_PATH = '.superdesign/registry.json';

    /**
     * Load component registry from the .superdesign/registry.json file
     * @param workspaceRoot The workspace root directory
     * @returns Promise<RegistryConfig> Registry configuration
     */
    public static async loadRegistry(workspaceRoot: string): Promise<RegistryConfig> {
        try {
            const registryFilePath = path.join(workspaceRoot, this.REGISTRY_FILE_PATH);
            
            // Check if the registry file exists
            if (!fs.existsSync(registryFilePath)) {
                console.log('Registry file not found at:', registryFilePath);
                return {
                    version: 1,
                    lastUpdated: new Date().toISOString(),
                    components: [],
                    pages: []
                };
            }

            // Read and parse the registry file
            const fileContent = fs.readFileSync(registryFilePath, 'utf8');
            const registryConfig: RegistryConfig = JSON.parse(fileContent);

            // Validate the structure
            if (!registryConfig.version || !Array.isArray(registryConfig.components) || !Array.isArray(registryConfig.pages)) {
                throw new Error('Invalid registry.json structure');
            }

            // Validate each component
            const validatedComponents = registryConfig.components.filter(component => {
                return this.validateComponent(component);
            });

            // Validate each page
            const validatedPages = registryConfig.pages.filter(page => {
                return this.validatePage(page);
            });

            console.log(`Loaded ${validatedComponents.length} components and ${validatedPages.length} pages from ${registryFilePath}`);
            
            return {
                ...registryConfig,
                components: validatedComponents,
                pages: validatedPages
            };

        } catch (error) {
            console.error('Error loading registry:', error);
            vscode.window.showErrorMessage(`Failed to load registry: ${error instanceof Error ? error.message : String(error)}`);
            return {
                version: 1,
                lastUpdated: new Date().toISOString(),
                components: [],
                pages: []
            };
        }
    }

    /**
     * Validate a component object to ensure it has all required fields
     * @param component The component object to validate
     * @returns boolean Whether the component is valid
     */
    private static validateComponent(component: any): component is RegistryComponent {
        try {
            // Check required fields
            if (!component.name || typeof component.name !== 'string') {
                console.warn('Component missing or invalid name:', component);
                return false;
            }

            if (!component.filePath || typeof component.filePath !== 'string') {
                console.warn('Component missing or invalid filePath:', component);
                return false;
            }

            if (!component.type || !['provider', 'ui', 'layout'].includes(component.type)) {
                console.warn('Component missing or invalid type:', component);
                return false;
            }

            if (!component.route || typeof component.route !== 'string') {
                console.warn('Component missing or invalid route:', component);
                return false;
            }

            if (typeof component.exported !== 'boolean') {
                console.warn('Component missing or invalid exported field:', component);
                return false;
            }

            if (!Array.isArray(component.props)) {
                console.warn('Component missing or invalid props array:', component);
                return false;
            }

            if (!component.propTypes || typeof component.propTypes !== 'object') {
                console.warn('Component missing or invalid propTypes object:', component);
                return false;
            }

            if (!component.description || typeof component.description !== 'string') {
                console.warn('Component missing or invalid description:', component);
                return false;
            }

            if (!component.group || typeof component.group !== 'string') {
                console.warn('Component missing or invalid group:', component);
                return false;
            }

            if (!component.createdAt || typeof component.createdAt !== 'string') {
                console.warn('Component missing or invalid createdAt:', component);
                return false;
            }

            if (!component.createdBy || typeof component.createdBy !== 'string') {
                console.warn('Component missing or invalid createdBy:', component);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating component:', error);
            return false;
        }
    }

    /**
     * Validate a page object to ensure it has all required fields
     * @param page The page object to validate
     * @returns boolean Whether the page is valid
     */
    private static validatePage(page: any): page is RegistryPage {
        try {
            // Check required fields
            if (!page.name || typeof page.name !== 'string') {
                console.warn('Page missing or invalid name:', page);
                return false;
            }

            if (!page.filePath || typeof page.filePath !== 'string') {
                console.warn('Page missing or invalid filePath:', page);
                return false;
            }

            if (!page.route || typeof page.route !== 'string') {
                console.warn('Page missing or invalid route:', page);
                return false;
            }

            if (typeof page.exported !== 'boolean') {
                console.warn('Page missing or invalid exported field:', page);
                return false;
            }

            if (!page.description || typeof page.description !== 'string') {
                console.warn('Page missing or invalid description:', page);
                return false;
            }

            if (!page.group || typeof page.group !== 'string') {
                console.warn('Page missing or invalid group:', page);
                return false;
            }

            if (!page.createdAt || typeof page.createdAt !== 'string') {
                console.warn('Page missing or invalid createdAt:', page);
                return false;
            }

            if (!page.createdBy || typeof page.createdBy !== 'string') {
                console.warn('Page missing or invalid createdBy:', page);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating page:', error);
            return false;
        }
    }

    /**
     * Create a default registry.json file if it doesn't exist
     * @param workspaceRoot The workspace root directory
     */
    public static async createDefaultRegistryFile(workspaceRoot: string): Promise<void> {
        const registryFilePath = path.join(workspaceRoot, this.REGISTRY_FILE_PATH);
        
        // Check if registry file already exists
        if (fs.existsSync(registryFilePath)) {
            return;
        }

        // Ensure the .superdesign directory exists
        const superdesignDir = path.join(workspaceRoot, '.superdesign');
        if (!fs.existsSync(superdesignDir)) {
            fs.mkdirSync(superdesignDir, { recursive: true });
        }

        // Create a default registry file
        const defaultRegistry: RegistryConfig = {
            version: 1,
            lastUpdated: new Date().toISOString(),
            components: [],
            pages: []
        };

        try {
            fs.writeFileSync(registryFilePath, JSON.stringify(defaultRegistry, null, 2));
            console.log('Created default registry.json at:', registryFilePath);
        } catch (error) {
            console.error('Error creating default registry.json:', error);
        }
    }

    /**
     * Watch for changes to the registry.json file and return updated registry
     * @param workspaceRoot The workspace root directory
     * @returns Promise<RegistryConfig> Updated registry configuration
     */
    public static async watchRegistry(workspaceRoot: string): Promise<RegistryConfig> {
        // For now, just reload the registry
        // In the future, we could implement actual file watching
        return await this.loadRegistry(workspaceRoot);
    }
} 