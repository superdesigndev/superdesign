import React from 'react';
import { ViewportMode } from '../types/canvas.types';

interface BaseHeaderProps {
    title: string;
    subtitle?: string;
    isSelected: boolean;
    isDragging: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
}

interface ViewportControlsProps {
    viewport: ViewportMode;
    onViewportChange?: (viewport: ViewportMode) => void;
    useGlobalViewport?: boolean;
    disabled?: boolean;
}

interface ActionButtonProps {
    icon: React.ReactNode;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    variant?: 'default' | 'danger' | 'success';
    disabled?: boolean;
}

// Viewport Icon Components - Enhanced for better clarity
const MobileIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <rect x="4" y="1" width="6" height="11" rx="1.2" stroke="currentColor" strokeWidth="0.8" fill="none"/>
        <circle cx="7" cy="10.5" r="0.6" fill="currentColor"/>
        <rect x="5.5" y="2.5" width="3" height="0.4" rx="0.2" fill="currentColor"/>
    </svg>
);

const TabletIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <rect x="2" y="2.5" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="0.8" fill="none"/>
        <circle cx="7" cy="9.5" r="0.4" fill="currentColor"/>
        <rect x="6" y="3.5" width="2" height="0.3" rx="0.15" fill="currentColor"/>
    </svg>
);

const DesktopIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <rect x="1" y="2" width="12" height="7" rx="0.6" stroke="currentColor" strokeWidth="0.8" fill="none"/>
        <rect x="6" y="9" width="2" height="2" fill="currentColor"/>
        <rect x="3.5" y="11" width="7" height="0.8" rx="0.4" fill="currentColor"/>
        <circle cx="7" cy="5.5" r="0.3" fill="currentColor" opacity="0.6"/>
    </svg>
);

// Modern Viewport Controls
export const ViewportControls: React.FC<ViewportControlsProps> = ({ 
    viewport, 
    onViewportChange, 
    useGlobalViewport = false,
    disabled = false 
}) => {
    const [isMobile, setIsMobile] = React.useState(false);
    
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 600);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (useGlobalViewport || !onViewportChange) {
        const getViewportIcon = () => {
            switch (viewport) {
                case 'mobile': return <MobileIcon />;
                case 'tablet': return <TabletIcon />;
                case 'desktop': return <DesktopIcon />;
                default: return <DesktopIcon />;
            }
        };

        return (
            <button
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--vscode-foreground)',
                    cursor: 'default',
                    borderRadius: '4px',
                    padding: isMobile ? '4px' : '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: isMobile ? '20px' : '24px',
                    height: isMobile ? '20px' : '24px',
                    opacity: 0.7,
                    transition: 'all 0.2s ease'
                }}
                title={`Global ${viewport} mode`}
                disabled
            >
                {getViewportIcon()}
            </button>
        );
    }

    const viewports: { mode: ViewportMode; icon: React.ReactNode; label: string }[] = [
        { mode: 'mobile', icon: <MobileIcon />, label: 'Mobile' },
        { mode: 'tablet', icon: <TabletIcon />, label: 'Tablet' },
        { mode: 'desktop', icon: <DesktopIcon />, label: 'Desktop' }
    ];

    // Control panel style - compact for both mobile and desktop
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1px',
                padding: '1px',
                borderRadius: '3px',
                background: 'var(--vscode-input-background)',
                border: '1px solid var(--vscode-input-border)',
                flexShrink: 0
            }}
        >
            {viewports.map(({ mode, icon, label }) => (
                <button
                    key={mode}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) {
                            onViewportChange(mode);
                        }
                    }}
                    disabled={disabled}
                    style={{
                        background: viewport === mode ? 'var(--vscode-button-background)' : 'transparent',
                        color: viewport === mode ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                        border: 'none',
                        borderRadius: '2px',
                        padding: isMobile ? '2px 3px' : '3px 4px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: isMobile ? '8px' : '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        opacity: disabled ? 0.5 : 1,
                        width: isMobile ? '18px' : '20px',
                        height: isMobile ? '18px' : '20px'
                    }}
                    title={label}
                    onMouseEnter={(e) => {
                        if (!disabled && viewport !== mode) {
                            e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!disabled && viewport !== mode) {
                            e.currentTarget.style.background = 'transparent';
                        }
                    }}
                >
                    {icon}
                </button>
            ))}
        </div>
    );
};

