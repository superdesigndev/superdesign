import * as vscode from 'vscode';
import type { SendMessageCommand, ChatMessage } from '../types/chat';

// Types for Claude service (avoid importing the actual class)
interface IClaudeService {
    sendMessage(message: string, onUpdate?: (msg: any) => void): Promise<any>;
    clearHistory(): void;
    getHistory(): any[];
    getSessionId(): string | null;
}

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _claudeService?: IClaudeService;

    constructor(private readonly _extensionUri: vscode.Uri) {
        // ClaudeService will be created lazily when first needed
    }
     
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from React
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message from webview:', message);
            
            switch (message.command) {
                case 'sendMessage':
                    console.log('Handling sendMessage with data:', message.data);
                    await this._handleSendMessage(message as SendMessageCommand);
                    break;
                case 'clearHistory':
                    console.log('Handling clearHistory');
                    await this._handleClearHistory();
                    break;
                default:
                    console.log('Unknown command:', message.command);
            }
        });
    }

    /**
     * Ensure Claude service is initialized
     */
    private async _ensureClaudeService(): Promise<IClaudeService> {
        if (!this._claudeService) {
            try {
                // Dynamic import to avoid loading Claude SDK at extension startup
                const { ClaudeService } = await import('../services/claudeService');
                this._claudeService = new ClaudeService();
            } catch (error) {
                throw new Error(`Failed to initialize Claude service: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return this._claudeService;
    }

    /**
     * Handle send message command from React
     */
    private async _handleSendMessage(command: SendMessageCommand) {
        console.log('_handleSendMessage called with command:', command);
        
        if (!this._view) {
            console.log('No view available, returning early');
            return;
        }

        const userMessage = command.data.message;
        console.log('User message:', userMessage);
        
        try {
            // Ensure Claude service is initialized
            console.log('Ensuring Claude service is initialized...');
            const claudeService = await this._ensureClaudeService();
            console.log('Claude service initialized, sending message...');
            
            // Send Claude request with streaming callback
            const response = await claudeService.sendMessage(
                userMessage,
                (streamingMessage: ChatMessage) => {
                    console.log('Received streaming message:', streamingMessage);
                    // Send streaming update to React
                    this._postMessageToWebview({
                        command: 'messageUpdate',
                        data: { message: streamingMessage }
                    });
                }
            );

            console.log('Final response from Claude:', response);
            // Send final response to React
            this._postMessageToWebview({
                command: 'messageComplete',
                data: { response }
            });

        } catch (error) {
            console.error('Error in _handleSendMessage:', error);
            // Send error to React
            this._postMessageToWebview({
                command: 'error',
                data: { 
                    error: error instanceof Error ? error.message : 'Unknown error occurred'
                }
            });
        }
    }

    /**
     * Handle clear history command from React
     */
    private async _handleClearHistory() {
        try {
            const claudeService = await this._ensureClaudeService();
            claudeService.clearHistory();
            
            // Notify React that history was cleared
            this._postMessageToWebview({
                command: 'historyCleared',
                data: {}
            });
        } catch (error) {
            // Send error to React if service initialization fails
            this._postMessageToWebview({
                command: 'error',
                data: { 
                    error: error instanceof Error ? error.message : 'Failed to clear history'
                }
            });
        }
    }

    /**
     * Send message to the webview
     */
    private _postMessageToWebview(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    /**
     * Generate HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'chat.js')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Superdesign Chat</title>
            </head>
            <body>
                <div id="chat-root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    /**
     * Generate a nonce for security
     */
    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}