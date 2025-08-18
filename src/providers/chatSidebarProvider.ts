import * as vscode from 'vscode';
import { ClaudeCodeService } from '../services/claudeCodeService';
import { ChatMessageService } from '../services/chatMessageService';
import { generateWebviewHtml } from '../templates/webviewTemplate';
import type { WebviewContext } from '../types/context';
import type { AgentService } from '../types/agent';
import type { VsCodeConfiguration, ProviderId } from './types';
import { ProviderService } from './ProviderService';
import { getModel } from './VsCodeConfiguration';

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly VIEW_TYPE = 'securedesign.chatView';
    private _view?: vscode.WebviewView;
    private readonly messageHandler: ChatMessageService;
    private readonly providerService: ProviderService;
    private customMessageHandler?: (message: any) => void;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentService: AgentService,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        this.messageHandler = new ChatMessageService(agentService, outputChannel);
        this.providerService = ProviderService.getInstance();
    }

    public setMessageHandler(handler: (message: any) => void) {
        this.customMessageHandler = handler;
    }

    public sendMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'assets'),
            ],
        };

        const webviewContext: WebviewContext = {
            layout: 'sidebar',
            extensionUri: this._extensionUri.toString(),
        };

        const html = await generateWebviewHtml(
            webviewView.webview,
            this._extensionUri,
            webviewContext
        );
        // eslint-disable-next-line require-atomic-updates
        webviewView.webview.html = html;

        // Handle messages from the webview
        const messageListener = webviewView.webview.onDidReceiveMessage(async message => {
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
                        await vscode.commands.executeCommand(
                            message.actionCommand,
                            message.actionArgs
                        );
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
                    await this.handleChangeProvider(
                        message.providerId,
                        message.model,
                        webviewView.webview
                    );
                    break;
                case 'showContextPicker':
                    await this.handleShowContextPicker(webviewView.webview);
                    break;
            }
        });

        // Dispose of the message listener when webview is disposed
        webviewView.onDidDispose(() => {
            messageListener.dispose();
        });
    }

    private async handleGetCurrentProvider(webview: vscode.Webview) {
        const modelToUse = getModel();

        await webview.postMessage({
            command: 'currentProviderResponse',
            provider: modelToUse?.providerId,
            model: modelToUse?.id,
        });
    }

    private async handleChangeProvider(
        providerId: ProviderId,
        model: string,
        webview: vscode.Webview
    ) {
        try {
            const config = vscode.workspace.getConfiguration('securedesign');

            // Get provider for this model
            const providerMetadata = this.providerService.getProviderMetadata(providerId);
            const displayName = `${providerMetadata.name} (${this.providerService.getModelDisplayName(model, providerId)})`;

            // Update both provider and specific model
            await config.update('aiModelProvider', providerId, vscode.ConfigurationTarget.Global);
            await config.update('aiModel', model, vscode.ConfigurationTarget.Global);

            // Check if credentials are configured
            const providerConfig: VsCodeConfiguration = {
                config: config,
                outputChannel: this.outputChannel,
            };

            const validation = this.providerService.validateCredentialsForProvider(
                providerId,
                providerConfig
            );

            if (!validation.isValid) {
                const result = await vscode.window.showWarningMessage(
                    `${displayName} selected, but credentials are not configured. Would you like to configure them now?`,
                    'Configure Credentials',
                    'Later'
                );

                if (result === 'Configure Credentials') {
                    await vscode.commands.executeCommand(providerMetadata.configureCommand);
                }
            }

            // Notify webview of successful change
            await webview.postMessage({
                command: 'providerChanged',
                provider: providerMetadata.id,
                model: model,
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
                    action: 'selectFile',
                },
                {
                    label: '📁 Select Folder',
                    description: 'Choose a folder from your workspace',
                    action: 'selectFolder',
                },
                {
                    label: '🖼️ Select Images',
                    description: 'Choose image files for analysis',
                    action: 'selectImages',
                },
                {
                    label: '📋 Canvas Content',
                    description: 'Use current canvas as context',
                    action: 'canvasContent',
                },
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'What would you like to add as context?',
                matchOnDescription: true,
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
                'Code Files': [
                    'js',
                    'ts',
                    'jsx',
                    'tsx',
                    'py',
                    'java',
                    'cpp',
                    'c',
                    'cs',
                    'go',
                    'rs',
                    'php',
                ],
                'Text Files': ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml'],
                'Config Files': ['config', 'conf', 'env', 'ini'],
            },
        });

        if (files && files.length > 0) {
            const filePath = files[0].fsPath;
            webview.postMessage({
                command: 'contextFromCanvas',
                data: {
                    fileName: filePath,
                    type: 'file',
                },
            });
        }
    }

    private async handleSelectFolder(webview: vscode.Webview) {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
        });

        if (folders && folders.length > 0) {
            const folderPath = folders[0].fsPath;
            webview.postMessage({
                command: 'contextFromCanvas',
                data: {
                    fileName: folderPath,
                    type: 'folder',
                },
            });
        }
    }

    private async handleSelectImages(webview: vscode.Webview) {
        const images = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            filters: {
                Images: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'],
            },
        });

        if (images && images.length > 0) {
            if (images.length === 1) {
                webview.postMessage({
                    command: 'contextFromCanvas',
                    data: {
                        fileName: images[0].fsPath,
                        type: 'image',
                    },
                });
            } else {
                const imagePaths = images.map(img => img.fsPath).join(', ');
                webview.postMessage({
                    command: 'contextFromCanvas',
                    data: {
                        fileName: imagePaths,
                        type: 'images',
                    },
                });
            }
        }
    }

    private async handleCanvasContent(webview: vscode.Webview) {
        // Request canvas content from extension
        await webview.postMessage({
            command: 'contextFromCanvas',
            data: {
                fileName: 'Canvas Content',
                type: 'canvas',
            },
        });
        vscode.window.showInformationMessage('Canvas content added as context');
    }
}
