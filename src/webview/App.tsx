import React, { useState, useEffect } from 'react';
import ChatInterface from './components/Chat/ChatInterface';
import CanvasView from './components/CanvasView';
import type { WebviewContext } from '../types/context';

// Import CSS as string for esbuild
import styles from './App.css';

const App: React.FC = () => {
    console.log('🚀 App component starting...');

    const [vscode] = useState(() => {
        console.log('📞 Acquiring vscode API...');
        return acquireVsCodeApi();
    });

    const [context, setContext] = useState<WebviewContext | null>(null);
    const [currentView, setCurrentView] = useState<'chat' | 'canvas'>('chat');
    const [nonce, setNonce] = useState<string | null>(null);

    useEffect(() => {
        console.log('🔄 App useEffect running...');

        // Detect which view to render based on data-view attribute
        const rootElement = document.getElementById('root');
        console.log('📍 Root element:', rootElement);

        const viewType = rootElement?.getAttribute('data-view');
        const nonceValue = rootElement?.getAttribute('data-nonce');

        console.log('🎯 View type detected:', viewType);
        console.log('🔐 Nonce value:', nonceValue);

        if (nonceValue) {
            setNonce(nonceValue);
            console.log('✅ Nonce set:', nonceValue);
        }

        if (viewType === 'canvas') {
            setCurrentView('canvas');
            console.log('🎨 Switching to canvas view');
        } else {
            setCurrentView('chat');
            console.log('💬 Switching to chat view');
        }

        // Inject CSS styles
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        console.log('🎨 CSS styles injected');

        // Get context from window (only needed for chat interface)
        const webviewContext = (window as any).__WEBVIEW_CONTEXT__;
        console.log('🌐 Webview context from window:', webviewContext);

        if (webviewContext) {
            setContext(webviewContext);
            console.log('✅ Context set:', webviewContext);
        } else {
            console.log('⚠️ No webview context found in window');
        }

        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    const renderView = () => {
        console.log('🖼️ Rendering view, currentView:', currentView);

        switch (currentView) {
            case 'canvas':
                console.log('🎨 Rendering CanvasView with vscode:', !!vscode, 'nonce:', nonce);
                try {
                    // Canvas view doesn't need context - it gets data from extension directly
                    return <CanvasView vscode={vscode} nonce={nonce} />;
                } catch (error) {
                    console.error('❌ Error rendering CanvasView:', error);
                    return <div>Error rendering canvas: {String(error)}</div>;
                }
            case 'chat':
            default:
                console.log('💬 Rendering ChatInterface, context:', !!context);
                // Chat interface needs context
                if (!context) {
                    console.log('⏳ Context not ready, showing loading...');
                    return <div>Loading...</div>;
                }
                try {
                    return <ChatInterface layout={context.layout} vscode={vscode} />;
                } catch (error) {
                    console.error('❌ Error rendering ChatInterface:', error);
                    return <div>Error rendering chat: {String(error)}</div>;
                }
        }
    };

    console.log('🔄 App rendering, currentView:', currentView);

    return (
        <div
            className={`superdesign-app ${currentView}-view ${context?.layout ? `${context.layout}-layout` : ''}`}
        >
            {renderView()}
        </div>
    );
};

export default App;
