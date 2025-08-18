import React, { useState, useEffect } from 'react';
import ThemePreviewHeader from './ThemePreviewHeader';
import ColorPalette from './ColorPalette';
import ThemePreview from './ThemePreview';
import ModeToggle from './ModeToggle';
import { parseThemeCSS, extractColorPalette, type ParsedTheme } from '../../utils/themeParser';
import type { GroupedColors } from './types';

interface ThemePreviewCardProps {
    themeName: string;
    cssSheet?: string | null;
    cssFilePath?: string | null;
    isLoading?: boolean;
    vscode?: any;
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({
    themeName,
    cssSheet,
    cssFilePath,
    isLoading = false,
    vscode,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [parsedTheme, setParsedTheme] = useState<ParsedTheme | null>(null);
    const [activeTab, setActiveTab] = useState<'theme' | 'components'>('theme');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [currentCssContent, setCurrentCssContent] = useState<string>('');
    const [isLoadingCss, setIsLoadingCss] = useState(false);
    const [cssLoadError, setCssLoadError] = useState<string | null>(null);

    // Pre-inject minimal CSS to avoid FOUC (Flash of Unstyled Content)
    useEffect(() => {
        const minimalCssId = 'theme-preview-minimal-css';
        const existingStyle = document.getElementById(minimalCssId);

        if (!existingStyle) {
            const minimalStyle = document.createElement('style');
            minimalStyle.id = minimalCssId;
            minimalStyle.textContent = `
        .theme-preview-live {
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
          border-radius: 4px;
          overflow: hidden;
          min-height: 400px;
          border: 1px solid var(--vscode-panel-border);
        }
      `;
            document.head.appendChild(minimalStyle);
        }

        // Cleanup on unmount
        return () => {
            const styleToRemove = document.getElementById(minimalCssId);
            if (styleToRemove) {
                document.head.removeChild(styleToRemove);
            }
        };
    }, []);

    // Set initial loading state immediately when cssFilePath is provided
    useEffect(() => {
        if (cssFilePath && vscode) {
            setIsLoadingCss(true);
            setIsExpanded(true); // Auto-expand to show loading state
        }
    }, [cssFilePath, vscode]);

    // Load CSS from file if cssFilePath is provided
    useEffect(() => {
        const loadCssFromFile = async () => {
            // Reset states
            setCssLoadError(null);

            if (cssFilePath && vscode) {
                try {
                    // Request CSS file content from extension
                    const response = await new Promise<string>((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            reject(new Error('Timeout loading CSS file'));
                        }, 3000); // Reduced timeout

                        const handler = (event: MessageEvent) => {
                            const message = event.data;
                            if (
                                message.command === 'cssFileContentResponse' &&
                                message.filePath === cssFilePath
                            ) {
                                clearTimeout(timeoutId);
                                window.removeEventListener('message', handler);
                                if (message.error) {
                                    reject(new Error(message.error));
                                } else {
                                    resolve(message.content);
                                }
                            }
                        };

                        window.addEventListener('message', handler);

                        // Request CSS file content
                        vscode.postMessage({
                            command: 'getCssFileContent',
                            filePath: cssFilePath,
                        });
                    });

                    setCurrentCssContent(response);
                    setIsExpanded(true); // Auto-expand when CSS loads successfully
                } catch (error) {
                    console.warn('Failed to load CSS from file, falling back to cssSheet:', error);
                    setCssLoadError(error instanceof Error ? error.message : 'Failed to load CSS');
                    setCurrentCssContent(cssSheet ?? '');
                } finally {
                    setIsLoadingCss(false);
                }
            } else if (cssSheet) {
                setCurrentCssContent(cssSheet);
                setIsExpanded(true); // Auto-expand when CSS is available
            }
        };

        void loadCssFromFile();
    }, [cssFilePath, cssSheet, vscode]);

    // Parse CSS when content is available
    useEffect(() => {
        if (currentCssContent && !isLoadingCss) {
            try {
                const theme = parseThemeCSS(currentCssContent);
                setParsedTheme(theme);
            } catch (error) {
                console.error('Failed to parse theme:', error);
                setCssLoadError('Failed to parse theme CSS');
            }
        }
    }, [currentCssContent, isLoadingCss]);

    const handleCopyCSS = () => {
        if (currentCssContent) {
            void navigator.clipboard.writeText(currentCssContent);
        }
    };

    const handleToggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    // Convert parsed theme to grouped colors format
    const getGroupedColors = (theme: ParsedTheme): GroupedColors => {
        const palette = extractColorPalette(theme);
        return palette.reduce(
            (acc, color) => {
                if (!acc[color.category]) {
                    acc[color.category] = {};
                }
                acc[color.category][color.name] = color.value;
                return acc;
            },
            {} as Record<string, Record<string, string>>
        );
    };

    // Show component if we're loading, have a theme, or have an error to display
    if (!parsedTheme && !isLoading && !isLoadingCss && !cssLoadError) {
        return null;
    }

