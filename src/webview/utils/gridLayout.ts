import type {
    GridPosition,
    CanvasConfig,
    DesignFile,
    HierarchyTree,
    HierarchyNode,
    ConnectionLine,
} from '../types/canvas.types';

/**
 * Calculate grid position for a frame based on its index
 */
export function calculateGridPosition(index: number, config: CanvasConfig): GridPosition {
    const row = Math.floor(index / config.framesPerRow);
    const col = index % config.framesPerRow;

    const x = col * (config.frameSize.width + config.gridSpacing);
    const y = row * (config.frameSize.height + config.gridSpacing);

    return { x, y };
}

/**
 * Calculate total canvas bounds based on number of items
 */
export function calculateCanvasBounds(
    itemCount: number,
    config: CanvasConfig
): { width: number; height: number } {
    if (itemCount === 0) {
        return { width: 0, height: 0 };
    }

    const rows = Math.ceil(itemCount / config.framesPerRow);
    const cols = Math.min(itemCount, config.framesPerRow);

    const width = cols * config.frameSize.width + (cols - 1) * config.gridSpacing;
    const height = rows * config.frameSize.height + (rows - 1) * config.gridSpacing;

    return { width, height };
}

/**
 * Calculate optimal fit-to-view scale and position
 */
export function calculateFitToView(
    itemCount: number,
    config: CanvasConfig,
    containerWidth: number,
    containerHeight: number,
    padding: number = 50
): { scale: number; x: number; y: number } {
    if (itemCount === 0) {
        return { scale: 1, x: 0, y: 0 };
    }

    const bounds = calculateCanvasBounds(itemCount, config);

    // Available space after padding
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = containerHeight - 2 * padding;

    // Calculate scale to fit
    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    // Calculate centering position
    const scaledWidth = bounds.width * scale;
    const scaledHeight = bounds.height * scale;

    const x = (containerWidth - scaledWidth) / 2;
    const y = (containerHeight - scaledHeight) / 2;

    return { scale, x, y };
}

/**
 * Find the nearest frame to a given position
 */
export function findNearestFrame(
    targetPosition: GridPosition,
    itemCount: number,
    config: CanvasConfig
): number | null {
    if (itemCount === 0) {
        return null;
    }

    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < itemCount; i++) {
        const framePos = calculateGridPosition(i, config);
        const distance = Math.sqrt(
            Math.pow(framePos.x - targetPosition.x, 2) + Math.pow(framePos.y - targetPosition.y, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
        }
    }

    return nearestIndex;
}

/**
 * Generate layout configurations for different screen sizes
 */
export function generateResponsiveConfig(
    baseConfig: CanvasConfig,
    containerWidth: number
): CanvasConfig {
    // Adjust frames per row based on container width (optimized for more frames)
    let framesPerRow = baseConfig.framesPerRow;
    let gridSpacing = baseConfig.gridSpacing;

    if (containerWidth < 600) {
        framesPerRow = 1;
        gridSpacing = 30; // Tight spacing on mobile
    } else if (containerWidth < 900) {
        framesPerRow = 2;
        gridSpacing = 40; // Moderate spacing on tablet
    } else if (containerWidth < 1300) {
        framesPerRow = 3;
        gridSpacing = 45; // Good spacing for medium screens
    } else if (containerWidth < 1800) {
        framesPerRow = 4;
        gridSpacing = 50; // Our default spacing
    } else {
        framesPerRow = 5; // Extra wide screens can fit 5 frames
        gridSpacing = 60; // Slightly more breathing room
    }

    return {
        ...baseConfig,
        framesPerRow,
        gridSpacing,
    };
}

/**
 * Calculate grid metrics for display
 */
export function getGridMetrics(
    itemCount: number,
    config: CanvasConfig
): {
    rows: number;
    cols: number;
    totalFrames: number;
    bounds: { width: number; height: number };
} {
    const rows = Math.ceil(itemCount / config.framesPerRow);
    const cols = Math.min(itemCount, config.framesPerRow);
    const bounds = calculateCanvasBounds(itemCount, config);

    return {
        rows,
        cols,
        totalFrames: itemCount,
        bounds,
    };
}

/**
 * Build hierarchy tree from design files
 */
