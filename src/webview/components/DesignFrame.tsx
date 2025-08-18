import React from 'react';
import type {
    DesignFile,
    GridPosition,
    FrameDimensions,
    ViewportMode,
} from '../types/canvas.types';
import { MobileIcon, TabletIcon, DesktopIcon, GlobeIcon } from './Icons';

// Import logo images

interface DesignFrameProps {
    file: DesignFile;
    position: GridPosition;
    dimensions: FrameDimensions;
    isSelected: boolean;
    onSelect: (fileName: string) => void;
    renderMode?: 'placeholder' | 'iframe' | 'html';
    showMetadata?: boolean;
    viewport?: ViewportMode;
    viewportDimensions?: FrameDimensions;
    onViewportChange?: (fileName: string, viewport: ViewportMode) => void;
    useGlobalViewport?: boolean;
    onDragStart?: (fileName: string, startPos: GridPosition, mouseEvent: React.MouseEvent) => void;
    isDragging?: boolean;
    nonce?: string | null;
    onSendToChat?: (fileName: string, prompt: string) => void;
}

const DesignFrame: React.FC<DesignFrameProps> = ({
    file,
    position,
    dimensions,
    isSelected,
    onSelect,
    renderMode = 'placeholder',
    showMetadata = true,
    viewport = 'desktop',
    viewportDimensions,
    onViewportChange,
    useGlobalViewport = false,
    onDragStart,
    isDragging = false,
    nonce = null,
    onSendToChat,
}) => {
    const [isLoading, setIsLoading] = React.useState(renderMode === 'iframe');
    const [hasError, setHasError] = React.useState(false);
    const [dragPreventOverlay, setDragPreventOverlay] = React.useState(false);
    const [showCopyDropdown, setShowCopyDropdown] = React.useState(false);
    const [copyButtonState, setCopyButtonState] = React.useState<{
        text: string;
        isSuccess: boolean;
    }>({ text: 'Copy prompt', isSuccess: false });
    const [copyPathButtonState, setCopyPathButtonState] = React.useState<{
        text: string;
        isSuccess: boolean;
    }>({ text: 'Copy design path', isSuccess: false });

    const handleClick = () => {
        onSelect(file.name);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (onDragStart && e.button === 0) {
            // Left mouse button only
            e.preventDefault();
            e.stopPropagation();

            // Show overlay to prevent iframe interaction during potential drag
            setDragPreventOverlay(true);

            onDragStart(file.name, position, e);
        }
    };

    // Clear drag prevention overlay when dragging ends
    React.useEffect(() => {
        if (!isDragging) {
            setDragPreventOverlay(false);
        }
    }, [isDragging]);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showCopyDropdown) {
                const target = event.target as Element;
                const dropdownElement = target.closest('.copy-prompt-dropdown');
                if (!dropdownElement) {
                    setShowCopyDropdown(false);
                }
            }
        };

        if (showCopyDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showCopyDropdown]);

    const handleViewportToggle = (newViewport: ViewportMode) => {
        if (onViewportChange && !useGlobalViewport) {
            onViewportChange(file.name, newViewport);
        }
    };

    const handleCopyPrompt = async (e: React.MouseEvent, platform?: string) => {
        e.preventDefault();
        e.stopPropagation();

        let promptText = '';
        let platformName = '';

        switch (platform) {
            case 'cursor':
                promptText = `${file.content}\n\nAbove is the design implementation, please use that as a reference to build a similar UI component. Make sure to follow modern React and TypeScript best practices.`;
                platformName = 'Cursor';
                break;
            case 'windsurf':
                promptText = `${file.content}\n\nAbove is the design implementation. Please analyze this design and create a similar UI component using modern web technologies and best practices.`;
                platformName = 'Windsurf';
                break;
            case 'claude-code':
                promptText = `${file.content}\n\nAbove is the design implementation. Please use this as a reference to create a similar component. Focus on clean, maintainable code structure.`;
                platformName = 'Claude Code';
                break;
            case 'lovable':
                promptText = `${file.content}\n\nAbove is the design implementation. Please recreate this design as a responsive React component with modern styling.`;
                platformName = 'Lovable';
                break;
            case 'bolt':
                promptText = `${file.content}\n\nAbove is the design implementation. Please create a similar UI using this as reference. Make it production-ready with proper styling.`;
                platformName = 'Bolt';
                break;
            case undefined:
            default:
                promptText = `${file.content}\n\nAbove is the design implementation, please use that as a reference`;
                platformName = '';
        }

        try {
            await navigator.clipboard.writeText(promptText);
            console.log(`✅ Copied ${platformName} prompt to clipboard for:`, file.name);

            // Show success state on button
            setCopyButtonState({ text: `Copied for ${platformName}!`, isSuccess: true });
            setTimeout(() => {
                setCopyButtonState({ text: 'Copy prompt', isSuccess: false });
            }, 2000);

            // Hide dropdown
            setShowCopyDropdown(false);
        } catch (err) {
            console.error('❌ Failed to copy to clipboard:', err);

            // Fallback: create a temporary textarea and copy
            const textarea = document.createElement('textarea');
            textarea.value = promptText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            console.log(`✅ Copied ${platformName} prompt using fallback method for:`, file.name);

            // Show success state on button
            setCopyButtonState({ text: `Copied for ${platformName}!`, isSuccess: true });
            setTimeout(() => {
                setCopyButtonState({ text: 'Copy prompt', isSuccess: false });
            }, 2000);

            // Hide dropdown
            setShowCopyDropdown(false);
        }
    };

    const handleCopyDesignPath = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const designPath = `Design file: ${file.path}`;

        try {
            await navigator.clipboard.writeText(designPath);
            console.log(`✅ Copied design path to clipboard:`, designPath);

            // Show success state on button
            setCopyPathButtonState({ text: 'Copied!', isSuccess: true });
            setTimeout(() => {
                setCopyPathButtonState({ text: 'Copy design path', isSuccess: false });
            }, 2000);
        } catch (err) {
            console.error('❌ Failed to copy design path to clipboard:', err);

            // Fallback: create a temporary textarea and copy
            const textarea = document.createElement('textarea');
            textarea.value = designPath;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            console.log(`✅ Copied design path using fallback method:`, designPath);

            // Show success state on button
            setCopyPathButtonState({ text: 'Copied!', isSuccess: true });
            setTimeout(() => {
                setCopyPathButtonState({ text: 'Copy design path', isSuccess: false });
            }, 2000);
        }
    };

    const handleCreateVariations = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onSendToChat) {
            onSendToChat(file.name, 'Create more variations based on this style');
        }
    };

    const handleIterateWithFeedback = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onSendToChat) {
            onSendToChat(file.name, 'Please create a few variations with this feedback: ');
        }
    };

    const getViewportIcon = (mode: ViewportMode): React.ReactElement => {
        switch (mode) {
            case 'mobile':
                return <MobileIcon />;
            case 'tablet':
                return <TabletIcon />;
            case 'desktop':
                return <DesktopIcon />;
            default:
                return <DesktopIcon />;
        }
    };

    const getViewportLabel = (mode: ViewportMode): string => {
        switch (mode) {
            case 'mobile':
                return 'Mobile';
            case 'tablet':
                return 'Tablet';
            case 'desktop':
                return 'Desktop';
            default:
                return 'Desktop';
        }
    };

    const renderContent = () => {
        switch (renderMode) {
            case 'iframe':
                // Handle SVG files differently than HTML files
                if (file.fileType === 'svg') {
                    // For SVG files, wrap in HTML with proper viewport
                    const svgHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:; img-src 'self' data: blob: https: http: *; font-src 'self' data: https: http: *; style-src 'self' 'unsafe-inline' https: http: *; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: *; connect-src 'self' https: http: *;">
                            ${viewportDimensions ? `<meta name="viewport" content="width=${viewportDimensions.width}, height=${viewportDimensions.height}, initial-scale=1.0">` : ''}
                            <style>
                                body { 
                                    margin: 0; 
                                    padding: 20px; 
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: center; 
                                    min-height: 100vh; 
                                    background: white;
                                    box-sizing: border-box;
                                }
                                svg { 
                                    max-width: 100%; 
                                    max-height: 100%; 
                                    height: auto; 
                                    width: auto;
                                }
                                img {
                                    max-width: 100%;
                                    height: auto;
                                }
                            </style>
                        </head>
                        <body>
                            ${file.content}
                            <script>
                                // Auto-render images in SVG context
                                document.addEventListener('DOMContentLoaded', function() {
                                    const images = document.querySelectorAll('img');
                                    images.forEach(function(img) {
                                        img.loading = 'eager';
                                        if (!img.complete || img.naturalWidth === 0) {
                                            const originalSrc = img.src;
                                            img.src = '';
                                            img.src = originalSrc;
                                        }
                                    });
                                });
                            </script>
                        </body>
                        </html>
                    `;

                    return (
                        <iframe
                            srcDoc={svgHtml}
                            title={`${file.name} - SVG`}
                            style={{
                                width: viewportDimensions
                                    ? `${viewportDimensions.width}px`
                                    : '100%',
                                height: viewportDimensions
                                    ? `${viewportDimensions.height}px`
                                    : '100%',
                                border: 'none',
                                background: 'white',
                                borderRadius: '0 0 6px 6px',
                                pointerEvents:
                                    isSelected && !dragPreventOverlay && !isDragging
                                        ? 'auto'
                                        : 'none',
                            }}
                            referrerPolicy='no-referrer'
                            loading='lazy'
                            onLoad={() => {
                                setIsLoading(false);
                                setHasError(false);
                                console.log(`SVG Frame loaded: ${file.name}`);
                            }}
                            onError={e => {
                                setIsLoading(false);
                                setHasError(true);
                                console.error(`SVG Frame error for ${file.name}:`, e);
                            }}
                        />
                    );
                }

                // HTML file handling (existing logic)
                // Function to inject nonce into script tags
                const injectNonce = (html: string, nonce: string | null) => {
                    if (!nonce) {
                        return html;
                    }
                    return html.replace(/<script/g, `<script nonce="${nonce}"`);
                };

                // Inject viewport meta tag and CSP if we have viewport dimensions
                let modifiedContent = file.content;

                // Use a more permissive CSP that relies on VS Code's built-in security
                const iframeCSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:; img-src 'self' data: blob: https: http: *; style-src 'self' 'unsafe-inline' data: https: http: *; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: *; connect-src 'self' https: http: *; frame-src 'self' data: blob: https: http: *;">`;

                // Service worker approach for external resource loading
                const serviceWorkerScript = `
                <script${nonce ? ` nonce="${nonce}"` : ''}>
                    // Register service worker to handle external resources
                    if ('serviceWorker' in navigator) {
                        const swCode = \`
                            self.addEventListener('fetch', event => {
                                const url = event.request.url;
                                
                                // Only handle external image requests
                                if (url.startsWith('http') && (url.includes('placehold.co') || url.includes('media.giphy.com') || url.match(/\\.(jpg|jpeg|png|gif|svg|webp)$/i))) {
                                    event.respondWith(
                                        fetch(event.request, {
                                            mode: 'cors',
                                            credentials: 'omit'
                                        }).catch(() => {
                                            // Fallback: return a placeholder image
                                            const canvas = new OffscreenCanvas(200, 120);
                                            const ctx = canvas.getContext('2d');
                                            ctx.fillStyle = '#cccccc';
                                            ctx.fillRect(0, 0, 200, 120);
                                            ctx.fillStyle = '#000000';
                                            ctx.font = '16px Arial';
                                            ctx.textAlign = 'center';
                                            ctx.fillText('IMAGE', 100, 60);
                                            
                                            return canvas.convertToBlob().then(blob => 
                                                new Response(blob, {
                                                    headers: { 'Content-Type': 'image/png' }
                                                })
                                            );
                                        })
                                    );
                                }
                            });
                        \`;
                        
                        const blob = new Blob([swCode], { type: 'application/javascript' });
                        const swUrl = URL.createObjectURL(blob);
                        
                        navigator.serviceWorker.register(swUrl).then(registration => {
                            console.log('Service Worker registered successfully');
                            
                            // Wait for service worker to be active
                            if (registration.active) {
                                processImages();
                            } else {
                                registration.addEventListener('updatefound', () => {
                                    const newWorker = registration.installing;
                                    newWorker.addEventListener('statechange', () => {
                                        if (newWorker.state === 'activated') {
                                            processImages();
                                        }
                                    });
                                });
                            }
                        }).catch(error => {
                            console.log('Service Worker registration failed, falling back to direct loading');
                            processImages();
                        });
                    } else {
                        // Fallback for browsers without service worker support
                        processImages();
                    }
                    
                    function processImages() {
                        // Force reload all external images to trigger service worker
                        const images = document.querySelectorAll('img[src]');
                        images.forEach(img => {
                            if (img.src.startsWith('http')) {
                                const originalSrc = img.src;
                                img.src = '';
                                setTimeout(() => {
                                    img.src = originalSrc;
                                }, 10);
                            }
                        });
                    }
                    
                    // Process images when DOM is ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            setTimeout(processImages, 100);
                        });
                    } else {
                        setTimeout(processImages, 100);
                    }
                </script>`;

                if (viewportDimensions) {
                    const viewportMeta = `<meta name="viewport" content="width=${viewportDimensions.width}, height=${viewportDimensions.height}, initial-scale=1.0">`;
                    if (modifiedContent.includes('<head>')) {
                        modifiedContent = modifiedContent.replace(
                            '<head>',
                            `<head>\n${iframeCSP}\n${viewportMeta}`
                        );
                        // Inject script before closing body tag
                        if (modifiedContent.includes('</body>')) {
                            modifiedContent = modifiedContent.replace(
                                '</body>',
                                `${serviceWorkerScript}\n</body>`
                            );
                        } else {
                            modifiedContent += serviceWorkerScript;
                        }
                    } else if (modifiedContent.includes('<html>')) {
                        modifiedContent = modifiedContent.replace(
                            '<html>',
                            `<html><head>\n${iframeCSP}\n${viewportMeta}\n</head>`
                        );
                        if (modifiedContent.includes('</body>')) {
                            modifiedContent = modifiedContent.replace(
                                '</body>',
                                `${serviceWorkerScript}\n</body>`
                            );
                        } else {
                            modifiedContent += serviceWorkerScript;
                        }
                    } else {
                        modifiedContent = `<head>\n${iframeCSP}\n${viewportMeta}\n</head>\n${modifiedContent}${serviceWorkerScript}`;
                    }
                } else {
                    // Even without viewport dimensions, we need to inject CSP and script
                    if (modifiedContent.includes('<head>')) {
                        modifiedContent = modifiedContent.replace('<head>', `<head>\n${iframeCSP}`);
                        if (modifiedContent.includes('</body>')) {
                            modifiedContent = modifiedContent.replace(
                                '</body>',
                                `${serviceWorkerScript}\n</body>`
                            );
                        } else {
                            modifiedContent += serviceWorkerScript;
                        }
                    } else if (modifiedContent.includes('<html>')) {
                        modifiedContent = modifiedContent.replace(
                            '<html>',
                            `<html><head>\n${iframeCSP}\n</head>`
                        );
                        if (modifiedContent.includes('</body>')) {
                            modifiedContent = modifiedContent.replace(
                                '</body>',
                                `${serviceWorkerScript}\n</body>`
                            );
                        } else {
                            modifiedContent += serviceWorkerScript;
                        }
                    } else {
                        modifiedContent = `<head>\n${iframeCSP}\n</head>\n${modifiedContent}${serviceWorkerScript}`;
                    }
                }

                // Inject nonce into all script tags
                modifiedContent = injectNonce(modifiedContent, nonce);

                return (
                    <iframe
                        srcDoc={modifiedContent}
                        title={`${file.name} - ${getViewportLabel(viewport)}`}
                        style={{
                            width: viewportDimensions ? `${viewportDimensions.width}px` : '100%',
                            height: viewportDimensions ? `${viewportDimensions.height}px` : '100%',
                            border: 'none',
                            background: 'white',
                            borderRadius: '0 0 6px 6px',
                            pointerEvents:
                                isSelected && !dragPreventOverlay && !isDragging ? 'auto' : 'none',
                        }}
                        referrerPolicy='no-referrer'
                        loading='lazy'
                        onLoad={() => {
                            setIsLoading(false);
                            setHasError(false);
                            console.log(`Frame loaded: ${file.name} (${viewport})`);
                        }}
                        onError={e => {
                            setIsLoading(false);
                            setHasError(true);
                            console.error(`Frame error for ${file.name}:`, e);
                        }}
                    />
                );

            case 'html':
                // Direct HTML/SVG rendering - USE WITH CAUTION (security risk)
                // Only use for trusted content or when iframe fails
                if (file.fileType === 'svg') {
                    return (
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                overflow: 'hidden',
                                background: 'white',
                                border: '1px solid var(--vscode-errorForeground)',
                                borderRadius: '0 0 6px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '20px',
                                boxSizing: 'border-box',
                            }}
                            title='⚠️ Direct SVG rendering - potential security risk'
                            dangerouslySetInnerHTML={{ __html: file.content }}
                        />
                    );
                }

                return (
                    <div
                        dangerouslySetInnerHTML={{ __html: file.content }}
                        style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            background: 'white',
                            border: '1px solid var(--vscode-errorForeground)',
                            borderRadius: '0 0 6px 6px',
                        }}
                        title='⚠️ Direct HTML rendering - potential security risk'
                    />
                );

            case 'placeholder':
            default:
                const placeholderIcon = file.fileType === 'svg' ? '🎨' : '🌐';
                const placeholderHint =
                    file.fileType === 'svg' ? 'SVG Vector Graphics' : 'HTML Design';

                return (
                    <div className='frame-placeholder'>
                        <div className='placeholder-icon'>{placeholderIcon}</div>
                        <p className='placeholder-name'>{file.name}</p>
                        <div className='placeholder-meta'>
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                            <span>{file.modified.toLocaleDateString()}</span>
                            <span className='file-type'>{file.fileType.toUpperCase()}</span>
                        </div>
                        {renderMode === 'placeholder' && (
                            <small className='placeholder-hint'>
                                {placeholderHint} - Zoom in to load
                            </small>
                        )}
                    </div>
                );
        }
    };

    return (
        <div
            className={`design-frame ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            style={{
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${dimensions.width}px`,
                height: `${dimensions.height}px`,
                cursor: isDragging ? 'grabbing' : 'grab',
                zIndex: isDragging ? 1000 : isSelected ? 10 : 1,
                opacity: isDragging ? 0.8 : 1,
            }}
            onClick={handleClick}
            title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
            onMouseDown={handleMouseDown}
        >
            <div className='frame-header'>
                <span className='frame-title'>{file.name}</span>

                {/* Viewport Controls */}
                {onViewportChange && !useGlobalViewport && (
                    <div className='frame-viewport-controls'>
                        <button
                            className={`frame-viewport-btn ${viewport === 'mobile' ? 'active' : ''}`}
                            onClick={() => handleViewportToggle('mobile')}
                            title='Mobile View'
                        >
                            <MobileIcon />
                        </button>
                        <button
                            className={`frame-viewport-btn ${viewport === 'tablet' ? 'active' : ''}`}
                            onClick={() => handleViewportToggle('tablet')}
                            title='Tablet View'
                        >
                            <TabletIcon />
                        </button>
                        <button
                            className={`frame-viewport-btn ${viewport === 'desktop' ? 'active' : ''}`}
                            onClick={() => handleViewportToggle('desktop')}
                            title='Desktop View'
                        >
                            <DesktopIcon />
                        </button>
                    </div>
                )}

                {/* Global viewport indicator */}
                {useGlobalViewport && (
                    <div className='frame-viewport-indicator'>
                        <span className='global-indicator'>
                            <GlobeIcon />
                        </span>
                        <span className='viewport-icon'>{getViewportIcon(viewport)}</span>
                    </div>
                )}

                {showMetadata && (
                    <div className='frame-meta'>
                        {isLoading && <span className='frame-status loading'>●</span>}
                        {hasError && <span className='frame-status error'>●</span>}
                        {!isLoading && !hasError && renderMode === 'iframe' && (
                            <span className='frame-status loaded'>●</span>
                        )}
                    </div>
                )}
            </div>
            <div className='frame-content'>
                {renderContent()}

                {/* Drag prevention overlay - prevents iframe interaction during drag */}
                {(dragPreventOverlay || isDragging) && isSelected && renderMode === 'iframe' && (
                    <div className='frame-drag-overlay'>
                        {dragPreventOverlay && !isDragging && (
                            <div className='drag-ready-hint'>
                                <span>✋</span>
                                <p>Ready to drag</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading overlay for iframe */}
                {isLoading && renderMode === 'iframe' && (
                    <div className='frame-loading-overlay'>
                        <div className='frame-loading-spinner'>
                            <div className='spinner-small' />
                            <span>Loading...</span>
                        </div>
                    </div>
                )}

                {/* Error overlay */}
                {hasError && (
                    <div className='frame-error-overlay'>
                        <div className='frame-error-content'>
                            <span>⚠️</span>
                            <p>Failed to load</p>
                            <small>{file.name}</small>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Action Buttons - Outside frame, top-right corner */}
            {isSelected && !isDragging && (
                <div
                    className='floating-action-buttons'
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <button
                        className='floating-action-btn'
                        onClick={handleCreateVariations}
                        title='Create more variations based on this style'
                    >
                        <svg
                            className='btn-icon'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <circle cx='6' cy='6' r='3' />
                            <circle cx='18' cy='18' r='3' />
                            <circle cx='18' cy='6' r='3' />
                            <path d='M18 9v6' />
                            <path d='M9 6h6' />
                        </svg>
                        <span className='btn-text'>Create variations</span>
                    </button>
                    <button
                        className='floating-action-btn'
                        onClick={handleIterateWithFeedback}
                        title='Create variations with feedback'
                    >
                        <svg className='btn-icon' viewBox='0 0 24 24' fill='none'>
                            <path
                                d='M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z'
                                fill='currentColor'
                            />
                        </svg>
                        <span className='btn-text'>Iterate with feedback</span>
                    </button>

                    {/* Copy Prompt Dropdown */}
                    <div className='copy-prompt-dropdown'>
                        <button
                            className={`floating-action-btn copy-prompt-main-btn ${copyButtonState.isSuccess ? 'success' : ''}`}
                            onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log(
                                    'Dropdown toggle clicked. Current context:',
                                    (window as any).__WEBVIEW_CONTEXT__
                                );
                                console.log(
                                    'Logo URIs available:',
                                    (window as any).__WEBVIEW_CONTEXT__?.logoUris
                                );
                                setShowCopyDropdown(!showCopyDropdown);
                            }}
                            title='Copy file content with reference prompt'
                        >
                            <svg
                                className='btn-icon'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            >
                                <path d='M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z' />
                                <path d='M20 3v4' />
                                <path d='M22 5h-4' />
                                <path d='M4 17v2' />
                                <path d='M5 18H3' />
                            </svg>
                            <span className='btn-text'>{copyButtonState.text}</span>
                            <svg className='dropdown-arrow' viewBox='0 0 24 24' fill='none'>
                                <path d='M7 10L12 15L17 10H7Z' fill='currentColor' />
                            </svg>
                        </button>

                        {showCopyDropdown && (
                            <div className='copy-dropdown-menu'>
                                <button
                                    className='copy-dropdown-item'
                                    onClick={e => void handleCopyPrompt(e, 'cursor')}
                                >
                                    <img
                                        src={(window as any).__WEBVIEW_CONTEXT__?.logoUris?.cursor}
                                        alt='Cursor'
                                        className='platform-logo'
                                        onError={e => {
                                            console.error(
                                                'Failed to load Cursor logo:',
                                                (window as any).__WEBVIEW_CONTEXT__?.logoUris
                                                    ?.cursor
                                            );
                                            console.error('Image error event:', e);
                                        }}
                                        onLoad={() =>
                                            console.log('Cursor logo loaded successfully')
                                        }
                                    />
                                    <span>Cursor</span>
                                </button>
                                <button
                                    className='copy-dropdown-item'
                                    onClick={e => void handleCopyPrompt(e, 'windsurf')}
                                >
                                    <img
                                        src={
                                            (window as any).__WEBVIEW_CONTEXT__?.logoUris?.windsurf
                                        }
                                        alt='Windsurf'
                                        className='platform-logo'
                                        onError={e => {
                                            console.error(
                                                'Failed to load Windsurf logo:',
                                                (window as any).__WEBVIEW_CONTEXT__?.logoUris
                                                    ?.windsurf
                                            );
                                            console.error('Image error event:', e);
                                        }}
                                        onLoad={() =>
                                            console.log('Windsurf logo loaded successfully')
                                        }
                                    />
                                    <span>Windsurf</span>
                                </button>
                                <button
                                    className='copy-dropdown-item'
                                    onClick={e => void handleCopyPrompt(e, 'claude-code')}
                                >
                                    <img
                                        src={
                                            (window as any).__WEBVIEW_CONTEXT__?.logoUris
                                                ?.claudeCode
                                        }
                                        alt='Claude Code'
                                        className='platform-logo'
                                        onError={e => {
                                            console.error(
                                                'Failed to load Claude Code logo:',
                                                (window as any).__WEBVIEW_CONTEXT__?.logoUris
                                                    ?.claudeCode
                                            );
                                            console.error('Image error event:', e);
                                        }}
                                        onLoad={() =>
                                            console.log('Claude Code logo loaded successfully')
                                        }
                                    />
                                    <span>Claude Code</span>
                                </button>
                                <button
                                    className='copy-dropdown-item'
                                    onClick={e => void handleCopyPrompt(e, 'lovable')}
                                >
                                    <img
                                        src={(window as any).__WEBVIEW_CONTEXT__?.logoUris?.lovable}
                                        alt='Lovable'
                                        className='platform-logo'
                                        onError={e => {
                                            console.error(
                                                'Failed to load Lovable logo:',
                                                (window as any).__WEBVIEW_CONTEXT__?.logoUris
                                                    ?.lovable
                                            );
                                            console.error('Image error event:', e);
                                        }}
                                        onLoad={() =>
                                            console.log('Lovable logo loaded successfully')
                                        }
                                    />
                                    <span>Lovable</span>
                                </button>
                                <button
                                    className='copy-dropdown-item'
                                    onClick={e => void handleCopyPrompt(e, 'bolt')}
                                >
                                    <img
                                        src={(window as any).__WEBVIEW_CONTEXT__?.logoUris?.bolt}
                                        alt='Bolt'
                                        className='platform-logo'
                                        onError={e => {
                                            console.error(
                                                'Failed to load Bolt logo:',
                                                (window as any).__WEBVIEW_CONTEXT__?.logoUris?.bolt
                                            );
                                            console.error('Image error event:', e);
                                        }}
                                        onLoad={() => console.log('Bolt logo loaded successfully')}
                                    />
                                    <span>Bolt</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Copy Design Path Button */}
                    <button
                        className={`floating-action-btn copy-path-btn ${copyPathButtonState.isSuccess ? 'success' : ''}`}
                        onClick={e => void handleCopyDesignPath(e)}
                        title='Copy absolute path of design file'
                    >
                        <svg
                            className='btn-icon'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
                            <path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
                        </svg>
                        <span className='btn-text'>{copyPathButtonState.text}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default DesignFrame;
