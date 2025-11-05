import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Codex } from '@openai/codex-sdk';
import { LLMProvider, LLMProviderOptions, LLMMessage } from './llmProvider';
import { Logger } from '../services/logger';

type CodexThread = ReturnType<Codex['startThread']>;

interface CodexStreamEvent {
    type: string;
    item?: {
        id?: string;
        type?: string;
        text?: string;
        aggregated_output?: string;
        [key: string]: any;
    };
    usage?: Record<string, unknown>;
    error?: { message?: string };
    [key: string]: any;
}

export class CodexProvider extends LLMProvider {
    private workingDirectory: string = '';
    private codexHome?: string;
    private modelId: string = 'o4-mini';
    private skipGitRepoCheck = true;
    private codexInstance: Codex | null = null;
    private authStatus: any = null;

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
        this.initializationPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            Logger.info('Starting Codex provider initialization...');
            await this.setupWorkingDirectory();
            await this.loadConfiguration();

            const options: Record<string, unknown> = {};
            if (this.codexHome) {
                // Codex SDK accepts codexHome to override ~/.codex
                options.codexHome = this.codexHome;
            }

            this.codexInstance = new Codex(options);

            await this.refreshAuthStatus();

            this.isInitialized = true;
            Logger.info('Codex provider initialized successfully');
        } catch (error) {
            Logger.error(`Failed to initialize Codex provider: ${error}`);
            this.initializationPromise = null;
            this.isInitialized = false;
            throw error;
        }
    }

    private async refreshAuthStatus(): Promise<void> {
        if (!this.codexInstance) {
            return;
        }

        try {
            const authModule = (this.codexInstance as any).auth;
            if (authModule && typeof authModule.getStatus === 'function') {
                this.authStatus = await authModule.getStatus();
            }
        } catch (error) {
            Logger.warn(`Unable to query Codex auth status: ${error}`);
        }
    }

    private async setupWorkingDirectory(): Promise<void> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (workspaceRoot) {
                const superdesignDir = path.join(workspaceRoot, '.superdesign');
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    Logger.info(`Created .superdesign directory for Codex provider: ${superdesignDir}`);
                }
                this.workingDirectory = superdesignDir;
            } else {
                const tempDir = path.join(os.tmpdir(), 'superdesign-codex');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    Logger.info(`Created temporary directory for Codex provider: ${tempDir}`);
                }
                this.workingDirectory = tempDir;
            }
        } catch (error) {
            Logger.error(`Failed to setup working directory for Codex provider: ${error}`);
            this.workingDirectory = process.cwd();
        }
    }

    private async loadConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('superdesign');
        const configuredHome = config.get<string>('codexHome');
        const configuredModel = config.get<string>('codexCliModel');
        const skipGitCheck = config.get<boolean>('codexSkipGitRepoCheck');

        if (configuredHome && configuredHome.trim().length > 0) {
            this.codexHome = configuredHome.trim();
        } else {
            this.codexHome = undefined;
        }

        if (configuredModel && configuredModel.trim().length > 0) {
            this.modelId = configuredModel.trim();
        }

        if (typeof skipGitCheck === 'boolean') {
            this.skipGitRepoCheck = skipGitCheck;
        }
    }

    async query(
        prompt: string,
        options?: Partial<LLMProviderOptions>,
        abortController?: AbortController,
        onMessage?: (message: LLMMessage) => void
    ): Promise<LLMMessage[]> {
        await this.ensureInitialized();

        if (!prompt || !this.codexInstance) {
            throw new Error('Codex provider is not ready or prompt is empty');
        }

        const messages: LLMMessage[] = [];
        const selectedModel = options?.modelId || this.modelId;
        const workingDirectory = options?.cwd || this.workingDirectory;

        let thread: CodexThread;
        try {
            const threadOptions: Record<string, unknown> = {
                workingDirectory,
                skipGitRepoCheck: this.skipGitRepoCheck
            };

            if (selectedModel) {
                threadOptions.model = selectedModel;
            }

            thread = this.codexInstance.startThread(threadOptions);
        } catch (error) {
            Logger.error(`Failed to start Codex thread: ${error}`);
            throw error;
        }

        const abortSignal = abortController?.signal;
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                Logger.info('Abort requested for Codex query');
            });
        }

        const shouldStream = typeof onMessage === 'function';
        try {
            if (shouldStream) {
                const runResult: any = await thread.runStreamed(prompt);
                const events: AsyncIterable<CodexStreamEvent> = runResult?.events;
                if (!events) {
                    Logger.warn('Codex runStreamed returned no events; falling back to non-streaming run');
                    return await this.runNonStreaming(thread, prompt, selectedModel, messages, onMessage);
                }

                for await (const event of events) {
                    if (abortSignal?.aborted) {
                        Logger.info('Aborting Codex stream due to user request');
                        break;
                    }

                    if (!event) {
                        continue;
                    }

                    if (event.type === 'item.completed' && event.item) {
                        const itemType = event.item.type;
                        if (itemType === 'agent_message') {
                            const text = event.item.text ?? '';
                            const message: LLMMessage = {
                                type: 'assistant',
                                role: 'assistant',
                                content: text,
                                text,
                                item: event.item
                            };
                            messages.push(message);
                            onMessage?.(message);
                        } else if (itemType === 'command_execution') {
                            const text = event.item.aggregated_output ?? '';
                            if (text.trim().length > 0) {
                                const message: LLMMessage = {
                                    type: 'tool',
                                    subtype: 'command_execution',
                                    content: text,
                                    text,
                                    item: event.item
                                };
                                messages.push(message);
                                onMessage?.(message);
                            }
                        }
                    } else if (event.type === 'turn.failed') {
                        const errorMessage = event.error?.message || 'Codex turn failed';
                        throw new Error(errorMessage);
                    }
                }

                if (messages.length === 0) {
                    // If no assistant message was emitted, fall back to non-streaming to get finalResponse.
                    const fallbackMessages = await this.runNonStreaming(
                        thread,
                        prompt,
                        selectedModel,
                        messages,
                        onMessage
                    );
                    return fallbackMessages;
                }

                return messages;
            }

            return await this.runNonStreaming(thread, prompt, selectedModel, messages, onMessage);
        } catch (error) {
            Logger.error(`Codex query failed: ${error}`);
            throw error;
        } finally {
            await this.refreshAuthStatus();
        }
    }

    private async runNonStreaming(
        thread: CodexThread,
        prompt: string,
        modelId: string | undefined,
        messages: LLMMessage[],
        onMessage?: (message: LLMMessage) => void
    ): Promise<LLMMessage[]> {
        const runOptions: Record<string, unknown> = {};
        if (modelId) {
            runOptions.model = modelId;
        }

        const turn: any = await thread.run(prompt, runOptions);

        const finalText =
            typeof turn?.finalResponse === 'string'
                ? turn.finalResponse
                : Array.isArray(turn?.finalResponse)
                    ? turn.finalResponse.join('\n')
                    : '';

        if (finalText && finalText.trim().length > 0) {
            const assistantMessage: LLMMessage = {
                type: 'assistant',
                role: 'assistant',
                content: finalText,
                text: finalText,
                turn
            };
            messages.push(assistantMessage);
            onMessage?.(assistantMessage);
        }

        const items: any[] = Array.isArray(turn?.items) ? turn.items : [];
        for (const item of items) {
            if (item?.type === 'command_execution') {
                const text = item.aggregated_output ?? '';
                if (text.trim().length > 0) {
                    const message: LLMMessage = {
                        type: 'tool',
                        subtype: 'command_execution',
                        content: text,
                        text,
                        item
                    };
                    messages.push(message);
                    onMessage?.(message);
                }
            }
        }

        if (messages.length === 0) {
            const placeholder: LLMMessage = {
                type: 'assistant',
                role: 'assistant',
                content: 'Codex did not return any output.',
                text: 'Codex did not return any output.'
            };
            messages.push(placeholder);
        }

        return messages;
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            await this.ensureInitialized();
            return true;
        } catch (error) {
            Logger.error(`Codex provider initialization failed while waiting: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    hasValidConfiguration(): boolean {
        const envConfigured =
            Boolean(process.env.CODEX_API_KEY && process.env.CODEX_API_KEY.trim()) ||
            Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

        const codexDir = this.codexHome || path.join(os.homedir(), '.codex');
        const authFileExists = fs.existsSync(path.join(codexDir, 'auth.json'));

        const statusLoggedIn =
            this.authStatus &&
            typeof this.authStatus === 'object' &&
            this.authStatus.status === 'logged_in';

        return Boolean(envConfigured || authFileExists || statusLoggedIn);
    }

    async refreshConfiguration(): Promise<boolean> {
        try {
            await this.loadConfiguration();
            await this.refreshAuthStatus();
            return true;
        } catch (error) {
            Logger.error(`Failed to refresh Codex configuration: ${error}`);
            return false;
        }
    }

    isAuthError(errorMessage: string): boolean {
        const lower = errorMessage.toLowerCase();
        const authIndicators = [
            'not logged in',
            'login required',
            'authentication',
            'auth token',
            'api key',
            'unauthorized',
            'forbidden',
            'credentials',
            'please run codex login'
        ];
        return authIndicators.some(indicator => lower.includes(indicator));
    }

    getProviderName(): string {
        return 'Codex CLI';
    }

    getProviderType(): 'api' | 'binary' {
        // Codex CLI runs locally and interacts with the filesystem.
        return 'binary';
    }
}
