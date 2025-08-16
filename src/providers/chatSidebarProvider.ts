import * as vscode from 'vscode';
import { ClaudeCodeService } from '../services/claudeCodeService';
import { ChatMessageService } from '../services/chatMessageService';
import { generateWebviewHtml } from '../templates/webviewTemplate';
import type { WebviewContext } from '../types/context';
import type { AgentService } from '../types/agent';

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly VIEW_TYPE = 'securedesign.chatView';
    private _view?: vscode.WebviewView;
    private readonly messageHandler: ChatMessageService;
    private customMessageHandler?: (message: any) => void;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentService: AgentService,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        this.messageHandler = new ChatMessageService(agentService, outputChannel);
    }

    public setMessageHandler(handler: (message: any) => void) {
        this.customMessageHandler = handler;
    }

    public sendMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'assets')
            ]
        };

        const webviewContext: WebviewContext = {
            layout: 'sidebar',
            extensionUri: this._extensionUri.toString()
        };

        webviewView.webview.html = generateWebviewHtml(
            webviewView.webview,
            this._extensionUri,
            webviewContext
        );

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                // First try custom message handler for auto-canvas functionality
                if (this.customMessageHandler) {
                    this.customMessageHandler(message);
                }

                // Then handle regular chat messages
                switch (message.command) {
                    case 'chatMessage':
                        await this.messageHandler.handleChatMessage(message, webviewView.webview);
                        break;
                    case 'stopChat':
                        await this.messageHandler.stopCurrentChat(webviewView.webview);
                        break;
                    case 'executeAction':
                        // Execute command from error action buttons
                        console.log('Executing action:', message.actionCommand, message.actionArgs);
                        if (message.actionArgs) {
                            await vscode.commands.executeCommand(message.actionCommand, message.actionArgs);
                        } else {
                            await vscode.commands.executeCommand(message.actionCommand);
                        }
                        break;
                    case 'getBase64Image':
                        // Forward to extension for image conversion
                        // This will be handled by extension.ts
                        break;
                    case 'getCurrentProvider':
                        await this.handleGetCurrentProvider(webviewView.webview);
                        break;
                    case 'changeProvider':
                        await this.handleChangeProvider(message.model, webviewView.webview);
                        break;
                    case 'showContextPicker':
                        await this.handleShowContextPicker(webviewView.webview);
                        break;
                }
            }
        );
    }

    private async handleGetCurrentProvider(webview: vscode.Webview) {
        const config = vscode.workspace.getConfiguration('securedesign');
        const currentProvider = config.get<string>('aiModelProvider', 'anthropic');
        const currentModel = config.get<string>('aiModel');
        
        // If no specific model is set, use defaults
        let defaultModel: string;
        switch (currentProvider) {
            case 'openai':
                defaultModel = 'gpt-4o';
                break;
            case 'openrouter':
                defaultModel = 'anthropic/claude-3-7-sonnet-20250219';
                break;
            case 'google':
                defaultModel = 'gemini-2.5-pro';
            case 'bedrock':
                defaultModel = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
                break;
            case 'anthropic':
            default:
                defaultModel = 'claude-3-5-sonnet-20241022';
                break;
        }
        
        await webview.postMessage({
            command: 'currentProviderResponse',
            provider: currentProvider,
            model: currentModel || defaultModel
        });
    }

    private async handleChangeProvider(model: string, webview: vscode.Webview) {
        try {
            const config = vscode.workspace.getConfiguration('securedesign');
            
            // Determine provider and API key based on model
            let provider: string;
            let apiKeyKey: string;
            let configureCommand: string;
            let displayName: string;
            
            if (model.includes('/')) {
                // OpenRouter model (contains slash like "openai/gpt-4o")
                provider = 'openrouter';
                apiKeyKey = 'openrouterApiKey';
                configureCommand = 'securedesign.configureOpenRouterApiKey';
                displayName = `OpenRouter (${this.getModelDisplayName(model)})`;
            } else if (model.startsWith('claude-')) {
                provider = 'anthropic';
                apiKeyKey = 'anthropicApiKey';
                configureCommand = 'securedesign.configureApiKey';
                displayName = `Anthropic (${this.getModelDisplayName(model)})`;
            } else if (model.startsWith('gemini-')) {
                provider = 'google';
                apiKeyKey = 'googleApiKey';
                configureCommand = 'securedesign.configureGoogleApiKey';
                displayName = `Google (${this.getModelDisplayName(model)})`;
            } else if (model.startsWith('anthropic.') || 
                       model.startsWith('amazon.') ||
                       model.startsWith('meta.') ||
                       model.startsWith('ai21.') ||
                       model.startsWith('cohere.') ||
                       model.startsWith('mistral.')) {
                provider = 'bedrock';
                apiKeyKey = 'awsAccessKeyId'; // We'll check both AWS keys in the validation
                configureCommand = 'superdesign.configureAWSBedrock';
                displayName = `AWS Bedrock (${this.getModelDisplayName(model)})`;
            } else {
                provider = 'openai';
                apiKeyKey = 'openaiApiKey';
                configureCommand = 'securedesign.configureOpenAIApiKey';
                displayName = `OpenAI (${this.getModelDisplayName(model)})`;
            }
            
            // Update both provider and specific model
            await config.update('aiModelProvider', provider, vscode.ConfigurationTarget.Global);
            await config.update('aiModel', model, vscode.ConfigurationTarget.Global);
            
            // Check if the credentials are configured for the selected provider
            let isConfigured = false;
            if (provider === 'bedrock') {
                const awsAccessKeyId = config.get<string>('awsAccessKeyId');
                const awsSecretAccessKey = config.get<string>('awsSecretAccessKey');
                isConfigured = !!(awsAccessKeyId && awsSecretAccessKey);
            } else {
                const apiKey = config.get<string>(apiKeyKey);
                isConfigured = !!apiKey;
            }
            
            if (!isConfigured) {
                const result = await vscode.window.showWarningMessage(
                    `${displayName} selected, but credentials are not configured. Would you like to configure them now?`,
                    'Configure Credentials',
                    'Later'
                );
                
                if (result === 'Configure Credentials') {
                    await vscode.commands.executeCommand(configureCommand);
                }
            }

            // Notify webview of successful change
            await webview.postMessage({
                command: 'providerChanged',
                provider: provider,
                model: model
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update AI model: ${error}`);
        }
    }

    private async handleShowContextPicker(webview: vscode.Webview) {
        try {
            // Show quick pick with context options
            const options = [
                {
                    label: '📄 Select File',
                    description: 'Choose a file from your workspace',
                    action: 'selectFile'
                },
                {
                    label: '📁 Select Folder',
                    description: 'Choose a folder from your workspace',
                    action: 'selectFolder'
                },
                {
                    label: '🖼️ Select Images',
                    description: 'Choose image files for analysis',
                    action: 'selectImages'
                },
                {
                    label: '📋 Canvas Content',
                    description: 'Use current canvas as context',
                    action: 'canvasContent'
                }
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'What would you like to add as context?',
                matchOnDescription: true
            });

            if (!selected) {
                return; // User cancelled
            }

            switch (selected.action) {
                case 'selectFile':
                    await this.handleSelectFile(webview);
                    break;
                case 'selectFolder':
                    await this.handleSelectFolder(webview);
                    break;
                case 'selectImages':
                    await this.handleSelectImages(webview);
                    break;
                case 'canvasContent':
                    await this.handleCanvasContent(webview);
                    break;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show context picker: ${error}`);
        }
    }

    private async handleSelectFile(webview: vscode.Webview) {
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'All Files': ['*'],
                'Code Files': ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php'],
                'Text Files': ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml'],
                'Config Files': ['config', 'conf', 'env', 'ini']
            }
        });

        if (files && files.length > 0) {
            const filePath = files[0].fsPath;
            webview.postMessage({
                command: 'contextFromCanvas',
                data: {
                    fileName: filePath,
                    type: 'file'
                }
            });
        }
    }

    private async handleSelectFolder(webview: vscode.Webview) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
        });

        if (folders && folders.length > 0) {
            const folderPath = folders[0].fsPath;
            webview.postMessage({
                command: 'contextFromCanvas',
                data: {
                    fileName: folderPath,
                    type: 'folder'
                }
            });
        }
    }

    private async handleSelectImages(webview: vscode.Webview) {
        const images = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp']
            }
        });

        if (images && images.length > 0) {
            if (images.length === 1) {
                webview.postMessage({
                    command: 'contextFromCanvas',
                    data: {
                        fileName: images[0].fsPath,
                        type: 'image'
                    }
                });
            } else {
                const imagePaths = images.map(img => img.fsPath).join(', ');
                webview.postMessage({
                    command: 'contextFromCanvas',
                    data: {
                        fileName: imagePaths,
                        type: 'images'
                    }
                });
            }
        }
    }

    private async handleCanvasContent(webview: vscode.Webview) {
        // Request canvas content from extension
        webview.postMessage({
            command: 'contextFromCanvas',
            data: {
                fileName: 'Canvas Content',
                type: 'canvas'
            }
        });
        vscode.window.showInformationMessage('Canvas content added as context');
    }
    
    private getModelDisplayName(model: string): string {
        const modelNames: { [key: string]: string } = {
            // OpenAI models
            'gpt-4.1': 'GPT-4.1',
            'gpt-4.1-mini': 'GPT-4.1 Mini',
            'gpt-4.1-nano': 'GPT-4.1 Nano',
            'gpt-4o': 'GPT-4o',
            'gpt-4o-mini': 'GPT-4o Mini',
            // Anthropic models
            'claude-4-opus-20250514': 'Claude 4 Opus',
            'claude-4-sonnet-20250514': 'Claude 4 Sonnet',
            'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
            'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
            'claude-3-opus-20240229': 'Claude 3 Opus',
            'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
            'claude-3-haiku-20240307': 'Claude 3 Haiku',
            // Google models
            'gemini-2.5-pro': 'Gemini 2.5 Pro',
            'gemini-2.5-flash': 'Gemini 2.5 Flash',
            'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
            // AWS Bedrock - Anthropic models
            'anthropic.claude-3-5-sonnet-20241022-v2:0': 'Claude 3.5 Sonnet v2',
            'anthropic.claude-3-5-sonnet-20240620-v1:0': 'Claude 3.5 Sonnet',
            'anthropic.claude-3-opus-20240229-v1:0': 'Claude 3 Opus',
            'anthropic.claude-3-sonnet-20240229-v1:0': 'Claude 3 Sonnet',
            'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku',
            // AWS Bedrock - Amazon models
            'amazon.nova-pro-v1:0': 'Amazon Nova Pro',
            'amazon.nova-lite-v1:0': 'Amazon Nova Lite',
            'amazon.nova-micro-v1:0': 'Amazon Nova Micro',
            // AWS Bedrock - Meta models
            'meta.llama3-2-90b-instruct-v1:0': 'Llama 3.2 90B Instruct',
            'meta.llama3-2-11b-instruct-v1:0': 'Llama 3.2 11B Instruct',
            'meta.llama3-2-3b-instruct-v1:0': 'Llama 3.2 3B Instruct',
            'meta.llama3-2-1b-instruct-v1:0': 'Llama 3.2 1B Instruct',
            'meta.llama3-1-405b-instruct-v1:0': 'Llama 3.1 405B Instruct',
            'meta.llama3-1-70b-instruct-v1:0': 'Llama 3.1 70B Instruct',
            'meta.llama3-1-8b-instruct-v1:0': 'Llama 3.1 8B Instruct',
            // AWS Bedrock - Mistral models
            'mistral.mistral-large-2407-v1:0': 'Mistral Large 2407',
            'mistral.mistral-small-2402-v1:0': 'Mistral Small 2402',
            'mistral.mistral-7b-instruct-v0:2': 'Mistral 7B Instruct',
            'mistral.mixtral-8x7b-instruct-v0:1': 'Mixtral 8x7B Instruct',
            // AWS Bedrock - AI21 models
            'ai21.jamba-1-5-large-v1:0': 'AI21 Jamba 1.5 Large',
            'ai21.jamba-1-5-mini-v1:0': 'AI21 Jamba 1.5 Mini',
            // AWS Bedrock - Cohere models
            'cohere.command-r-plus-v1:0': 'Cohere Command R+',
            'cohere.command-r-v1:0': 'Cohere Command R',
            // OpenRouter - Google models
            'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
            'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
            'google/gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro Preview',
            'google/gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash Preview',
            'google/gemini-2.5-pro-preview-03-25': 'Gemini 2.5 Pro Preview (Mar)',
            'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
            'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash Exp',
            'google/gemini-2.0-flash-lite-001': 'Gemini 2.0 Flash Lite',
            'google/gemma-3-27b-it': 'Gemma 3 27B',
            'google/gemma-3-12b-it': 'Gemma 3 12B',
            'google/gemma-3-4b-it': 'Gemma 3 4B',
            'google/gemma-2-27b-it': 'Gemma 2 27B',
            'google/gemma-2-9b-it': 'Gemma 2 9B',
            'google/gemini-flash-1.5': 'Gemini Flash 1.5',
            'google/gemini-flash-1.5-8b': 'Gemini Flash 1.5 8B',
            'google/gemini-pro-1.5': 'Gemini Pro 1.5',
            // OpenRouter - Meta models
            'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick 17B',
            'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B',
            'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B',
            'meta-llama/llama-3.2-90b-vision-instruct': 'Llama 3.2 90B Vision',
            'meta-llama/llama-3.2-11b-vision-instruct': 'Llama 3.2 11B Vision',
            'meta-llama/llama-3.2-3b-instruct': 'Llama 3.2 3B',
            'meta-llama/llama-3.2-1b-instruct': 'Llama 3.2 1B',
            'meta-llama/llama-3.1-405b-instruct': 'Llama 3.1 405B',
            'meta-llama/llama-3.1-70b-instruct': 'Llama 3.1 70B',
            'meta-llama/llama-3.1-8b-instruct': 'Llama 3.1 8B',
            'meta-llama/llama-3-70b-instruct': 'Llama 3 70B',
            'meta-llama/llama-3-8b-instruct': 'Llama 3 8B',
            'meta-llama/llama-guard-4-12b': 'Llama Guard 4 12B',
            'meta-llama/llama-guard-3-8b': 'Llama Guard 3 8B',
            'meta-llama/llama-guard-2-8b': 'Llama Guard 2 8B',
            // OpenRouter - DeepSeek models
            'deepseek/deepseek-r1': 'DeepSeek R1',
            'deepseek/deepseek-r1-0528': 'DeepSeek R1 0528',
            'deepseek/deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill Llama 70B',
            'deepseek/deepseek-r1-distill-llama-8b': 'DeepSeek R1 Distill Llama 8B',
            'deepseek/deepseek-r1-distill-qwen-32b': 'DeepSeek R1 Distill Qwen 32B',
            'deepseek/deepseek-r1-distill-qwen-14b': 'DeepSeek R1 Distill Qwen 14B',
            'deepseek/deepseek-r1-distill-qwen-7b': 'DeepSeek R1 Distill Qwen 7B',
            'deepseek/deepseek-r1-distill-qwen-1.5b': 'DeepSeek R1 Distill Qwen 1.5B',
            'deepseek/deepseek-chat-v3': 'DeepSeek Chat V3',
            'deepseek/deepseek-v3-base': 'DeepSeek V3 Base',
            'deepseek/deepseek-prover-v2': 'DeepSeek Prover V2',
            // OpenRouter - Mistral models
            'mistralai/mistral-small-3.2-24b-instruct-2506': 'Mistral Small 3.2 24B',
            'mistralai/magistral-small-2506': 'Magistral Small',
            'mistralai/magistral-medium-2506': 'Magistral Medium',
            'mistralai/devstral-small-2505': 'Devstral Small',
            'mistralai/mistral-medium-3': 'Mistral Medium 3',
            'mistralai/mistral-small-3.1-24b-instruct-2503': 'Mistral Small 3.1 24B',
            'mistralai/mistral-saba-2502': 'Mistral Saba',
            'mistralai/mistral-small-24b-instruct-2501': 'Mistral Small 24B',
            'mistralai/codestral-2501': 'Codestral',
            'mistralai/mistral-large-2411': 'Mistral Large 2411',
            'mistralai/mistral-large-2407': 'Mistral Large 2407',
            'mistralai/pixtral-large-2411': 'Pixtral Large',
            'mistralai/pixtral-12b': 'Pixtral 12B',
            'mistralai/ministral-8b': 'Ministral 8B',
            'mistralai/ministral-3b': 'Ministral 3B',
            'mistralai/mistral-nemo': 'Mistral Nemo',
            'mistralai/mistral-large': 'Mistral Large',
            'mistralai/mixtral-8x22b-instruct': 'Mixtral 8x22B',
            'mistralai/mixtral-8x7b-instruct': 'Mixtral 8x7B',
            'mistralai/mistral-7b-instruct': 'Mistral 7B',
            // OpenRouter - xAI models
            'x-ai/grok-3': 'Grok 3',
            'x-ai/grok-3-mini': 'Grok 3 Mini',
            'x-ai/grok-3-beta': 'Grok 3 Beta',
            'x-ai/grok-3-mini-beta': 'Grok 3 Mini Beta',
            'x-ai/grok-2-vision-1212': 'Grok 2 Vision',
            'x-ai/grok-2-1212': 'Grok 2',
            'x-ai/grok-vision-beta': 'Grok Vision Beta',
            // OpenRouter - Qwen models
            'qwen/qwen3-235b-a22b-04-28': 'Qwen3 235B',
            'qwen/qwen3-32b-04-28': 'Qwen3 32B',
            'qwen/qwen3-30b-a3b-04-28': 'Qwen3 30B',
            'qwen/qwen3-14b-04-28': 'Qwen3 14B',
            'qwen/qwen3-8b-04-28': 'Qwen3 8B',
            'qwen/qwen2.5-vl-72b-instruct': 'Qwen2.5 VL 72B',
            'qwen/qwen2.5-vl-32b-instruct': 'Qwen2.5 VL 32B',
            'qwen/qwen-2.5-coder-32b-instruct': 'Qwen 2.5 Coder 32B',
            'qwen/qwen-2.5-72b-instruct': 'Qwen 2.5 72B',
            'qwen/qwen-2.5-7b-instruct': 'Qwen 2.5 7B',
            'qwen/qwen-2-72b-instruct': 'Qwen 2 72B',
            'qwen/qwen-2-vl-7b-instruct': 'Qwen 2 VL 7B',
            'qwen/qwq-32b': 'QwQ 32B',
            'qwen/qwq-32b-preview': 'QwQ 32B Preview',
            'qwen/qwen-vl-max-2025-01-25': 'Qwen VL Max',
            'qwen/qwen-vl-plus': 'Qwen VL Plus',
            'qwen/qwen-max-2025-01-25': 'Qwen Max',
            'qwen/qwen-plus-2025-01-25': 'Qwen Plus',
            'qwen/qwen-turbo-2024-11-01': 'Qwen Turbo',
            // OpenRouter - Perplexity models
            'perplexity/sonar-reasoning-pro': 'Sonar Reasoning Pro',
            'perplexity/sonar-pro': 'Sonar Pro',
            'perplexity/sonar-deep-research': 'Sonar Deep Research',
            'perplexity/sonar-reasoning': 'Sonar Reasoning',
            'perplexity/sonar': 'Sonar',
            'perplexity/r1-1776': 'R1-1776',
            'perplexity/llama-3.1-sonar-large-128k-online': 'Llama 3.1 Sonar Large Online',
            'perplexity/llama-3.1-sonar-small-128k-online': 'Llama 3.1 Sonar Small Online',
            // OpenRouter - Microsoft models
            'microsoft/phi-4-reasoning-plus-04-30': 'Phi-4 Reasoning Plus',
            'microsoft/mai-ds-r1': 'MAI-DS-R1',
            'microsoft/phi-4-multimodal-instruct': 'Phi-4 Multimodal',
            'microsoft/phi-4': 'Phi-4',
            'microsoft/phi-3.5-mini-128k-instruct': 'Phi-3.5 Mini',
            'microsoft/phi-3-medium-128k-instruct': 'Phi-3 Medium',
            'microsoft/phi-3-mini-128k-instruct': 'Phi-3 Mini',
            'microsoft/wizardlm-2-8x22b': 'WizardLM-2 8x22B',
            // OpenRouter - NVIDIA models
            'nvidia/llama-3.3-nemotron-super-49b-v1': 'Llama 3.3 Nemotron Super 49B',
            'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'Llama 3.1 Nemotron Ultra 253B',
            'nvidia/llama-3.1-nemotron-70b-instruct': 'Llama 3.1 Nemotron 70B',
            // OpenRouter - Other models
            'minimax/minimax-01': 'MiniMax-01',
            'minimax/minimax-m1': 'MiniMax-M1',
            'liquid/lfm-40b': 'LFM 40B',
            'liquid/lfm-7b': 'LFM 7B',
            'liquid/lfm-3b': 'LFM 3B',
            'cohere/command-a-03-2025': 'Command A',
            'cohere/command-r7b-12-2024': 'Command R7B',
            'cohere/command-r-plus': 'Command R Plus',
            'cohere/command-r': 'Command R',
            'amazon/nova-pro-v1': 'Nova Pro',
            'amazon/nova-lite-v1': 'Nova Lite',
            'amazon/nova-micro-v1': 'Nova Micro',
            'ai21/jamba-1.6-large': 'Jamba 1.6 Large',
            'ai21/jamba-1.6-mini': 'Jamba 1.6 Mini',
            '01-ai/yi-large': 'Yi Large',
            'inflection/inflection-3-productivity': 'Inflection 3 Productivity',
            'inflection/inflection-3-pi': 'Inflection 3 Pi',
            'rekaai/reka-flash-3': 'Reka Flash 3',
            'openrouter/auto': 'Auto (Best Available)'
        };
        
        return modelNames[model] || model;
    }
} 