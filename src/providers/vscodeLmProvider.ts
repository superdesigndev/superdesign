import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LLMProvider, LLMMessage, LLMProviderOptions, LLMStreamCallback } from './llmProvider';
import { Logger } from '../services/logger';

type LanguageModelChatSelector = {
    vendor?: string;
    family?: string;
    version?: string;
    id?: string;
};

type TextPartCtor = new (...args: any[]) => { value?: string };
type ToolCallPartCtor = new (...args: any[]) => { callId?: string; name?: string; input?: Record<string, unknown> };
type ToolResultPartCtor = new (...args: any[]) => { toolCallId?: string };

type VsCodeChatModel = {
    id?: string;
    identifier?: string;
    vendor?: string;
    family?: string;
    name?: string;
    version?: string;
    sendRequest?: (
        messages: any[],
        options?: Record<string, unknown>,
        token?: vscode.CancellationToken
    ) => Promise<{ stream: AsyncIterable<unknown> }>;
    countTokens?: (text: string) => Promise<number>;
    maxInputTokens?: number;
};

const FALLBACK_MODEL_ID = 'vscodelm/fallback';
const FALLBACK_VENDOR = 'superdesign';
const FALLBACK_FAMILY = 'fallback';

type EnsureClientResult = {
    client: VsCodeChatModel;
    degraded: boolean;
    reason?: string;
};

