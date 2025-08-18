import * as vscode from 'vscode';
import { Logger } from './services/logger';
import type { ChatSidebarProvider } from './providers/chatSidebarProvider';
import path from 'path';

export class SuperdesignCanvasPanel {
    public static currentPanel: SuperdesignCanvasPanel | undefined;
    public static readonly viewType = 'superdesignCanvasPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _sidebarProvider: ChatSidebarProvider;
    private readonly _disposables: vscode.Disposable[] = [];
    private _fileWatcher: vscode.FileSystemWatcher | undefined;

    public static createOrShow(extensionUri: vscode.Uri, sidebarProvider: ChatSidebarProvider) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (SuperdesignCanvasPanel.currentPanel) {
            SuperdesignCanvasPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SuperdesignCanvasPanel.viewType,
            'SecureDesign Canvas',
            column ?? vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'src', 'assets'),
                ],
            }
        );

        SuperdesignCanvasPanel.currentPanel = new SuperdesignCanvasPanel(
            panel,
            extensionUri,
            sidebarProvider
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        sidebarProvider: ChatSidebarProvider
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._sidebarProvider = sidebarProvider;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setupFileWatcher();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'loadDesignFiles':
                        void this._loadDesignFiles();
                        break;
                    case 'selectFrame':
                        Logger.debug(`Frame selected: ${message.data?.fileName}`);
                        break;
                    case 'setContextFromCanvas':
                        // Forward context to chat sidebar
                        this._sidebarProvider.sendMessage({
                            command: 'contextFromCanvas',
                            data: message.data,
                        });
                        break;
                    case 'setChatPrompt':
                        // Forward prompt to chat sidebar
                        this._sidebarProvider.sendMessage({
                            command: 'setChatPrompt',
                            data: message.data,
                        });
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SuperdesignCanvasPanel.currentPanel = undefined;

        // Dispose of file watcher
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
            this._fileWatcher = undefined;
        }

        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _setupFileWatcher() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Watch for changes in .superdesign/design_iterations/*.html, *.svg, and *.css
        const pattern = new vscode.RelativePattern(
            workspaceFolder,
            '.superdesign/design_iterations/**/*.{html,svg,css}'
        );

        this._fileWatcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            false, // Don't ignore create events
            false, // Don't ignore change events
            false // Don't ignore delete events
        );

        // Handle file creation
        this._fileWatcher.onDidCreate(uri => {
            Logger.debug(`Design file created: ${uri.fsPath}`);
            this._panel.webview.postMessage({
                command: 'fileChanged',
                data: {
                    fileName: path.basename(uri.fsPath) ?? '',
                    changeType: 'created',
                },
            });
        });

        // Handle file modification
        this._fileWatcher.onDidChange(uri => {
            Logger.debug(`Design file modified: ${uri.fsPath}`);
            this._panel.webview.postMessage({
                command: 'fileChanged',
                data: {
                    fileName: path.basename(uri.fsPath) ?? '',
                    changeType: 'modified',
                },
            });
        });

        // Handle file deletion
        this._fileWatcher.onDidDelete(uri => {
            Logger.debug(`Design file deleted: ${uri.fsPath}`);
            this._panel.webview.postMessage({
                command: 'fileChanged',
                data: {
                    fileName: path.basename(uri.fsPath) ?? '',
                    changeType: 'deleted',
                },
            });
        });
    }

    private _update() {
        const { webview } = this._panel;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
        );

        // Generate webview URIs for logo images
        const logoUris = {
            cursor: webview
                .asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'cursor_logo.png')
                )
                .toString(),
            windsurf: webview
                .asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'windsurf_logo.png')
                )
                .toString(),
            claudeCode: webview
                .asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'claude_code_logo.png')
                )
                .toString(),
            lovable: webview
                .asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'lovable_logo.png')
                )
                .toString(),
            bolt: webview
                .asWebviewUri(
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'bolt_logo.jpg')
                )
                .toString(),
        };

        // Debug logging
        Logger.debug(`Canvas Panel - Extension URI: ${this._extensionUri.toString()}`);
        Logger.debug(`Canvas Panel - Generated logo URIs: ${JSON.stringify(logoUris)}`);

        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: https: vscode-webview:; script-src 'nonce-${nonce}'; frame-src ${webview.cspSource};">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>SecureDesign Canvas</title>
			</head>
			<body>
				<div id="root" data-view="canvas" data-nonce="${nonce}"></div>
				<script nonce="${nonce}">
					// Debug: Check if context data is being generated
					console.log('Canvas Panel - About to set webview context. Logo URIs:', ${JSON.stringify(logoUris)});
					
					// Initialize context for React app
					window.__WEBVIEW_CONTEXT__ = {
						layout: 'panel',
						extensionUri: '${this._extensionUri.toString()}',
						logoUris: ${JSON.stringify(logoUris)}
					};
					
					// Debug logging in webview
					console.log('Canvas Panel - Webview context set:', window.__WEBVIEW_CONTEXT__);
					console.log('Canvas Panel - Logo URIs received in webview:', window.__WEBVIEW_CONTEXT__?.logoUris);
				</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }

    private async _loadDesignFiles() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this._panel.webview.postMessage({
                command: 'error',
                data: { error: 'No workspace folder found. Please open a workspace first.' },
            });
            return;
        }

        try {
            const designFolder = vscode.Uri.joinPath(
                workspaceFolder.uri,
                '.superdesign',
                'design_iterations'
            );

            // Check if the design_files folder exists
            try {
                await vscode.workspace.fs.stat(designFolder);
            } catch {
                // Folder doesn't exist, create it
                try {
                    await vscode.workspace.fs.createDirectory(designFolder);
                    Logger.info('Created .superdesign/design_iterations directory');
                } catch (createError) {
                    this._panel.webview.postMessage({
                        command: 'error',
                        data: {
                            error: `Failed to create design_iterations directory: ${createError}`,
                        },
                    });
                    return;
                }
            }

            // Read all files in the directory
            const files = await vscode.workspace.fs.readDirectory(designFolder);
            const designFiles = files.filter(
                ([name, type]) =>
                    type === vscode.FileType.File &&
                    (name.toLowerCase().endsWith('.html') || name.toLowerCase().endsWith('.svg'))
            );

            const loadedFiles = await Promise.all(
                designFiles.map(async ([fileName, _]) => {
                    const filePath = vscode.Uri.joinPath(designFolder, fileName);

                    try {
                        // Read file stats and content
                        const [stat, content] = await Promise.all([
                            vscode.workspace.fs.stat(filePath),
                            vscode.workspace.fs.readFile(filePath),
                        ]);

                        const fileType = fileName.toLowerCase().endsWith('.svg') ? 'svg' : 'html';
                        let htmlContent = Buffer.from(content).toString('utf8');

                        // For HTML files, inline any external CSS files
                        if (fileType === 'html') {
                            htmlContent = await this._inlineExternalCSS(htmlContent, designFolder);
                        }

                        return {
                            name: fileName,
                            path: filePath.fsPath,
                            content: htmlContent,
                            size: stat.size,
                            modified: new Date(stat.mtime),
                            fileType,
                        };
                    } catch (fileError) {
                        Logger.error(`Failed to read file ${fileName}: ${fileError}`);
                        return null;
                    }
                })
            );

            // Filter out any failed file reads
            const validFiles = loadedFiles.filter(file => file !== null);

            Logger.info(`Loaded ${validFiles.length} design files (HTML & SVG)`);

            this._panel.webview.postMessage({
                command: 'designFilesLoaded',
                data: { files: validFiles },
            });
        } catch (error) {
            Logger.error(`Error loading design files: ${error}`);
            this._panel.webview.postMessage({
                command: 'error',
                data: { error: `Failed to load design files: ${error}` },
            });
        }
    }

    private async _inlineExternalCSS(
        htmlContent: string,
        designFolder: vscode.Uri
    ): Promise<string> {
        // Match link tags that reference CSS files
        const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
        let modifiedContent = htmlContent;
        const matches = Array.from(htmlContent.matchAll(linkRegex));

        for (const match of matches) {
            const fullLinkTag = match[0];
            const cssFileName = match[1];

            try {
                // Only process relative paths (not absolute URLs)
                if (!cssFileName.startsWith('http') && !cssFileName.startsWith('//')) {
                    const cssFilePath = vscode.Uri.joinPath(designFolder, cssFileName);

                    // Check if CSS file exists
                    try {
                        const cssContent = await vscode.workspace.fs.readFile(cssFilePath);
                        const cssText = Buffer.from(cssContent).toString('utf8');

                        // Replace the link tag with a style tag containing the CSS content
                        const styleTag = `<style>\n${cssText}\n</style>`;
                        modifiedContent = modifiedContent.replace(fullLinkTag, styleTag);

                        Logger.debug(`Inlined CSS file: ${cssFileName}`);
                    } catch (cssError) {
                        Logger.warn(`Could not read CSS file ${cssFileName}: ${cssError}`);
                        // Leave the original link tag in place if CSS file can't be read
                    }
                }
            } catch (error) {
                Logger.warn(`Error processing CSS link ${cssFileName}: ${error}`);
            }
        }

        return modifiedContent;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
