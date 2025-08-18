import { z } from 'zod';
import { tool } from 'ai';
import * as fs from 'fs';
import * as path from 'path';
import type { ExecutionContext } from '../types/agent';
import {
    handleToolError,
    validateWorkspacePath,
    resolveWorkspacePath,
    createSuccessResponse,
    type ToolResponse,
} from './tool-utils';

const editParametersSchema = z.object({
    file_path: z
        .string()
        .describe(
            'Path to the file to edit (relative to workspace root, or absolute path within workspace)'
        ),
    old_string: z
        .string()
        .describe(
            'The exact text to find and replace. Must match exactly including whitespace, indentation, and context. For single replacements, include 3+ lines of context before and after the target text.'
        ),
    new_string: z
        .string()
        .describe(
            'The text to replace old_string with. Should maintain proper indentation and formatting.'
        ),
    expected_replacements: z
        .number()
        .min(1)
        .optional()
        .describe(
            'Number of replacements expected (default: 1). Use when replacing multiple occurrences.'
        ),
});

interface CalculatedEdit {
    currentContent: string;
    newContent: string;
    occurrences: number;
    isNewFile: boolean;
    error?: string;
}

// Path validation is now handled by validateWorkspacePath in tool-utils

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate the edit operation without executing it
 */
function calculateEdit(
    file_path: string,
    old_string: string,
    new_string: string,
    expected_replacements: number,
    context: ExecutionContext
): CalculatedEdit {
    // Use the utility function to resolve paths
    const absolutePath = resolveWorkspacePath(file_path, context);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        if (old_string === '') {
            // Creating a new file
            return {
                currentContent: '',
                newContent: new_string,
                occurrences: 1,
                isNewFile: true,
            };
        } else {
            return {
                currentContent: '',
                newContent: '',
                occurrences: 0,
                isNewFile: false,
                error: `File not found: ${file_path}. Cannot apply edit. Use empty old_string to create a new file.`,
            };
        }
    }

    // Read current content
    let currentContent: string;
    try {
        currentContent = fs.readFileSync(absolutePath, 'utf8');
        // Normalize line endings to LF
        currentContent = currentContent.replace(/\r\n/g, '\n');
    } catch (error) {
        return {
            currentContent: '',
            newContent: '',
            occurrences: 0,
            isNewFile: false,
            error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        };
    }

    // Handle creating file that already exists
    if (old_string === '') {
        return {
            currentContent,
            newContent: '',
            occurrences: 0,
            isNewFile: false,
            error: `File already exists, cannot create: ${file_path}`,
        };
    }

    // Count occurrences
    const occurrences = (currentContent.match(new RegExp(escapeRegExp(old_string), 'g')) ?? [])
        .length;

    // Validate occurrence count
    if (occurrences === 0) {
        return {
            currentContent,
            newContent: currentContent,
            occurrences: 0,
            isNewFile: false,
            error: `Text not found in file. 0 occurrences of old_string found. Ensure exact text match including whitespace and indentation.`,
        };
    }

    if (occurrences !== expected_replacements) {
        return {
            currentContent,
            newContent: currentContent,
            occurrences,
            isNewFile: false,
            error: `Expected ${expected_replacements} replacement(s) but found ${occurrences} occurrence(s).`,
        };
    }

    // Apply replacement
    const newContent = currentContent.split(old_string).join(new_string);

    return {
        currentContent,
        newContent,
        occurrences,
        isNewFile: false,
    };
}

export function createEditTool(context: ExecutionContext) {
    return tool({
        description:
            'Replace text within a file using exact string matching. Accepts both relative and absolute file paths within the workspace.',
        inputSchema: editParametersSchema,
        execute: async ({
            file_path,
            old_string,
            new_string,
            expected_replacements = 1,
        }): Promise<ToolResponse> => {
            try {
                // Validate workspace path (handles both absolute and relative paths)
                const pathError = validateWorkspacePath(file_path, context);
                if (pathError) {
                    return pathError;
                }

                console.log(`Editing file: ${file_path}`);

                // Calculate the edit
                const editResult = calculateEdit(
                    file_path,
                    old_string,
                    new_string,
                    expected_replacements,
                    context
                );

                if (editResult.error) {
                    return handleToolError(editResult.error, 'Edit operation', 'execution');
                }

                const absolutePath = resolveWorkspacePath(file_path, context);

                // Create parent directories if needed (for new files)
                if (editResult.isNewFile) {
                    const dirName = path.dirname(absolutePath);
                    if (!fs.existsSync(dirName)) {
                        fs.mkdirSync(dirName, { recursive: true });
                        console.log(`Created parent directories for: ${file_path}`);
                    }
                }

                // Write the updated content
                fs.writeFileSync(absolutePath, editResult.newContent, 'utf8');

                const newLines = editResult.newContent.split('\n').length;
                const newSize = Buffer.byteLength(editResult.newContent, 'utf8');

                if (editResult.isNewFile) {
                    console.log(`Created new file: ${file_path} (${newLines} lines)`);
                } else {
                    console.log(
                        `Applied ${editResult.occurrences} replacement(s) to: ${file_path} (${newLines} lines)`
                    );
                }

                return createSuccessResponse({
                    file_path,
                    absolute_path: absolutePath,
                    is_new_file: editResult.isNewFile,
                    replacements_made: editResult.occurrences,
                    lines_total: newLines,
                    bytes_total: newSize,
                    old_string_length: old_string.length,
                    new_string_length: new_string.length,
                });
            } catch (error) {
                return handleToolError(error, 'Edit tool execution', 'execution');
            }
        },
    });
}
