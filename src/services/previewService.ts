import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Preview, PreviewConfig } from '../webview/types/canvas.types';

export class PreviewService {
    private static readonly PREVIEWS_FILE_PATH = '.superdesign/previews.json';

    /**
     * Load previews from the .superdesign/previews.json file
     * @param workspaceRoot The workspace root directory
     * @returns Promise<Preview[]> Array of preview configurations
     */
    public static async loadPreviews(workspaceRoot: string): Promise<Preview[]> {
        try {
            const previewsFilePath = path.join(workspaceRoot, this.PREVIEWS_FILE_PATH);
            
            // Check if the previews file exists
            if (!fs.existsSync(previewsFilePath)) {
                console.log('Previews file not found at:', previewsFilePath);
                return [];
            }

            // Read and parse the previews file
            const fileContent = fs.readFileSync(previewsFilePath, 'utf8');
            const previewConfig: PreviewConfig = JSON.parse(fileContent);

            // Validate the structure
            if (!previewConfig.version || !Array.isArray(previewConfig.previews)) {
                throw new Error('Invalid previews.json structure');
            }

            // Validate each preview
            const validatedPreviews = previewConfig.previews.filter(preview => {
                return this.validatePreview(preview);
            });

            console.log(`Loaded ${validatedPreviews.length} valid previews from ${previewsFilePath}`);
            return validatedPreviews;

        } catch (error) {
            console.error('Error loading previews:', error);
            vscode.window.showErrorMessage(`Failed to load previews: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    /**
     * Validate a preview object to ensure it has all required fields
     * @param preview The preview object to validate
     * @returns boolean Whether the preview is valid
     */
    private static validatePreview(preview: any): preview is Preview {
        try {
            // Check required fields
            if (!preview.id || typeof preview.id !== 'string') {
                console.warn('Preview missing or invalid id:', preview);
                return false;
            }

            if (!preview.type || !['component', 'page'].includes(preview.type)) {
                console.warn('Preview missing or invalid type:', preview);
                return false;
            }

            if (!preview.route || typeof preview.route !== 'string') {
                console.warn('Preview missing or invalid route:', preview);
                return false;
            }

            if (typeof preview.description !== 'string') {
                console.warn('Preview missing or invalid description:', preview);
                return false;
            }

            if (typeof preview.group !== 'string') {
                console.warn('Preview missing or invalid group:', preview);
                return false;
            }

            if (typeof preview.createdBy !== 'string') {
                console.warn('Preview missing or invalid createdBy:', preview);
                return false;
            }

            // Validate type-specific fields
            if (preview.type === 'component' && (!preview.component || typeof preview.component !== 'string')) {
                console.warn('Component preview missing or invalid component field:', preview);
                return false;
            }

            if (preview.type === 'page' && (!preview.page || typeof preview.page !== 'string')) {
                console.warn('Page preview missing or invalid page field:', preview);
                return false;
            }

            // Validate props (should be an object)
            if (!preview.props || typeof preview.props !== 'object' || Array.isArray(preview.props)) {
                console.warn('Preview missing or invalid props (should be object):', preview);
                return false;
            }

            // parentId can be null or string
            if (preview.parentId !== null && typeof preview.parentId !== 'string') {
                console.warn('Preview invalid parentId (should be null or string):', preview);
                return false;
            }

            return true;
        } catch (error) {
            console.warn('Error validating preview:', error, preview);
            return false;
        }
    }

    /**
     * Create a default previews.json file if it doesn't exist
     * @param workspaceRoot The workspace root directory
     * @returns Promise<boolean> Whether the file was created successfully
     */
    public static async createDefaultPreviewsFile(workspaceRoot: string): Promise<boolean> {
        try {
            const previewsFilePath = path.join(workspaceRoot, this.PREVIEWS_FILE_PATH);
            const superdesignDir = path.dirname(previewsFilePath);

            // Create .superdesign directory if it doesn't exist
            if (!fs.existsSync(superdesignDir)) {
                fs.mkdirSync(superdesignDir, { recursive: true });
            }

            // Don't overwrite existing file
            if (fs.existsSync(previewsFilePath)) {
                return true;
            }

            // Create default previews configuration
            const defaultConfig: PreviewConfig = {
                version: 1,
                previews: []
            };

            fs.writeFileSync(previewsFilePath, JSON.stringify(defaultConfig, null, 2));
            console.log('Created default previews.json at:', previewsFilePath);
            return true;

        } catch (error) {
            console.error('Error creating default previews file:', error);
            vscode.window.showErrorMessage(`Failed to create previews file: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Delete a preview from the previews.json file
     * @param workspaceRoot The workspace root directory
     * @param previewId The ID of the preview to delete
     * @returns Promise<Preview[]> Updated array of preview configurations
     */
    public static async deletePreview(workspaceRoot: string, previewId: string): Promise<Preview[]> {
        try {
            const previewsFilePath = path.join(workspaceRoot, this.PREVIEWS_FILE_PATH);
            
            // Check if the previews file exists
            if (!fs.existsSync(previewsFilePath)) {
                console.log('Previews file not found at:', previewsFilePath);
                return [];
            }

            // Read and parse the current previews file
            const fileContent = fs.readFileSync(previewsFilePath, 'utf8');
            const previewConfig: PreviewConfig = JSON.parse(fileContent);

            // Validate the structure
            if (!previewConfig.version || !Array.isArray(previewConfig.previews)) {
                throw new Error('Invalid previews.json structure');
            }

            // Filter out the preview to delete
            const originalCount = previewConfig.previews.length;
            const updatedPreviews = previewConfig.previews.filter(preview => preview.id !== previewId);
            
            // Check if preview was found and removed
            if (updatedPreviews.length === originalCount) {
                throw new Error(`Preview with ID "${previewId}" not found`);
            }

            // Update the config with filtered previews
            const updatedConfig: PreviewConfig = {
                ...previewConfig,
                previews: updatedPreviews
            };

            // Write the updated config back to the file
            fs.writeFileSync(previewsFilePath, JSON.stringify(updatedConfig, null, 2));
            
            console.log(`Deleted preview "${previewId}" from ${previewsFilePath}`);
            vscode.window.showInformationMessage(`Preview "${previewId}" deleted successfully`);
            
            // Return updated previews (re-validate to be safe)
            return updatedPreviews.filter(preview => this.validatePreview(preview));

        } catch (error) {
            console.error('Error deleting preview:', error);
            vscode.window.showErrorMessage(`Failed to delete preview: ${error instanceof Error ? error.message : String(error)}`);
            // Return current previews on error
            return await this.loadPreviews(workspaceRoot);
        }
    }

    /**
     * Watch for changes to the previews.json file
     * @param workspaceRoot The workspace root directory
     * @param onChangeCallback Callback function to call when the file changes
     * @returns vscode.FileSystemWatcher The file watcher
     */
    public static watchPreviewsFile(
        workspaceRoot: string, 
        onChangeCallback: (previews: Preview[]) => void
    ): vscode.FileSystemWatcher {
        const previewsPattern = new vscode.RelativePattern(workspaceRoot, this.PREVIEWS_FILE_PATH);
        const watcher = vscode.workspace.createFileSystemWatcher(previewsPattern);

        const handleChange = async () => {
            const previews = await this.loadPreviews(workspaceRoot);
            onChangeCallback(previews);
        };

        watcher.onDidCreate(handleChange);
        watcher.onDidChange(handleChange);
        watcher.onDidDelete(() => onChangeCallback([]));

        return watcher;
    }
} 