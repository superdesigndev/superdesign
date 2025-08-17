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

/**
 * Write tool result with metadata
 */
export interface WriteToolResult {
    file_path: string;
    absolute_path: string;
    is_new_file: boolean;
    lines_written: number;
    bytes_written: number;
}

// Path validation is now handled by validateWorkspacePath in tool-utils

export function createWriteTool(context: ExecutionContext) {
    return tool({
        description:
            'Write content to a file in the workspace. Creates parent directories if needed.',
        inputSchema: z.object({
            file_path: z
                .string()
                .describe(
                    'Path to the file to write to (relative to workspace root, or absolute path within workspace)'
                ),
            content: z.string().describe('Content to write to the file'),
            create_dirs: z
                .boolean()
                .optional()
                .default(true)
                .describe(
                    "Whether to create parent directories if they don't exist (default: true)"
                ),
        }),
        execute: async ({ file_path, content, create_dirs = true }): Promise<ToolResponse> => {
            const startTime = Date.now();

            try {
                // Validate workspace path (handles both absolute and relative paths)
                const pathError = validateWorkspacePath(file_path, context);
                if (pathError) {
                    return pathError;
                }

                // Resolve absolute path within workspace
                const absolutePath = resolveWorkspacePath(file_path, context);

                context.outputChannel.appendLine(`[write] Writing to file: ${file_path}`);

                // Check if target is a directory
                if (fs.existsSync(absolutePath)) {
                    const stats = fs.lstatSync(absolutePath);
                    if (stats.isDirectory()) {
                        return handleToolError(
                            `Target path is a directory, not a file: ${file_path}`,
                            'Path validation',
                            'validation'
                        );
                    }
                }

                // Create parent directories if needed and requested
                if (create_dirs) {
                    const dirName = path.dirname(absolutePath);
                    if (!fs.existsSync(dirName)) {
                        fs.mkdirSync(dirName, { recursive: true });
                        context.outputChannel.appendLine(
                            `[write] Created parent directories for: ${file_path}`
                        );
                    }
                }

                // Determine if this is a new file or overwrite
                const isNewFile = !fs.existsSync(absolutePath);

                // Write the file
                fs.writeFileSync(absolutePath, content, 'utf8');

                const duration = Date.now() - startTime;
                const lines = content.split('\n').length;
                const size = Buffer.byteLength(content, 'utf8');

                context.outputChannel.appendLine(
                    `[write] ${isNewFile ? 'Created' : 'Updated'} file: ${file_path} (${lines} lines, ${size} bytes) in ${duration}ms`
                );

                const result: WriteToolResult = {
                    file_path,
                    absolute_path: absolutePath,
                    is_new_file: isNewFile,
                    lines_written: lines,
                    bytes_written: size,
                };

                return createSuccessResponse(result);
            } catch (error) {
                const duration = Date.now() - startTime;
                const errorMessage = error instanceof Error ? error.message : String(error);

                context.outputChannel.appendLine(
                    `[write] Error writing file: ${errorMessage} (${duration}ms)`
                );
                return handleToolError(error, 'Write tool execution', 'execution');
            }
        },
    });
}
