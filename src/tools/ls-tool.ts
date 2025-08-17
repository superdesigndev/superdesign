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
  type ToolResponse 
} from './tool-utils';

const lsParametersSchema = z.object({
  path: z.string().optional().describe('Path to the directory to list (relative to workspace root, or absolute path within workspace). Defaults to workspace root.'),
  show_hidden: z.boolean().optional().describe('Whether to show hidden files and directories (starting with .)'),
  ignore: z.array(z.string()).optional().describe('Array of glob patterns to ignore (e.g., ["*.log", "temp*"])'),
  detailed: z.boolean().optional().describe('Whether to show detailed file information (size, modified time)')
});

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: Date;
  extension?: string;
}

// Path validation is now handled by validateWorkspacePath in tool-utils

/**
 * Check if a filename should be ignored based on patterns
 */
function shouldIgnore(filename: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  for (const pattern of patterns) {
    // Convert glob pattern to RegExp (simplified version)
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
      .replace(/\*/g, '.*')                   // * becomes .*
      .replace(/\?/g, '.');                   // ? becomes .
    
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(filename)) {
      return true;
    }
  }

  return false;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format modified time in relative format
 */
function formatModifiedTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  
  return date.toLocaleDateString();
}

export function createLsTool(context: ExecutionContext) {
  return tool({
    description: 'List the contents of a directory in the workspace. Shows files and subdirectories with optional filtering.',
    inputSchema: lsParametersSchema,
    execute: async (params): Promise<ToolResponse> => {
      try {
        const { path: targetPath = '.', show_hidden = false, ignore, detailed = false } = params;

        // Validate workspace path (handles both absolute and relative paths)
        const pathError = validateWorkspacePath(targetPath, context);
        if (pathError) {
          return pathError;
        }

        // Resolve target directory
        const absolutePath = resolveWorkspacePath(targetPath, context);

        console.log(`Listing directory: ${targetPath}`);

        // Check if path exists and is a directory
        const dirError = validateDirectoryExists(absolutePath, targetPath);
        if (dirError) {
          return dirError;
        }

      // Read directory contents
      const files = fs.readdirSync(absolutePath);
      
              if (files.length === 0) {
          console.log(`Directory is empty: ${targetPath}`);
          return createSuccessResponse({
            path: targetPath,
            absolute_path: absolutePath,
            entries: [],
            total_count: 0
          });
        }

      const entries: FileEntry[] = [];
      let hiddenCount = 0;
      let ignoredCount = 0;

      // Process each file/directory
      for (const file of files) {
        // Skip hidden files unless requested
        if (!show_hidden && file.startsWith('.')) {
          hiddenCount++;
          continue;
        }

        // Check ignore patterns
        if (shouldIgnore(file, ignore)) {
          ignoredCount++;
          continue;
        }

        const fullPath = path.join(absolutePath, file);
        
        try {
          const fileStats = fs.statSync(fullPath);
          const isDir = fileStats.isDirectory();
          
          const entry: FileEntry = {
            name: file,
            isDirectory: isDir,
            size: isDir ? 0 : fileStats.size,
            modifiedTime: fileStats.mtime,
            extension: isDir ? undefined : path.extname(file).slice(1)
          };

          entries.push(entry);
        } catch (error) {
          // Log error but continue with other files
          console.log(`Error accessing ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Sort entries (directories first, then alphabetically)
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) {
          return -1;
        }
        if (!a.isDirectory && b.isDirectory) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });

      // Create formatted output
      let summary = `Listed ${entries.length} item(s) in ${targetPath}`;
      if (hiddenCount > 0) {
        summary += ` (${hiddenCount} hidden)`;
      }
      if (ignoredCount > 0) {
        summary += ` (${ignoredCount} ignored)`;
      }

      // Create detailed listing if requested
      let detailedListing = '';
      if (detailed && entries.length > 0) {
        detailedListing = '\n\nDetailed listing:\n';
        detailedListing += entries.map(entry => {
          const type = entry.isDirectory ? '[DIR]' : '[FILE]';
          const size = entry.isDirectory ? '' : ` ${formatFileSize(entry.size)}`;
          const modified = ` ${formatModifiedTime(entry.modifiedTime)}`;
          const ext = entry.extension ? ` .${entry.extension}` : '';
          return `${type} ${entry.name}${size}${modified}${ext}`;
        }).join('\n');
      }

      console.log(`${summary}${detailedListing}`);

      return createSuccessResponse({
        path: targetPath,
        absolute_path: absolutePath,
        entries,
        total_count: entries.length,
        hidden_count: hiddenCount,
        ignored_count: ignoredCount,
        directories: entries.filter(e => e.isDirectory).length,
        files: entries.filter(e => !e.isDirectory).length,
        summary,
        detailed_listing: detailed ? detailedListing : undefined
      });

      } catch (error) {
        return handleToolError(error, 'Ls tool execution', 'execution');
      }
    }
  });
} 