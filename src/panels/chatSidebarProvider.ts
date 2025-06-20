import * as vscode from 'vscode';

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
    constructor(private readonly _extensionUri: vscode.Uri) {}
     
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        //handle messages from React
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'sendMessage':
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'chat.js')
        );

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <title>Superdesign</title>
        </head>
        <body>
            <div id='chat-root'></div>
            <script src='${scriptUri}'></script>
        </body>
        </html>`;
    }
}