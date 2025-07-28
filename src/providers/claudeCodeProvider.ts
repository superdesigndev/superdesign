import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { LLMProvider, LLMProviderOptions, LLMMessage, LLMStreamCallback } from './llmProvider';
import { Logger } from '../services/logger';

export class ClaudeCodeProvider extends LLMProvider {
    private workingDirectory: string = '';
    private currentSessionId: string | null = null;
    private claudeCodePath: string = 'claude';
    private modelId: string = 'claude-sonnet-4-20250514';
    private thinkingBudgetTokens: number = 50000;

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
        this.initializationPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            Logger.info('Starting Claude Code binary provider initialization...');
            
            // Setup working directory
            await this.setupWorkingDirectory();
            
            // Check if claude-code binary is available
            await this.checkClaudeCodeBinary();
            
            // Load configuration
            await this.loadConfiguration();

            this.isInitialized = true;
            Logger.info('Claude Code binary provider initialized successfully');
        } catch (error) {
            Logger.error(`Failed to initialize Claude Code binary provider: ${error}`);
            this.initializationPromise = null;
            this.isInitialized = false;
            throw error;
        }
    }

    private async setupWorkingDirectory(): Promise<void> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (workspaceRoot) {
                const superdesignDir = path.join(workspaceRoot, '.superdesign');
                
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    Logger.info(`Created .superdesign directory: ${superdesignDir}`);
                }
                
                this.workingDirectory = superdesignDir;
            } else {
                Logger.warn('No workspace root found, using temporary directory');
                const tempDir = path.join(os.tmpdir(), 'superdesign-claude-code');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    Logger.info(`Created temporary directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
            }
        } catch (error) {
            Logger.error(`Failed to setup working directory: ${error}`);
            this.workingDirectory = process.cwd();
        }
    }

    private async checkClaudeCodeBinary(): Promise<void> {
        const commandsToTry = [
            { args: ['--version'], description: 'version check' },
            { args: ['--help'], description: 'help check' },
            { args: [], description: 'basic check' }
        ];

        for (const { args, description } of commandsToTry) {
            try {
                await this.tryClaudeCommand(args, description);
                Logger.info(`Claude binary verified with ${description}`);
                return; // Success, exit early
            } catch (error) {
                Logger.debug(`${description} failed: ${error}`);
                // Continue to next command
            }
        }

        // If all commands failed, provide detailed error information
        const errorMessage = `Claude binary not available at '${this.claudeCodePath}'. 

Please check:
1. Is Claude CLI installed? Try running 'claude --help' in your terminal
2. Is it in your PATH? Try running 'which claude' or 'where claude'
3. Is it named differently? Try setting the path in VS Code settings (superdesign.claudeCodePath)

Common installation methods:
- Official: Visit https://claude.ai/download
- npm: npm install -g @anthropic-ai/claude-cli
- Or set custom path in settings if installed elsewhere`;
        
        Logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    private async tryClaudeCommand(args: string[], description: string): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.debug(`Trying command: ${this.claudeCodePath} ${args.join(' ')}`);
            
            const child = spawn(this.claudeCodePath, args, { 
                stdio: 'pipe',
                timeout: 10000 // 10 second timeout
            });

            let output = '';
            let error = '';

            child.stdout?.on('data', (data) => {
                output += data.toString();
            });

            child.stderr?.on('data', (data) => {
                error += data.toString();
            });

            child.on('close', (code) => {
                Logger.debug(`Command exit code: ${code}, stdout: ${output.substring(0, 100)}, stderr: ${error.substring(0, 100)}`);
                
                // For claude CLI, we might get non-zero exit codes even when it's working
                // Check if we got any meaningful output
                if (output.trim() || error.includes('claude') || error.includes('usage') || code === 0) {
                    Logger.info(`Claude binary responded successfully (${description})`);
                    resolve();
                } else {
                    reject(new Error(`No response from claude binary`));
                }
            });

            child.on('error', (err) => {
                Logger.debug(`Command error: ${err}`);
                reject(err);
            });
        });
    }

    private async loadConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('superdesign');
        
        // Get claude-code specific settings
        const claudeCodePath = config.get<string>('claudeCodePath');
        if (claudeCodePath) {
            this.claudeCodePath = claudeCodePath;
        }

        const modelId = config.get<string>('claudeCodeModelId');
        if (modelId) {
            this.modelId = modelId;
        }

        const thinkingBudget = config.get<number>('claudeCodeThinkingBudget');
        if (thinkingBudget) {
            this.thinkingBudgetTokens = thinkingBudget;
        }
    }

    async query(
        prompt: string, 
        options?: Partial<LLMProviderOptions>, 
        abortController?: AbortController,
        onMessage?: LLMStreamCallback
    ): Promise<LLMMessage[]> {
        Logger.info('Starting Claude Code binary query');
        
        await this.ensureInitialized();

        const messages: LLMMessage[] = [];

        let systemPrompt = options?.customSystemPrompt || '';
        
        // Try to load system prompt from file if not provided
        if (!systemPrompt) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
                const systemPromptPath = path.join(workspaceRoot, 'system-prompt.txt');
                if (fs.existsSync(systemPromptPath)) {
                    try {
                        systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
                        Logger.info('Loaded system prompt from system-prompt.txt');
                    } catch (error) {
                        Logger.warn(`Failed to load system prompt from file: ${error}`);
                    }
                }
            }
        }
        
        // Fallback to embedded system prompt if file doesn't exist
        if (!systemPrompt) {
            systemPrompt = `# Role
You are a **senior front-end designer**.
You pay close attention to every pixel, spacing, font, color;
Whenever there are UI implementation task, think deeply of the design style first, and then implement UI bit by bit

# When asked to create design:
1. You ALWAYS spin up 3 parallel sub agents concurrently to implement one design with variations, so it's faster for user to iterate (Unless specifically asked to create only one version)

<task_for_each_sub_agent>
1. Build one single html page of just one screen to build a design based on users' feedback/task
2. You ALWAYS output design files in '.superdesign/design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
3. If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
</task_for_each_sub_agent>

## Technical Specifications
1. **Images**: do NEVER include any images, we can't render images in webview,just try to use css to make some placeholder images. (Don't use service like placehold.co too, we can't render it)
2. **Styles**: Use **Tailwind CSS** via **CDN** for styling.
3. **All text should be only black or white**.
4. Choose a **4 pt or 8 pt spacing system**—all margins, padding, line-heights, and element sizes must be exact multiples.
5. **Responsive design** You only output responsive design, it needs to look perfect on both mobile, tablet and desktop.

## Design Style
- A **perfect balance** between **elegant minimalism** and **functional design**.
- **Well-proportioned white space** for a clean layout.
- **Clear information hierarchy** using **subtle shadows and modular card layouts**.
- **Refined rounded corners**.
- **Responsive design** that looks perfect on mobile, tablet and desktop.`;
            Logger.info('Using embedded system prompt as fallback');
        }

        try {
            const { args, systemPrompt: sysPrompt } = this.buildClaudeCodeArgs({
                systemPrompt,
                prompt,
                modelId: this.modelId,
                thinkingBudgetTokens: this.thinkingBudgetTokens,
                resume: this.currentSessionId,
                maxTurns: options?.maxTurns || 10,
                allowedTools: options?.allowedTools || [
                    'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'LS', 'Grep', 'Glob'
                ],
                permissionMode: options?.permissionMode || 'acceptEdits'
            });
            
            const outputs = await this.runClaudeCodeProcess(
                args,
                this.workingDirectory,
                abortController,
                sysPrompt
            );

            for (const output of outputs) {
                const message = this.parseClaudeCodeOutput(output);
                if (message) {
                    messages.push(message);
                    
                    // Extract session ID if present
                    if (message.session_id) {
                        this.currentSessionId = message.session_id;
                    }
                    
                    // Call streaming callback if provided
                    if (onMessage) {
                        try {
                            onMessage(message);
                        } catch (callbackError) {
                            Logger.error(`Streaming callback error: ${callbackError}`);
                        }
                    }
                }
            }

            Logger.info(`Claude Code query completed with ${messages.length} messages`);
            return messages;
        } catch (error) {
            Logger.error(`Claude Code query failed: ${error}`);
            throw error;
        }
    }

    private buildClaudeCodeArgs(options: {
        systemPrompt: string;
        prompt: string;
        modelId: string;
        thinkingBudgetTokens: number;
        resume?: string | null;
        maxTurns?: number;
        allowedTools?: string[];
        permissionMode?: string;
    }): { args: string[], systemPrompt: string } {
        const args: string[] = [];

        // Use model alias for better compatibility - Claude Code supports both aliases and full model IDs
        let modelAlias = 'sonnet'; // default
        if (options.modelId.includes('sonnet-4') || options.modelId.includes('claude-sonnet-4')) {
            modelAlias = 'sonnet'; // Claude 4 Sonnet uses 'sonnet' alias
        } else if (options.modelId.includes('haiku')) {
            modelAlias = 'haiku';
        } else if (options.modelId.includes('opus')) {
            modelAlias = 'opus';
        }
        args.push('--model', modelAlias);

        if (options.resume) {
            args.push('--resume', options.resume);
        }

        // Add dangerously-skip-permissions flag
        args.push('--dangerously-skip-permissions');
        
        // Use -p flag for user prompt only
        args.push('-p', options.prompt);
        
        Logger.info(`Building claude-code command: claude ${args.map(arg => 
            arg.length > 50 ? arg.substring(0, 50) + '...' : arg
        ).join(' ')}`);

        return { args, systemPrompt: options.systemPrompt };
    }

    private async runClaudeCodeProcess(
        args: string[], 
        cwd: string, 
        abortController?: AbortController,
        systemPrompt?: string
    ): Promise<string[]> {
        return new Promise((resolve, reject) => {
            Logger.info(`Spawning claude-code from: ${this.claudeCodePath}`);
            Logger.info(`Working directory: ${cwd}`);
            Logger.info(`Full command: ${this.claudeCodePath} ${args.join(' ')}`);
            
            const child = spawn(this.claudeCodePath, args, {
                cwd,
                stdio: 'pipe',
                env: { ...process.env },
                timeout: 300000,  // 5 minute timeout
                shell: false  // Explicitly disable shell to avoid quoting issues
            });

            let buffer = '';
            const outputs: string[] = [];

            if (abortController) {
                abortController.signal.addEventListener('abort', () => {
                    Logger.info('Aborting claude-code process');
                    child.kill('SIGTERM');
                });
            }

            child.on('error', (error) => {
                Logger.error(`Claude Code process error: ${error}`);
                reject(error);
            });

            // Pipe system prompt to stdin
            if (systemPrompt && child.stdin) {
                child.stdin.write(systemPrompt);
                child.stdin.end();
                Logger.debug(`Piped system prompt to stdin (${systemPrompt.length} chars)`);
            }

            child.stdout?.on('data', (data) => {
                const chunk = data.toString();
                Logger.debug(`Received stdout chunk: ${chunk.substring(0, 100)}...`);
                buffer += chunk;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim()) {
                        Logger.debug(`Adding output line: ${line.substring(0, 100)}...`);
                        outputs.push(line);
                    }
                }
            });

            let stderrBuffer = '';
            child.stderr?.on('data', (data) => {
                const errorText = data.toString();
                stderrBuffer += errorText;
                Logger.error(`Claude Code stderr: ${errorText}`);
            });

            child.on('close', (code) => {
                Logger.info(`Claude Code process closed with code: ${code}`);
                Logger.info(`Process outputs collected: ${outputs.length} items`);
                
                // Process any remaining buffer
                if (buffer.trim()) {
                    outputs.push(buffer.trim());
                }
                
                if (code !== 0 && !abortController?.signal.aborted) {
                    let errorMessage = `Claude Code process exited with code ${code}`;
                    if (code === 2) {
                        errorMessage += ` (Command line argument error - check model name and arguments)`;
                    }
                    if (stderrBuffer) {
                        errorMessage += `\nStderr: ${stderrBuffer}`;
                    }
                    Logger.error(errorMessage);
                    reject(new Error(errorMessage));
                } else {
                    Logger.info(`Resolving with ${outputs.length} outputs`);
                    resolve(outputs);
                }
            });
        });
    }

    private parseClaudeCodeOutput(output: string): LLMMessage | null {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(output);
            return parsed as LLMMessage;
        } catch (error) {
            // If not JSON, treat as plain text message
            if (output.trim()) {
                return {
                    type: 'assistant',
                    content: output.trim()
                };
            }
            return null;
        }
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            await this.ensureInitialized();
            return true;
        } catch (error) {
            Logger.error(`Claude Code provider initialization failed: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    hasValidConfiguration(): boolean {
        // Claude Code doesn't need API key, just needs the binary to be available
        return true;//this.isInitialized;
    }

    async refreshConfiguration(): Promise<boolean> {
        try {
            await this.loadConfiguration();
            return true;
        } catch (error) {
            Logger.error(`Failed to refresh Claude Code configuration: ${error}`);
            return false;
        }
    }

    isAuthError(errorMessage: string): boolean {
        // Claude Code binary doesn't have API key auth errors in the same way
        // But it could have other auth-related issues
        const authErrorPatterns = [
            'authentication failed',
            'unauthorized',
            'access denied',
            'permission denied',
            'binary not found',
            'command not found',
            'not installed'
        ];
        
        const lowercaseMessage = errorMessage.toLowerCase();
        return authErrorPatterns.some(pattern => lowercaseMessage.includes(pattern));
    }

    getProviderName(): string {
        return 'Claude Code Binary';
    }

    getProviderType(): 'api' | 'binary' {
        return 'binary';
    }

    // Debug method to help users troubleshoot binary detection
    async debugBinaryDetection(): Promise<string> {
        const results: string[] = [];
        
        results.push(`Checking for Claude binary at: ${this.claudeCodePath}`);
        
        // Try different possible binary names
        const possibleNames = ['claude', 'claude-code', 'anthropic'];
        
        for (const name of possibleNames) {
            try {
                const testChild = spawn(name, ['--version'], { stdio: 'pipe', shell: true, timeout: 5000 });
                
                await new Promise((resolve) => {
                    let output = '';
                    let error = '';
                    
                    testChild.stdout?.on('data', (data) => output += data.toString());
                    testChild.stderr?.on('data', (data) => error += data.toString());
                    
                    testChild.on('close', (code) => {
                        results.push(`${name}: exit code ${code}, output: ${output.substring(0, 50)}${output.length > 50 ? '...' : ''}`);
                        resolve(undefined);
                    });
                    
                    testChild.on('error', (err) => {
                        results.push(`${name}: error - ${err.message}`);
                        resolve(undefined);
                    });
                });
            } catch (error) {
                results.push(`${name}: failed to test - ${error}`);
            }
        }
        
        return results.join('\n');
    }
}