import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatInterface from './components/Chat/ChatInterface';
import type { WebviewContext } from '../types/context';

// Import main App styles for panel layout
import App from './App';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);

    console.log('🚀 Index.tsx starting...');

    // Check if this is a canvas view (doesn't need context)
    const viewType = container.getAttribute('data-view');
    console.log('🎯 View type from index.tsx:', viewType);

    if (viewType === 'canvas') {
        console.log('🎨 Canvas view detected, rendering App without context check');
        // Canvas view - render App component directly (it will handle the canvas routing)
        root.render(<App />);
    } else {
        console.log('💬 Chat view detected, checking for context...');
        // Chat view - needs context
        const context: WebviewContext = (window as any).__WEBVIEW_CONTEXT__;
        console.log('🌐 Context found:', !!context);

        if (!context) {
            console.error('❌ No context provided for chat view');
            root.render(<div>Error: No context provided for chat view</div>);
        } else if (context.layout === 'panel') {
            console.log('📋 Panel layout, rendering full App');
            // Use full App component for panel (includes header and styling)
            root.render(<App />);
        } else {
            console.log('🔲 Sidebar layout, rendering ChatInterface directly');
            // Use ChatInterface directly for sidebar (compact layout)
            const vscode = acquireVsCodeApi();
            root.render(<ChatInterface layout='sidebar' vscode={vscode} />);
        }
    }
}
