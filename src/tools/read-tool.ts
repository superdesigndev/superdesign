import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { tool } from 'ai';
import { z } from 'zod';
import type { ExecutionContext } from '../types/agent';
import {
    handleToolError,
    validateWorkspacePath,
    resolveWorkspacePath,
    createSuccessResponse,
    validateFileExists,
    type ToolResponse,
} from './tool-utils';

/**
 * File read result with metadata
 */
export interface FileReadResult {
    content: string;
    filePath: string;
    fileType: 'text' | 'image' | 'pdf' | 'binary';
    mimeType?: string;
    lineCount?: number;
    isTruncated?: boolean;
    linesShown?: [number, number]; // [startLine, endLine]
    size: number;
}

// Constants for file processing
const DEFAULT_MAX_LINES = 1000;
const MAX_LINE_LENGTH = 2000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Path validation is now handled by validateWorkspacePath in tool-utils

/**
 * Check if a file is likely binary by sampling content
 */
function isBinaryFile(filePath: string): boolean {
    try {
        const fd = fs.openSync(filePath, 'r');
        const fileSize = fs.fstatSync(fd).size;

        if (fileSize === 0) {
            fs.closeSync(fd);
            return false;
        }

        const bufferSize = Math.min(4096, fileSize);
        const buffer = Buffer.alloc(bufferSize);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);

        if (bytesRead === 0) {
            return false;
        }

        // Check for null bytes (strong binary indicator)
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) {
                return true;
            }
        }

        // Count non-printable characters
        let nonPrintableCount = 0;
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] < 9 || (buffer[i] > 13 && buffer[i] < 32)) {
                nonPrintableCount++;
            }
        }

        // If >30% non-printable characters, consider binary
        return nonPrintableCount / bytesRead > 0.3;
    } catch {
        return false;
    }
}

/**
 * Detect file type based on extension and content
 */
function detectFileType(filePath: string): 'text' | 'image' | 'pdf' | 'binary' {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath);

    // Check for images
    if (mimeType && mimeType.startsWith('image/')) {
        return 'image';
    }

    // Check for PDF
    if (mimeType === 'application/pdf') {
        return 'pdf';
    }

    // Known binary extensions
    const binaryExtensions = [
        '.exe',
        '.dll',
        '.so',
        '.dylib',
        '.zip',
        '.tar',
        '.gz',
        '.7z',
        '.bin',
        '.dat',
        '.class',
        '.jar',
        '.war',
        '.pyc',
        '.pyo',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
        '.odt',
        '.ods',
        '.odp',
        '.wasm',
        '.obj',
        '.o',
        '.a',
        '.lib',
    ];

    if (binaryExtensions.includes(ext)) {
        return 'binary';
    }

    // Content-based binary detection
    if (isBinaryFile(filePath)) {
        return 'binary';
    }

    return 'text';
}

/**
 * Process text file content with line range support
 */
async function processTextFile(
    filePath: string,
    startLine?: number,
    lineCount?: number,
    encoding: string = 'utf-8'
): Promise<{ content: string; metadata: Partial<FileReadResult> }> {
    const content = await fs.promises.readFile(filePath, encoding as BufferEncoding);
    const lines = content.split('\n');
    const originalLineCount = lines.length;

    // Handle line range
    const actualStartLine = Math.max((startLine || 1) - 1, 0); // Convert to 0-based
    const actualLineCount = lineCount || Math.min(DEFAULT_MAX_LINES, originalLineCount);
    const endLine = Math.min(actualStartLine + actualLineCount, originalLineCount);

    const selectedLines = lines.slice(actualStartLine, endLine);

    // Truncate long lines
    let linesWereTruncated = false;
    const processedLines = selectedLines.map(line => {
        if (line.length > MAX_LINE_LENGTH) {
            linesWereTruncated = true;
            return `${line}... [line truncated]`;
        }
        return line;
    });

    const contentWasTruncated = endLine < originalLineCount;
    const isTruncated = contentWasTruncated || linesWereTruncated;

    let processedContent = processedLines.join('\n');

    // Add truncation notice
    if (contentWasTruncated) {
        processedContent = `[Content truncated: showing lines ${actualStartLine + 1}-${endLine} of ${originalLineCount} total lines]\n\n${processedContent}`;
    } else if (linesWereTruncated) {
        processedContent = `[Some lines truncated due to length (max ${MAX_LINE_LENGTH} chars)]\n\n${processedContent}`;
    }

    return {
        content: processedContent,
        metadata: {
            lineCount: originalLineCount,
            isTruncated,
            linesShown: [actualStartLine + 1, endLine],
        },
    };
}

