import React from 'react';

interface ModeToggleProps {
    isDarkMode: boolean;
    onToggle: (isDarkMode: boolean) => void;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ isDarkMode, onToggle }) => {
    const handleToggle = () => {
        onToggle(!isDarkMode);
    };

    return (
        <>
            <style>
                {`
          .mode-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-editor-background);
            cursor: pointer;
            transition: all 0.2s;
          }

          .mode-toggle:hover {
            background: var(--vscode-list-hoverBackground);
          }

          .mode-toggle-icon {
            font-size: 12px;
            line-height: 1;
          }

          .mode-toggle-text {
            font-size: 11px;
            font-weight: 500;
            color: var(--vscode-foreground);
          }
        `}
            </style>
            <div className='mode-toggle' onClick={handleToggle}>
                <span className='mode-toggle-icon'>{isDarkMode ? '🌙' : '☀️'}</span>
                <span className='mode-toggle-text'>{isDarkMode ? 'Dark' : 'Light'}</span>
            </div>
        </>
    );
};

export default ModeToggle;
