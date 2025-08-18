import React, { useState, useEffect, useRef } from 'react';
import {
    TransformWrapper,
    TransformComponent,
    type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import DesignFrame from './DesignFrame';
import {
    generateResponsiveConfig,
    buildHierarchyTree,
    calculateHierarchyPositions,
    getHierarchicalPosition,
    detectDesignRelationships,
} from '../utils/gridLayout';
import type {
    DesignFile,
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
    LinkIcon,
} from './Icons';

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
        scaleWithZoom: false,
    },
    viewports: {
        desktop: { width: 1000, height: 600 }, // More compact desktop view
        tablet: { width: 640, height: 800 }, // Smaller tablet view
        mobile: { width: 320, height: 550 }, // More compact mobile view
    },
    hierarchy: {
        horizontalSpacing: 180, // Reduced horizontal spacing for hierarchy
        verticalSpacing: 120, // Reduced vertical spacing for hierarchy
        connectionLineWidth: 2,
        connectionLineColor: 'var(--vscode-textLink-foreground)',
        showConnections: true,
    },
};

const CanvasView: React.FC<CanvasViewProps> = ({ vscode, nonce }) => {
    console.log('🎨 CanvasView component starting...');
    console.log('📞 CanvasView props - vscode:', !!vscode, 'nonce:', nonce);

    const [designFiles, setDesignFiles] = useState<DesignFile[]>([]);
    const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
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
        offset: { x: 0, y: 0 },
    });
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
    const [hierarchyTree, setHierarchyTree] = useState<HierarchyTree | null>(null);
    const [showConnections, setShowConnections] = useState(true);
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    console.log('✅ CanvasView state initialized successfully');

    // Performance optimization: Switch render modes based on zoom level
    const getOptimalRenderMode = (_zoom: number): 'placeholder' | 'iframe' => {
        // Always render iframe as requested by the user
        return 'iframe';
    };

    // Helper function to transform mouse coordinates to canvas space
    const transformMouseToCanvasSpace = (
        clientX: number,
        clientY: number,
        canvasRect: DOMRect
    ): GridPosition => {
        // Get current transform state from the TransformWrapper
        const transformState = transformRef.current?.instance?.transformState;
        const currentScale = transformState?.scale ?? 1;
        const currentTranslateX = transformState?.positionX ?? 0;
        const currentTranslateY = transformState?.positionY ?? 0;

        // Calculate mouse position relative to canvas, then adjust for zoom and pan
        const rawMouseX = clientX - canvasRect.left;
        const rawMouseY = clientY - canvasRect.top;

        // Transform mouse coordinates to canvas space (inverse of current transform)
        return {
            x: (rawMouseX - currentTranslateX) / currentScale,
            y: (rawMouseY - currentTranslateY) / currentScale,
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
            [fileName]: viewport,
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

                designFiles.forEach(_file => {
                    const viewportDimensions = currentConfig.viewports[viewport] ?? {
                        width: currentConfig.frameSize.width,
                        height: currentConfig.frameSize.height,
                    };
                    totalWidth += viewportDimensions.width;
                    totalHeight += viewportDimensions.height + 50; // Add header space
                    frameCount++;
                });

                const avgFrameDimensions =
                    frameCount > 0
                        ? {
                              width: Math.round(totalWidth / frameCount),
                              height: Math.round(totalHeight / frameCount),
                          }
                        : { width: 400, height: 550 };

                const updatedTree = calculateHierarchyPositions(
                    hierarchyTree,
                    currentConfig,
                    avgFrameDimensions
                );
                setHierarchyTree(updatedTree);
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
        const loadMessage: WebviewMessage = {
            command: 'loadDesignFiles',
        };
        vscode.postMessage(loadMessage);

        // Listen for messages from extension
        const messageHandler = (event: MessageEvent) => {
            const message: ExtensionToWebviewMessage = event.data;

            switch (message.command) {
                case 'designFilesLoaded':
                    // Convert date strings back to Date objects
                    const filesWithDates = message.data.files.map(file => ({
                        ...file,
                        modified: new Date(file.modified),
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

                    const avgFrameDimensions =
                        frameCount > 0
                            ? {
                                  width: Math.round(totalWidth / frameCount),
                                  height: Math.round(totalHeight / frameCount),
                              }
                            : { width: 400, height: 550 };

                    const positionedTree = calculateHierarchyPositions(
                        tree,
                        currentConfig,
                        avgFrameDimensions
                    );
                    setHierarchyTree(positionedTree);

                    setIsLoading(false);

                    // Auto-center view after files are loaded
                    setTimeout(() => {
                        if (transformRef.current) {
                            transformRef.current.resetTransform();
                        }
                    }, 100);
                    break;

                case 'error':
                    setError(message.data.error);
                    setIsLoading(false);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vscode]); // Removed currentConfig dependency to prevent constant re-renders

    const handleFrameSelect = (fileName: string) => {
        setSelectedFrames([fileName]); // Single selection for now

        // Find the selected file to get its full path
        const selectedFile = designFiles.find(file => file.name === fileName);
        const filePath = selectedFile ? selectedFile.path : fileName;

        const selectMessage: WebviewMessage = {
            command: 'selectFrame',
            data: { fileName },
        };
        vscode.postMessage(selectMessage);

        // Also send context to chat interface with full path
        const contextMessage: WebviewMessage = {
            command: 'setContextFromCanvas',
            data: { fileName: filePath, type: 'frame' },
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
            data: { fileName: filePath, type: 'frame' },
        };
        vscode.postMessage(contextMessage);

        // Then send the prompt to the chat input
        const promptMessage: WebviewMessage = {
            command: 'setChatPrompt',
            data: { prompt },
        };
        vscode.postMessage(promptMessage);
    };

    // Canvas control functions
    const handleZoomIn = () => {
        if (transformRef.current) {
            const currentState = transformRef.current.instance?.transformState;
            console.log('🔍 ZOOM IN - Before:', {
                scale: currentState?.scale,
                positionX: currentState?.positionX,
                positionY: currentState?.positionY,
                step: 0.05,
                minScale: 0.1,
                maxScale: 3,
                smooth: false,
            });

            transformRef.current.zoomIn(0.05);

            // Log after zoom (with small delay to capture the change)
            setTimeout(() => {
                const newState = transformRef.current?.instance?.transformState;
                console.log('🔍 ZOOM IN - After:', {
                    scale: newState?.scale,
                    positionX: newState?.positionX,
                    positionY: newState?.positionY,
                    scaleDiff: newState?.scale ? newState.scale - (currentState?.scale || 1) : 0,
                    positionXDiff: newState?.positionX
                        ? newState.positionX - (currentState?.positionX || 0)
                        : 0,
                    positionYDiff: newState?.positionY
                        ? newState.positionY - (currentState?.positionY || 0)
                        : 0,
                });
            }, 50);
        }
    };

    const handleZoomOut = () => {
        if (transformRef.current) {
            const currentState = transformRef.current.instance?.transformState;
            console.log('🔍 ZOOM OUT - Before:', {
                scale: currentState?.scale,
                positionX: currentState?.positionX,
                positionY: currentState?.positionY,
                step: 0.05,
            });

            transformRef.current.zoomOut(0.05);

            // Log after zoom (with small delay to capture the change)
            setTimeout(() => {
                const newState = transformRef.current?.instance?.transformState;
                console.log('🔍 ZOOM OUT - After:', {
                    scale: newState?.scale,
                    positionX: newState?.positionX,
                    positionY: newState?.positionY,
                    scaleDiff: newState?.scale ? newState.scale - (currentState?.scale || 1) : 0,
                    positionXDiff: newState?.positionX
                        ? newState.positionX - (currentState?.positionX || 0)
                        : 0,
                    positionYDiff: newState?.positionY
                        ? newState.positionY - (currentState?.positionY || 0)
                        : 0,
                });
            }, 50);
        }
    };

    const handleResetZoom = () => {
        if (transformRef.current) {
            const currentState = transformRef.current.instance?.transformState;
            console.log('🔍 RESET ZOOM - Before:', {
                scale: currentState?.scale,
                positionX: currentState?.positionX,
                positionY: currentState?.positionY,
            });

            transformRef.current.resetTransform();

            setTimeout(() => {
                const newState = transformRef.current?.instance?.transformState;
                console.log('🔍 RESET ZOOM - After:', {
                    scale: newState?.scale,
                    positionX: newState?.positionX,
                    positionY: newState?.positionY,
                });
            }, 50);
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

        console.log('🔄 TRANSFORM CHANGE:', {
            scale: state.scale,
            positionX: state.positionX,
            positionY: state.positionY,
            previousScale: currentZoom,
        });
        setCurrentZoom(state.scale);
    };

    // Get frame position (custom, hierarchy, or default grid position)
    const getFramePosition = (fileName: string, index: number): GridPosition => {
        if (customPositions[fileName]) {
            return customPositions[fileName];
        }

        // Use hierarchy layout if in hierarchy mode and tree is available
        if (layoutMode === 'hierarchy' && hierarchyTree) {
            return getHierarchicalPosition(fileName, hierarchyTree);
        }

        // Default grid position calculation
        const viewportMode = getFrameViewport(fileName);
        const viewportDimensions = currentConfig.viewports[viewportMode];
        const actualWidth = viewportDimensions.width;
        const actualHeight = viewportDimensions.height + 50;

        const col = index % currentConfig.framesPerRow;
        const row = Math.floor(index / currentConfig.framesPerRow);

        const x =
            col *
            (Math.max(actualWidth, currentConfig.frameSize.width) + currentConfig.gridSpacing);
        const y =
            row *
            (Math.max(actualHeight, currentConfig.frameSize.height) + currentConfig.gridSpacing);

        return { x, y };
    };

    // Drag handlers
    const handleDragStart = (
        fileName: string,
        startPos: GridPosition,
        mouseEvent: React.MouseEvent
    ) => {
        // Get canvas grid element for proper coordinate calculation
        const canvasGrid = document.querySelector('.canvas-grid') as HTMLElement;
        if (!canvasGrid) {
            return;
        }

        const canvasRect = canvasGrid.getBoundingClientRect();
        const canvasMousePos = transformMouseToCanvasSpace(
            mouseEvent.clientX,
            mouseEvent.clientY,
            canvasRect
        );

        // Also ensure this frame is selected
        if (!selectedFrames.includes(fileName)) {
            setSelectedFrames([fileName]);
        }

        setDragState({
            isDragging: true,
            draggedFrame: fileName,
            startPosition: startPos,
            currentPosition: startPos,
            offset: {
                x: canvasMousePos.x - startPos.x,
                y: canvasMousePos.y - startPos.y,
            },
        });
    };

    const handleDragMove = (mousePos: GridPosition) => {
        if (!dragState.isDragging || !dragState.draggedFrame) {
            return;
        }

        const newPosition = {
            x: mousePos.x - dragState.offset.x,
            y: mousePos.y - dragState.offset.y,
        };

        setDragState(prev => ({
            ...prev,
            currentPosition: newPosition,
        }));
    };

    const handleDragEnd = () => {
        if (!dragState.isDragging || !dragState.draggedFrame) {
            return;
        }

        // Snap to grid (optional - makes positioning cleaner)
        const gridSize = 25;
        const snappedPosition = {
            x: Math.round(dragState.currentPosition.x / gridSize) * gridSize,
            y: Math.round(dragState.currentPosition.y / gridSize) * gridSize,
        };

        // Save the new position
        setCustomPositions(prev => ({
            ...prev,
            [dragState.draggedFrame!]: snappedPosition,
        }));

        // Reset drag state
        setDragState({
            isDragging: false,
            draggedFrame: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            offset: { x: 0, y: 0 },
        });
    };

    // Reset positions to grid
    const handleResetPositions = () => {
        setCustomPositions({});
    };

    // Update connection positions based on current frame positions
    const updateConnectionPositions = (
        connections: ConnectionLine[],
        files: DesignFile[]
    ): ConnectionLine[] => {
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
                y: fromPosition.y + (fromDimensions.height + 50) / 2, // +50 for header
            };

            const toConnectionPoint = {
                x: toPosition.x,
                y: toPosition.y + (toDimensions.height + 50) / 2, // +50 for header
            };

            return {
                ...connection,
                fromPosition: fromConnectionPoint,
                toPosition: toConnectionPoint,
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

    if (isLoading) {
        return (
            <div className='canvas-loading'>
                <div className='loading-spinner'>
                    <div className='spinner' />
                    <p>Loading design files...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='canvas-error'>
                <div className='error-message'>
                    <h3>Error loading canvas</h3>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Retry</button>
                </div>
            </div>
        );
    }

    if (designFiles.length === 0) {
        return (
            <div className='canvas-empty'>
                <div className='empty-state'>
                    <h3>
                        No design files found in <code>.superdesign/design_iterations/</code>
                    </h3>
                    <p>
                        Prompt Securedesign OR Cursor/Windsurf/Claude Code to design UI like{' '}
                        <kbd>Help me design a calculator UI</kbd> and preview the UI here
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className='canvas-container'>
            {/* Canvas Controls - Clean Minimal Design */}
            <div className='canvas-toolbar'>
                {/* Navigation Section */}
                <div className='toolbar-section'>
                    <div className='control-group'>
                        <button
                            className='toolbar-btn zoom-btn'
                            onClick={handleZoomOut}
                            title='Zoom Out (Cmd/Ctrl + -)'
                        >
                            <ZoomOutIcon />
                        </button>
                        <div className='zoom-display'>
                            <span className='zoom-value'>{Math.round(currentZoom * 100)}%</span>
                        </div>
                        <button
                            className='toolbar-btn zoom-btn'
                            onClick={handleZoomIn}
                            title='Zoom In (Cmd/Ctrl + +)'
                        >
                            <ZoomInIcon />
                        </button>
                        <div className='toolbar-divider' />
                        <button
                            className='toolbar-btn'
                            onClick={handleResetZoom}
                            title='Reset Zoom (Cmd/Ctrl + 0)'
                        >
                            <HomeIcon />
                        </button>
                        <button
                            className='toolbar-btn'
                            onClick={handleResetPositions}
                            title='Reset Frame Positions'
                        >
                            <RefreshIcon />
                        </button>
                    </div>
                </div>

                {/* Layout Section */}
                <div className='toolbar-section'>
                    <div className='control-group'>
                        <div className='layout-toggle'>
                            <button
                                className={`toggle-btn ${layoutMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setLayoutMode('grid')}
                                title='Grid Layout'
                            >
                                <ScaleIcon />
                            </button>
                            <button
                                className={`toggle-btn ${layoutMode === 'hierarchy' ? 'active' : ''}`}
                                onClick={() => setLayoutMode('hierarchy')}
                                title='Hierarchy Layout'
                                disabled={!hierarchyTree || hierarchyTree.nodes.size === 0}
                            >
                                <TreeIcon />
                            </button>
                        </div>
                        {layoutMode === 'hierarchy' && (
                            <button
                                className={`toolbar-btn connection-btn ${showConnections ? 'active' : ''}`}
                                onClick={() => setShowConnections(!showConnections)}
                                title='Toggle Connection Lines'
                            >
                                <LinkIcon />
                            </button>
                        )}
                    </div>
                </div>

                {/* Viewport Section */}
                <div className='toolbar-section'>
                    <div className='control-group'>
                        <button
                            className={`toolbar-btn viewport-mode-btn ${useGlobalViewport ? 'active' : ''}`}
                            onClick={toggleGlobalViewport}
                            title='Toggle Global Viewport Mode'
                        >
                            <GlobeIcon />
                        </button>
                        <div className='viewport-selector'>
                            <button
                                className={`viewport-btn ${globalViewportMode === 'mobile' && useGlobalViewport ? 'active' : ''}`}
                                onClick={() => handleGlobalViewportChange('mobile')}
                                title='Mobile View (375×667)'
                                disabled={!useGlobalViewport}
                            >
                                <MobileIcon />
                            </button>
                            <button
                                className={`viewport-btn ${globalViewportMode === 'tablet' && useGlobalViewport ? 'active' : ''}`}
                                onClick={() => handleGlobalViewportChange('tablet')}
                                title='Tablet View (768×1024)'
                                disabled={!useGlobalViewport}
                            >
                                <TabletIcon />
                            </button>
                            <button
                                className={`viewport-btn ${globalViewportMode === 'desktop' && useGlobalViewport ? 'active' : ''}`}
                                onClick={() => handleGlobalViewportChange('desktop')}
                                title='Desktop View (1200×800)'
                                disabled={!useGlobalViewport}
                            >
                                <DesktopIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Infinite Canvas */}
            <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={0.1} // Lower min scale to prevent negative values
                maxScale={3} // Higher max scale for more zoom range
                limitToBounds={false}
                smooth={false} // Disable smooth for better performance
                disablePadding // Disable padding to prevent position jumps
                doubleClick={{
                    disabled: false,
                    mode: 'zoomIn',
                    step: 50, // Moderate double-click zoom step
                    animationTime: 150, // Quick double-click zoom
                }}
                wheel={{
                    wheelDisabled: true, // Disable wheel zoom
                    touchPadDisabled: false, // Enable trackpad pan
                    step: 0.05, // Even smaller zoom steps
                }}
                panning={{
                    disabled: dragState.isDragging,
                    velocityDisabled: true, // Disable velocity for immediate response
                    wheelPanning: true, // Enable trackpad panning
                }}
                pinch={{
                    disabled: false, // Keep pinch zoom enabled
                    step: 1, // Ultra-fine pinch steps
                }}
                centerOnInit
                onTransformed={ref => handleTransformChange(ref)}
                onZoom={ref => {
                    const state = ref.state;

                    // Check for invalid scale and fix it
                    if (state.scale <= 0) {
                        console.error('🚨 ZOOM EVENT - Invalid scale:', state.scale, '- Fixing...');
                        ref.setTransform(state.positionX, state.positionY, 0.1);
                        return;
                    }

                    console.log('📏 ZOOM EVENT:', {
                        scale: state.scale,
                        positionX: state.positionX,
                        positionY: state.positionY,
                        event: 'onZoom',
                    });
                }}
                onPanning={ref => {
                    console.log('👆 PAN EVENT:', {
                        scale: ref.state.scale,
                        positionX: ref.state.positionX,
                        positionY: ref.state.positionY,
                        event: 'onPanning',
                    });
                }}
                onZoomStart={ref => {
                    console.log('🔍 ZOOM START:', {
                        scale: ref.state.scale,
                        positionX: ref.state.positionX,
                        positionY: ref.state.positionY,
                        event: 'onZoomStart',
                    });
                }}
                onZoomStop={ref => {
                    console.log('🔍 ZOOM STOP:', {
                        scale: ref.state.scale,
                        positionX: ref.state.positionX,
                        positionY: ref.state.positionY,
                        event: 'onZoomStop',
                    });
                }}
            >
                <TransformComponent
                    wrapperClass='canvas-transform-wrapper'
                    contentClass='canvas-transform-content'
                >
                    <div
                        className={`canvas-grid ${dragState.isDragging ? 'dragging' : ''}`}
                        onMouseMove={e => {
                            if (dragState.isDragging) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const mousePos = transformMouseToCanvasSpace(
                                    e.clientX,
                                    e.clientY,
                                    rect
                                );
                                handleDragMove(mousePos);
                            }
                        }}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onClick={e => {
                            // Clear selection when clicking on empty space
                            if (e.target === e.currentTarget) {
                                setSelectedFrames([]);

                                // Also clear context in chat
                                const clearContextMessage: WebviewMessage = {
                                    command: 'setContextFromCanvas',
                                    data: { fileName: '', type: 'clear' },
                                };
                                vscode.postMessage(clearContextMessage);
                            }
                        }}
                    >
                        {/* Connection Lines (render behind frames) */}
                        {layoutMode === 'hierarchy' && hierarchyTree && showConnections && (
                            <ConnectionLines
                                connections={updateConnectionPositions(
                                    hierarchyTree.connections,
                                    designFiles
                                )}
                                containerBounds={hierarchyTree.bounds}
                                isVisible={showConnections}
                                zoomLevel={currentZoom}
                            />
                        )}
                        {designFiles.map((file, index) => {
                            const frameViewport = getFrameViewport(file.name);
                            const viewportDimensions = currentConfig.viewports[frameViewport];

                            // Use actual viewport dimensions (add frame border/header space)
                            const actualWidth = viewportDimensions.width;
                            const actualHeight = viewportDimensions.height + 50; // Add space for header

                            // Get position (custom or default grid)
                            const position = getFramePosition(file.name, index);

                            // If this frame is being dragged, use current drag position
                            const finalPosition =
                                dragState.isDragging && dragState.draggedFrame === file.name
                                    ? dragState.currentPosition
                                    : position;

                            return (
                                <DesignFrame
                                    key={file.name}
                                    file={file}
                                    position={finalPosition}
                                    dimensions={{ width: actualWidth, height: actualHeight }}
                                    isSelected={selectedFrames.includes(file.name)}
                                    onSelect={handleFrameSelect}
                                    renderMode={getOptimalRenderMode(currentZoom)}
                                    viewport={frameViewport}
                                    viewportDimensions={viewportDimensions}
                                    onViewportChange={handleFrameViewportChange}
                                    useGlobalViewport={useGlobalViewport}
                                    onDragStart={handleDragStart}
                                    isDragging={
                                        dragState.isDragging && dragState.draggedFrame === file.name
                                    }
                                    nonce={nonce}
                                    onSendToChat={handleSendToChat}
                                />
                            );
                        })}
                    </div>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
};

export default CanvasView;