/**
 * Process image or PDF file
 */
async function processMediaFile(
    filePath: string,
    fileType: 'image' | 'pdf'
): Promise<{ content: string; metadata: Partial<FileReadResult> }> {
    const buffer = await fs.promises.readFile(filePath);
    const base64Data = buffer.toString('base64');
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    // For SuperDesign, we'll return a descriptive message rather than raw base64
    // The actual file handling would be done by the VS Code webview
    const fileName = path.basename(filePath);
    const fileSize = (buffer.length / 1024).toFixed(1);

    return {
        content: `[${fileType.toUpperCase()} FILE: ${fileName}]\nFile size: ${fileSize} KB\nMIME type: ${mimeType}\nBase64 data available for webview display.`,
        metadata: {
            mimeType,
        },
    };
}

export function createReadTool(context: ExecutionContext) {
    return tool({
        description:
            'Read the contents of a file within the workspace. Supports text files, images (PNG, JPG, SVG, etc.), and handles large files with line-range reading.',
        inputSchema: z.object({
            filePath: z
                .string()
                .describe(
                    'Path to the file to read, relative to the workspace root or absolute path within workspace'
                ),
            startLine: z
                .number()
                .optional()
                .describe(
                    'Optional: Starting line number to read from (1-based). Use with lineCount for large files.'
                ),
            lineCount: z
                .number()
                .optional()
                .describe(
                    'Optional: Number of lines to read. Use with startLine to read specific sections.'
                ),
            encoding: z
                .string()
                .optional()
                .describe('Optional: File encoding (utf-8, ascii, etc.). Defaults to utf-8.'),
        }),
        execute: async ({ filePath, startLine, lineCount, encoding }): Promise<ToolResponse> => {
            const startTime = Date.now();

            try {
                // Validate workspace path (handles both absolute and relative paths)
                const pathError = validateWorkspacePath(filePath, context);
                if (pathError) {
                    return pathError;
                }

                // Resolve file path
                const absolutePath = resolveWorkspacePath(filePath, context);

                // Check file existence
                const fileError = validateFileExists(absolutePath, filePath);
                if (fileError) {
                    return fileError;
                }

                // Check if it's a directory
                const stats = fs.statSync(absolutePath);
                if (stats.isDirectory()) {
                    return handleToolError(
                        `Path is a directory, not a file: ${filePath}`,
                        'Path validation',
                        'validation'
                    );
                }

                // Check file size
                if (stats.size > MAX_FILE_SIZE_BYTES) {
                    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                    return handleToolError(
                        `File too large (${sizeMB}MB). Maximum size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
                        'File size check',
                        'validation'
                    );
                }

                // Detect file type
                const fileType = detectFileType(absolutePath);
                context.outputChannel.appendLine(
                    `[read] Reading ${fileType} file: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`
                );

                let content: string;
                let metadata: Partial<FileReadResult> = {};

                // Process based on file type
                switch (fileType) {
                    case 'text': {
                        const result = await processTextFile(
                            absolutePath,
                            startLine,
                            lineCount,
                            encoding
                        );
                        content = result.content;
                        metadata = result.metadata;
                        break;
                    }

                    case 'image':
                    case 'pdf': {
                        const result = await processMediaFile(absolutePath, fileType);
                        content = result.content;
                        metadata = result.metadata;
                        break;
                    }

                    case 'binary': {
                        const fileName = path.basename(absolutePath);
                        const fileSize = (stats.size / 1024).toFixed(1);
                        content = `[BINARY FILE: ${fileName}]\nFile size: ${fileSize} KB\nCannot display binary content as text.`;
                        break;
                    }

                    default:
                        return handleToolError(
                            `Unsupported file type: ${fileType}`,
                            'File type detection',
                            'validation'
                        );
                }

                // Create result
                const fileReadResult: FileReadResult = {
                    content,
                    filePath,
                    fileType,
                    mimeType: mime.lookup(absolutePath) || undefined,
                    size: stats.size,
                    ...metadata,
                };

                const duration = Date.now() - startTime;
                context.outputChannel.appendLine(`[read] File read completed in ${duration}ms`);

                return createSuccessResponse(fileReadResult);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                context.outputChannel.appendLine(`[read] Read failed: ${errorMessage}`);
                return handleToolError(error, 'Read tool execution', 'execution');
            }
        },
    });
}
