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

const grepParametersSchema = z.object({
    pattern: z
        .string()
        .describe(
            'Regular expression pattern to search for (e.g., "function\\s+\\w+", "import.*from")'
        ),
    path: z
        .string()
        .optional()
        .describe(
            'Directory to search in (relative to workspace root, or absolute path within workspace). Defaults to workspace root.'
        ),
    include: z
        .string()
        .optional()
        .describe('File pattern to include (e.g., "*.js", "*.{ts,tsx}", "src/**/*.ts")'),
    case_sensitive: z
        .boolean()
        .optional()
        .describe('Whether the search should be case-sensitive (default: false)'),
    max_files: z
        .number()
        .min(1)
        .optional()
        .describe('Maximum number of files to search (default: 1000)'),
    max_matches: z
        .number()
        .min(1)
        .optional()
        .describe('Maximum number of matches to return (default: 100)'),
});

interface GrepMatch {
    filePath: string;
    lineNumber: number;
    line: string;
    matchStart: number;
    matchEnd: number;
}

// Path validation is now handled by validateWorkspacePath in tool-utils

/**
 * Check if a file path matches the include pattern
 */
function matchesIncludePattern(filePath: string, includePattern?: string): boolean {
    if (!includePattern) {
        return true;
    }

    // Convert glob pattern to regex (simplified)
    const regexPattern = includePattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
        .replace(/\*\*/g, '###DOUBLESTAR###') // Temporarily replace **
        .replace(/\*/g, '[^/]*') // * becomes [^/]* (no directory separators)
        .replace(/###DOUBLESTAR###/g, '.*') // ** becomes .* (any characters)
        .replace(/\?/g, '[^/]'); // ? becomes [^/] (single char, no dir sep)

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
}

/**
 * Check if a file should be skipped based on common patterns
 */
function shouldSkipFile(filePath: string): boolean {
    const skipPatterns = [
        /node_modules/,
        /\.git/,
        /\.vscode/,
        /dist/,
        /build/,
        /coverage/,
        /\.nyc_output/,
        /\.next/,
        /\.cache/,
        /\.DS_Store/,
        /Thumbs\.db/,
        /\.log$/,
        /\.tmp$/,
        /\.temp$/,
    ];

    return skipPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Simple check if file is likely a text file
 */
function isTextFile(filePath: string): boolean {
    const textExtensions = [
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        '.html',
        '.htm',
        '.css',
        '.scss',
        '.sass',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.h',
        '.hpp',
        '.cs',
        '.php',
        '.rb',
        '.go',
        '.rs',
        '.swift',
        '.kt',
        '.scala',
        '.clj',
        '.hs',
        '.elm',
        '.ml',
        '.f',
        '.txt',
        '.md',
        '.rst',
        '.asciidoc',
        '.xml',
        '.yaml',
        '.yml',
        '.toml',
        '.ini',
        '.cfg',
        '.conf',
        '.properties',
        '.env',
        '.gitignore',
        '.gitattributes',
        '.dockerfile',
        '.makefile',
        '.sh',
        '.bat',
        '.ps1',
        '.sql',
        '.graphql',
        '.vue',
        '.svelte',
        '.astro',
        '.prisma',
        '.proto',
    ];

    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext) || !ext; // Include extensionless files
}

/**
 * Recursively find files to search
 */
async function findFilesToSearch(
    dirPath: string,
    includePattern?: string,
    maxFiles: number = 1000
): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
        if (files.length >= maxFiles) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) {
                    break;
                }

                const fullPath = path.join(currentPath, entry.name);
                const relativePath = path.relative(dirPath, fullPath);

                // Skip common directories and files
                if (shouldSkipFile(relativePath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await scanDirectory(fullPath);
                } else if (entry.isFile()) {
                    // Check if file matches include pattern
                    if (matchesIncludePattern(relativePath, includePattern)) {
                        // Only include text files (basic check)
                        if (isTextFile(fullPath)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
        } catch {
            // Ignore permission errors and continue
        }
    };

    await scanDirectory(dirPath);
    return files;
}

/**
 * Search for pattern in a single file
 */
async function searchInFile(
    filePath: string,
    regex: RegExp,
    maxMatches: number
): Promise<GrepMatch[]> {
    const matches: GrepMatch[] = [];

    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split(/\r?\n/);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (matches.length >= maxMatches) {
                break;
            }

            const line = lines[lineIndex];
            let match;
            regex.lastIndex = 0; // Reset regex state

            while ((match = regex.exec(line)) !== null) {
                matches.push({
                    filePath,
                    lineNumber: lineIndex + 1,
                    line: line,
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                });

                if (matches.length >= maxMatches) {
                    break;
                }

                // Prevent infinite loop on zero-length matches
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }
        }
    } catch {
        // Ignore files that can't be read (binary files, permission issues, etc.)
    }

    return matches;
}