export function buildHierarchyTree(designs: DesignFile[]): HierarchyTree {
    const nodes = new Map<string, HierarchyNode>();
    const roots: string[] = [];
    const connections: ConnectionLine[] = [];

    // First pass: Create nodes and identify roots
    designs.forEach(design => {
        const node: HierarchyNode = {
            fileName: design.name,
            position: { x: 0, y: 0 }, // Will be calculated later
            generation: design.generation ?? 0,
            branchIndex: design.branchIndex ?? 0,
            parent: design.parentDesign,
            children: design.children ?? [],
        };

        nodes.set(design.name, node);

        if (!design.parentDesign) {
            roots.push(design.name);
        }
    });

    // Second pass: Build connections
    nodes.forEach((node, fileName) => {
        if (node.parent && nodes.has(node.parent)) {
            const parentNode = nodes.get(node.parent)!;
            connections.push({
                id: `${node.parent}-${fileName}`,
                fromFrame: node.parent,
                toFrame: fileName,
                fromPosition: parentNode.position,
                toPosition: node.position,
            });
        }
    });

    return {
        roots,
        nodes,
        connections,
        bounds: { width: 0, height: 0 },
    };
}

/**
 * Calculate hierarchical positions for design tree
 */
export function calculateHierarchyPositions(
    tree: HierarchyTree,
    config: CanvasConfig,
    actualFrameDimensions?: { width: number; height: number }
): HierarchyTree {
    const { verticalSpacing } = config.hierarchy;
    // Use actual frame dimensions if provided, otherwise fall back to config or defaults
    const frameWidth = actualFrameDimensions?.width ?? Math.max(config.frameSize.width, 400);
    const frameHeight = actualFrameDimensions?.height ?? Math.max(config.frameSize.height, 550);

    // Position root nodes first with generous spacing
    let currentRootY = 100; // Start with some padding
    tree.roots.forEach(rootName => {
        const rootNode = tree.nodes.get(rootName)!;
        rootNode.position = {
            x: 50, // Start with some padding from left edge
            y: currentRootY,
        };

        // Calculate subtree height to determine spacing for next root
        calculateSubtreeHeight(rootNode, tree.nodes, config, {
            width: frameWidth,
            height: frameHeight,
        });

        // Position children recursively
        const nextAvailableY = positionChildrenImproved(
            rootNode,
            tree.nodes,
            config,
            currentRootY,
            { width: frameWidth, height: frameHeight }
        );

        // Update position for next root with large spacing to avoid overlaps
        currentRootY = Math.max(
            currentRootY + frameHeight + verticalSpacing * 2,
            nextAvailableY + verticalSpacing * 2
        );
    });

    // Update connection positions
    tree.connections.forEach(connection => {
        const fromNode = tree.nodes.get(connection.fromFrame);
        const toNode = tree.nodes.get(connection.toFrame);

        if (fromNode && toNode) {
            connection.fromPosition = {
                x: fromNode.position.x + frameWidth,
                y: fromNode.position.y + frameHeight / 2,
            };
            connection.toPosition = {
                x: toNode.position.x,
                y: toNode.position.y + frameHeight / 2,
            };
        }
    });

    // Calculate total bounds
    let maxX = 0,
        maxY = 0;
    tree.nodes.forEach(node => {
        maxX = Math.max(maxX, node.position.x + frameWidth + 100);
        maxY = Math.max(maxY, node.position.y + frameHeight + 100);
    });

    tree.bounds = { width: maxX, height: maxY };

    return tree;
}

/**
 * Calculate the total height needed for a subtree
 */
function calculateSubtreeHeight(
    node: HierarchyNode,
    nodes: Map<string, HierarchyNode>,
    config: CanvasConfig,
    frameDimensions: { width: number; height: number }
): number {
    const { verticalSpacing } = config.hierarchy;
    const frameHeight = frameDimensions.height;

    const children = node.children
        .map(childName => nodes.get(childName))
        .filter(child => child !== undefined);

    if (children.length === 0) {
        return frameHeight;
    }

    // Calculate total height needed for all children
    let totalChildrenHeight = 0;
    children.forEach(child => {
        totalChildrenHeight += calculateSubtreeHeight(child, nodes, config, frameDimensions);
    });

    // Add spacing between children
    totalChildrenHeight += (children.length - 1) * verticalSpacing;

    return Math.max(frameHeight, totalChildrenHeight);
}

/**
 * Position children nodes recursively without overlaps
 */
