// Canvas view type definitions

export interface DesignFile {
    name: string;
    path: string;
    relativePath?: string;     // Relative path from design_iterations for nested files
    content: string;
    size: number;
    modified: Date;
    fileType: 'html' | 'svg';  // File type for proper rendering
    // New hierarchy properties
    version?: string;          // e.g., "v1", "v2", "v3"
    parentDesign?: string;     // Reference to parent design file name
    children?: string[];       // Array of child design file names
    generation?: number;       // 0 for root designs, 1 for first children, etc.
    branchIndex?: number;      // Index within the same generation/branch
}

export interface CanvasState {
    designFiles: DesignFile[];
    selectedFrames: string[];
    isLoading: boolean;
    error: string | null;
    zoom: number;
    pan: { x: number; y: number };
}

// Message types for communication between extension and webview
export interface ExtensionMessage {
    command: string;
    data?: any;
}

export interface LoadDesignFilesMessage extends ExtensionMessage {
    command: 'loadDesignFiles';
}

export interface DesignFilesLoadedMessage extends ExtensionMessage {
    command: 'designFilesLoaded';
    data: {
        files: DesignFile[];
    };
}

export interface SelectFrameMessage extends ExtensionMessage {
    command: 'selectFrame';
    data: {
        fileName: string;
    };
}

export interface SetContextFromCanvasMessage extends ExtensionMessage {
    command: 'setContextFromCanvas';
    data: {
        fileName: string;
        type: 'frame' | 'clear';
    };
}

export interface SetChatPromptMessage extends ExtensionMessage {
    command: 'setChatPrompt';
    data: {
        prompt: string;
    };
}

export interface ErrorMessage extends ExtensionMessage {
    command: 'error';
    data: {
        error: string;
    };
}

export interface FileWatchMessage extends ExtensionMessage {
    command: 'fileChanged';
    data: {
        fileName: string;
        changeType: 'created' | 'modified' | 'deleted';
    };
}

export type WebviewMessage = 
    | LoadDesignFilesMessage 
    | SelectFrameMessage
    | SetContextFromCanvasMessage
    | SetChatPromptMessage;

export type ExtensionToWebviewMessage = 
    | DesignFilesLoadedMessage 
    | ErrorMessage 
    | FileWatchMessage;

// Canvas grid layout types
export interface GridPosition {
    x: number;
    y: number;
}

export interface FrameDimensions {
    width: number;
    height: number;
}

export type ViewportMode = 'desktop' | 'mobile' | 'tablet';

export interface ViewportConfig {
    desktop: FrameDimensions;
    mobile: FrameDimensions;
    tablet: FrameDimensions;
}

export interface FrameViewportState {
    [fileName: string]: ViewportMode;
}

export interface FramePositionState {
    [fileName: string]: GridPosition;
}

export interface DragState {
    isDragging: boolean;
    draggedFrame: string | null;
    startPosition: GridPosition;
    currentPosition: GridPosition;
    offset: GridPosition;
}

export interface CanvasConfig {
    frameSize: FrameDimensions;
    gridSpacing: number;
    framesPerRow: number;
    minZoom: number;
    maxZoom: number;
    // Responsive settings
    responsive: {
        enableScaling: boolean;
        minFrameSize: FrameDimensions;
        maxFrameSize: FrameDimensions;
        scaleWithZoom: boolean;
    };
    // Viewport configurations
    viewports: ViewportConfig;
    // New hierarchy settings
    hierarchy: {
        horizontalSpacing: number;     // Space between generations (horizontal)
        verticalSpacing: number;       // Space between siblings (vertical)
        connectionLineWidth: number;   // Width of connection lines
        connectionLineColor: string;   // Color of connection lines
        showConnections: boolean;      // Toggle connection visibility
    };
}

// New types for hierarchical layout
export type LayoutMode = 'grid' | 'hierarchy';

export interface ConnectionLine {
    id: string;
    fromFrame: string;
    toFrame: string;
    fromPosition: GridPosition;
    toPosition: GridPosition;
    color?: string;
    width?: number;
}

export interface HierarchyNode {
    fileName: string;
    position: GridPosition;
    generation: number;
    branchIndex: number;
    parent?: string;
    children: string[];
}

export interface HierarchyTree {
    roots: string[];
    nodes: Map<string, HierarchyNode>;
    connections: ConnectionLine[];
    bounds: { width: number; height: number };
} 