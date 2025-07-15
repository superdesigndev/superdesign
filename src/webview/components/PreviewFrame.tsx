import React from 'react';
import { Preview, GridPosition, FrameDimensions, ViewportMode } from '../types/canvas.types';
import { MobileIcon, TabletIcon, DesktopIcon } from './Icons';
import { FrameHeader, ViewportControls, ActionButton } from './FrameHeader';

interface PreviewFrameProps {
    preview: Preview;
    position: GridPosition;
    dimensions: FrameDimensions;
    isSelected: boolean;
    onSelect: (previewId: string, event?: React.MouseEvent) => void;
    viewport?: ViewportMode;
    viewportDimensions?: FrameDimensions;
    onViewportChange?: (previewId: string, viewport: ViewportMode) => void;
    useGlobalViewport?: boolean;
    onDragStart?: (previewId: string, startPos: GridPosition, mouseEvent: React.MouseEvent) => void;
    isDragging?: boolean;
    onDelete?: (previewId: string) => void;
    onSendToChat?: (previewId: string, prompt: string) => void;
    refreshKey?: number;
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({
    preview,
    position,
    dimensions,
    isSelected,
    onSelect,
    viewport = 'desktop',
    viewportDimensions,
    onViewportChange,
    useGlobalViewport = false,
    onDragStart,
    isDragging = false,
    onDelete,
    onSendToChat,
    refreshKey = 0
}) => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);
    const [dragPreventOverlay, setDragPreventOverlay] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 600);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        onSelect(preview.id, e);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (onDragStart && e.button === 0) { // Left mouse button only
            e.preventDefault();
            e.stopPropagation();
            
            // Show overlay to prevent iframe interaction during potential drag
            setDragPreventOverlay(true);
            
            onDragStart(preview.id, position, e);
        }
    };

    // Clear drag prevention overlay when dragging ends
    React.useEffect(() => {
        if (!isDragging) {
            setDragPreventOverlay(false);
        }
    }, [isDragging]);

    const handleViewportToggle = (newViewport: ViewportMode) => {
        if (onViewportChange && !useGlobalViewport) {
            onViewportChange(preview.id, newViewport);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onDelete) {
            onDelete(preview.id);
        }
    };

    const getViewportIcon = (mode: ViewportMode): React.ReactElement => {
        switch (mode) {
            case 'mobile': return <MobileIcon />;
            case 'tablet': return <TabletIcon />;
            case 'desktop': return <DesktopIcon />;
        }
    };

    const getViewportLabel = (mode: ViewportMode): string => {
        switch (mode) {
            case 'mobile': return 'Mobile (375×667)';
            case 'tablet': return 'Tablet (768×1024)';
            case 'desktop': return 'Desktop (1200×800)';
        }
    };

    return (
        <div
            className="design-frame preview-frame"
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width: dimensions.width,
                height: dimensions.height,
                border: isSelected ? '2px solid var(--vscode-focusBorder)' : '1px solid var(--vscode-panel-border)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--vscode-editor-background)',
                cursor: 'default'
            }}
            onClick={handleClick}
        >
            {/* Modern Preview Header */}
            <FrameHeader
                title={preview.type === 'component' ? (preview.component || 'Component') : (preview.page || 'Page')}
                badge={preview.type.toUpperCase()}
                isSelected={isSelected}
                isDragging={isDragging}
                onMouseDown={handleMouseDown}
                onClick={handleClick}
            >
                {onDelete && (
                    <ActionButton
                        icon={
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        }
                        onClick={handleDelete}
                        title={`Delete preview: ${preview.id}`}
                        variant="danger"
                    />
                )}
            </FrameHeader>

            {/* Loading Overlay */}
            {isLoading && (
                <div
                    style={{
                        position: 'absolute',
                        top: isMobile ? '28px' : '36px',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'var(--vscode-editor-background)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                    }}
                >
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '8px',
                        color: 'var(--vscode-descriptionForeground)'
                    }}>
                        <div className="spinner" style={{
                            width: '20px',
                            height: '20px',
                            border: '2px solid var(--vscode-progressBar-background)',
                            borderTop: '2px solid var(--vscode-progressBar-background)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <span style={{ fontSize: '11px' }}>Loading preview...</span>
                    </div>
                </div>
            )}

            {/* Error Overlay */}
            {hasError && !isLoading && (
                <div
                    style={{
                        position: 'absolute',
                        top: isMobile ? '28px' : '36px',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'var(--vscode-editor-background)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                    }}
                >
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '8px',
                        color: 'var(--vscode-errorForeground)',
                        textAlign: 'center',
                        padding: '16px'
                    }}>
                        <span style={{ fontSize: '16px' }}>⚠️</span>
                        <span style={{ fontSize: '11px' }}>Failed to load preview</span>
                        <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)' }}>
                            {preview.route}
                        </span>
                    </div>
                </div>
            )}

            {/* Drag Prevention Overlay */}
            {(dragPreventOverlay || isDragging) && (
                <div
                    style={{
                        position: 'absolute',
                        top: isMobile ? '28px' : '36px',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'transparent',
                        zIndex: 20,
                        cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                />
            )}

            {/* Preview Content */}
            <iframe
                key={`preview-${preview.id}-${refreshKey}`}
                src={preview.route}
                style={{
                    width: '100%',
                    height: `${dimensions.height - (isMobile ? 28 : 36)}px`,
                    border: 'none',
                    background: 'white',
                    borderRadius: '0 0 6px 6px',
                    pointerEvents: (isSelected && !dragPreventOverlay && !isDragging) ? 'auto' : 'none'
                }}
                title={`Preview: ${preview.description}`}
                onLoad={() => {
                    setIsLoading(false);
                    setHasError(false);
                }}
                onError={(e) => {
                    setIsLoading(false);
                    setHasError(true);
                    console.error(`❌ Preview error for ${preview.id}:`, e);
                }}
                referrerPolicy="no-referrer"
                loading="lazy"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
            />

            {/* Add the spinner keyframe animation */}
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
};

export default PreviewFrame; 