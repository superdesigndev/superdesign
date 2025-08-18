import React from 'react';
import type { ConnectionLine } from '../types/canvas.types';

interface ConnectionLinesProps {
    connections: ConnectionLine[];
    containerBounds: { width: number; height: number };
    isVisible: boolean;
    zoomLevel: number;
}

const ConnectionLines: React.FC<ConnectionLinesProps> = ({
    connections,
    containerBounds,
    isVisible,
    zoomLevel,
}) => {
    if (!isVisible || connections.length === 0) {
        return null;
    }

    // Adjust line styling based on zoom level
    const getLineStyle = (connection: ConnectionLine) => ({
        stroke: connection.color ?? 'var(--vscode-textLink-foreground)',
        strokeWidth: (connection.width ?? 2) / zoomLevel, // Thinner lines when zoomed out
        strokeDasharray: zoomLevel < 0.5 ? '5,5' : 'none', // Dashed when very zoomed out
        opacity: Math.max(0.3, Math.min(1, zoomLevel)), // More transparent when zoomed out
        markerEnd: 'url(#arrowhead)',
    });

    // Calculate curve path for organic looking connections
    const createCurvePath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
        const dx = to.x - from.x;
        const _dy = to.y - from.y;

        // Create a smooth curve with control points
        const cp1x = from.x + dx * 0.6;
        const cp1y = from.y;
        const cp2x = to.x - dx * 0.6;
        const cp2y = to.y;

        return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
    };

    return (
        <svg
            className='connection-lines'
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: containerBounds.width,
                height: containerBounds.height,
                pointerEvents: 'none',
                zIndex: 1,
                overflow: 'visible',
            }}
        >
            {/* Arrow marker definition */}
            <defs>
                <marker
                    id='arrowhead'
                    markerWidth='10'
                    markerHeight='7'
                    refX='9'
                    refY='3.5'
                    orient='auto'
                    fill='var(--vscode-textLink-foreground)'
                >
                    <polygon points='0 0, 10 3.5, 0 7' />
                </marker>
            </defs>

            {/* Render all connection lines */}
            {connections.map(connection => (
                <g key={connection.id} className='connection-group'>
                    {/* Main connection line */}
                    <path
                        d={createCurvePath(connection.fromPosition, connection.toPosition)}
                        fill='none'
                        style={getLineStyle(connection)}
                        className='connection-line'
                    />

                    {/* Optional: Add a thicker invisible line for easier hover detection */}
                    <path
                        d={createCurvePath(connection.fromPosition, connection.toPosition)}
                        fill='none'
                        stroke='transparent'
                        strokeWidth='10'
                        className='connection-line-hover-target'
                        style={{ pointerEvents: 'stroke' }}
                    >
                        <title>{`${connection.fromFrame} → ${connection.toFrame}`}</title>
                    </path>
                </g>
            ))}
        </svg>
    );
};

export default ConnectionLines;
