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
    validateDirectoryExists,
    type ToolResponse,
} from './tool-utils';

const globParametersSchema = z.object({
    pattern: z
        .string()
        .describe('Glob pattern to match (e.g., "*.js", "src/**/*.ts", "**/*.{js,ts}")'),
    path: z
        .string()
        .optional()
        .describe(
            'Directory to search in (relative to workspace root, or absolute path within workspace). Defaults to workspace root.'
        ),
    case_sensitive: z
        .boolean()
        .optional()
        .describe('Whether the search should be case-sensitive (default: false)'),
    include_dirs: z
        .boolean()
        .optional()
        .describe('Whether to include directories in results (default: false)'),
    show_hidden: z
        .boolean()
        .optional()
        .describe('Whether to include hidden files/directories (starting with .)'),
    max_results: z
        .number()
        .min(1)
        .optional()
        .describe('Maximum number of results to return (default: 500)'),
    sort_by_time: z
        .boolean()
        .optional()
        .describe('Whether to sort results by modification time, newest first (default: false)'),
});

interface GlobFileEntry {
    path: string;
    absolutePath: string;
    isDirectory: boolean;
    size: number;
    modifiedTime: Date;
    extension?: string;
}

// Path validation is now handled by validateWorkspacePath in tool-utils

/**
 * Convert glob pattern to regex pattern
 */
function globToRegex(pattern: string, caseSensitive: boolean = false): RegExp {
    // Handle special cases for braces {js,ts}
    let regexPattern = pattern;

    // Handle brace expansion like {js,ts,jsx}
    const braceRegex = /\{([^}]+)\}/g;
    regexPattern = regexPattern.replace(braceRegex, (match, content) => {
        const options = content.split(',').map((s: string) => s.trim());
        return `(${options.join('|')})`;
    });

    // Escape regex special characters except glob chars
    regexPattern = regexPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except *, ?, and already handled {}
        .replace(/\\\{/g, '{') // Restore { that we want to keep
        .replace(/\\\}/g, '}') // Restore } that we want to keep
        .replace(/\\\|/g, '|') // Restore | that we want to keep
        .replace(/\\\(/g, '(') // Restore ( that we want to keep
        .replace(/\\\)/g, ')'); // Restore ) that we want to keep

    // Handle glob patterns
    regexPattern = regexPattern
        .replace(/\*\*/g, '###DOUBLESTAR###') // Temporarily replace **
        .replace(/\*/g, '[^/]*') // * becomes [^/]* (match any chars except path separator)
        .replace(/###DOUBLESTAR###/g, '.*') // ** becomes .* (match any chars including path separator)
        .replace(/\?/g, '[^/]'); // ? becomes [^/] (match single char except path separator)

    const flags = caseSensitive ? '' : 'i';
    return new RegExp(`^${regexPattern}$`, flags);
}

/**
 * Check if a file should be skipped based on common patterns
 */
function shouldSkipPath(relativePath: string, showHidden: boolean): boolean {
    // Skip hidden files unless requested
    if (!showHidden && relativePath.split('/').some(part => part.startsWith('.'))) {
        return true;
    }

    // Skip common directories that should never be searched
    const skipPatterns = [
        /node_modules/,
        /\.git$/,
        /\.svn$/,
        /\.hg$/,
        /\.vscode$/,
        /dist$/,
        /build$/,
        /coverage$/,
        /\.nyc_output$/,
        /\.next$/,
        /\.cache$/,
    ];

    return skipPatterns.some(pattern => pattern.test(relativePath));
}

/**
 * Recursively find files matching the pattern
 */
async function findMatches(
    searchDir: string,
    pattern: RegExp,
    options: {
        includeDirs: boolean;
        showHidden: boolean;
        maxResults: number;
    }
): Promise<GlobFileEntry[]> {
    const results: GlobFileEntry[] = [];

    const scanDirectory = async (currentDir: string): Promise<void> => {
        if (results.length >= options.maxResults) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                if (results.length >= options.maxResults) {
                    break;
                }

                const fullPath = path.join(currentDir, entry.name);
                const relativePath = path.relative(searchDir, fullPath);

                // Skip paths that should be ignored
                if (shouldSkipPath(relativePath, options.showHidden)) {
                    continue;
                }

                const isDirectory = entry.isDirectory();

                // Check if this path matches the pattern
                const matches = pattern.test(relativePath);

                if (matches && (options.includeDirs || !isDirectory)) {
                    try {
                        const stats = await fs.promises.stat(fullPath);

                        results.push({
                            path: relativePath,
                            absolutePath: fullPath,
                            isDirectory,
                            size: isDirectory ? 0 : stats.size,
                            modifiedTime: stats.mtime,
                            extension: isDirectory ? undefined : path.extname(entry.name).slice(1),
                        });
                    } catch {
                        // Ignore stat errors and continue
                    }
                }

                // Recursively scan subdirectories
                if (isDirectory) {
                    await scanDirectory(fullPath);
                }
            }
        } catch {
            // Ignore permission errors and continue
        }
    };

    await scanDirectory(searchDir);
    return results;
}

