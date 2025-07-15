import * as vscode from 'vscode';
import { generateWebviewHtml } from '../templates/webviewTemplate';
import { WebviewContext } from '../types/context';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ComponentRegistryProvider implements vscode.WebviewViewProvider {
    public static readonly VIEW_TYPE = 'superdesign.componentRegistryView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly outputChannel: vscode.OutputChannel
    ) {}

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
            viewType: 'registry',
            extensionUri: this._extensionUri.toString()
        };

        webviewView.webview.html = generateWebviewHtml(webviewView.webview, this._extensionUri, webviewContext);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    this.outputChannel.appendLine(`ComponentRegistry received message: ${JSON.stringify(message)}`);
                    
                    switch (message.type) {
                        case 'loadRegistry':
                            await this.handleLoadRegistry(message);
                            break;
                        case 'componentClicked':
                            await this.handleComponentClicked(message);
                            break;
                        case 'pageClicked':
                            await this.handlePageClicked(message);
                            break;
                        case 'addToCanvas':
                            await this.handleAddToCanvas(message.data);
                            break;
                        default:
                            this.outputChannel.appendLine(`Unknown message type: ${message.type}`);
                    }
                } catch (error) {
                    this.outputChannel.appendLine(`Error handling message: ${error}`);
                    console.error('Error handling message:', error);
                }
            },
            undefined,
            []
        );

        // Load registry on startup
        this.loadRegistry();
    }

    private async handleLoadRegistry(message: any) {
        await this.loadRegistry();
    }

    private async handleComponentClicked(message: any) {
        this.outputChannel.appendLine(`Component clicked: ${message.component.name}`);
        await this.showComponentInEditor(message.component);
    }

    private async handlePageClicked(message: any) {
        this.outputChannel.appendLine(`Page clicked: ${message.page.name}`);
        await this.showPageInEditor(message.page);
    }

    private async showComponentInEditor(component: any) {
        try {
            // Create or show webview panel for component
            const panel = vscode.window.createWebviewPanel(
                'superdesign.componentPreview',
                `Component: ${component.name}`,
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionUri]
                }
            );

            // Generate HTML content for the component
            const htmlContent = await this.generateComponentPreviewHtml(component, panel.webview);
            panel.webview.html = htmlContent;

            // Handle messages from the preview webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    try {
                        this.outputChannel.appendLine(`Component preview received message: ${JSON.stringify(message)}`);
                        
                        switch (message.type) {
                            case 'addToCanvas':
                                await this.handleAddToCanvas(message.data);
                                break;
                            default:
                                this.outputChannel.appendLine(`Unknown message type: ${message.type}`);
                        }
                    } catch (error) {
                        this.outputChannel.appendLine(`Error handling preview message: ${error}`);
                        console.error('Error handling preview message:', error);
                    }
                },
                undefined,
                []
            );

        } catch (error) {
            this.outputChannel.appendLine(`Error showing component: ${error}`);
            vscode.window.showErrorMessage(`Failed to show component: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async showPageInEditor(page: any) {
        try {
            // Create or show webview panel for page
            const panel = vscode.window.createWebviewPanel(
                'superdesign.pagePreview',
                `Page: ${page.name}`,
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionUri]
                }
            );

            // Generate HTML content for the page
            const htmlContent = await this.generatePagePreviewHtml(page, panel.webview);
            panel.webview.html = htmlContent;

            // Handle messages from the preview webview
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    try {
                        this.outputChannel.appendLine(`Page preview received message: ${JSON.stringify(message)}`);
                        
                        switch (message.type) {
                            case 'addToCanvas':
                                await this.handleAddToCanvas(message.data);
                                break;
                            default:
                                this.outputChannel.appendLine(`Unknown message type: ${message.type}`);
                        }
                    } catch (error) {
                        this.outputChannel.appendLine(`Error handling preview message: ${error}`);
                        console.error('Error handling preview message:', error);
                    }
                },
                undefined,
                []
            );

        } catch (error) {
            this.outputChannel.appendLine(`Error showing page: ${error}`);
            vscode.window.showErrorMessage(`Failed to show page: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async generateComponentPreviewHtml(component: any, webview: vscode.Webview): Promise<string> {
        try {
            // Parse current props from route
            const currentProps = this.parsePropsFromRoute(component.route);
            const propsEditorHtml = this.generatePropsEditor(component, currentProps);

            return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Component: ${component.name}</title>
                    <style>
                        body {
                            font-family: var(--vscode-font-family);
                            background-color: var(--vscode-editor-background);
                            color: var(--vscode-editor-foreground);
                            margin: 0;
                            padding: 0;
                            line-height: 1.6;
                            display: flex;
                            flex-direction: row;
                            height: 100vh;
                        }
                        .props-panel {
                            width: 300px;
                            background: var(--vscode-sideBar-background);
                            border-right: 1px solid var(--vscode-panel-border);
                            display: flex;
                            flex-direction: column;
                            overflow: hidden;
                            flex-shrink: 0;
                        }
                        .props-header {
                            background: var(--vscode-tab-activeBackground);
                            border-bottom: 1px solid var(--vscode-panel-border);
                            padding: 12px 16px;
                            font-size: 14px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        }
                        .props-content {
                            flex: 1;
                            overflow-y: auto;
                            padding: 16px;
                        }
                        .props-content::-webkit-scrollbar {
                            width: 6px;
                        }
                        .props-content::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .props-content::-webkit-scrollbar-thumb {
                            background: var(--vscode-scrollbarSlider-background);
                            border-radius: 3px;
                        }
                        .props-content::-webkit-scrollbar-thumb:hover {
                            background: var(--vscode-scrollbarSlider-hoverBackground);
                        }
                        .prop-group {
                            margin-bottom: 16px;
                        }
                        .prop-label {
                            display: block;
                            font-size: 12px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                            margin-bottom: 4px;
                        }
                        .prop-type {
                            font-size: 10px;
                            color: var(--vscode-descriptionForeground);
                            margin-left: 4px;
                            font-family: var(--vscode-editor-font-family);
                        }
                        .prop-input {
                            width: 100%;
                            padding: 6px 8px;
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 3px;
                            color: var(--vscode-input-foreground);
                            font-size: 12px;
                            font-family: var(--vscode-font-family);
                            box-sizing: border-box;
                        }
                        .prop-input:focus {
                            outline: none;
                            border-color: var(--vscode-focusBorder);
                        }
                        .prop-checkbox {
                            margin-right: 6px;
                        }
                        .prop-checkbox-container {
                            display: flex;
                            align-items: center;
                            font-size: 12px;
                        }
                        .prop-function-note {
                            font-size: 10px;
                            color: var(--vscode-descriptionForeground);
                            font-style: italic;
                            margin-top: 2px;
                        }
                        .preview-main {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            min-width: 0;
                        }
                        .preview-section {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            position: relative;
                            min-height: 0;
                        }
                        .preview-header {
                            background: var(--vscode-tab-activeBackground);
                            border-bottom: 1px solid var(--vscode-panel-border);
                            padding: 8px 20px;
                            font-size: 14px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                        }
                        .viewport-controls {
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        }
                        .viewport-btn {
                            background: transparent;
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 3px;
                            padding: 6px 8px;
                            cursor: pointer;
                            color: var(--vscode-foreground);
                            font-size: 11px;
                            font-weight: 500;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            transition: all 0.2s ease;
                            min-width: 70px;
                            justify-content: center;
                        }
                        .viewport-btn:hover {
                            background: var(--vscode-list-hoverBackground);
                            border-color: var(--vscode-focusBorder);
                        }
                        .viewport-btn.active {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border-color: var(--vscode-button-background);
                        }
                        .viewport-icon {
                            width: 14px;
                            height: 14px;
                        }
                        .iframe-container {
                            flex: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: #f5f5f5;
                            position: relative;
                            overflow: auto;
                        }
                        .iframe-wrapper {
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 8px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                            transition: all 0.3s ease;
                            position: relative;
                            overflow: hidden;
                        }
                        .iframe-wrapper.mobile {
                            width: 375px;
                            height: 667px;
                            max-height: calc(100vh - 60px);
                        }
                        .iframe-wrapper.tablet {
                            width: 768px;
                            height: 1024px;
                            max-height: calc(100vh - 60px);
                        }
                        .iframe-wrapper.desktop {
                            width: 100%;
                            height: 100%;
                            max-width: 1200px;
                            max-height: calc(100vh - 60px);
                            border-radius: 0;
                        }
                        .preview-iframe {
                            width: 100%;
                            height: 100%;
                            border: none;
                            background: white;
                            border-radius: inherit;
                        }
                        .viewport-indicator {
                            position: absolute;
                            top: -30px;
                            left: 50%;
                            transform: translateX(-50%);
                            background: var(--vscode-badge-background);
                            color: var(--vscode-badge-foreground);
                            padding: 2px 8px;
                            border-radius: 3px;
                            font-size: 10px;
                            font-weight: 500;
                        }
                        .loading-overlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 10;
                            border-radius: inherit;
                        }
                        .loading-spinner {
                            width: 20px;
                            height: 20px;
                            border: 2px solid #e0e0e0;
                            border-top: 2px solid var(--vscode-button-background);
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        }
                        .error-overlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: white;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            z-index: 10;
                            padding: 20px;
                            text-align: center;
                            border-radius: inherit;
                        }
                        .error-icon {
                            font-size: 32px;
                            margin-bottom: 12px;
                            opacity: 0.6;
                        }
                        .error-title {
                            font-size: 16px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                            color: var(--vscode-errorForeground);
                        }
                        .error-message {
                            font-size: 13px;
                            color: var(--vscode-descriptionForeground);
                            margin: 0;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        
                        /* Responsive adjustments */
                        @media (max-width: 1300px) {
                            .iframe-wrapper.desktop {
                                width: 95%;
                                height: 90%;
                            }
                        }
                        
                        @media (max-width: 800px) {
                            .iframe-wrapper.tablet {
                                width: 90%;
                                height: 70%;
                            }
                        }
                        
                        @media (max-width: 400px) {
                            .iframe-wrapper.mobile {
                                width: 95%;
                                height: 80%;
                            }
                        }
                        .add-to-canvas-btn {
                            margin-left: 16px;
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            border-radius: 3px;
                            padding: 6px 12px;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        }
                        .add-to-canvas-btn:hover {
                            background: var(--vscode-button-hoverBackground);
                        }
                    </style>
                </head>
                <body>
                    ${propsEditorHtml}
                    <div class="preview-main">
                        <div class="preview-section">
                            <div class="preview-header">
                                <div class="viewport-controls">
                                    <button class="viewport-btn" onclick="setViewport('mobile')" id="mobile-btn">
                                        <svg class="viewport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                        </svg>
                                        Mobile
                                    </button>
                                    <button class="viewport-btn" onclick="setViewport('tablet')" id="tablet-btn">
                                        <svg class="viewport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                        </svg>
                                        Tablet
                                    </button>
                                    <button class="viewport-btn active" onclick="setViewport('desktop')" id="desktop-btn">
                                        <svg class="viewport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                            <line x1="8" y1="21" x2="16" y2="21"></line>
                                            <line x1="12" y1="17" x2="12" y2="21"></line>
                                        </svg>
                                        Desktop
                                    </button>
                                    <button class="add-to-canvas-btn" onclick="addToCanvas()" title="Add to Canvas">➕ Add to Canvas</button>
                                </div>
                            </div>
                            <div class="iframe-container">
                                <div class="iframe-wrapper desktop" id="iframe-wrapper">
                                    <div class="viewport-indicator" id="viewport-indicator">Desktop (Responsive)</div>
                                    <div class="loading-overlay" id="loading">
                                        <div class="loading-spinner"></div>
                                    </div>
                                    <div class="error-overlay" id="error" style="display: none;">
                                        <div class="error-icon">⚠️</div>
                                        <div class="error-title">Failed to load preview</div>
                                        <div class="error-message">The component route could not be loaded</div>
                                    </div>
                                    <iframe 
                                        class="preview-iframe"
                                        src="${component.route}"
                                        title="Component Preview"
                                        id="component-iframe"
                                        onload="document.getElementById('loading').style.display = 'none';"
                                        onerror="document.getElementById('loading').style.display = 'none'; document.getElementById('error').style.display = 'flex';"
                                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                                        referrerpolicy="no-referrer"
                                    ></iframe>
                                </div>
                            </div>
                        </div>
                    </div>

                    <script>
                        let currentViewport = 'desktop';
                        let currentProps = ${JSON.stringify(currentProps)};
                        const originalRoute = '${component.route}';
                        
                        function setViewport(viewport) {
                            // Remove active class from all buttons
                            document.querySelectorAll('.viewport-btn').forEach(btn => btn.classList.remove('active'));
                            
                            // Add active class to selected button
                            document.getElementById(viewport + '-btn').classList.add('active');
                            
                            // Update iframe wrapper class
                            const wrapper = document.getElementById('iframe-wrapper');
                            wrapper.className = 'iframe-wrapper ' + viewport;
                            
                            // Update viewport indicator
                            const indicator = document.getElementById('viewport-indicator');
                            const viewportLabels = {
                                mobile: 'Mobile (375×667)',
                                tablet: 'Tablet (768×1024)', 
                                desktop: 'Desktop (Responsive)'
                            };
                            indicator.textContent = viewportLabels[viewport];
                            
                            currentViewport = viewport;
                        }

                        function updateProp(propName, value) {
                            // Parse value based on type
                            const propType = ${JSON.stringify(component.propTypes || {})};
                            const type = propType[propName] || 'string';
                            
                            let parsedValue = value;
                            
                            if (type === 'number') {
                                parsedValue = parseFloat(value) || 0;
                            } else if (type === 'boolean') {
                                parsedValue = value === true || value === 'true';
                            } else if (type.includes('=>') || type.includes('function')) {
                                // For functions, create a no-op function
                                parsedValue = function() { console.log(propName + ' called'); };
                            }
                            
                            currentProps[propName] = parsedValue;
                            updatePreview();
                        }

                        function updatePreview() {
                            try {
                                const url = new URL(originalRoute);
                                url.searchParams.set('props', JSON.stringify(currentProps));
                                
                                const iframe = document.getElementById('component-iframe');
                                iframe.src = url.toString();
                                
                                // Show loading state
                                document.getElementById('loading').style.display = 'flex';
                                document.getElementById('error').style.display = 'none';
                            } catch (error) {
                                console.error('Failed to update preview:', error);
                            }
                        }

                        function resetProps() {
                            // Reset to original props
                            const url = new URL(originalRoute);
                            const propsParam = url.searchParams.get('props');
                            if (propsParam) {
                                currentProps = JSON.parse(decodeURIComponent(propsParam));
                            } else {
                                currentProps = {};
                            }
                            
                            // Update form inputs
                            document.querySelectorAll('[data-prop]').forEach(input => {
                                const propName = input.getAttribute('data-prop');
                                const value = currentProps[propName];
                                
                                if (input.type === 'checkbox') {
                                    input.checked = !!value;
                                    const label = input.parentElement.querySelector('span');
                                    if (label) label.textContent = !!value ? 'true' : 'false';
                                } else {
                                    input.value = typeof value === 'string' ? value : JSON.stringify(value || '');
                                }
                            });
                            
                            updatePreview();
                        }
                        
                        // Initialize with desktop view
                        setViewport('desktop');

                        function addToCanvas() {
                            const vscode = acquireVsCodeApi();
                            
                            // Construct the route with updated props
                            let routeWithProps = originalRoute;
                            try {
                                const url = new URL(originalRoute);
                                url.searchParams.set('props', JSON.stringify(currentProps));
                                routeWithProps = url.toString();
                            } catch (error) {
                                console.warn('Failed to add props to route:', error);
                                // Fallback to original route if URL construction fails
                            }
                            
                            vscode.postMessage({
                                type: 'addToCanvas',
                                data: {
                                    // For component preview
                                    type: 'component',
                                    name: ${JSON.stringify(component.name)},
                                    component: ${JSON.stringify(component.name)},
                                    route: routeWithProps,
                                    props: currentProps,
                                    description: ${JSON.stringify(component.description)},
                                    filePath: ${JSON.stringify(component.filePath)},
                                    group: ${JSON.stringify(component.group)},
                                    createdBy: ${JSON.stringify(component.createdBy)},
                                    parentId: null
                                }
                            });
                        }
                    </script>
                </body>
                </html>
            `;
        } catch (error) {
            return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Error</title>
                </head>
                <body style="font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-errorForeground);">
                    <h1>Error loading component</h1>
                    <p>${error instanceof Error ? error.message : String(error)}</p>
                </body>
                </html>
            `;
        }
    }

    private parsePropsFromRoute(route: string): Record<string, any> {
        try {
            const url = new URL(route);
            const propsParam = url.searchParams.get('props');
            if (propsParam) {
                return JSON.parse(decodeURIComponent(propsParam));
            }
        } catch (error) {
            console.warn('Failed to parse props from route:', error);
        }
        return {};
    }

    private generatePropsEditor(component: any, currentProps: Record<string, any>): string {
        if (!component.props || component.props.length === 0) {
            return `
                <div class="props-panel">
                    <div class="props-header">
                        <span>Props</span>
                    </div>
                    <div class="props-content">
                        <div style="text-align: center; color: var(--vscode-descriptionForeground); font-size: 12px; padding: 20px;">
                            No props available
                        </div>
                    </div>
                </div>
            `;
        }

        const propInputs = component.props.map((propName: string) => {
            const propType = component.propTypes?.[propName] || 'string';
            const currentValue = currentProps[propName] || this.getDefaultValue(propType);
            
            return this.generatePropInput(propName, propType, currentValue);
        }).join('');

        return `
            <div class="props-panel">
                <div class="props-header">
                    <span>Props</span>
                    <button onclick="resetProps()" style="background: none; border: 1px solid var(--vscode-input-border); color: var(--vscode-foreground); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Reset</button>
                </div>
                <div class="props-content">
                    ${propInputs}
                </div>
            </div>
        `;
    }

    private generatePropInput(propName: string, propType: string, currentValue: any): string {
        const isFunction = propType.includes('=>') || propType.includes('function');
        
        if (propType === 'boolean') {
            return `
                <div class="prop-group">
                    <label class="prop-label">
                        ${propName}
                        <span class="prop-type">${propType}</span>
                    </label>
                    <div class="prop-checkbox-container">
                        <input 
                            type="checkbox" 
                            class="prop-checkbox" 
                            data-prop="${propName}"
                            ${currentValue ? 'checked' : ''}
                            onchange="updateProp('${propName}', this.checked)"
                        >
                        <span>${currentValue ? 'true' : 'false'}</span>
                    </div>
                </div>
            `;
        }

        if (isFunction) {
            return `
                <div class="prop-group">
                    <label class="prop-label">
                        ${propName}
                        <span class="prop-type">${propType}</span>
                    </label>
                    <input 
                        type="text" 
                        class="prop-input" 
                        data-prop="${propName}"
                        value="function() {}"
                        readonly
                        style="opacity: 0.6; cursor: not-allowed;"
                    >
                    <div class="prop-function-note">Function props are handled automatically</div>
                </div>
            `;
        }

        const inputType = propType === 'number' ? 'number' : 'text';
        const value = typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue);

        return `
            <div class="prop-group">
                <label class="prop-label">
                    ${propName}
                    <span class="prop-type">${propType}</span>
                </label>
                <input 
                    type="${inputType}" 
                    class="prop-input" 
                    data-prop="${propName}"
                    value="${value || ''}"
                    onchange="updateProp('${propName}', this.value)"
                    oninput="updateProp('${propName}', this.value)"
                >
            </div>
        `;
    }

    private getDefaultValue(propType: string): any {
        if (propType === 'boolean') return false;
        if (propType === 'number') return 0;
        if (propType.includes('=>') || propType.includes('function')) return 'function() {}';
        return '';
    }

    private async generatePagePreviewHtml(page: any, webview: vscode.Webview): Promise<string> {
        try {
            return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Page: ${page.name}</title>
                    <style>
                        body {
                            font-family: var(--vscode-font-family);
                            background-color: var(--vscode-editor-background);
                            color: var(--vscode-editor-foreground);
                            margin: 0;
                            padding: 0;
                            line-height: 1.6;
                            display: flex;
                            flex-direction: column;
                            height: 100vh;
                        }
                        .preview-section {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            position: relative;
                            min-height: 0;
                        }
                        .preview-header {
                            background: var(--vscode-tab-activeBackground);
                            border-bottom: 1px solid var(--vscode-panel-border);
                            padding: 8px 20px;
                            font-size: 14px;
                            font-weight: 600;
                            color: var(--vscode-foreground);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                        }
                        .viewport-controls {
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        }
                        .viewport-btn {
                            background: transparent;
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 3px;
                            padding: 6px 8px;
                            cursor: pointer;
                            color: var(--vscode-foreground);
                            font-size: 11px;
                            font-weight: 500;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            transition: all 0.2s ease;
                            min-width: 70px;
                            justify-content: center;
                        }
                        .viewport-btn:hover {
                            background: var(--vscode-list-hoverBackground);
                            border-color: var(--vscode-focusBorder);
                        }
                        .viewport-btn.active {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border-color: var(--vscode-button-background);
                        }
                        .viewport-icon {
                            width: 14px;
                            height: 14px;
                        }
                        .iframe-container {
                            flex: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: #f5f5f5;
                            position: relative;
                            overflow: auto;
                        }
                        .iframe-wrapper {
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 8px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                            transition: all 0.3s ease;
                            position: relative;
                            overflow: hidden;
                        }
                        .iframe-wrapper.mobile {
                            width: 375px;
                            height: 667px;
                            max-height: calc(100vh - 60px);
                        }
                        .iframe-wrapper.tablet {
                            width: 768px;
                            height: 1024px;
                            max-height: calc(100vh - 60px);
                        }
                        .iframe-wrapper.desktop {
                            width: 100%;
                            height: 100%;
                            max-width: 1200px;
                            max-height: calc(100vh - 60px);
                            border-radius: 0;
                        }
                        .preview-iframe {
                            width: 100%;
                            height: 100%;
                            border: none;
                            background: white;
                            border-radius: inherit;
                        }
                        .viewport-indicator {
                            position: absolute;
                            top: -30px;
                            left: 50%;
                            transform: translateX(-50%);
                            background: var(--vscode-badge-background);
                            color: var(--vscode-badge-foreground);
                            padding: 2px 8px;
                            border-radius: 3px;
                            font-size: 10px;
                            font-weight: 500;
                        }
                        .loading-overlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 10;
                            border-radius: inherit;
                        }
                        .loading-spinner {
                            width: 20px;
                            height: 20px;
                            border: 2px solid #e0e0e0;
                            border-top: 2px solid var(--vscode-button-background);
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        }
                        .error-overlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: white;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            z-index: 10;
                            padding: 20px;
                            text-align: center;
                            border-radius: inherit;
                        }
                        .error-icon {
                            font-size: 32px;
                            margin-bottom: 12px;
                            opacity: 0.6;
                        }
                        .error-title {
                            font-size: 16px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                            color: var(--vscode-errorForeground);
                        }
                        .error-message {
                            font-size: 13px;
                            color: var(--vscode-descriptionForeground);
                            margin: 0;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        
                        /* Responsive adjustments */
                        @media (max-width: 1300px) {
                            .iframe-wrapper.desktop {
                                width: 95%;
                                height: 90%;
                            }
                        }
                        
                        @media (max-width: 800px) {
                            .iframe-wrapper.tablet {
                                width: 90%;
                                height: 70%;
                            }
                        }
                        
                        @media (max-width: 400px) {
                            .iframe-wrapper.mobile {
                                width: 95%;
                                height: 80%;
                            }
                        }
                        .add-to-canvas-btn {
                            margin-left: 16px;
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            border-radius: 3px;
                            padding: 6px 12px;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        }
                        .add-to-canvas-btn:hover {
                            background: var(--vscode-button-hoverBackground);
                        }
                    </style>
                </head>
                <body>
                    <div class="preview-section">
                        <div class="preview-header">
                            <div class="viewport-controls">
                                <button class="viewport-btn" onclick="setViewport('mobile')" id="mobile-btn">
                                    <svg class="viewport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                    </svg>
                                    Mobile
                                </button>
                                <button class="viewport-btn" onclick="setViewport('tablet')" id="tablet-btn">
                                    <svg class="viewport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                    </svg>
                                    Tablet
                                </button>
                                <button class="viewport-btn active" onclick="setViewport('desktop')" id="desktop-btn">
                                    <svg class="viewport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                        <line x1="8" y1="21" x2="16" y2="21"></line>
                                        <line x1="12" y1="17" x2="12" y2="21"></line>
                                    </svg>
                                    Desktop
                                </button>
                                <button class="add-to-canvas-btn" onclick="addToCanvas()" title="Add to Canvas">➕ Add to Canvas</button>
                            </div>
                        </div>
                        <div class="iframe-container">
                            <div class="iframe-wrapper desktop" id="iframe-wrapper">
                                <div class="viewport-indicator" id="viewport-indicator">Desktop (Responsive)</div>
                                <div class="loading-overlay" id="loading">
                                    <div class="loading-spinner"></div>
                                </div>
                                <div class="error-overlay" id="error" style="display: none;">
                                    <div class="error-icon">⚠️</div>
                                    <div class="error-title">Failed to load preview</div>
                                    <div class="error-message">The page route could not be loaded</div>
                                </div>
                                <iframe 
                                    class="preview-iframe"
                                    src="${page.route}"
                                    title="Page Preview"
                                    onload="document.getElementById('loading').style.display = 'none';"
                                    onerror="document.getElementById('loading').style.display = 'none'; document.getElementById('error').style.display = 'flex';"
                                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                                    referrerpolicy="no-referrer"
                                ></iframe>
                            </div>
                        </div>
                    </div>

                    <script>
                        let currentViewport = 'desktop';
                        
                        function setViewport(viewport) {
                            // Remove active class from all buttons
                            document.querySelectorAll('.viewport-btn').forEach(btn => btn.classList.remove('active'));
                            
                            // Add active class to selected button
                            document.getElementById(viewport + '-btn').classList.add('active');
                            
                            // Update iframe wrapper class
                            const wrapper = document.getElementById('iframe-wrapper');
                            wrapper.className = 'iframe-wrapper ' + viewport;
                            
                            // Update viewport indicator
                            const indicator = document.getElementById('viewport-indicator');
                            const viewportLabels = {
                                mobile: 'Mobile (375×667)',
                                tablet: 'Tablet (768×1024)', 
                                desktop: 'Desktop (Responsive)'
                            };
                            indicator.textContent = viewportLabels[viewport];
                            
                            currentViewport = viewport;
                        }
                        
                        // Initialize with desktop view
                        setViewport('desktop');

                        function addToCanvas() {
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                type: 'addToCanvas',
                                data: {
                                    // For page preview
                                    type: 'page',
                                    name: ${JSON.stringify(page.name)},
                                    page: ${JSON.stringify(page.page)},
                                    route: ${JSON.stringify(page.route)},
                                    props: {},
                                    description: ${JSON.stringify(page.description)},
                                    filePath: ${JSON.stringify(page.filePath)},
                                    group: ${JSON.stringify(page.group)},
                                    createdBy: ${JSON.stringify(page.createdBy)},
                                    parentId: null
                                }
                            });
                        }
                    </script>
                </body>
                </html>
            `;
        } catch (error) {
            return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Error</title>
                </head>
                <body style="font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-errorForeground);">
                    <h1>Error loading page</h1>
                    <p>${error instanceof Error ? error.message : String(error)}</p>
                </body>
                </html>
            `;
        }
    }

    private async loadRegistry() {
        try {
            const { RegistryService } = await import('../services/registryService');
            
            // Get the workspace root directory
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder found');
            }
            
            const registry = await RegistryService.loadRegistry(workspaceRoot);
            
            this.sendMessage({
                type: 'registryLoaded',
                registry: registry
            });
        } catch (error) {
            this.outputChannel.appendLine(`Error loading registry: ${error}`);
            this.sendMessage({
                type: 'registryError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleAddToCanvas(data: any) {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder found.');
                return;
            }
            const previewsPath = path.join(workspaceRoot, '.superdesign', 'previews.json');
            let previewsJson: any = { version: 1, previews: [] };
            try {
                const file = await fs.readFile(previewsPath, 'utf8');
                previewsJson = JSON.parse(file);
            } catch (e) {
                // File does not exist, will create
            }

            // Generate a unique id (kebab-case from name/type)
            let baseId = (data.name || data.component || data.page || 'preview').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            let id = baseId;
            let i = 1;
            while (previewsJson.previews.some((p: any) => p.id === id)) {
                id = `${baseId}-${i++}`;
            }

            // Build preview entry
            const entry: any = {
                id,
                name: data.name,
                type: data.type,
                route: data.route,
                props: data.props || {},
                description: data.description,
                filePath: data.filePath,
                group: data.group,
                createdBy: data.createdBy,
                parentId: data.parentId || null
            };
            if (data.type === 'component') {
                entry.component = data.component;
            } else if (data.type === 'page') {
                entry.page = data.page;
            }

            previewsJson.previews.push(entry);
            await fs.mkdir(path.dirname(previewsPath), { recursive: true });
            await fs.writeFile(previewsPath, JSON.stringify(previewsJson, null, 2), 'utf8');
            vscode.window.showInformationMessage(`Added to canvas: ${data.name}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add to canvas: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 