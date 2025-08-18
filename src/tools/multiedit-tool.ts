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
    validateFileExists,
    type ToolResponse,
} from './tool-utils';

const singleEditSchema = z.object({
    old_string: z
        .string()
        .describe('The exact text to find and replace. Must match exactly including whitespace.'),
    new_string: z.string().describe('The text to replace old_string with.'),
    expected_replacements: z
        .number()
        .min(1)
        .optional()
        .describe('Number of replacements expected (default: 1)'),
});

const multieditParametersSchema = z.object({
    file_path: z
        .string()
        .describe(
            'Path to the file to edit (relative to workspace root, or absolute path within workspace)'
        ),
    edits: z
        .array(singleEditSchema)
        .min(1)
        .describe('Array of edit operations to perform in sequence'),
    fail_fast: z
        .boolean()
        .optional()
        .describe(
            'Whether to stop on first error (true) or continue with remaining edits (false, default)'
        ),
});

interface SingleEdit {
    old_string: string;
    new_string: string;
    expected_replacements?: number;
}

interface EditResult {
    edit: SingleEdit;
    success: boolean;
    occurrences: number;
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
 * Apply a single edit to content
 */
function applySingleEdit(content: string, edit: SingleEdit): EditResult {
    const expectedReplacements = edit.expected_replacements ?? 1;

    // Count occurrences
    const regex = new RegExp(escapeRegExp(edit.old_string), 'g');
    const matches = content.match(regex) || [];
    const occurrences = matches.length;

    // Validate occurrence count
    if (occurrences === 0) {
        return {
            edit,
            success: false,
            occurrences: 0,
            error: `Text not found: "${edit.old_string}${edit.old_string.length > 50 ? '...' : ''}"`,
        };
    }

    if (occurrences !== expectedReplacements) {
        return {
            edit,
            success: false,
            occurrences,
            error: `Expected ${expectedReplacements} replacement(s) but found ${occurrences} occurrence(s)`,
        };
    }

    return {
        edit,
        success: true,
        occurrences,
    };
}

export function createMultieditTool(context: ExecutionContext) {
    return tool({
        description:
            'Perform multiple find-and-replace operations on a single file in sequence. Each edit is applied to the result of the previous edit. Accepts both relative and absolute file paths within the workspace.',
        inputSchema: multieditParametersSchema,
        execute: async (params): Promise<ToolResponse> => {
            try {
                const { file_path, edits, fail_fast = true } = params;

                // Validate workspace path (handles both absolute and relative paths)
                const pathError = validateWorkspacePath(file_path, context);
                if (pathError) {
                    return pathError;
                }

                // Resolve path
                const absolutePath = resolveWorkspacePath(file_path, context);

                // Check if file exists
                const fileError = validateFileExists(absolutePath, file_path);
                if (fileError) {
                    return fileError;
                }

                console.log(`Performing ${edits.length} edit(s) on: ${file_path}`);

                // Read current content
                let currentContent: string;
                try {
                    currentContent = fs.readFileSync(absolutePath, 'utf8');
                    // Normalize line endings to LF
                    currentContent = currentContent.replace(/\r\n/g, '\n');
                } catch (error) {
                    return handleToolError(error, 'Failed to read file', 'permission');
                }

                const originalContent = currentContent;
                const editResults: EditResult[] = [];
                let successCount = 0;
                let totalReplacements = 0;

                // Apply edits sequentially
                for (let i = 0; i < edits.length; i++) {
                    const edit = edits[i];

                    console.log(`Applying edit ${i + 1}/${edits.length}`);

                    const editResult = applySingleEdit(currentContent, edit);
                    editResults.push(editResult);

                    if (editResult.success) {
                        // Apply the edit
                        currentContent = currentContent
                            .split(edit.old_string)
                            .join(edit.new_string);
                        successCount++;
                        totalReplacements += editResult.occurrences;
                        console.log(
                            `✓ Edit ${i + 1} successful: ${editResult.occurrences} replacement(s)`
                        );
                    } else {
                        console.log(`✗ Edit ${i + 1} failed: ${editResult.error}`);

                        if (fail_fast) {
                            return handleToolError(
                                `Edit operation failed at step ${i + 1}: ${editResult.error}`,
                                'Edit sequence',
                                'execution'
                            );
                        }
                    }
                }

                // Write the updated content if any edits were successful
                if (successCount > 0) {
                    fs.writeFileSync(absolutePath, currentContent, 'utf8');
                }

                const newLines = currentContent.split('\n').length;
                const newSize = Buffer.byteLength(currentContent, 'utf8');
                const hasErrors = editResults.some(r => !r.success);

                console.log(
                    `Multi-edit completed: ${successCount}/${edits.length} edits successful, ${totalReplacements} total replacements`
                );

                return createSuccessResponse({
                    file_path,
                    absolute_path: absolutePath,
                    edits_total: edits.length,
                    edits_successful: successCount,
                    edits_failed: edits.length - successCount,
                    total_replacements: totalReplacements,
                    lines_total: newLines,
                    bytes_total: newSize,
                    content_changed: currentContent !== originalContent,
                    edit_results: editResults,
                });
            } catch (error) {
                return handleToolError(error, 'Multiedit tool execution', 'execution');
            }
        },
    });
}
