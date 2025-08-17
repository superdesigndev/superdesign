import React from 'react';
import type { ParsedTheme } from '../../utils/themeParser';

interface ThemeDetailsProps {
    reasoning: string;
    theme: ParsedTheme | null;
}

const ThemeDetails: React.FC<ThemeDetailsProps> = ({ reasoning, theme }) => {
    if (!theme) {
        return null;
    }

    const styles = {
        section: {
            marginBottom: '1.5rem',
        },
        sectionTitle: {
            margin: '0 0 0.75rem 0',
            fontSize: '16px',
            fontWeight: '600' as const,
            color: 'var(--foreground)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
        },
        reasoningText: {
            fontSize: '14px',
            lineHeight: '1.5',
            color: 'var(--foreground)',
            margin: 0,
            whiteSpace: 'pre-wrap' as const,
        },
        metadataGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
        },
        metadataItem: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.25rem',
        },
        metadataLabel: {
            fontSize: '12px',
            fontWeight: '500' as const,
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
        },
        metadataValue: {
            fontSize: '14px',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-mono)',
            padding: '0.25rem 0.5rem',
            backgroundColor: 'var(--muted)',
            borderRadius: '0.25rem',
            border: '1px solid var(--border)',
        },
        shadowsList: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
        },
        shadowItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '12px',
        },
        shadowPreview: {
            width: '3rem',
            height: '1.5rem',
            backgroundColor: 'var(--card)',
            borderRadius: '0.25rem',
            border: '1px solid var(--border)',
        },
        shadowLabel: {
            fontFamily: 'var(--font-mono)',
            color: 'var(--muted-foreground)',
            minWidth: '4rem',
        },
    };

    const shadowEntries = Object.entries(theme.shadows).filter(
        ([_, value]) => value && value !== 'none'
    );
    const hasShadows = shadowEntries.length > 0;

    return (
        <div>
            {reasoning && (
                <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                        <span>💭</span>
                        <span>Design Reasoning</span>
                    </h4>
                    <p style={styles.reasoningText}>{reasoning}</p>
                </div>
            )}

            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>
                    <span>⚙️</span>
                    <span>Theme Properties</span>
                </h4>
                <div style={styles.metadataGrid}>
                    <div style={styles.metadataItem}>
                        <span style={styles.metadataLabel}>Font Family (Sans)</span>
                        <span style={styles.metadataValue}>{theme.fonts.sans}</span>
                    </div>
                    <div style={styles.metadataItem}>
                        <span style={styles.metadataLabel}>Font Family (Mono)</span>
                        <span style={styles.metadataValue}>{theme.fonts.mono}</span>
                    </div>
                    <div style={styles.metadataItem}>
                        <span style={styles.metadataLabel}>Border Radius</span>
                        <span style={styles.metadataValue}>{theme.radius}</span>
                    </div>
                    <div style={styles.metadataItem}>
                        <span style={styles.metadataLabel}>Base Spacing</span>
                        <span style={styles.metadataValue}>{theme.spacing}</span>
                    </div>
                    <div style={styles.metadataItem}>
                        <span style={styles.metadataLabel}>Mode Support</span>
                        <span style={styles.metadataValue}>
                            {theme.darkMode ? 'Light + Dark' : 'Light Only'}
                        </span>
                    </div>
                    <div style={styles.metadataItem}>
                        <span style={styles.metadataLabel}>Total Variables</span>
                        <span style={styles.metadataValue}>
                            {Object.keys(theme.variables).length}
                        </span>
                    </div>
                </div>
            </div>

            {hasShadows && (
                <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                        <span>🌫️</span>
                        <span>Shadow System</span>
                    </h4>
                    <div style={styles.shadowsList}>
                        {shadowEntries.map(([name, value]) => (
                            <div key={name} style={styles.shadowItem}>
                                <div
                                    style={{
                                        ...styles.shadowPreview,
                                        boxShadow: value,
                                    }}
                                />
                                <span style={styles.shadowLabel}>{name}:</span>
                                <span
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--muted-foreground)',
                                        fontFamily: 'var(--font-mono)',
                                    }}
                                >
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThemeDetails;
