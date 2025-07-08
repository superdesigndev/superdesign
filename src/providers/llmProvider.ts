import * as vscode from 'vscode';

export interface LLMMessage {
    type: string;
    subtype?: string;
    message?: any;
    content?: string;
    text?: string;
    result?: string;
    is_error?: boolean;
    session_id?: string;
    parent_tool_use_id?: string;
    duration_ms?: number;
    total_cost_usd?: number;
    [key: string]: any;
}

export interface LLMProviderOptions {
    maxTurns?: number;
    allowedTools?: string[];
    permissionMode?: 'acceptEdits' | 'prompt' | 'deny';
    cwd?: string;
    customSystemPrompt?: string;
    thinkingBudgetTokens?: number;
    resume?: string;
    [key: string]: any;
}

export type LLMStreamCallback = (message: LLMMessage) => void;

export abstract class LLMProvider {
    protected outputChannel: vscode.OutputChannel;
    protected isInitialized = false;
    protected initializationPromise: Promise<void> | null = null;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    abstract initialize(): Promise<void>;
    abstract query(
        prompt: string, 
        options?: Partial<LLMProviderOptions>, 
        abortController?: AbortController,
        onMessage?: LLMStreamCallback
    ): Promise<LLMMessage[]>;
    abstract isReady(): boolean;
    abstract waitForInitialization(): Promise<boolean>;
    abstract getWorkingDirectory(): string;
    abstract hasValidConfiguration(): boolean;
    abstract refreshConfiguration(): Promise<boolean>;
    abstract isAuthError(errorMessage: string): boolean;
    abstract getProviderName(): string;
    abstract getProviderType(): 'api' | 'binary';

    protected async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
        if (!this.isInitialized) {
            if (!this.initializationPromise) {
                this.initializationPromise = this.initialize();
                await this.initializationPromise;
            } else {
                throw new Error(`${this.getProviderName()} not initialized`);
            }
        }
    }
}

export enum LLMProviderType {
    CLAUDE_API = 'claude-api',
    CLAUDE_CODE = 'claude-code'
}

export interface LLMProviderConfig {
    type: LLMProviderType;
    apiKey?: string;
    claudeCodePath?: string;
    modelId?: string;
    thinkingBudgetTokens?: number;
}