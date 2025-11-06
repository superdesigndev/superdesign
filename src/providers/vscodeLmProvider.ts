import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LLMProvider, LLMMessage, LLMProviderOptions, LLMStreamCallback } from './llmProvider';
import { Logger } from '../services/logger';

type VsCodeChatModel = {
    identifier?: string;
    vendor?: string;
    family?: string;
    name?: string;
    sendRequest?: (
        messages: any[],
        options?: Record<string, unknown>,
        token?: vscode.CancellationToken
    ) => Promise<{ stream: AsyncIterable<unknown> }>;
};

export class VsCodeLmProvider extends LLMProvider {
    private workingDirectory = '';
    private availableModels: VsCodeChatModel[] = [];

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
        this.initializationPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            Logger.info('Starting VS Code LM provider initialization...');
            await this.setupWorkingDirectory();
            await this.refreshModels();
            this.isInitialized = true;
            Logger.info('VS Code LM provider initialized successfully');
        } catch (error) {
            this.initializationPromise = null;
            this.isInitialized = false;
            Logger.error(`Failed to initialize VS Code LM provider: ${error}`);
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
                    Logger.info(`Created .superdesign directory for VS Code LM provider: ${superdesignDir}`);
                }
                this.workingDirectory = superdesignDir;
            } else {
                const tempDir = path.join(os.tmpdir(), 'superdesign-vscode-lm');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    Logger.info(`Created temporary directory for VS Code LM provider: ${tempDir}`);
                }
                this.workingDirectory = tempDir;
            }
        } catch (error) {
            Logger.error(`Failed to setup working directory for VS Code LM provider: ${error}`);
            this.workingDirectory = process.cwd();
        }
    }

    private async refreshModels(): Promise<void> {
        const lmApi: any = (vscode as any).lm;
        if (!lmApi || typeof lmApi.selectChatModels !== 'function') {
            throw new Error('VS Code language model API is unavailable. Please ensure you are running inside VS Code 1.95+ with the LM API enabled.');
        }

        const models: VsCodeChatModel[] = await lmApi.selectChatModels({} as any);
        this.availableModels = Array.isArray(models) ? models : [];

        if (this.availableModels.length === 0) {
            throw new Error('No VS Code language model providers are available. Install and sign in to GitHub Copilot or another LM extension.');
        }
    }

    private buildModelKey(model: VsCodeChatModel): string {
        const vendor = model.vendor || 'unknown';
        const idPart =
            model.identifier ||
            model.family ||
            model.name ||
            'model';
        return `vscodelm/${vendor}/${idPart}`;
    }

    private getConfiguredModelId(optionsModelId?: string): string {
        if (optionsModelId && optionsModelId.startsWith('vscodelm/')) {
            return optionsModelId;
        }

        const config = vscode.workspace.getConfiguration('superdesign');
        const configured = config.get<string>('aiModel');
        if (configured && configured.startsWith('vscodelm/')) {
            return configured;
        }

        return 'vscodelm/auto';
    }

    private resolveModel(modelId?: string): VsCodeChatModel {
        const targetId = this.getConfiguredModelId(modelId);
        if (targetId === 'vscodelm/auto') {
            return this.availableModels[0];
        }

        return (
            this.availableModels.find(model => this.buildModelKey(model) === targetId) ??
            this.availableModels[0]
        );
    }

    private loadSystemPrompt(customPrompt?: string): string {
        if (customPrompt && customPrompt.trim()) {
            return customPrompt;
        }

        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
                const systemPromptPath = path.join(workspaceRoot, 'system-prompt.txt');
                if (fs.existsSync(systemPromptPath)) {
                    return fs.readFileSync(systemPromptPath, 'utf8');
                }
            }
        } catch (error) {
            Logger.warn(`Failed to load system prompt for VS Code LM provider: ${error}`);
        }

        return `# Role
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
1. **Images**: do NEVER include any images, we can't render images in webview, just try to use css to make some placeholder images. (Don't use service like placehold.co too, we can't render it)
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
    }

    async query(
        prompt: string,
        options?: Partial<LLMProviderOptions>,
        abortController?: AbortController,
        onMessage?: LLMStreamCallback
    ): Promise<LLMMessage[]> {
        await this.ensureInitialized();

        if (!prompt || !prompt.trim()) {
            throw new Error('VS Code LM provider requires a non-empty prompt.');
        }

        const model = this.resolveModel(options?.modelId);
        const lmChatMessage: any = (vscode as any).LanguageModelChatMessage;
        const lmTextPart: any = (vscode as any).LanguageModelTextPart;
        const lmToolCallPart: any = (vscode as any).LanguageModelToolCallPart;

        type TextPart = { value?: string };
        type ToolCallPart = { callId?: string; name?: string; input?: Record<string, unknown> };

        const TextPartCtor = (typeof lmTextPart === 'function'
            ? lmTextPart
            : undefined) as (new (...args: any[]) => TextPart) | undefined;
        const ToolCallCtor = (typeof lmToolCallPart === 'function'
            ? lmToolCallPart
            : undefined) as (new (...args: any[]) => ToolCallPart) | undefined;

        if (!model || typeof model.sendRequest !== 'function') {
            throw new Error('Selected VS Code LM model is unavailable. Please ensure GitHub Copilot (or another provider) is installed and signed in.');
        }

        const systemPrompt = this.loadSystemPrompt(options?.customSystemPrompt);
        const messages: any[] = [];
        if (systemPrompt) {
            messages.push(lmChatMessage.Assistant(systemPrompt));
        }
        messages.push(lmChatMessage.User(prompt));

        const cancellationToken = (abortController as any)?.token;
        const response = await model.sendRequest(
            messages,
            { justification: 'Superdesign chat request via VS Code LM provider' },
            cancellationToken
        );

        const collectedMessages: LLMMessage[] = [];
        const textBuffer: string[] = [];

        try {
            for await (const chunk of response.stream as AsyncIterable<unknown>) {
                if (abortController?.signal.aborted) {
                    Logger.info('VS Code LM query aborted by user.');
                    break;
                }

                if (TextPartCtor && chunk instanceof TextPartCtor) {
                    const textChunk = chunk as TextPart;
                    const text = textChunk.value ?? '';
                    if (text) {
                        textBuffer.push(text);
                        const streamMessage: LLMMessage = {
                            type: 'assistant',
                            role: 'assistant',
                            content: text,
                            text
                        };
                        onMessage?.(streamMessage);
                    }
                } else if (ToolCallCtor && chunk instanceof ToolCallCtor) {
                    const toolChunk = chunk as ToolCallPart;
                    const toolMessage: LLMMessage = {
                        type: 'tool',
                        subtype: 'command_execution',
                        toolCallId: toolChunk.callId,
                        toolName: toolChunk.name,
                        content: JSON.stringify(toolChunk.input ?? {}),
                        args: toolChunk.input ?? {}
                    };
                    collectedMessages.push(toolMessage);
                    onMessage?.(toolMessage);
                }
            }
        } catch (error) {
            Logger.error(`VS Code LM streaming error: ${error}`);
            throw error;
        }

        const finalText = textBuffer.join('');
        if (finalText.trim()) {
            const finalMessage: LLMMessage = {
                type: 'assistant',
                role: 'assistant',
                content: finalText,
                text: finalText
            };
            collectedMessages.push(finalMessage);
        }

        return collectedMessages;
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            await this.ensureInitialized();
            return true;
        } catch (error) {
            Logger.error(`VS Code LM provider initialization failed while waiting: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    hasValidConfiguration(): boolean {
        return this.availableModels.length > 0;
    }

    async refreshConfiguration(): Promise<boolean> {
        try {
            await this.refreshModels();
            return true;
        } catch (error) {
            Logger.error(`Failed to refresh VS Code LM configuration: ${error}`);
            return false;
        }
    }

    isAuthError(errorMessage: string): boolean {
        if (!errorMessage) {
            return false;
        }
        const lower = errorMessage.toLowerCase();
        return lower.includes('sign in') ||
            lower.includes('login') ||
            lower.includes('copilot') ||
            lower.includes('permission');
    }

    getProviderName(): string {
        return 'VS Code Language Model';
    }

    getProviderType(): 'api' | 'binary' {
        return 'binary';
    }
}
