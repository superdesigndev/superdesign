import React from 'react';
import type { GroupedColors } from './types';

interface ColorPaletteProps {
    colors: GroupedColors;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors }) => {
    const handleColorCopy = (color: string) => {
        void navigator.clipboard.writeText(color);
    };

    const renderColorGroup = (groupName: string, colorGroup: GroupedColors[string]) => {
        if (!colorGroup || Object.keys(colorGroup).length === 0) {
            return null;
        }

        return (
            <div key={groupName} className='color-group'>
                <h4 className='color-group-title'>{groupName}</h4>
                <div className='color-grid'>
                    {Object.entries(colorGroup).map(([name, color]) => (
                        <div
                            key={name}
                            className='color-swatch'
                            onClick={() => handleColorCopy(color)}
                            title={`${name}: ${color}`}
                        >
                            <div className='color-preview' style={{ backgroundColor: color }} />
                            <div className='color-info'>
                                <span className='color-name'>{name}</span>
                                <span className='color-value'>{color}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
            <style>
                {`
          .color-palette {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .color-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .color-group-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .color-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 8px;
          }

          .color-swatch {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--vscode-editor-background);
          }

          .color-swatch:hover {
            background: var(--vscode-list-hoverBackground);
          }

          .color-preview {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
          }

          .color-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
            flex: 1;
          }

          .color-name {
            font-size: 11px;
            font-weight: 500;
            color: var(--vscode-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .color-value {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `}
            </style>
            <div className='color-palette'>
                {colors &&
                    Object.entries(colors).map(([groupName, colorGroup]) =>
                        renderColorGroup(groupName, colorGroup)
                    )}
            </div>
        </>
    );
};

export default ColorPalette;