// Modern Action Button Component
export const ActionButton: React.FC<ActionButtonProps> = ({ 
    icon, 
    onClick, 
    title, 
    variant = 'default',
    disabled = false 
}) => {
    const [isMobile, setIsMobile] = React.useState(false);
    
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 600);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const getVariantColors = () => {
        switch (variant) {
            case 'danger':
                return {
                    color: 'var(--vscode-errorForeground)',
                    hoverBg: 'var(--vscode-inputValidation-errorBackground)',
                    hoverColor: 'var(--vscode-errorForeground)'
                };
            case 'success':
                return {
                    color: 'var(--vscode-terminal-ansiGreen)',
                    hoverBg: 'var(--vscode-list-hoverBackground)',
                    hoverColor: 'var(--vscode-terminal-ansiGreen)'
                };
            default:
                return {
                    color: 'var(--vscode-foreground)',
                    hoverBg: 'var(--vscode-list-hoverBackground)',
                    hoverColor: 'var(--vscode-foreground)'
                };
        }
    };

    const colors = getVariantColors();

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: 'transparent',
                border: 'none',
                color: colors.color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                padding: isMobile ? '4px' : '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: isMobile ? '20px' : '24px',
                height: isMobile ? '20px' : '24px',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.2s ease'
            }}
            title={title}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.background = colors.hoverBg;
                    e.currentTarget.style.color = colors.hoverColor;
                }
            }}
            onMouseLeave={(e) => {
                if (!disabled) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = colors.color;
                }
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
        >
            {icon}
        </button>
    );
};

// Main Modern Frame Header Component
export const FrameHeader: React.FC<BaseHeaderProps & {
    children?: React.ReactNode;
    badge?: string;
    compact?: boolean;
}> = ({ 
    title, 
    subtitle, 
    isSelected, 
    isDragging, 
    onMouseDown, 
    onClick,
    children,
    badge,
    compact = false
}) => {
    // Check if we're in a mobile-sized viewport
    const [isMobile, setIsMobile] = React.useState(false);
    
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 600);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const shouldShowSubtitle = !isMobile && !compact && subtitle;
    const shouldShowBadge = badge; // Show badge on both mobile and desktop

    return (
        <div
            style={{
                height: isMobile ? '28px' : '36px',
                background: isSelected 
                    ? 'var(--vscode-list-activeSelectionBackground)' 
                    : 'var(--vscode-sideBar-background)',
                borderBottom: '1px solid var(--vscode-panel-border)',
                padding: isMobile ? '3px 5px' : '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: 'all 0.2s ease',
                borderRadius: '6px 6px 0 0',
                boxShadow: isSelected 
                    ? '0 0 0 1px var(--vscode-focusBorder)' 
                    : '0 1px 2px rgba(0, 0, 0, 0.04)',
                position: 'relative',
                zIndex: isSelected ? 2 : 1
            }}
            onMouseDown={onMouseDown}
            onClick={onClick}
        >
            {/* Left Side - Title & Info */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobile ? '3px' : '6px', 
                flex: 1,
                minWidth: 0 // Allow text truncation
            }}>
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: isMobile ? '1px' : '2px',
                    minWidth: 0,
                    flex: 1
                }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: isMobile ? '3px' : '5px',
                        minWidth: 0
                    }}>
                        <span style={{ 
                            fontWeight: '600',
                            fontSize: isMobile ? '10px' : '12px',
                            color: 'var(--vscode-foreground)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: isMobile ? '100px' : '150px',
                            lineHeight: isMobile ? '1.1' : '1.2'
                        }}>
                            {title}
                        </span>
                        
                        {shouldShowBadge && (
                            <span style={{
                                background: 'var(--vscode-badge-background)',
                                color: 'var(--vscode-badge-foreground)',
                                fontSize: isMobile ? '7px' : '8px',
                                fontWeight: '500',
                                padding: isMobile ? '1px 3px' : '1px 4px',
                                borderRadius: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.2px',
                                flexShrink: 0
                            }}>
                                {badge}
                            </span>
                        )}
                    </div>
                    
                    {shouldShowSubtitle && (
                        <span style={{ 
                            fontSize: '9px',
                            color: 'var(--vscode-descriptionForeground)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                            lineHeight: '1.1'
                        }}>
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>

            {/* Right Side - Actions */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobile ? '1px' : '3px',
                flexShrink: 0
            }}>
                {children}
            </div>
        </div>
    );
}; 