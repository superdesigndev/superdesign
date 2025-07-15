// Canvas view type definitions

export interface DesignFile {
    name: string;
    path: string;
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
    selectedFrame: string;
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

// Preview-related message types
export interface LoadPreviewsMessage extends ExtensionMessage {
    command: 'loadPreviews';
}

export interface PreviewsLoadedMessage extends ExtensionMessage {
    command: 'previewsLoaded';
    data: {
        previews: Preview[];
        hotReload?: boolean;
    };
}

export interface DeletePreviewMessage extends ExtensionMessage {
    command: 'deletePreview';
    data: {
        previewId: string;
    };
}

export interface OpenInBrowserMessage extends ExtensionMessage {
    command: 'openInBrowser';
    data: {
        fileName?: string;
        filePath?: string;
        previewId?: string;
        route?: string;
    };
}

export interface OpenInSimpleBrowserMessage extends ExtensionMessage {
    command: 'openInSimpleBrowser';
    data: {
        fileName?: string;
        filePath?: string;
        previewId?: string;
        route?: string;
    };
}

export interface RenameFrameMessage extends ExtensionMessage {
    command: 'renameFrame';
    data: {
        frameId: string;
        newName: string;
    };
}

export interface RefreshFrameMessage extends ExtensionMessage {
    command: 'refreshFrame';
    data: {
        frameId: string;
    };
}

export interface OpenFileMessage extends ExtensionMessage {
    command: 'openFile';
    data: {
        filePath: string;
    };
}

export interface PreviewDeletedMessage extends ExtensionMessage {
    command: 'previewDeleted';
    data: {
        previewId: string;
        previews: Preview[];
    };
}

export interface FrameRefreshedMessage extends ExtensionMessage {
    command: 'frameRefreshed';
    data: {
        frameId: string;
    };
}

export type WebviewMessage = 
    | LoadDesignFilesMessage
    | SelectFrameMessage
    | SetContextFromCanvasMessage
    | SetChatPromptMessage
    | LoadPreviewsMessage
    | LoadRegistryMessage
    | DeletePreviewMessage
    | OpenInBrowserMessage
    | OpenInSimpleBrowserMessage
    | RenameFrameMessage
    | RefreshFrameMessage
    | OpenFileMessage;

export type ExtensionToWebviewMessage = 
    | DesignFilesLoadedMessage 
    | ErrorMessage 
    | FileWatchMessage
    | PreviewsLoadedMessage
    | RegistryLoadedMessage
    | RegistryLoadingMessage
    | PreviewDeletedMessage
    | FrameRefreshedMessage;

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

// Preview configuration types
export interface Preview {
    id: string;
    name: string;
    type: 'component' | 'page';
    component?: string;
    page?: string;
    route: string;
    props: Record<string, any>;
    description: string;
    parentId: string | null;
    group: string;
    createdBy: string;
    filePath?: string;
}

export interface PreviewConfig {
    version: number;
    previews: Preview[];
}

// Extended CanvasState to include previews
export interface ExtendedCanvasState extends CanvasState {
    previews: Preview[];
    previewsLoading: boolean;
    previewsError: string | null;
} 

// Registry configuration types
export interface RegistryComponent {
    name: string;
    filePath: string;
    type: 'provider' | 'ui' | 'layout';
    route: string;
    exported: boolean;
    props: string[];
    propTypes: Record<string, string>;
    description: string;
    group: string;
    createdAt: string;
    createdBy: string;
}

export interface RegistryPage {
    name: string;
    filePath: string;
    page: string;
    route: string;
    exported: boolean;
    description: string;
    group: string;
    createdAt: string;
    createdBy: string;
}

export interface RegistryConfig {
    version: number;
    lastUpdated: string;
    components: RegistryComponent[];
    pages: RegistryPage[];
}

// Registry-related message types
export interface LoadRegistryMessage extends ExtensionMessage {
    command: 'loadRegistry';
}

export interface RegistryLoadedMessage extends ExtensionMessage {
    command: 'registryLoaded';
    data: {
        registry: RegistryConfig;
    };
}

export interface RegistryLoadingMessage extends ExtensionMessage {
    command: 'registryLoading';
} 