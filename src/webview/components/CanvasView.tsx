import React, { useState, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import DesignFrame from './DesignFrame';
import PreviewFrame from './PreviewFrame';
import { calculateGridPosition, calculateFitToView, getGridMetrics, generateResponsiveConfig, buildHierarchyTree, calculateHierarchyPositions, getHierarchicalPosition, detectDesignRelationships, buildPreviewHierarchyTree, calculatePreviewHierarchyPositions, getPreviewHierarchicalPosition, PreviewHierarchyTree } from '../utils/gridLayout';
import { 
    DesignFile, 
    CanvasState, 
    WebviewMessage, 
    ExtensionToWebviewMessage,
    CanvasConfig,
    ViewportMode,
    FrameViewportState,
    FramePositionState,
    DragState,
    GridPosition,
    LayoutMode,
    HierarchyTree,
    ConnectionLine,
    Preview,
    LoadPreviewsMessage,
    PreviewsLoadedMessage,
    FrameDimensions
} from '../types/canvas.types';
import ConnectionLines from './ConnectionLines';
import {
    ZoomInIcon,
    ZoomOutIcon,
    HomeIcon,
    ScaleIcon,
    RefreshIcon,
    GlobeIcon,
    MobileIcon,
    TabletIcon,
    DesktopIcon,
    TreeIcon,
    LinkIcon
} from './Icons';

// Iframe overlay control icons
const CommentIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M14 1H2a1 1 0 00-1 1v8a1 1 0 001 1h2v4l4-4h6a1 1 0 001-1V2a1 1 0 00-1-1zM13 9H8l-2 2V9H3V3h10v6z"/>
    </svg>
);

const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M12.854 2.854a.5.5 0 00-.708-.708L3 11.293V13h1.707l9.147-9.146z"/>
        <path d="M2 12.5V15h.5a.5.5 0 00.5-.5V13h1.5a.5.5 0 00.5-.5V12H2.5a.5.5 0 00-.5.5z"/>
    </svg>
);

const ShareIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3.5 6a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-8a.5.5 0 00-.5-.5h-2a.5.5 0 010-1h2A1.5 1.5 0 0114 6.5v8a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 14.5v-8A1.5 1.5 0 013.5 5h2a.5.5 0 010 1h-2z"/>
        <path d="M7.646.146a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8.5 1.707V10.5a.5.5 0 01-1 0V1.707L5.354 3.854a.5.5 0 11-.708-.708l3-3z"/>
    </svg>
);

const CodeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/>
    </svg>
);



const MoreIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
    </svg>
);

// IframeOverlay component for selected frames
interface IframeOverlayProps {
    frameId: string;
    position: GridPosition;
    dimensions: FrameDimensions;
    frameType: 'design' | 'preview';
    zoomLevel?: number;
    onComment: () => void;
    onEdit: () => void;
    onShare: () => void;
    onViewCode: () => void;
    onOpenInBrowser: () => void;
    onMore: () => void;
}

const IframeOverlay: React.FC<IframeOverlayProps> = ({
    frameId,
    position,
    dimensions,
    frameType,
    onComment,
    onEdit,
    onShare,
    onViewCode,
    onOpenInBrowser,
    onMore,
    zoomLevel = 1
}) => {
    const toolbarHeight = 40;
    const toolbarSpacing = 8; // Space between toolbar and iframe
    const inverseScale = 1 / zoomLevel; // Counteract zoom scaling
    const toolbarWidth = 320; // Fixed compact width for toolbar
    const centerOffset = (dimensions.width - toolbarWidth) / 2; // Center the toolbar horizontally
    
    return (
        <div
            className="iframe-overlay"
            style={{
                position: 'absolute',
                left: position.x + centerOffset, // Center horizontally relative to frame
                top: position.y - (toolbarHeight + toolbarSpacing) * inverseScale, // Position toolbar above iframe, adjusted for scale
                width: toolbarWidth,
                height: toolbarHeight, // Use original height, transform will handle scaling
                pointerEvents: 'none', // Allow interaction with iframe below
                zIndex: 1000
            }}
        >
            {/* Toolbar positioned above iframe with consistent size */}
            <div
                className="iframe-overlay-toolbar"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: toolbarWidth, // Use compact fixed width
                    height: `${toolbarHeight}px`,
                    background: 'var(--vscode-sideBar-background)',
                    border: '1px solid var(--vscode-panel-border)',
                    boxShadow: '0 2px 8px var(--vscode-widget-shadow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 12px',
                    borderRadius: '6px',
                    pointerEvents: 'auto', // Enable interaction with toolbar
                    transform: `scale(${inverseScale})`, // Scale inversely to zoom to maintain consistent size
                    transformOrigin: 'top center' // Center the scaling origin
                }}
            >
                {/* Left side - Frame info (compact) */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    color: 'var(--vscode-foreground)',
                    fontSize: '11px',
                    fontWeight: 500,
                    maxWidth: '120px',
                    overflow: 'hidden'
                }}>
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '80px'
                    }}>{frameId}</span>
                    <span style={{ 
                        background: frameType === 'design' ? 'var(--vscode-button-background)' : 'var(--vscode-errorForeground)',
                        color: frameType === 'design' ? 'var(--vscode-button-foreground)' : 'var(--vscode-errorBackground)',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontSize: '8px',
                        textTransform: 'uppercase',
                        flexShrink: 0
                    }}>
                        {frameType.substring(0, 1)} {/* Just first letter: D or P */}
                    </span>
                </div>

                {/* Right side - Controls */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '3px'
                }}>
                    <button
                        className="iframe-overlay-btn"
                        onClick={onComment}
                        title="Add Comment"
                    >
                        <CommentIcon />
                    </button>
                    <button
                        className="iframe-overlay-btn"
                        onClick={onEdit}
                        title="Edit"
                    >
                        <EditIcon />
                    </button>
                    <button
                        className="iframe-overlay-btn"
                        onClick={onShare}
                        title="Share"
                    >
                        <ShareIcon />
                    </button>
                    <button
                        className="iframe-overlay-btn"
                        onClick={onViewCode}
                        title="View Code"
                    >
                        <CodeIcon />
                    </button>
                    <div className="iframe-overlay-btn-container">
                        <button
                            className="iframe-overlay-btn"
                            onClick={onOpenInBrowser}
                        >
                            <GlobeIcon />
                        </button>
                        <div className="iframe-overlay-tooltip">Open in New Tab</div>
                    </div>
                    <button
                        className="iframe-overlay-btn"
                        onClick={onMore}
                        title="More Options"
                    >
                        <MoreIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CanvasViewProps {
    vscode: any;
    nonce: string | null;
}

