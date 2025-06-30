import * as vscode from 'vscode';
import { AgentFactory } from '../core/agent-factory';
import { ChatMessageService } from '../services/chatMessageService';
import { generateWebviewHtml } from '../templates/webviewTemplate';
import { WebviewContext } from '../types/context';

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly VIEW_TYPE = 'superdesign.chatView';
    private _view?: vscode.WebviewView;
    private messageHandler: ChatMessageService | null = null;
    private customMessageHandler?: (message: any) => void;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly agentFactory: AgentFactory,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        // MessageHandler will be initialized when first needed
    }

    /**
     * Get the current agent from factory and ensure message handler is initialized
     */
    private async ensureMessageHandler(): Promise<ChatMessageService> {
        const currentAgent = await this.agentFactory.getOrCreateAgent();
        
        // Create or update message handler if needed
        if (!this.messageHandler || this.messageHandler['agentService'] !== currentAgent) {
            this.outputChannel.appendLine(`🔄 ChatSidebarProvider: Creating/updating message handler with current agent`);
            this.messageHandler = new ChatMessageService(currentAgent, this.outputChannel);
        }
        
        return this.messageHandler;
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
                    case 'chatWithClaude':
                        // Always get the current agent before processing messages
                        await this.ensureMessageHandler();
                        await this.messageHandler!.handleChatMessage(message, webviewView.webview);
                        break;
                    case 'stopChat':
                        await this.messageHandler!.stopCurrentChat(webviewView.webview);
                        break;
                }
            }
        );
    }
} 