function positionChildrenImproved(
    parentNode: HierarchyNode,
    nodes: Map<string, HierarchyNode>,
    config: CanvasConfig,
    startY: number,
    frameDimensions: { width: number; height: number }
): number {
    const { horizontalSpacing, verticalSpacing } = config.hierarchy;
    // Use passed frame dimensions
    const frameWidth = frameDimensions.width;
    const frameHeight = frameDimensions.height;

    const children = parentNode.children
        .map(childName => nodes.get(childName))
        .filter(child => child !== undefined);

    if (children.length === 0) {
        return startY + frameHeight;
    }

    let currentY = startY;

    // Position each child without overlapping
    children.forEach(child => {
        child.position = {
            x: parentNode.position.x + frameWidth + horizontalSpacing,
            y: currentY,
        };

        // Recursively position grandchildren and get the next available Y
        const nextY = positionChildrenImproved(child, nodes, config, currentY, frameDimensions);

        // Move to next position with generous spacing to avoid overlaps
        currentY = Math.max(currentY + frameHeight + verticalSpacing, nextY + verticalSpacing);
    });

    return currentY;
}

/**
 * Get hierarchical position for a specific design
 */
export function getHierarchicalPosition(fileName: string, tree: HierarchyTree): GridPosition {
    const node = tree.nodes.get(fileName);
    return node ? node.position : { x: 0, y: 0 };
}

/**
 * Parse hierarchical path from filename (e.g., "text_1_3_1.html" -> ["text", "1", "3", "1"])
 */
export function parseHierarchicalPath(filename: string): string[] {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Split by underscores
    const parts = nameWithoutExt.split('_');

    return parts;
}

/**
 * Get parent path from hierarchical filename (e.g., "text_1_3_1" -> "text_1_3")
 */
export function getParentPath(filename: string): string | null {
    const parts = parseHierarchicalPath(filename);

    // If only one part or two parts (like "text_1"), it's a root
    if (parts.length <= 2) {
        return null;
    }

    // Remove the last number to get parent path
    const parentParts = parts.slice(0, -1);
    return parentParts.join('_');
}

/**
 * Get generation level from hierarchical filename (e.g., "text_1_3_1" -> 2, "text_1" -> 0)
 */
export function getGenerationLevel(filename: string): number {
    const parts = parseHierarchicalPath(filename);

    // Generation is the number of numeric parts minus 1
    // text_1 -> generation 0
    // text_1_3 -> generation 1
    // text_1_3_1 -> generation 2
    const numericParts = parts.slice(1); // Skip the first part (like "text")
    return Math.max(0, numericParts.length - 1);
}

/**
 * Get version at current level (e.g., "text_1_3_1" -> "1", "text_1_3" -> "3")
 */
export function getCurrentLevelVersion(filename: string): string {
    const parts = parseHierarchicalPath(filename);

    // Return the last part (current level version)
    return parts[parts.length - 1];
}

/**
 * Detect design relationships based on hierarchical naming patterns
 */
export function detectDesignRelationships(designs: DesignFile[]): DesignFile[] {
    const updatedDesigns = designs.map(design => ({ ...design }));

    // Create a map for quick lookup
    const designMap = new Map<string, DesignFile>();
    updatedDesigns.forEach(design => {
        // Use filename without extension as the key
        const nameWithoutExt = design.name.replace(/\.[^/.]+$/, '');
        designMap.set(nameWithoutExt, design);
    });

    // Auto-detect versions and relationships
    updatedDesigns.forEach(design => {
        // Set version (current level version)
        design.version = getCurrentLevelVersion(design.name);

        // Set generation level
        design.generation = getGenerationLevel(design.name);

        // Find parent
        const parentPath = getParentPath(design.name);
        if (parentPath) {
            const parentDesign = designMap.get(parentPath);
            if (parentDesign) {
                design.parentDesign = parentDesign.name;

                // Add this design as a child to parent
                parentDesign.children ??= [];
                if (!parentDesign.children.includes(design.name)) {
                    parentDesign.children.push(design.name);
                }
            }
        }

        // Set branch index (order among siblings)
        if (design.parentDesign) {
            const parentDesign = designMap.get(getParentPath(design.name)!);
            if (parentDesign?.children) {
                design.branchIndex = parentDesign.children.indexOf(design.name);
            }
        } else {
            // For root designs, use the version number as branch index
            design.branchIndex = parseInt(design.version) - 1;
        }
    });

    return updatedDesigns;
}