const CANVAS_CONFIG: CanvasConfig = {
    frameSize: { width: 320, height: 400 }, // Smaller default frame size for better density
    gridSpacing: 50, // Much tighter spacing between frames
    framesPerRow: 4, // Fit 4 frames per row by default
    minZoom: 0.1,
    maxZoom: 5,
    responsive: {
        enableScaling: true,
        minFrameSize: { width: 160, height: 200 }, // Reduced minimum size
        maxFrameSize: { width: 400, height: 500 }, // Reduced maximum size
        scaleWithZoom: false
    },
    viewports: {
        desktop: { width: 1000, height: 600 }, // More compact desktop view
        tablet: { width: 640, height: 800 }, // Smaller tablet view
        mobile: { width: 320, height: 550 } // More compact mobile view
    },
    hierarchy: {
        horizontalSpacing: 180, // Reduced horizontal spacing for hierarchy
        verticalSpacing: 120, // Reduced vertical spacing for hierarchy
        connectionLineWidth: 2,
        connectionLineColor: 'var(--vscode-textLink-foreground)',
        showConnections: true
    }
};

const CanvasView: React.FC<CanvasViewProps> = ({ vscode, nonce }) => {
    
    const [designFiles, setDesignFiles] = useState<DesignFile[]>([]);
    const [selectedFrame, setSelectedFrame] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);
    const [currentConfig, setCurrentConfig] = useState<CanvasConfig>(CANVAS_CONFIG);
    const [globalViewportMode, setGlobalViewportMode] = useState<ViewportMode>('tablet');
    const [frameViewports, setFrameViewports] = useState<FrameViewportState>({});
    const [useGlobalViewport, setUseGlobalViewport] = useState(true);
    const [customPositions, setCustomPositions] = useState<FramePositionState>({});
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedFrame: null,
        startPosition: { x: 0, y: 0 },
        currentPosition: { x: 0, y: 0 },
        offset: { x: 0, y: 0 }
    });
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
    const [hierarchyTree, setHierarchyTree] = useState<HierarchyTree | null>(null);
    const [showConnections, setShowConnections] = useState(true);
    // Preview state variables
    const [previews, setPreviews] = useState<Preview[]>([]);
    const [previewsLoading, setPreviewsLoading] = useState(true);
    const [previewsError, setPreviewsError] = useState<string | null>(null);
    // Preview hierarchy state
    const [previewHierarchyTree, setPreviewHierarchyTree] = useState<PreviewHierarchyTree | null>(null);
    

    
    // Custom confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        onCancel: () => {}
    });
    
    const transformRef = useRef<ReactZoomPanPinchRef>(null);
    
    // Performance optimization: Switch render modes based on zoom level
    const getOptimalRenderMode = (_zoom: number): 'placeholder' | 'iframe' => {
        // Always render iframe as requested by the user
        return 'iframe';
    };

    // Helper function to transform mouse coordinates to canvas space
    const transformMouseToCanvasSpace = (clientX: number, clientY: number, canvasRect: DOMRect): GridPosition => {
        // Get current transform state from the TransformWrapper
        const transformState = transformRef.current?.instance?.transformState;
        const currentScale = transformState?.scale || 1;
        const currentTranslateX = transformState?.positionX || 0;
        const currentTranslateY = transformState?.positionY || 0;
        
        // Calculate mouse position relative to canvas, then adjust for zoom and pan
        const rawMouseX = clientX - canvasRect.left;
        const rawMouseY = clientY - canvasRect.top;
        
        // Transform mouse coordinates to canvas space (inverse of current transform)
        return {
            x: (rawMouseX - currentTranslateX) / currentScale,
            y: (rawMouseY - currentTranslateY) / currentScale
        };
    };

    // Viewport management functions
    const getFrameViewport = (fileName: string): ViewportMode => {
        if (useGlobalViewport) {
            return globalViewportMode;
        }
        return frameViewports[fileName] || 'desktop';
    };

    const handleFrameViewportChange = (fileName: string, viewport: ViewportMode) => {
        setFrameViewports(prev => ({
            ...prev,
            [fileName]: viewport
        }));
    };

    const handleGlobalViewportChange = (viewport: ViewportMode) => {
        setGlobalViewportMode(viewport);
        if (useGlobalViewport) {
            // Update all frames to the new global viewport
            const newFrameViewports: FrameViewportState = {};
            designFiles.forEach(file => {
                newFrameViewports[file.name] = viewport;
            });
            setFrameViewports(newFrameViewports);
            
            // Update hierarchy positioning when viewport changes to adjust connection spacing
            if (hierarchyTree && designFiles.length > 0) {
                // Recalculate frame dimensions for new viewport
                let totalWidth = 0;
                let totalHeight = 0;
                let frameCount = 0;
                
                designFiles.forEach(file => {
                    const viewportDimensions = currentConfig.viewports[viewport];
                    totalWidth += viewportDimensions.width;
                    totalHeight += viewportDimensions.height + 50; // Add header space
                    frameCount++;
                });
                
                const avgFrameDimensions = frameCount > 0 ? {
                    width: Math.round(totalWidth / frameCount),
                    height: Math.round(totalHeight / frameCount)
                } : { width: 400, height: 550 };
                
                const updatedTree = calculateHierarchyPositions(hierarchyTree, currentConfig, avgFrameDimensions);
                setHierarchyTree(updatedTree);
            }
            
            // Update preview hierarchy positioning when viewport changes
            if (previewHierarchyTree && previews.length > 0) {
                // Recalculate preview frame dimensions for new viewport
                let totalPreviewWidth = 0;
                let totalPreviewHeight = 0;
                let previewCount = 0;
                
                previews.forEach(preview => {
                    const viewportDimensions = currentConfig.viewports[viewport];
                    totalPreviewWidth += viewportDimensions.width;
                    totalPreviewHeight += viewportDimensions.height + 50; // Add header space
                    previewCount++;
                });
                
                const avgPreviewFrameDimensions = previewCount > 0 ? {
                    width: Math.round(totalPreviewWidth / previewCount),
                    height: Math.round(totalPreviewHeight / previewCount)
                } : { width: 400, height: 550 };
                
                const updatedPreviewTree = calculatePreviewHierarchyPositions(
                    previewHierarchyTree, 
                    currentConfig, 
                    avgPreviewFrameDimensions,
                    hierarchyTree?.bounds // Pass design hierarchy bounds to avoid overlap
                );
                setPreviewHierarchyTree(updatedPreviewTree);
            }
        }
    };

    const toggleGlobalViewport = () => {
        const newUseGlobal = !useGlobalViewport;
        setUseGlobalViewport(newUseGlobal);
        
        if (newUseGlobal) {
            // Set all frames to current global viewport
            const newFrameViewports: FrameViewportState = {};
            designFiles.forEach(file => {
                newFrameViewports[file.name] = globalViewportMode;
            });
            setFrameViewports(newFrameViewports);
        }
    };

    // Responsive config update
    useEffect(() => {
        const updateConfig = () => {
            const responsive = generateResponsiveConfig(CANVAS_CONFIG, window.innerWidth);
            setCurrentConfig(responsive);
        };

        updateConfig();
        window.addEventListener('resize', updateConfig);
        return () => window.removeEventListener('resize', updateConfig);
    }, []);

    useEffect(() => {
        // Request design files from extension
        const loadDesignFilesMessage: WebviewMessage = {
            command: 'loadDesignFiles'
        };
        vscode.postMessage(loadDesignFilesMessage);

        // Request previews from extension
        const loadPreviewsMessage: WebviewMessage = {
            command: 'loadPreviews'
        };
        vscode.postMessage(loadPreviewsMessage);

        // Listen for messages from extension
        const messageHandler = (event: MessageEvent) => {
            const message: ExtensionToWebviewMessage = event.data;
            
            switch (message.command) {
                case 'designFilesLoaded':
                    // Convert date strings back to Date objects
                    const filesWithDates = message.data.files.map(file => ({
                        ...file,
                        modified: new Date(file.modified)
                    }));
                    
                    // Detect design relationships and build hierarchy
                    const filesWithRelationships = detectDesignRelationships(filesWithDates);
                    setDesignFiles(filesWithRelationships);
                    
                    // Build hierarchy tree
                    const tree = buildHierarchyTree(filesWithRelationships);
                    
                    // Calculate average frame dimensions based on viewport usage
                    let totalWidth = 0;
                    let totalHeight = 0;
                    let frameCount = 0;
                    
                    filesWithRelationships.forEach(file => {
                        const frameViewport = getFrameViewport(file.name);
                        const viewportDimensions = currentConfig.viewports[frameViewport];
                        totalWidth += viewportDimensions.width;
                        totalHeight += viewportDimensions.height + 50; // Add header space
                        frameCount++;
                    });
                    
                    const avgFrameDimensions = frameCount > 0 ? {
                        width: Math.round(totalWidth / frameCount),
                        height: Math.round(totalHeight / frameCount)
                    } : { width: 400, height: 550 };
                    
                    const positionedTree = calculateHierarchyPositions(tree, currentConfig, avgFrameDimensions);
                    setHierarchyTree(positionedTree);
                    
                    // Design files loading complete - show canvas immediately
                    setIsLoading(false);
                    
                    // Auto-center view after files are loaded
                    setTimeout(() => {
                        if (transformRef.current) {
                            transformRef.current.resetTransform();
                        }
                    }, 100);
                    break;
                    
                case 'previewsLoaded':
                    setPreviews(message.data.previews);
                    setPreviewsLoading(false);
                    
                    // Build preview hierarchy tree
                    const previewTree = buildPreviewHierarchyTree(message.data.previews);
                    
                    // Calculate average frame dimensions for previews
                    let totalPreviewWidth = 0;
                    let totalPreviewHeight = 0;
                    let previewCount = 0;
                    
                    message.data.previews.forEach(preview => {
                        const previewViewport = getFrameViewport(preview.id);
                        const viewportDimensions = currentConfig.viewports[previewViewport];
                        totalPreviewWidth += viewportDimensions.width;
                        totalPreviewHeight += viewportDimensions.height + 50; // Add header space
                        previewCount++;
                    });
                    
                    const avgPreviewFrameDimensions = previewCount > 0 ? {
                        width: Math.round(totalPreviewWidth / previewCount),
                        height: Math.round(totalPreviewHeight / previewCount)
                    } : { width: 400, height: 550 };
                    
                    const positionedPreviewTree = calculatePreviewHierarchyPositions(
                        previewTree, 
                        currentConfig, 
                        avgPreviewFrameDimensions,
                        hierarchyTree?.bounds // Pass design hierarchy bounds to avoid overlap
                    );
                    setPreviewHierarchyTree(positionedPreviewTree);
                    break;

                case 'previewDeleted':
                    setPreviews(message.data.previews);
                    // Clear selection if the deleted preview was selected
                    if (selectedFrame === message.data.previewId) {
                        setSelectedFrame('');
                    }
                    break;

                case 'error':
                    setError(message.data.error);
                    setPreviewsError(message.data.error);
                    setIsLoading(false);
                    setPreviewsLoading(false);
                    break;

                case 'fileChanged':
                    // Handle file system changes (will implement in Task 2.3)
                    console.log('File changed:', message.data);
                    // Re-request files when changes occur
                    vscode.postMessage({ command: 'loadDesignFiles' });
                    break;
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, [vscode]); // Removed currentConfig dependency to prevent constant re-renders

    // Handle keyboard events for confirmation dialog and global shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (confirmDialog.isOpen) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    confirmDialog.onCancel();
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmDialog.onConfirm();
                }
                return;
            }

            // Global keyboard shortcuts (when not in confirmation dialog)
            switch (event.key) {
                case 'Escape':
                    if (selectedFrame) {
                        event.preventDefault();
                        setSelectedFrame('');
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [confirmDialog, selectedFrame]);



    // Single frame selection
    const handleFrameSelect = (frameId: string, event?: React.MouseEvent) => {
        // Always single selection
        setSelectedFrame(frameId);
        
        // Send context to chat interface
        const selectedFile = designFiles.find(file => file.name === frameId);
        const filePath = selectedFile ? selectedFile.path : frameId;
        
        const selectMessage: WebviewMessage = {
            command: 'selectFrame',
            data: { fileName: frameId }
        };
        vscode.postMessage(selectMessage);

        const contextMessage: WebviewMessage = {
            command: 'setContextFromCanvas',
            data: { fileName: filePath, type: 'frame' }
        };
        vscode.postMessage(contextMessage);
    };



    const handleSendToChat = (fileName: string, prompt: string) => {
        // Find the selected file to get its full path
        const selectedFile = designFiles.find(file => file.name === fileName);
        const filePath = selectedFile ? selectedFile.path : fileName;
        
        // Set context first
        const contextMessage: WebviewMessage = {
            command: 'setContextFromCanvas',
            data: { fileName: filePath, type: 'frame' }
        };
        vscode.postMessage(contextMessage);
        
        // Then send the prompt to the chat input
        const promptMessage: WebviewMessage = {
            command: 'setChatPrompt',
            data: { prompt }
        };
        vscode.postMessage(promptMessage);
    };

    const handleDeletePreview = (previewId: string) => {
        // Show custom confirmation dialog instead of window.confirm()
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Preview',
            message: `Are you sure you want to delete the preview "${previewId}"? This action cannot be undone.`,
            onConfirm: () => {
                // Send delete message to extension
                const deleteMessage: WebviewMessage = {
                    command: 'deletePreview',
                    data: { previewId }
                };
                vscode.postMessage(deleteMessage);
                
                // Close the dialog
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            },
            onCancel: () => {
                // Just close the dialog
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Iframe overlay handlers
    const handleOverlayComment = (frameId: string) => {
        console.log('Add comment to:', frameId);
        // TODO: Implement comment functionality
        handleSendToChat(frameId, "I'd like to add a comment about this design. What feedback or suggestions do you have?");
    };

    const handleOverlayEdit = (frameId: string) => {
        console.log('Edit frame:', frameId);
        // TODO: Implement edit functionality
        handleSendToChat(frameId, "I'd like to modify this design. Can you help me make some changes?");
    };

    const handleOverlayShare = (frameId: string) => {
        console.log('Share frame:', frameId);
        // Copy frame URL or file path to clipboard
        const selectedFile = designFiles.find(file => file.name === frameId);
        const selectedPreview = previews.find(preview => preview.id === frameId);
        
        if (selectedFile) {
            navigator.clipboard.writeText(selectedFile.path);
            console.log('Copied file path to clipboard:', selectedFile.path);
        } else if (selectedPreview) {
            const shareData = {
                title: `Preview: ${selectedPreview.id}`,
                text: selectedPreview.description || 'Check out this design preview',
                url: selectedPreview.route
            };
            
            if (navigator.share) {
                navigator.share(shareData);
            } else {
                navigator.clipboard.writeText(selectedPreview.route);
                console.log('Copied preview route to clipboard:', selectedPreview.route);
            }
        }
    };

    const handleOverlayViewCode = (frameId: string) => {
        console.log('View code for:', frameId);
        const selectedFile = designFiles.find(file => file.name === frameId);
        if (selectedFile) {
            handleSendToChat(frameId, "Can you show me the code for this design and explain how it works?");
        } else {
            handleSendToChat(frameId, "Can you help me generate code to recreate this design?");
        }
    };

    const handleOverlayOpenInBrowser = (frameId: string) => {
        console.log('Opening in simple browser:', frameId);
        
        // For design files, try to open the file path
        const selectedFile = designFiles.find(file => file.name === frameId);
        if (selectedFile) {
            // Send message to extension to open file in VS Code's simple browser
            const openSimpleBrowserMessage: WebviewMessage = {
                command: 'openInSimpleBrowser',
                data: { fileName: selectedFile.name, filePath: selectedFile.path }
            };
            vscode.postMessage(openSimpleBrowserMessage);
        } else {
            // For previews, try to open the preview route
            const selectedPreview = previews.find(preview => preview.id === frameId);
            if (selectedPreview) {
                const openSimpleBrowserMessage: WebviewMessage = {
                    command: 'openInSimpleBrowser',
                    data: { previewId: selectedPreview.id, route: selectedPreview.route }
                };
                vscode.postMessage(openSimpleBrowserMessage);
            }
        }
    };

    const handleOverlayMore = (frameId: string) => {
        console.log('More options for:', frameId);
        // TODO: Implement more options menu
        handleSendToChat(frameId, "What other actions or options are available for working with this design?");
    };

    // Canvas control functions
    const handleZoomIn = () => {
        if (transformRef.current) {
            transformRef.current.zoomIn(0.05);
        }
    };

    const handleZoomOut = () => {
        if (transformRef.current) {
            transformRef.current.zoomOut(0.05);
        }
    };

    const handleResetZoom = () => {
        if (transformRef.current) {
            transformRef.current.resetTransform();
        }
    };

    const handleTransformChange = (ref: ReactZoomPanPinchRef) => {
        const state = ref.state;
        
        // Prevent negative or zero scales
        if (state.scale <= 0) {
            console.error('🚨 INVALID SCALE DETECTED:', state.scale, '- Resetting to minimum');
            ref.setTransform(state.positionX, state.positionY, 0.1);
            return;
        }
        
        // Update current zoom level
        // console.log('🔄 TRANSFORM CHANGE:', { scale: state.scale, positionX: state.positionX, positionY: state.positionY });
        setCurrentZoom(state.scale);
    };

    // Get frame position (custom, hierarchy, or default grid position)
    const getFramePosition = (fileName: string, index: number, isPreview: boolean = false): GridPosition => {
        if (customPositions[fileName]) {
            return customPositions[fileName];
        }
        
        // Use hierarchy layout if in hierarchy mode and tree is available
        if (layoutMode === 'hierarchy') {
            if (isPreview && previewHierarchyTree) {
                return getPreviewHierarchicalPosition(fileName, previewHierarchyTree, index, currentConfig);
            } else if (!isPreview && hierarchyTree) {
                return getHierarchicalPosition(fileName, hierarchyTree, index, currentConfig);
            }
        }
        
        // Default grid position calculation
        const viewportMode = getFrameViewport(fileName);
        const viewportDimensions = currentConfig.viewports[viewportMode];
        const actualWidth = viewportDimensions.width;
        const actualHeight = viewportDimensions.height + 50;
        
        const col = index % currentConfig.framesPerRow;
        const row = Math.floor(index / currentConfig.framesPerRow);
        
        const x = col * (Math.max(actualWidth, currentConfig.frameSize.width) + currentConfig.gridSpacing);
        const y = row * (Math.max(actualHeight, currentConfig.frameSize.height) + currentConfig.gridSpacing);
        
        return { x, y };
    };

    // Drag handlers
    const handleDragStart = (fileName: string, startPos: GridPosition, mouseEvent: React.MouseEvent) => {
        // Get canvas grid element for proper coordinate calculation
        const canvasGrid = document.querySelector('.canvas-grid') as HTMLElement;
        if (!canvasGrid) return;
        
        const canvasRect = canvasGrid.getBoundingClientRect();
        const canvasMousePos = transformMouseToCanvasSpace(mouseEvent.clientX, mouseEvent.clientY, canvasRect);
        
        // Ensure this frame is selected
        setSelectedFrame(fileName);
        
        setDragState({
            isDragging: true,
            draggedFrame: fileName,
            startPosition: startPos,
            currentPosition: startPos,
            offset: {
                x: canvasMousePos.x - startPos.x,
                y: canvasMousePos.y - startPos.y
            }
        });
    };

    const handleDragMove = (mousePos: GridPosition) => {
        if (!dragState.isDragging || !dragState.draggedFrame) return;
        
        const newPosition = {
            x: mousePos.x - dragState.offset.x,
            y: mousePos.y - dragState.offset.y
        };
        
        setDragState(prev => ({
            ...prev,
            currentPosition: newPosition
        }));
    };

    const handleDragEnd = () => {
        if (!dragState.isDragging || !dragState.draggedFrame) return;
        
        // Snap to grid (optional - makes positioning cleaner)
        const gridSize = 25;
        const snappedPosition = {
            x: Math.round(dragState.currentPosition.x / gridSize) * gridSize,
            y: Math.round(dragState.currentPosition.y / gridSize) * gridSize
        };
        
        // Save the new position
        setCustomPositions(prev => ({
            ...prev,
            [dragState.draggedFrame!]: snappedPosition
        }));
        
        // Reset drag state
        setDragState({
            isDragging: false,
            draggedFrame: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            offset: { x: 0, y: 0 }
        });
    };

    // Reset positions to grid and reload data
    const handleResetPositions = () => {
        setCustomPositions({});
        
        // Also reload design files and previews
        const loadDesignFilesMessage: WebviewMessage = {
            command: 'loadDesignFiles'
        };
        vscode.postMessage(loadDesignFilesMessage);

        const loadPreviewsMessage: WebviewMessage = {
            command: 'loadPreviews'
        };
        vscode.postMessage(loadPreviewsMessage);
    };

    // Update connection positions based on current frame positions
    const updateConnectionPositions = (connections: ConnectionLine[], files: DesignFile[]): ConnectionLine[] => {
        return connections.map(connection => {
            const fromIndex = files.findIndex(f => f.name === connection.fromFrame);
            const toIndex = files.findIndex(f => f.name === connection.toFrame);
            
            if (fromIndex === -1 || toIndex === -1) {
                return connection; // Keep original if frame not found
            }
            
            // Get current positions (custom or calculated)
            const fromPosition = getFramePosition(connection.fromFrame, fromIndex);
            const toPosition = getFramePosition(connection.toFrame, toIndex);
            
            // Get frame dimensions for connection point calculation
            const fromViewport = getFrameViewport(connection.fromFrame);
            const toViewport = getFrameViewport(connection.toFrame);
            const fromDimensions = currentConfig.viewports[fromViewport];
            const toDimensions = currentConfig.viewports[toViewport];
            
            // Calculate connection points (center-right of from frame to center-left of to frame)
            const fromConnectionPoint = {
                x: fromPosition.x + fromDimensions.width,
                y: fromPosition.y + (fromDimensions.height + 50) / 2 // +50 for header
            };
            
            const toConnectionPoint = {
                x: toPosition.x,
                y: toPosition.y + (toDimensions.height + 50) / 2 // +50 for header
            };
            
            return {
                ...connection,
                fromPosition: fromConnectionPoint,
                toPosition: toConnectionPoint
            };
        });
    };

    // Update preview connection positions based on current preview positions  
    const updatePreviewConnectionPositions = (connections: ConnectionLine[], previews: Preview[]): ConnectionLine[] => {
        return connections.map(connection => {
            const fromIndex = previews.findIndex(p => p.id === connection.fromFrame);
            const toIndex = previews.findIndex(p => p.id === connection.toFrame);
            
            if (fromIndex === -1 || toIndex === -1) {
                return connection; // Keep original if preview not found
            }
            
            // Get current positions (custom or calculated) - previews placed after design files
            const fromPosition = getFramePosition(connection.fromFrame, designFiles.length + fromIndex, true);
            const toPosition = getFramePosition(connection.toFrame, designFiles.length + toIndex, true);
            
            // Get frame dimensions for connection point calculation
            const fromViewport = getFrameViewport(connection.fromFrame);
            const toViewport = getFrameViewport(connection.toFrame);
            const fromDimensions = currentConfig.viewports[fromViewport];
            const toDimensions = currentConfig.viewports[toViewport];
            
            // Calculate connection points (center-right of from frame to center-left of to frame)
            const fromConnectionPoint = {
                x: fromPosition.x + fromDimensions.width,
                y: fromPosition.y + (fromDimensions.height + 50) / 2 // +50 for header
            };
            
            const toConnectionPoint = {
                x: toPosition.x,
                y: toPosition.y + (toDimensions.height + 50) / 2 // +50 for header
            };
            
            return {
                ...connection,
                fromPosition: fromConnectionPoint,
                toPosition: toConnectionPoint
            };
        });
    };

    // Keyboard shortcuts for zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        handleZoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        handleZoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        handleResetZoom();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Recalculate hierarchy positions when layout mode changes to hierarchy
    useEffect(() => {
        if (layoutMode === 'hierarchy') {
            // Recalculate design hierarchy positions if we have design files
            if (designFiles.length > 0) {
                const tree = buildHierarchyTree(designFiles);
                
                // Calculate average frame dimensions based on viewport usage
                let totalWidth = 0;
                let totalHeight = 0;
                let frameCount = 0;
                
                designFiles.forEach(file => {
                    const frameViewport = getFrameViewport(file.name);
                    const viewportDimensions = currentConfig.viewports[frameViewport];
                    totalWidth += viewportDimensions.width;
                    totalHeight += viewportDimensions.height + 50; // Add header space
                    frameCount++;
                });
                
                const avgFrameDimensions = frameCount > 0 ? {
                    width: Math.round(totalWidth / frameCount),
                    height: Math.round(totalHeight / frameCount)
                } : { width: 400, height: 550 };
                
                const positionedTree = calculateHierarchyPositions(tree, currentConfig, avgFrameDimensions);
                setHierarchyTree(positionedTree);
                
                // Recalculate preview hierarchy positions if we have previews
                if (previews.length > 0) {
                    const previewTree = buildPreviewHierarchyTree(previews);
                    
                    // Calculate average frame dimensions for previews
                    let totalPreviewWidth = 0;
                    let totalPreviewHeight = 0;
                    let previewCount = 0;
                    
                    previews.forEach(preview => {
                        const previewViewport = getFrameViewport(preview.id);
                        const viewportDimensions = currentConfig.viewports[previewViewport];
                        totalPreviewWidth += viewportDimensions.width;
                        totalPreviewHeight += viewportDimensions.height + 50; // Add header space
                        previewCount++;
                    });
                    
                    const avgPreviewFrameDimensions = previewCount > 0 ? {
                        width: Math.round(totalPreviewWidth / previewCount),
                        height: Math.round(totalPreviewHeight / previewCount)
                    } : { width: 400, height: 550 };
                    
                    const positionedPreviewTree = calculatePreviewHierarchyPositions(
                        previewTree, 
                        currentConfig, 
                        avgPreviewFrameDimensions,
                        positionedTree.bounds // Use the newly calculated design hierarchy bounds
                    );
                    setPreviewHierarchyTree(positionedPreviewTree);
                }
            }
        }
    }, [layoutMode, designFiles, previews, currentConfig, getFrameViewport]);

    if (isLoading) {
        return (
            <div className="canvas-loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading design files...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="canvas-error">
                <div className="error-message">
                    <h3>Error loading canvas</h3>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (designFiles.length === 0 && previews.length === 0) {
        return (
            <div className="canvas-empty">
                <div className="empty-state">
                    <h3>No design files or previews found</h3>
                    <p>Prompt Superdesign OR Cursor/Windsurf/Claude Code to design UI like <kbd>Help me design a calculator UI</kbd> and preview the UI here</p>
                    <p>Or create a <code>.superdesign/previews.json</code> file to display custom previews</p>
                </div>
            </div>
        );
    }

    return (
        <div className="canvas-container">
            {/* Canvas Controls - Clean Minimal Design */}
            <div className="canvas-toolbar">
                {/* Navigation Section */}
                <div className="toolbar-section">
                    <div className="control-group">
                        <button 
                            className="control-button" 
                            onClick={handleZoomOut}
                            title="Zoom out"
                        >
                            <ZoomOutIcon />
                        </button>
                        <span className="zoom-level">{Math.round(currentZoom * 100)}%</span>
                        <button 
                            className="control-button" 
                            onClick={handleZoomIn}
                            title="Zoom in"
                        >
                            <ZoomInIcon />
                        </button>
                        <button 
                            className="control-button" 
                            onClick={handleResetZoom}
                            title="Reset zoom"
                        >
                            <HomeIcon />
                        </button>
                    </div>
                </div>

                {/* Layout Controls */}
                <div className="toolbar-section">
                    <div className="control-group">
                        <button 
                            className={`control-button ${layoutMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setLayoutMode('grid')}
                            title="Grid layout"
                        >
                            <ScaleIcon />
                        </button>
                        <button 
                            className={`control-button ${layoutMode === 'hierarchy' ? 'active' : ''}`}
                            onClick={() => setLayoutMode('hierarchy')}
                            title="Hierarchy layout"
                        >
                            <TreeIcon />
                        </button>
                        
                        {layoutMode === 'hierarchy' && (
                            <button 
                                className={`control-button ${showConnections ? 'active' : ''}`}
                                onClick={() => setShowConnections(!showConnections)}
                                title="Toggle connections"
                            >
                                <LinkIcon />
                            </button>
                        )}
                        
                        <button 
                            className="control-button"
                            onClick={handleResetPositions}
                            title="Reset positions and reload data"
                        >
                            <RefreshIcon />
                        </button>
                    </div>
                </div>



                {/* Global Viewport Controls */}
                <div className="toolbar-section">
                    <div className="control-group">
                        <button 
                            className={`control-button ${useGlobalViewport ? 'active' : ''}`}
                            onClick={toggleGlobalViewport}
                            title="Global viewport"
                        >
                            <GlobeIcon />
                        </button>
                        
                        {useGlobalViewport && (
                            <>
                                <button 
                                    className={`control-button ${globalViewportMode === 'mobile' ? 'active' : ''}`}
                                    onClick={() => handleGlobalViewportChange('mobile')}
                                    title="Mobile view"
                                >
                                    <MobileIcon />
                                </button>
                                <button 
                                    className={`control-button ${globalViewportMode === 'tablet' ? 'active' : ''}`}
                                    onClick={() => handleGlobalViewportChange('tablet')}
                                    title="Tablet view"
                                >
                                    <TabletIcon />
                                </button>
                                <button 
                                    className={`control-button ${globalViewportMode === 'desktop' ? 'active' : ''}`}
                                    onClick={() => handleGlobalViewportChange('desktop')}
                                    title="Desktop view"
                                >
                                    <DesktopIcon />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Infinite Canvas */}
            <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={0.1}                  // Lower min scale to prevent negative values
                maxScale={3}                    // Higher max scale for more zoom range
                limitToBounds={false}
                smooth={false}                  // Disable smooth for better performance
                disablePadding={true}           // Disable padding to prevent position jumps
                doubleClick={{
                    disabled: false,
                    mode: "zoomIn",
                    step: 50,                   // Moderate double-click zoom step
                    animationTime: 150          // Quick double-click zoom
                }}
                wheel={{
                    wheelDisabled: true,        // Disable wheel zoom
                    touchPadDisabled: false,    // Enable trackpad pan
                    step: 0.05                  // Even smaller zoom steps
                }}
                panning={{
                    disabled: dragState.isDragging,
                    velocityDisabled: true,     // Disable velocity for immediate response
                    wheelPanning: true          // Enable trackpad panning
                }}
                pinch={{
                    disabled: false,            // Keep pinch zoom enabled
                    step: 1                     // Ultra-fine pinch steps
                }}
                centerOnInit={true}
                onTransformed={(ref) => handleTransformChange(ref)}
                onZoom={(ref) => {
                    const state = ref.state;
                    
                    // Check for invalid scale and fix it
                    if (state.scale <= 0) {
                        console.error('🚨 ZOOM EVENT - Invalid scale:', state.scale, '- Fixing...');
                        ref.setTransform(state.positionX, state.positionY, 0.1);
                        return;
                    }
                }}
            >
                <TransformComponent
                    wrapperClass="canvas-transform-wrapper"
                    contentClass="canvas-transform-content"
                >
                    <div 
                        className={`canvas-grid ${dragState.isDragging ? 'dragging' : ''}`}
                        onMouseMove={(e) => {
                            if (dragState.isDragging) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const mousePos = transformMouseToCanvasSpace(e.clientX, e.clientY, rect);
                                handleDragMove(mousePos);
                            }
                        }}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onClick={(e) => {
                            // Clear selection when clicking on empty space
                            if (e.target === e.currentTarget) {
                                setSelectedFrame('');
                                
                                // Also clear context in chat
                                const clearContextMessage: WebviewMessage = {
                                    command: 'setContextFromCanvas',
                                    data: { fileName: '', type: 'clear' }
                                };
                                vscode.postMessage(clearContextMessage);
                            }
                        }}
                    >
                        {/* Connection Lines (render behind frames) */}
                        {layoutMode === 'hierarchy' && showConnections && (
                            <>
                                {/* Design file connections */}
                                {hierarchyTree && (
                                    <ConnectionLines
                                        connections={updateConnectionPositions(hierarchyTree.connections, designFiles)}
                                        containerBounds={hierarchyTree.bounds}
                                        isVisible={showConnections}
                                        zoomLevel={currentZoom}
                                    />
                                )}
                                {/* Preview connections */}
                                {previewHierarchyTree && (
                                    <ConnectionLines
                                        connections={updatePreviewConnectionPositions(previewHierarchyTree.connections, previews)}
                                        containerBounds={previewHierarchyTree.bounds}
                                        isVisible={showConnections}
                                        zoomLevel={currentZoom}
                                    />
                                )}
                            </>
                        )}
                        {designFiles.map((file, index) => {
                            const frameViewport = getFrameViewport(file.name);
                            const viewportDimensions = currentConfig.viewports[frameViewport];
                            
                            // Use actual viewport dimensions (add frame border/header space)
                            const actualWidth = viewportDimensions.width;
                            const actualHeight = viewportDimensions.height + 50; // Add space for header
                            
                            // Get position (custom or default grid)
                            const position = getFramePosition(file.name, index, false);
                            
                            // If this frame is being dragged, use current drag position
                            const finalPosition = dragState.isDragging && dragState.draggedFrame === file.name 
                                ? dragState.currentPosition 
                                : position;
                            
                            return (
                                <DesignFrame
                                    key={file.name}
                                    file={file}
                                    position={finalPosition}
                                    dimensions={{ width: actualWidth, height: actualHeight }}
                                    isSelected={selectedFrame === file.name}
                                    onSelect={(fileName, event) => handleFrameSelect(fileName, event)}
                                    renderMode={getOptimalRenderMode(currentZoom)}
                                    viewport={frameViewport}
                                    viewportDimensions={viewportDimensions}
                                    onViewportChange={handleFrameViewportChange}
                                    useGlobalViewport={useGlobalViewport}
                                    onDragStart={handleDragStart}
                                    isDragging={dragState.isDragging && dragState.draggedFrame === file.name}
                                    nonce={nonce}
                                    onSendToChat={handleSendToChat}
                                />
                            );
                        })}
                        
                        {/* Render Previews */}
                        {previews.map((preview, index) => {
                            const frameViewport = getFrameViewport(preview.id);
                            const viewportDimensions = currentConfig.viewports[frameViewport];
                            
                            // Use actual viewport dimensions (add frame border/header space)
                            const actualWidth = viewportDimensions.width;
                            const actualHeight = viewportDimensions.height + 50; // Add space for header
                            
                            // Get position for preview (place after design files)
                            const previewIndex = designFiles.length + index;
                            const position = getFramePosition(preview.id, previewIndex, true);
                            
                            // If this frame is being dragged, use current drag position
                            const finalPosition = dragState.isDragging && dragState.draggedFrame === preview.id 
                                ? dragState.currentPosition 
                                : position;
                            
                            return (
                                <PreviewFrame
                                    key={`preview-${preview.id}`}
                                    preview={preview}
                                    position={finalPosition}
                                    dimensions={{ width: actualWidth, height: actualHeight }}
                                    isSelected={selectedFrame === preview.id}
                                    onSelect={(previewId, event) => handleFrameSelect(previewId, event)}
                                    viewport={frameViewport}
                                    viewportDimensions={viewportDimensions}
                                    onViewportChange={handleFrameViewportChange}
                                    useGlobalViewport={useGlobalViewport}
                                    onDragStart={handleDragStart}
                                    isDragging={dragState.isDragging && dragState.draggedFrame === preview.id}
                                    onDelete={handleDeletePreview}
                                    onSendToChat={handleSendToChat}
                                />
                            );
                        })}
                        
                        {/* Render Iframe Overlay for selected frame */}
                        {selectedFrame && (
                            (() => {
                                // Find the selected frame (either design file or preview)
                                const selectedFile = designFiles.find(file => file.name === selectedFrame);
                                const selectedPreview = previews.find(preview => preview.id === selectedFrame);
                                
                                if (selectedFile) {
                                    const fileIndex = designFiles.findIndex(file => file.name === selectedFrame);
                                    const frameViewport = getFrameViewport(selectedFrame);
                                    const viewportDimensions = currentConfig.viewports[frameViewport];
                                    const actualWidth = viewportDimensions.width;
                                    const actualHeight = viewportDimensions.height + 50;
                                    const position = getFramePosition(selectedFrame, fileIndex, false);
                                    
                                    return (
                                        <IframeOverlay
                                            frameId={selectedFrame}
                                            position={position}
                                            dimensions={{ width: actualWidth, height: actualHeight }}
                                            frameType="design"
                                            zoomLevel={currentZoom}
                                            onComment={() => handleOverlayComment(selectedFrame)}
                                            onEdit={() => handleOverlayEdit(selectedFrame)}
                                                                                    onShare={() => handleOverlayShare(selectedFrame)}
                                        onViewCode={() => handleOverlayViewCode(selectedFrame)}
                                        onOpenInBrowser={() => handleOverlayOpenInBrowser(selectedFrame)}
                                        onMore={() => handleOverlayMore(selectedFrame)}
                                    />
                                );
                            } else if (selectedPreview) {
                                    const previewIndex = previews.findIndex(preview => preview.id === selectedFrame);
                                    const frameViewport = getFrameViewport(selectedFrame);
                                    const viewportDimensions = currentConfig.viewports[frameViewport];
                                    const actualWidth = viewportDimensions.width;
                                    const actualHeight = viewportDimensions.height + 50;
                                    const position = getFramePosition(selectedFrame, designFiles.length + previewIndex, true);
                                    
                                    return (
                                        <IframeOverlay
                                            frameId={selectedFrame}
                                            position={position}
                                            dimensions={{ width: actualWidth, height: actualHeight }}
                                            frameType="preview"
                                            zoomLevel={currentZoom}
                                            onComment={() => handleOverlayComment(selectedFrame)}
                                            onEdit={() => handleOverlayEdit(selectedFrame)}
                                            onShare={() => handleOverlayShare(selectedFrame)}
                                            onViewCode={() => handleOverlayViewCode(selectedFrame)}
                                            onOpenInBrowser={() => handleOverlayOpenInBrowser(selectedFrame)}
                                            onMore={() => handleOverlayMore(selectedFrame)}
                                        />
                                    );
                                }
                                
                                return null;
                            })()
                        )}
                    </div>
                </TransformComponent>
            </TransformWrapper>

            {/* Custom Confirmation Dialog */}
            {confirmDialog.isOpen && (
                <div 
                    className="confirm-dialog-overlay"
                    onClick={(e) => {
                        // Close dialog if clicking on overlay (outside the dialog content)
                        if (e.target === e.currentTarget) {
                            confirmDialog.onCancel();
                        }
                    }}
                >
                    <div className="confirm-dialog-content">
                        <h3>{confirmDialog.title}</h3>
                        <p>{confirmDialog.message}</p>
                        <div className="confirm-dialog-buttons">
                            <button className="confirm-dialog-btn confirm" onClick={confirmDialog.onConfirm}>
                                Delete
                            </button>
                            <button className="confirm-dialog-btn cancel" onClick={confirmDialog.onCancel}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Confirmation Dialog Styles */}
            <style>{`
                .canvas-container {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }

                .canvas-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 8px 16px;
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    flex-shrink: 0;
                }

                .toolbar-section {
                    display: flex;
                    align-items: center;
                }

                .control-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .control-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: transparent;
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 4px;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .control-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .control-button.active {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                .control-button.danger {
                    border-color: var(--vscode-errorForeground);
                    color: var(--vscode-errorForeground);
                }

                .control-button.danger:hover {
                    background: var(--vscode-errorForeground);
                    color: var(--vscode-errorBackground);
                }

                .zoom-level {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    min-width: 35px;
                    text-align: center;
                }

                .selection-info {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-badge-background);
                }

                .selection-counter {
                    font-size: 11px;
                    font-weight: 500;
                    margin-right: 6px;
                }

                .canvas-view {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }

                .canvas-grid {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    background: var(--vscode-editor-background);
                }

                .canvas-grid.dragging {
                    cursor: grabbing;
                }

                .design-frame.selected {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 2px;
                }

                .design-frame:hover {
                    outline: 1px solid var(--vscode-button-border);
                    outline-offset: 1px;
                }

                .loading-spinner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--vscode-foreground);
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--vscode-button-border);
                    border-top: 3px solid var(--vscode-button-background);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .canvas-error, .canvas-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 32px;
                    text-align: center;
                    color: var(--vscode-foreground);
                }

                .error-message, .empty-state {
                    max-width: 400px;
                }

                .error-message h3, .empty-state h3 {
                    margin: 0 0 12px 0;
                    color: var(--vscode-errorForeground);
                }

                .error-message button {
                    margin-top: 16px;
                    padding: 8px 16px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .confirm-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(2px);
                    animation: fadeIn 0.2s ease-out;
                }

                .confirm-dialog-content {
                    background: var(--vscode-dropdown-background);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 6px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.2s ease-out;
                }

                .confirm-dialog-content h3 {
                    margin: 0 0 12px 0;
                    color: var(--vscode-foreground);
                    font-size: 16px;
                    font-weight: 600;
                }

                .confirm-dialog-content p {
                    margin: 0 0 20px 0;
                    color: var(--vscode-descriptionForeground);
                    line-height: 1.4;
                }

                .confirm-dialog-buttons {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }

                .confirm-dialog-btn {
                    padding: 6px 12px;
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }

                .confirm-dialog-btn.confirm {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                .confirm-dialog-btn.cancel {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .confirm-dialog-btn:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from { 
                        opacity: 0; 
                        transform: translateY(-20px) scale(0.95); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1); 
                    }
                }

                /* Iframe Overlay Styles */
                .iframe-overlay {
                    pointer-events: none;
                    z-index: 1000;
                }

                .iframe-overlay-toolbar {
                    transition: all 0.2s ease;
                }

                .iframe-overlay-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: transparent;
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 3px;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 12px;
                }

                .iframe-overlay-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                    color: var(--vscode-button-foreground);
                    border-color: var(--vscode-focusBorder);
                    transform: translateY(-1px);
                }

                .iframe-overlay-btn:active {
                    transform: translateY(0);
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                /* Ensure overlay doesn't interfere with zoom/pan */
                .iframe-overlay * {
                    user-select: none;
                }

                /* Custom Tooltip Styles */
                .iframe-overlay-btn-container {
                    position: relative;
                    display: inline-block;
                }

                .iframe-overlay-tooltip {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--vscode-editorHoverWidget-background);
                    color: var(--vscode-editorHoverWidget-foreground);
                    border: 1px solid var(--vscode-editorHoverWidget-border);
                    padding: 6px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    white-space: nowrap;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s ease, visibility 0.2s ease;
                    z-index: 10001;
                    margin-bottom: 4px;
                    box-shadow: 0 2px 8px var(--vscode-widget-shadow);
                }

                .iframe-overlay-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 4px solid transparent;
                    border-top-color: var(--vscode-editorHoverWidget-background);
                }

                .iframe-overlay-btn-container:hover .iframe-overlay-tooltip {
                    opacity: 1;
                    visibility: visible;
                }
            `}</style>
        </div>
    );
};

export default CanvasView; 