export class VsCodeLmProvider extends LLMProvider {
    private workingDirectory = '';
    private availableModels: VsCodeChatModel[] = [];
    private client: VsCodeChatModel | null = null;
    private clientSelectorKey: string | null = null;
    private configurationDisposable: vscode.Disposable | null = null;
    private lastDegradedReason: string | null = null;

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);

        this.configurationDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
            if (
                event.affectsConfiguration('superdesign.aiModel') ||
                event.affectsConfiguration('superdesign.llmProvider') ||
                event.affectsConfiguration('lm')
            ) {
                Logger.info('VS Code LM configuration changed; resetting cached model.');
                this.availableModels = [];
                this.client = null;
                this.clientSelectorKey = null;
                this.lastDegradedReason = null;
                this.refreshModels().catch((error) => {
                    Logger.warn(`VS Code LM model refresh failed: ${error instanceof Error ? error.message : String(error)}`);
                });
            }
        });

        this.initializationPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        Logger.info('Starting VS Code LM provider initialization...');
        await this.setupWorkingDirectory();
        await this.refreshModels().catch((error) => {
            Logger.warn(`VS Code LM initial model discovery failed: ${error instanceof Error ? error.message : String(error)}`);
        });

        this.isInitialized = true;
        Logger.info('VS Code LM provider initialized successfully');
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
            Logger.warn('VS Code language model API is unavailable. Ensure VS Code 1.95+ with LM API enabled.');
            this.availableModels = [];
            return;
        }

        try {
            const models: VsCodeChatModel[] = await lmApi.selectChatModels({} as any);
            this.availableModels = Array.isArray(models) ? models : [];

            if (this.availableModels.length === 0) {
                Logger.warn('No VS Code language models detected. Sign in to GitHub Copilot or install another LM provider.');
            }
        } catch (error) {
            Logger.warn(`Failed to enumerate VS Code language models: ${error instanceof Error ? error.message : String(error)}`);
            this.availableModels = [];
        }
    }

    private buildModelKey(model: VsCodeChatModel): string {
        const segments = ['vscodelm'];
        const vendor = model.vendor || 'unknown';
        segments.push(vendor);

        if (model.family) {
            segments.push(model.family);
        }

        const idPart = model.identifier || model.id || model.name || 'model';
        segments.push(idPart);

        if (model.version) {
            segments.push(model.version);
        }

        return segments.filter(Boolean).join('/');
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

    private parseSelectorFromModelId(modelId: string): LanguageModelChatSelector {
        if (!modelId || modelId === 'vscodelm/auto') {
            return {};
        }

        const segments = modelId.split('/').filter(Boolean);
        if (segments.length < 2 || segments[0] !== 'vscodelm') {
            return {};
        }

        const selector: LanguageModelChatSelector = {};
        const [, vendor, ...rest] = segments;

        if (vendor && vendor !== 'auto') {
            selector.vendor = vendor;
        }

        if (rest.length === 1) {
            const value = rest[0];
            if (value && value !== 'auto') {
                selector.family = value;
                selector.id = value;
            }
        } else if (rest.length >= 2) {
            const [family, ...idParts] = rest;
            if (family && family !== 'auto') {
                selector.family = family;
            }
            const idCandidate = idParts.filter(Boolean).join('/');
            if (idCandidate) {
                selector.id = idCandidate;
            }
        }

        return selector;
    }

    private selectModelFromCollection(models: VsCodeChatModel[], modelId: string): VsCodeChatModel | undefined {
        if (!models || models.length === 0) {
            return undefined;
        }

        if (!modelId || modelId === 'vscodelm/auto') {
            return models[0];
        }

        const normalizedTarget = modelId.toLowerCase();

        const direct = models.find((model) => this.buildModelKey(model).toLowerCase() === normalizedTarget);
        if (direct) {
            return direct;
        }

        const byIdentifier = models.find((model) => {
            const identifier = (model.id ?? model.identifier ?? '').toLowerCase();
            return identifier && normalizedTarget.endsWith(identifier);
        });
        if (byIdentifier) {
            return byIdentifier;
        }

        const byFamily = models.find((model) => {
            const family = (model.family ?? '').toLowerCase();
            return family && normalizedTarget.includes(family);
        });

        return byFamily ?? models[0];
    }

    private async ensureClient(selector: LanguageModelChatSelector, modelId: string): Promise<EnsureClientResult> {
        const selectorKey = JSON.stringify(selector || {});

        if (this.client && this.clientSelectorKey === selectorKey) {
            return {
                client: this.client,
                degraded: this.client.id === FALLBACK_MODEL_ID,
                reason: this.lastDegradedReason ?? undefined
            };
        }

        const lmApi: any = (vscode as any).lm;
        if (!lmApi || typeof lmApi.selectChatModels !== 'function') {
            const reason = 'VS Code language model API is unavailable. Please restart VS Code or enable the LM preview.';
            Logger.warn(reason);
            const fallbackClient = this.createFallbackClient(reason);
            this.client = fallbackClient;
            this.clientSelectorKey = selectorKey;
            this.lastDegradedReason = reason;
            return { client: fallbackClient, degraded: true, reason };
        }

        try {
            const models: VsCodeChatModel[] = await lmApi.selectChatModels(selector as any);
            this.availableModels = Array.isArray(models) ? models : [];

            const resolved = this.selectModelFromCollection(this.availableModels, modelId);
            if (resolved) {
                this.client = resolved;
                this.clientSelectorKey = selectorKey;
                this.lastDegradedReason = null;
                return { client: resolved, degraded: false };
            }

            const reason = 'No VS Code language models match the selected criteria. Install and sign in to GitHub Copilot or update your Superdesign VS Code LM settings.';
            Logger.warn(reason);
            const fallbackClient = this.createFallbackClient(reason);
            this.client = fallbackClient;
            this.clientSelectorKey = selectorKey;
            this.lastDegradedReason = reason;
            return { client: fallbackClient, degraded: true, reason };
        } catch (error) {
            const reason = `Failed to select VS Code language model: ${error instanceof Error ? error.message : String(error)}`;
            Logger.warn(reason);
            const fallbackClient = this.createFallbackClient(reason);
            this.client = fallbackClient;
            this.clientSelectorKey = selectorKey;
            this.lastDegradedReason = reason;
            return { client: fallbackClient, degraded: true, reason };
        }
    }

    private createFallbackClient(message: string): VsCodeChatModel {
        const textCtor = this.getTextPartCtor();

        const stream = async function* () {
            if (textCtor) {
                yield new textCtor(message);
            } else {
                yield { value: message };
            }
        };

        return {
            id: FALLBACK_MODEL_ID,
            vendor: FALLBACK_VENDOR,
            family: FALLBACK_FAMILY,
            name: 'VS Code LM (degraded)',
            sendRequest: async () => ({
                stream: stream()
            }),
            countTokens: async () => this.estimateTokens(message)
        };
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
            Logger.warn(`Failed to load system prompt for VS Code LM provider: ${error instanceof Error ? error.message : String(error)}`);
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

        const modelId = this.getConfiguredModelId(options?.modelId);
        const selector = this.parseSelectorFromModelId(modelId);
        const { client, degraded, reason } = await this.ensureClient(selector, modelId);

        if (!client || typeof client.sendRequest !== 'function') {
            throw new Error('Selected VS Code LM model is unavailable. Please ensure GitHub Copilot (or another provider) is installed and signed in.');
        }

        const systemPrompt = this.loadSystemPrompt(options?.customSystemPrompt);
        const structuredMessages = Array.isArray((options as any)?.messages) ? (options as any).messages : undefined;
        const { messages, textForCounting } = this.buildVsCodeMessages(systemPrompt, prompt, structuredMessages);

        const cancellationTokenSource = new vscode.CancellationTokenSource();
        const cancellationToken = cancellationTokenSource.token;

        const collectedMessages: LLMMessage[] = [];
        const textBuffer: string[] = [];
        let accumulatedText = '';

        const metadata = degraded ? { degraded: true, diagnostic: reason } : undefined;

        const abortListener = () => {
            if (!cancellationToken.isCancellationRequested) {
                cancellationTokenSource.cancel();
            }
        };

        if (abortController) {
            if (abortController.signal.aborted) {
                abortListener();
                return [];
            }
            abortController.signal.addEventListener('abort', abortListener, { once: true });
        }

        const textPartCtor = this.getTextPartCtor();
        const toolCallCtor = this.getToolCallCtor();

        try {
            const response = await client.sendRequest(
                messages,
                {
                    justification: `Superdesign would like to use '${client.name ?? 'language model'}' from '${client.vendor ?? 'unknown'}'. Click 'Allow' to proceed.`
                },
                cancellationToken
            );

            if (!response || !this.isAsyncIterable(response.stream)) {
                const fallbackText = reason ?? 'VS Code language model did not provide a streaming response. Please verify your Copilot access.';
                accumulatedText += fallbackText;
                textBuffer.push(fallbackText);
                const fallbackMessage: LLMMessage = {
                    type: 'assistant',
                    role: 'assistant',
                    content: fallbackText,
                    text: fallbackText,
                    metadata
                };
                onMessage?.(fallbackMessage);
                collectedMessages.push(fallbackMessage);
            } else {
                for await (const rawChunk of response.stream as AsyncIterable<unknown>) {
                    if (abortController?.signal.aborted) {
                        Logger.info('VS Code LM query aborted by user.');
                        break;
                    }

                    if (textPartCtor && rawChunk instanceof textPartCtor) {
                        const textValue = (rawChunk as { value?: string }).value ?? '';
                        if (textValue) {
                            textBuffer.push(textValue);
                            accumulatedText += textValue;
                            const streamMessage: LLMMessage = {
                                type: 'assistant',
                                role: 'assistant',
                                content: textValue,
                                text: textValue,
                                metadata
                            };
                            onMessage?.(streamMessage);
                        }
                    } else if (toolCallCtor && rawChunk instanceof toolCallCtor) {
                        const toolChunk = rawChunk as { callId?: string; name?: string; input?: Record<string, unknown> };

                        if (!toolChunk.callId || !toolChunk.name) {
                            Logger.warn('VS Code LM provider received incomplete tool call chunk; skipping.');
                            continue;
                        }

                        const toolPayload = {
                            type: 'tool_call',
                            name: toolChunk.name,
                            callId: toolChunk.callId,
                            arguments: toolChunk.input ?? {}
                        };

                        const toolCallText = JSON.stringify(toolPayload);
                        accumulatedText += toolCallText;

                        const toolMessage: LLMMessage = {
                            type: 'tool',
                            subtype: 'command_execution',
                            toolCallId: toolChunk.callId,
                            toolName: toolChunk.name,
                            content: toolCallText,
                            args: toolChunk.input ?? {},
                            metadata
                        };

                        collectedMessages.push(toolMessage);
                        onMessage?.(toolMessage);
                    } else if (typeof rawChunk === 'string') {
                        textBuffer.push(rawChunk);
                        accumulatedText += rawChunk;
                        const streamMessage: LLMMessage = {
                            type: 'assistant',
                            role: 'assistant',
                            content: rawChunk,
                            text: rawChunk,
                            metadata
                        };
                        onMessage?.(streamMessage);
                    } else {
                        Logger.debug(`VS Code LM provider received unsupported chunk type: ${JSON.stringify(rawChunk)}`);
                    }
                }
            }

            const finalText = textBuffer.join('');
            if (finalText.trim()) {
                const finalMessage: LLMMessage = {
                    type: 'assistant',
                    role: 'assistant',
                    content: finalText,
                    text: finalText,
                    metadata
                };
                collectedMessages.push(finalMessage);
            }

            const inputTokens = this.estimateTokens(textForCounting);
            const outputTokens = this.estimateTokens(accumulatedText);

            Logger.info(`VS Code LM usage (est): input ~${inputTokens} tokens, output ~${outputTokens} tokens.`);

            const usageMessage: LLMMessage = {
                type: 'usage',
                role: 'system',
                content: '',
                inputTokens,
                outputTokens,
                metadata
            };

            onMessage?.(usageMessage);
            collectedMessages.push(usageMessage);

            return collectedMessages;
        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                throw new Error('VS Code LM request cancelled by user.');
            }
            throw error;
        } finally {
            if (abortController) {
                abortController.signal.removeEventListener('abort', abortListener);
            }
            if (typeof cancellationTokenSource.dispose === 'function') {
                cancellationTokenSource.dispose();
            }
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
            Logger.error(`VS Code LM provider initialization failed while waiting: ${error instanceof Error ? error.message : String(error)}`);
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
            this.client = null;
            this.clientSelectorKey = null;
            this.lastDegradedReason = null;
            await this.refreshModels();
            return this.availableModels.length > 0;
        } catch (error) {
            Logger.error(`Failed to refresh VS Code LM configuration: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    isAuthError(errorMessage: string): boolean {
        if (!errorMessage) {
            return false;
        }
        const lower = errorMessage.toLowerCase();
        return (
            lower.includes('sign in') ||
            lower.includes('signin') ||
            lower.includes('login') ||
            lower.includes('copilot') ||
            lower.includes('permission') ||
            lower.includes('consent')
        );
    }

    getProviderName(): string {
        return 'VS Code Language Model';
    }

    getProviderType(): 'api' | 'binary' {
        return 'binary';
    }

    private getTextPartCtor(): TextPartCtor | undefined {
        const ctor = (vscode as any).LanguageModelTextPart;
        return typeof ctor === 'function' ? (ctor as TextPartCtor) : undefined;
    }

    private getToolCallCtor(): ToolCallPartCtor | undefined {
        const ctor = (vscode as any).LanguageModelToolCallPart;
        return typeof ctor === 'function' ? (ctor as ToolCallPartCtor) : undefined;
    }

    private getToolResultCtor(): ToolResultPartCtor | undefined {
        const ctor = (vscode as any).LanguageModelToolResultPart;
        return typeof ctor === 'function' ? (ctor as ToolResultPartCtor) : undefined;
    }

    private buildVsCodeMessages(
        systemPrompt: string,
        prompt: string,
        structuredMessages?: any[]
    ): { messages: any[]; textForCounting: string } {
        const lmChatMessage: any = (vscode as any).LanguageModelChatMessage;
        if (!lmChatMessage || typeof lmChatMessage.User !== 'function' || typeof lmChatMessage.Assistant !== 'function') {
            throw new Error('VS Code language model API is unavailable. Please ensure you are using VS Code 1.95+.');
        }

        const textCtor = this.getTextPartCtor();
        const toolCallCtor = this.getToolCallCtor();
        const toolResultCtor = this.getToolResultCtor();

        const vsMessages: any[] = [];
        let textAccumulator = '';

        if (systemPrompt && systemPrompt.trim()) {
            vsMessages.push(lmChatMessage.Assistant(systemPrompt));
            textAccumulator += systemPrompt;
        }

        if (structuredMessages && structuredMessages.length > 0) {
            for (const message of structuredMessages) {
                const role = (message?.role ?? 'user').toLowerCase();
                const { contentParts, flattenedText } = this.transformMessageContent(
                    message,
                    role,
                    textCtor,
                    toolCallCtor,
                    toolResultCtor
                );

                if (role === 'user') {
                    vsMessages.push(lmChatMessage.User(contentParts));
                } else {
                    vsMessages.push(lmChatMessage.Assistant(contentParts));
                }

                textAccumulator += flattenedText;
            }
        } else {
            vsMessages.push(lmChatMessage.User(prompt));
            textAccumulator += prompt;
        }

        return { messages: vsMessages, textForCounting: textAccumulator };
    }

    private transformMessageContent(
        message: any,
        role: string,
        textCtor: TextPartCtor | undefined,
        toolCallCtor: ToolCallPartCtor | undefined,
        toolResultCtor: ToolResultPartCtor | undefined
    ): { contentParts: any; flattenedText: string } {
        const content = message?.content;

        if (typeof content === 'string') {
            return { contentParts: content, flattenedText: content };
        }

        if (!Array.isArray(content)) {
            const serialized = typeof content === 'undefined' ? '' : JSON.stringify(content);
            return { contentParts: serialized, flattenedText: serialized };
        }

        const toolParts: any[] = [];
        const textParts: any[] = [];
        let flattenedText = '';

        const pushText = (text: string) => {
            if (!text) {
                return;
            }
            flattenedText += text;
            if (textCtor) {
                textParts.push(new textCtor(text));
            } else {
                textParts.push(text);
            }
        };

        if (role === 'user') {
            for (const part of content) {
                if (part?.type === 'tool-result') {
                    const callId = part.tool_use_id ?? part.toolCallId ?? part.toolCallID ?? 'tool-call';
                    const segments = this.extractTextSegments(part.content);
                    const resultPart = this.createToolResultPart(toolResultCtor, callId, segments, textCtor);
                    if (resultPart) {
                        toolParts.push(resultPart);
                        flattenedText += segments.join('');
                    } else {
                        const fallback = `[Tool Result ${callId}]: ${segments.join(' ')}`;
                        pushText(fallback);
                    }
                } else if (part?.type === 'image') {
                    pushText(`[Image (${part.source?.type ?? 'unknown'}): ${part.source?.media_type ?? 'unknown'} not supported by VS Code LM API]`);
                } else if (part?.type === 'text') {
                    pushText(part.text ?? '');
                } else {
                    const fallback = typeof part === 'string' ? part : JSON.stringify(part ?? '');
                    pushText(fallback);
                }
            }
        } else if (role === 'assistant') {
            for (const part of content) {
                if (part?.type === 'tool-call' || part?.type === 'tool_use') {
                    const callId = part.toolCallId ?? part.tool_use_id ?? part.id ?? 'tool-call';
                    const name = part.toolName ?? part.name ?? 'tool';
                    const input = part.args ?? part.input ?? {};
                    const toolCallPart = this.createToolCallPart(toolCallCtor, callId, name, input);
                    if (toolCallPart) {
                        toolParts.push(toolCallPart);
                        flattenedText += JSON.stringify({ type: 'tool_call', name, callId, arguments: input });
                    } else {
                        pushText(`[Tool Call ${name}] ${JSON.stringify(input)}`);
                    }
                } else if (part?.type === 'image') {
                    pushText('[Image generation not supported by VS Code LM API]');
                } else if (part?.type === 'text') {
                    pushText(part.text ?? '');
                } else {
                    const fallback = typeof part === 'string' ? part : JSON.stringify(part ?? '');
                    pushText(fallback);
                }
            }
        } else {
            for (const part of content) {
                if (part?.type === 'text') {
                    pushText(part.text ?? '');
                } else {
                    const fallback = typeof part === 'string' ? part : JSON.stringify(part ?? '');
                    pushText(fallback);
                }
            }
        }

        const combinedParts = [...toolParts, ...textParts];
        if (combinedParts.length === 0) {
            return { contentParts: '', flattenedText };
        }

        return { contentParts: combinedParts, flattenedText };
    }

    private extractTextSegments(content: any): string[] {
        if (!content) {
            return [''];
        }

        if (typeof content === 'string') {
            return [content];
        }

        if (Array.isArray(content)) {
            const segments: string[] = [];
            for (const part of content) {
                if (typeof part === 'string') {
                    segments.push(part);
                } else if (part?.type === 'text') {
                    segments.push(part.text ?? '');
                } else if (part?.type === 'image') {
                    segments.push(`[Image (${part.source?.type ?? 'unknown'}): ${part.source?.media_type ?? 'unknown'} not supported by VS Code LM API]`);
                } else {
                    segments.push(typeof part === 'object' ? JSON.stringify(part ?? '') : String(part ?? ''));
                }
            }
            return segments.length > 0 ? segments : [''];
        }

        if (typeof content === 'object') {
            return [JSON.stringify(content)];
        }

        return [String(content ?? '')];
    }

    private createToolCallPart(
        toolCallCtor: ToolCallPartCtor | undefined,
        callId: string,
        name: string,
        input: Record<string, unknown>
    ): any {
        if (!toolCallCtor) {
            return null;
        }

        try {
            return new toolCallCtor(callId, name, input ?? {});
        } catch (error) {
            Logger.warn(`Failed to instantiate LanguageModelToolCallPart: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    private createToolResultPart(
        toolResultCtor: ToolResultPartCtor | undefined,
        callId: string,
        segments: string[],
        textCtor: TextPartCtor | undefined
    ): any {
        if (!toolResultCtor) {
            return null;
        }

        try {
            const parts = (segments.length > 0 ? segments : ['']).map((segment) =>
                textCtor ? new textCtor(segment) : segment
            );
            return new toolResultCtor(callId, parts);
        } catch (error) {
            Logger.warn(`Failed to instantiate LanguageModelToolResultPart: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    private estimateTokens(text: string | undefined): number {
        if (!text) {
            return 0;
        }
        const normalized = text.trim();
        if (!normalized) {
            return 0;
        }
        return Math.max(0, Math.ceil(normalized.length / 4));
    }

    private isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
        return value != null && typeof (value as any)[Symbol.asyncIterator] === 'function';
    }
}