    return (
        <>
            <style>
                {`
          .theme-preview-tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
          }

          .theme-preview-tab {
            padding: 8px 12px;
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            opacity: 0.7;
            transition: opacity 0.2s;
            border-bottom: 2px solid transparent;
          }

          .theme-preview-tab:hover {
            opacity: 1;
          }

          .theme-preview-tab.active {
            opacity: 1;
            border-bottom-color: var(--vscode-focusBorder);
          }

          .theme-preview-content {
            padding: 12px;
            background: var(--vscode-editor-background);
          }

          .component-preview-section {
            position: relative;
          }

          .component-preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          .component-preview-title {
            font-size: 11px;
            font-weight: 500;
            color: var(--vscode-foreground);
            margin: 0;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
            </style>
            <div>
                <ThemePreviewHeader
                    themeName={themeName}
                    isExpanded={isExpanded}
                    onToggleExpanded={handleToggleExpanded}
                    isLoading={isLoading || isLoadingCss}
                    onCopyCSS={handleCopyCSS}
                />

                {isExpanded && (
                    <>
                        {/* Loading State */}
                        {isLoadingCss && (
                            <div className='theme-preview-content'>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '2rem',
                                        color: 'var(--vscode-descriptionForeground)',
                                        fontSize: '12px',
                                    }}
                                >
                                    <div style={{ marginRight: '8px' }}>
                                        <div
                                            className='loading-spinner'
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                border: '2px solid var(--vscode-progressBar-background)',
                                                borderTop:
                                                    '2px solid var(--vscode-progressBar-background)',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                            }}
                                        />
                                    </div>
                                    Loading theme CSS...
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {cssLoadError && !isLoadingCss && (
                            <div className='theme-preview-content'>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '2rem',
                                        color: 'var(--vscode-errorForeground)',
                                        fontSize: '12px',
                                        backgroundColor:
                                            'var(--vscode-inputValidation-errorBackground)',
                                        border: '1px solid var(--vscode-inputValidation-errorBorder)',
                                        borderRadius: '4px',
                                        margin: '8px',
                                    }}
                                >
                                    ⚠️ {cssLoadError}
                                </div>
                            </div>
                        )}

                        {/* Normal Content */}
                        {!isLoadingCss && !cssLoadError && parsedTheme && (
                            <>
                                <div className='theme-preview-tabs'>
                                    <button
                                        className={`theme-preview-tab ${activeTab === 'theme' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('theme')}
                                    >
                                        Theme
                                    </button>
                                    <button
                                        className={`theme-preview-tab ${activeTab === 'components' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('components')}
                                    >
                                        UI Components
                                    </button>
                                </div>

                                <div className='theme-preview-content'>
                                    {activeTab === 'theme' && (
                                        <>
                                            {/* CSS File Name - Subtle Display */}
                                            {cssFilePath && (
                                                <div
                                                    style={{
                                                        marginBottom: '0.75rem',
                                                        fontSize: '10px',
                                                        color: 'var(--vscode-descriptionForeground)',
                                                        opacity: 0.7,
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {cssFilePath.split('/').pop()}
                                                </div>
                                            )}

                                            {/* Typography Preview */}
                                            <div
                                                style={{
                                                    marginBottom: '1rem',
                                                    padding: '0.75rem',
                                                    backgroundColor:
                                                        'var(--vscode-editor-background)',
                                                    border: '1px solid var(--vscode-panel-border)',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr 1fr 1fr',
                                                        gap: '1rem',
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    <div>
                                                        <div
                                                            style={{
                                                                fontSize: '10px',
                                                                color: 'var(--vscode-descriptionForeground)',
                                                                marginBottom: '0.25rem',
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            Sans
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: '12px',
                                                                color: 'var(--vscode-foreground)',
                                                                fontFamily:
                                                                    parsedTheme.fonts?.sans ||
                                                                    'inherit',
                                                            }}
                                                        >
                                                            {parsedTheme.fonts?.sans
                                                                ?.split(',')[0]
                                                                ?.trim() || 'Default'}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div
                                                            style={{
                                                                fontSize: '10px',
                                                                color: 'var(--vscode-descriptionForeground)',
                                                                marginBottom: '0.25rem',
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            Serif
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: '12px',
                                                                color: 'var(--vscode-foreground)',
                                                                fontFamily:
                                                                    parsedTheme.fonts?.serif ||
                                                                    'inherit',
                                                            }}
                                                        >
                                                            {parsedTheme.fonts?.serif
                                                                ?.split(',')[0]
                                                                ?.trim() || 'Default'}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div
                                                            style={{
                                                                fontSize: '10px',
                                                                color: 'var(--vscode-descriptionForeground)',
                                                                marginBottom: '0.25rem',
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            Mono
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: '12px',
                                                                color: 'var(--vscode-foreground)',
                                                                fontFamily:
                                                                    parsedTheme.fonts?.mono ||
                                                                    'inherit',
                                                            }}
                                                        >
                                                            {parsedTheme.fonts?.mono
                                                                ?.split(',')[0]
                                                                ?.trim() || 'Default'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Color Palette */}
                                            <ColorPalette colors={getGroupedColors(parsedTheme)} />
                                        </>
                                    )}

                                    {activeTab === 'components' && (
                                        <div className='component-preview-section'>
                                            <div className='component-preview-header'>
                                                <h4 className='component-preview-title'>
                                                    Component Preview
                                                </h4>
                                                <ModeToggle
                                                    isDarkMode={isDarkMode}
                                                    onToggle={setIsDarkMode}
                                                />
                                            </div>
                                            <ThemePreview
                                                theme={parsedTheme}
                                                isDarkMode={isDarkMode}
                                                cssSheet={currentCssContent}
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default ThemePreviewCard;
