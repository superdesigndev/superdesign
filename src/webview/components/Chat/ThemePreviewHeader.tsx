import React from 'react';

interface ThemePreviewHeaderProps {
  themeName: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isLoading: boolean;
  onCopyCSS: () => void;
}

const ThemePreviewHeader: React.FC<ThemePreviewHeaderProps> = ({
  themeName,
  isExpanded,
  onToggleExpanded,
  isLoading,
  onCopyCSS
}) => {
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div 
      className="tool-message__header"
      onClick={onToggleExpanded}
    >
      <div className="tool-message__main">
        <span className="tool-icon">
          {isLoading ? (
            <div className="loading-icon-simple">
              <div className="loading-ring" />
            </div>
          ) : (
            '⚙️'
          )}
        </span>
        <div className="tool-info">
          <span className="tool-name">
            Generate Theme - <span style={{ color: 'var(--vscode-descriptionForeground)', fontWeight: 'normal' }}>{themeName}</span>
          </span>
          {isLoading && (
            <span className="tool-time-remaining">
              Generating theme...
            </span>
          )}
        </div>
      </div>
      <div className="tool-actions">
        {!isLoading && (
          <button
            className="theme-copy-btn"
            onClick={(e) => handleActionClick(e, onCopyCSS)}
            title="Copy CSS to clipboard"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '2px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
          >
            📋
          </button>
        )}
        <button className={`tool-expand-btn ${isExpanded ? 'expanded' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ThemePreviewHeader; 