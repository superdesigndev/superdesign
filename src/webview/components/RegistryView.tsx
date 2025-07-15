import React, { useEffect, useState } from 'react';
import ComponentRegistry from './Chat/ComponentRegistry';
import { RegistryConfig } from '../types/canvas.types';

interface RegistryViewProps {
    vscode: any;
}

const RegistryView: React.FC<RegistryViewProps> = ({ vscode }) => {
    const [registry, setRegistry] = useState<RegistryConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle messages from the extension
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            console.log('RegistryView received message:', message);

            switch (message.type) {
                case 'registryLoaded':
                    setRegistry(message.registry);
                    setError(null);
                    setLoading(false);
                    break;
                case 'registryError':
                    setError(message.error);
                    setLoading(false);
                    break;
            }
        };

        window.addEventListener('message', messageHandler);

        // Request registry load on mount
        vscode.postMessage({ type: 'loadRegistry' });

        return () => {
            window.removeEventListener('message', messageHandler);
        };
    }, [vscode]);

    const handleComponentSelect = (component: any) => {
        vscode.postMessage({
            type: 'componentClicked',
            component: component
        });
    };

    const handlePageSelect = (page: any) => {
        vscode.postMessage({
            type: 'pageClicked',
            page: page
        });
    };



    if (loading) {
        return (
            <div style={{ 
                padding: '20px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100vh',
                color: 'var(--vscode-foreground)'
            }}>
                Loading registry...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                padding: '20px', 
                color: 'var(--vscode-errorForeground)',
                backgroundColor: 'var(--vscode-sideBar-background)',
                height: '100vh'
            }}>
                <h3>Error loading registry</h3>
                <p>{error}</p>
                <button 
                    onClick={() => {
                        setLoading(true);
                        setError(null);
                        vscode.postMessage({ type: 'loadRegistry' });
                    }}
                    style={{
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!registry) {
        return (
            <div style={{ 
                padding: '20px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100vh',
                color: 'var(--vscode-foreground)'
            }}>
                No registry data available
            </div>
        );
    }

    return (
        <div style={{
            height: '100vh',
            backgroundColor: 'var(--vscode-sideBar-background)',
            color: 'var(--vscode-foreground)',
            overflow: 'hidden'
        }}>
            <ComponentRegistry 
                registry={registry}
                isLoading={loading}
                error={error}
                onComponentSelect={handleComponentSelect}
                onPageSelect={handlePageSelect}
                onRefresh={() => {
                    setLoading(true);
                    vscode.postMessage({ type: 'loadRegistry' });
                }}
            />
        </div>
    );
};

export default RegistryView; 