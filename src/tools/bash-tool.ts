import { z } from 'zod';
import { tool } from 'ai';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import type { ExecutionContext } from '../types/agent';
import {
    handleToolError,
    validateWorkspacePath,
    resolveWorkspacePath,
    createSuccessResponse,
    validateDirectoryExists,
    type ToolResponse,
} from './tool-utils';

const bashParametersSchema = z.object({
    command: z
        .string()
        .describe('Shell command to execute (e.g., "npm install", "ls -la", "git status")'),
    description: z
        .string()
        .optional()
        .describe('Brief description of what the command does for logging purposes'),
    directory: z
        .string()
        .optional()
        .describe(
            'Directory to run command in (relative to workspace root). Defaults to workspace root.'
        ),
    timeout: z
        .number()
        .optional()
        .describe('Timeout in milliseconds (default: 30000ms = 30 seconds)'),
    capture_output: z
        .boolean()
        .optional()
        .describe('Whether to capture and return command output (default: true)'),
    env: z
        .record(z.string(), z.string())
        .optional()
        .describe('Environment variables to set for the command execution'),
});

interface CommandResult {
    command: string;
    directory: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    duration: number;
    timedOut: boolean;
    processId?: number;
}

/**
 * Check for potentially unsafe commands
 */
function hasUnsafeCommand(command: string): boolean {
    const unsafePatterns = [
        // System modification
        /\brm\s+(-[rf]*\s+)?\/\s*$/i,
        /\brm\s+-[rf]*\s+\/$/i,
        /\b(format|fdisk|mkfs)\b/i,
        // Network operations that could be dangerous
        /\b(curl|wget)\s+.*\|\s*(bash|sh|python|ruby|perl)/i,
        // Process manipulation
        /\b(kill|killall|pkill)\s+(-9\s+)?1\b/i,
        // System shutdown/reboot
        /\b(shutdown|reboot|halt|init\s+0)\b/i,
        // Privilege escalation
        /\b(sudo\s+su|sudo.*passwd|chmod\s+777)/i,
        // Directory traversal attempts
        /\.\.(\/|\\)/,
        // Dangerous redirections
        />\s*(\/dev\/|\/proc\/|\/sys\/)/i,
    ];

    return unsafePatterns.some(pattern => pattern.test(command));
}

// Path validation is now handled by validateWorkspacePath in tool-utils

/**
 * Execute command with proper process management
 */
async function executeCommand(
    command: string,
    options: {
        cwd: string;
        env: NodeJS.ProcessEnv;
        timeout: number;
        captureOutput: boolean;
    }
): Promise<CommandResult> {
    const startTime = Date.now();
    const isWindows = os.platform() === 'win32';

    // Choose shell based on platform
    const shell = isWindows ? 'cmd.exe' : 'bash';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const child: ChildProcess = spawn(shell, shellArgs, {
        cwd: options.cwd,
        env: options.env,
        stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        detached: !isWindows, // Create process group on Unix systems
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Capture output if requested
    if (options.captureOutput && child.stdout && child.stderr) {
        child.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
    }

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
            try {
                if (isWindows) {
                    // On Windows, use taskkill to terminate process tree
                    spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
                } else {
                    // On Unix, kill the process group
                    process.kill(-child.pid, 'SIGTERM');
                    // Force kill after 1 second if still running
                    setTimeout(() => {
                        if (child.pid && !child.killed) {
                            try {
                                process.kill(-child.pid, 'SIGKILL');
                            } catch {
                                // Process might already be dead
                            }
                        }
                    }, 1000);
                }
            } catch {
                // Process might already be dead
            }
        }
    }, options.timeout);

    // Wait for process to complete
    const exitPromise = new Promise<{ code: number | null; signal: string | null }>(resolve => {
        child.on('exit', (code, signal) => {
            clearTimeout(timeoutHandle);
            resolve({ code, signal });
        });
    });

    const { code, signal } = await exitPromise;
    const duration = Date.now() - startTime;

    return {
        command,
        directory: path.relative(options.cwd, options.cwd) || '.',
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        signal: signal,
        duration,
        timedOut,
        processId: child.pid,
    };
}

export function createBashTool(context: ExecutionContext) {
    return tool({
        description:
            'Execute shell/bash commands within the workspace. Supports timeouts, output capture, and secure execution.',
        inputSchema: bashParametersSchema,
        execute: async ({
            command,
            description,
            directory,
            timeout = 30000,
            capture_output = true,
            env,
        }): Promise<ToolResponse> => {
            try {
                // Security checks
                if (hasUnsafeCommand(command)) {
                    return handleToolError(
                        'Command contains potentially unsafe operations',
                        'Security check',
                        'security'
                    );
                }

                // Resolve execution directory
                const workingDir = directory ?? '.';

                // Security check for workspace boundary
                const pathError = validateWorkspacePath(workingDir, context);
                if (pathError) {
                    return pathError;
                }

                const absolutePath = resolveWorkspacePath(workingDir, context);

                // Check if directory exists
                const dirError = validateDirectoryExists(absolutePath, workingDir);
                if (dirError) {
                    return dirError;
                }

                console.log(
                    `Executing command: ${command}${description ? ` (${description})` : ''}`
                );
                console.log(`Working directory: ${workingDir}`);

                // Prepare environment
                const processEnv = {
                    ...process.env,
                    ...env,
                };

                // Execute the command
                const result = await executeCommand(command, {
                    cwd: absolutePath,
                    env: processEnv,
                    timeout,
                    captureOutput: capture_output,
                });

                // Log results
                if (result.timedOut) {
                    console.log(`Command timed out after ${timeout}ms`);
                } else if (result.exitCode === 0) {
                    console.log(`Command completed successfully in ${result.duration}ms`);
                } else {
                    console.log(
                        `Command failed with exit code ${result.exitCode} in ${result.duration}ms`
                    );
                }

                // Create summary for display
                let summary = `Command: ${command}\n`;
                summary += `Directory: ${result.directory}\n`;
                summary += `Exit Code: ${result.exitCode}\n`;
                summary += `Duration: ${result.duration}ms\n`;

                if (result.timedOut) {
                    summary += `Status: TIMED OUT (${timeout}ms)\n`;
                } else if (result.signal) {
                    summary += `Signal: ${result.signal}\n`;
                }

                if (capture_output) {
                    if (result.stdout) {
                        summary += `\nStdout:\n${result.stdout}\n`;
                    }
                    if (result.stderr) {
                        summary += `\nStderr:\n${result.stderr}\n`;
                    }
                }

                if (result.timedOut) {
                    return handleToolError(
                        `Command timed out after ${timeout}ms`,
                        'Command execution',
                        'execution'
                    );
                }

                if (result.exitCode !== 0) {
                    return handleToolError(
                        `Command failed with exit code ${result.exitCode}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`,
                        'Command execution',
                        'execution'
                    );
                }

                return createSuccessResponse({
                    command,
                    directory: workingDir,
                    exitCode: result.exitCode,
                    duration: result.duration,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    summary,
                });
            } catch (error) {
                return handleToolError(error, 'Bash tool execution', 'execution');
            }
        },
    });
}
