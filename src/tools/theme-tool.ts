import * as fs from 'fs';
import * as path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import type { ExecutionContext } from '../types/agent';
import {
    handleToolError,
    validateWorkspacePath,
    resolveWorkspacePath,
    createSuccessResponse,
    type ToolResponse,
} from './tool-utils';

const themePrompt = `Design a perfect theme that including color, font, spacing, shadown, etc.
`;

const cssSheetDescription = `The full css sheet content, has to include below classes:
:root selector - Must contain CSS custom properties
CSS custom properties format - --variable-name: value;
Semicolon-terminated - Each property must end with ;
--background, --foreground (basic colors)
--primary, --primary-foreground (brand colors)
--secondary, --muted, --accent (semantic colors)
--destructive, --border, --input, --ring (UI elements)
--card, --popover + their foreground variants
--chart-1 through --chart-5 (data visualization)
--sidebar-* variables for navigation
--font-sans, --font-serif, --font-mono
--radius, --spacing
--shadow-* variables (xs, sm, md, lg, xl, etc.)

You can add more relevant ones based on use cases, but make sure to include all the above classes.`;

export function createThemeTool(context: ExecutionContext) {
    return tool({
        description: themePrompt,
        inputSchema: z.object({
            theme_name: z.string().describe('The name of the theme'),
            reasoning_reference: z
                .string()
                .describe(
                    'Think through the theme design to make it coherent and what reference you used'
                ),
            cssSheet: z.string().describe(cssSheetDescription),
            cssFilePath: z
                .string()
                .describe(
                    'Path to the css file to write to (relative to workspace root, or absolute path within workspace)'
                ),
            create_dirs: z
                .boolean()
                .optional()
                .default(true)
                .describe(
                    "Whether to create parent directories if they don't exist (default: true)"
                ),
        }),
        execute: async ({
            cssSheet,
            theme_name,
            reasoning_reference,
            cssFilePath,
            create_dirs = true,
        }): Promise<ToolResponse> => {
            try {
                // Validate and resolve the CSS file path
                const validationError = validateWorkspacePath(cssFilePath, context);
                if (validationError) {
                    return validationError;
                }

                const resolvedPath = resolveWorkspacePath(cssFilePath, context);

                // Create parent directories if needed
                if (create_dirs) {
                    const dirPath = path.dirname(resolvedPath);
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                        context.outputChannel.appendLine(`[theme] Created directory: ${dirPath}`);
                    }
                }

                // Write the CSS content to file
                fs.writeFileSync(resolvedPath, cssSheet, 'utf8');

                context.outputChannel.appendLine(
                    `[theme] Successfully created theme "${theme_name}" at: ${resolvedPath}`
                );

                return createSuccessResponse({
                    success: true,
                    message: `Theme "${theme_name}" saved successfully`,
                    filePath: resolvedPath,
                    theme_name,
                    reasoning_reference,
                    cssSheet,
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                context.outputChannel.appendLine(`[theme] Theme creation failed: ${errorMessage}`);
                return handleToolError(error, 'Theme tool execution', 'execution');
            }
        },
    });
}