/**
 * Sort results by modification time (newest first) or alphabetically
 */
function sortResults(results: GlobFileEntry[], sortByTime: boolean): GlobFileEntry[] {
    if (!sortByTime) {
        // Sort alphabetically with directories first
        return results.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) {
                return -1;
            }
            if (!a.isDirectory && b.isDirectory) {
                return 1;
            }
            return a.path.localeCompare(b.path);
        });
    }

    // Sort by modification time (newest first) with recent files prioritized
    const oneDayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;

    return results.sort((a, b) => {
        const aTime = a.modifiedTime.getTime();
        const bTime = b.modifiedTime.getTime();
        const aIsRecent = aTime > oneDayAgo;
        const bIsRecent = bTime > oneDayAgo;

        // Both recent: newest first
        if (aIsRecent && bIsRecent) {
            return bTime - aTime;
        }

        // One recent: recent first
        if (aIsRecent) {
            return -1;
        }
        if (bIsRecent) {
            return 1;
        }

        // Both old: alphabetical
        return a.path.localeCompare(b.path);
    });
}

export function createGlobTool(context: ExecutionContext) {
    return tool({
        description:
            'Find files and directories matching glob patterns (e.g., "*.js", "src/**/*.ts"). Efficient for locating files by name or path structure.',
        inputSchema: globParametersSchema,
        execute: async (params): Promise<ToolResponse> => {
            try {
                const {
                    pattern,
                    path: searchPath = '.',
                    case_sensitive = false,
                    include_dirs = false,
                    show_hidden = false,
                    max_results = 500,
                    sort_by_time = false,
                } = params;

                // Validate workspace path (handles both absolute and relative paths)
                const pathError = validateWorkspacePath(searchPath, context);
                if (pathError) {
                    return pathError;
                }

                // Resolve search directory
                const absolutePath = resolveWorkspacePath(searchPath, context);

                // Check if path exists and is a directory
                const dirError = validateDirectoryExists(absolutePath, searchPath);
                if (dirError) {
                    return dirError;
                }

                console.log(`Finding files matching pattern "${pattern}" in ${searchPath}`);

                // Convert glob pattern to regex
                const regex = globToRegex(pattern, case_sensitive);

                // Find matching files
                const matches = await findMatches(absolutePath, regex, {
                    includeDirs: include_dirs,
                    showHidden: show_hidden,
                    maxResults: max_results,
                });

                // Sort results
                const sortedMatches = sortResults(matches, sort_by_time);

                // Create summary
                const fileCount = sortedMatches.filter(m => !m.isDirectory).length;
                const dirCount = sortedMatches.filter(m => m.isDirectory).length;

                let summary = `Found ${sortedMatches.length} match(es) for pattern "${pattern}"`;
                if (fileCount > 0 && dirCount > 0) {
                    summary += ` (${fileCount} files, ${dirCount} directories)`;
                } else if (fileCount > 0) {
                    summary += ` (${fileCount} files)`;
                } else if (dirCount > 0) {
                    summary += ` (${dirCount} directories)`;
                }

                if (sortedMatches.length >= max_results) {
                    summary += ` - results truncated at ${max_results}`;
                }

                console.log(summary);

                return createSuccessResponse({
                    pattern,
                    search_path: searchPath,
                    matches: sortedMatches,
                    total_matches: sortedMatches.length,
                    file_count: fileCount,
                    directory_count: dirCount,
                    summary,
                    truncated: sortedMatches.length >= max_results,
                    sorted_by_time: sort_by_time,
                });
            } catch (error) {
                return handleToolError(error, 'Glob tool execution', 'execution');
            }
        },
    });
}