export function createGrepTool(context: ExecutionContext) {
    return tool({
        description:
            'Search for text patterns within file contents using regular expressions. Can filter by file types and paths.',
        inputSchema: grepParametersSchema,
        execute: async (params): Promise<ToolResponse> => {
            try {
                const {
                    pattern,
                    path: searchPath = '.',
                    include,
                    case_sensitive = false,
                    max_files = 1000,
                    max_matches = 100,
                } = params;

                // Pattern validation (test if it's a valid regex)
                try {
                    new RegExp(pattern);
                } catch (error) {
                    return handleToolError(
                        `Invalid regular expression pattern: ${error instanceof Error ? error.message : String(error)}`,
                        'Pattern validation',
                        'validation'
                    );
                }

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

                console.log(`Searching for pattern "${pattern}" in ${searchPath}`);

                // Create regex pattern
                const regexFlags = case_sensitive ? 'g' : 'gi';
                const regex = new RegExp(pattern, regexFlags);

                // Find files to search
                const filesToSearch = await findFilesToSearch(absolutePath, include, max_files);

                if (filesToSearch.length === 0) {
                    const message = `No files found to search in ${searchPath}${include ? ` matching ${include}` : ''}`;
                    return createSuccessResponse({
                        pattern,
                        search_path: searchPath,
                        include_pattern: include,
                        files_searched: 0,
                        matches: [],
                        total_matches: 0,
                        message,
                    });
                }

                // Search in files
                const allMatches: GrepMatch[] = [];
                let filesSearched = 0;
                let filesWithMatches = 0;

                for (const file of filesToSearch) {
                    if (allMatches.length >= max_matches) {
                        break;
                    }

                    const fileMatches = await searchInFile(
                        file,
                        regex,
                        max_matches - allMatches.length
                    );
                    if (fileMatches.length > 0) {
                        // Convert absolute paths to relative paths for output
                        const relativePath = path.relative(absolutePath, file);
                        fileMatches.forEach(match => {
                            match.filePath = relativePath;
                        });

                        allMatches.push(...fileMatches);
                        filesWithMatches++;
                    }
                    filesSearched++;
                }

                // Format results
                let summary = `Found ${allMatches.length} match(es) for "${pattern}" in ${filesWithMatches} file(s)`;
                if (filesSearched < filesToSearch.length) {
                    summary += ` (searched ${filesSearched}/${filesToSearch.length} files)`;
                }

                // Group matches by file for better readability
                const matchesByFile: Record<string, GrepMatch[]> = {};
                allMatches.forEach(match => {
                    if (!matchesByFile[match.filePath]) {
                        matchesByFile[match.filePath] = [];
                    }
                    matchesByFile[match.filePath].push(match);
                });

                console.log(summary);

                return createSuccessResponse({
                    pattern,
                    search_path: searchPath,
                    include_pattern: include,
                    files_searched: filesSearched,
                    files_with_matches: filesWithMatches,
                    matches: allMatches,
                    matches_by_file: matchesByFile,
                    total_matches: allMatches.length,
                    summary,
                    truncated: allMatches.length >= max_matches,
                });
            } catch (error) {
                return handleToolError(error, 'Grep tool execution', 'execution');
            }
        },
    });
}
