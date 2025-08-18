import * as vscode from 'vscode';
import type { WebviewContext } from '../types/context';

export async function generateWebviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    context: WebviewContext
): Promise<string> {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
    );

    // Generate webview URIs for logo images
    const logoUris = {
        cursor: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'assets', 'cursor_logo.png')).toString(),
        windsurf: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'assets', 'windsurf_logo.png')).toString(),
        claudeCode: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'assets', 'claude_code_logo.png')).toString(),
        lovable: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'assets', 'lovable_logo.png')).toString(),
        bolt: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'assets', 'bolt_logo.jpg')).toString(),
    };

    // Debug logging
    console.log('Extension URI:', extensionUri.toString());
    console.log('Generated logo URIs:', logoUris);
    
    // Check if files exist
    const fs = await import('fs');
    const path = await import('path');
    Object.entries(logoUris).forEach(([name, _uri]) => {
        const filePath = path.join(extensionUri.fsPath, 'src', 'assets', name === 'bolt' ? 'bolt_logo.jpg' : `${name === 'claudeCode' ? 'claude_code' : name}_logo.png`);
        const exists = fs.existsSync(filePath);
        console.log(`${name} logo exists at ${filePath}:`, exists);
    });

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: https: vscode-webview:; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Securedesign Chat</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                font-weight: var(--vscode-font-weight);
                color: ${context.layout === 'sidebar' ? 'var(--vscode-sideBar-foreground)' : 'var(--vscode-panel-foreground)'};
                background-color: ${context.layout === 'sidebar' ? 'var(--vscode-sideBar-background)' : 'var(--vscode-panel-background)'};
                border-right: ${context.layout === 'sidebar' ? '1px solid var(--vscode-sideBar-border)' : '1px solid var(--vscode-panel-border)'};
                margin: 0;
                padding: ${context.layout === 'sidebar' ? '8px' : '16px'};
                height: 100vh;
                overflow: hidden;
                box-sizing: border-box;
            }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script>
            // Debug: Check if context data is being generated
            console.log('About to set webview context. Context object:', ${JSON.stringify({ ...context, logoUris })});
            
            // Initialize context for React app
            window.__WEBVIEW_CONTEXT__ = ${JSON.stringify({ ...context, logoUris })};
            
            // Debug logging in webview
            console.log('Webview context set:', window.__WEBVIEW_CONTEXT__);
            console.log('Logo URIs received in webview:', window.__WEBVIEW_CONTEXT__?.logoUris);
            
            // Additional debug - check if context persists
            setTimeout(() => {
                console.log('Context check after 1 second:', window.__WEBVIEW_CONTEXT__);
            }, 1000);
        </script>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}

 