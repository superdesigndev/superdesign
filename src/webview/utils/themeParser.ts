interface ParsedTheme {
    variables: Record<string, string>;
    lightMode: ThemeColors;
    darkMode?: ThemeColors;
    fonts: {
        sans: string;
        serif: string;
        mono: string;
    };
    radius: string;
    shadows: Record<string, string>;
    spacing: string;
}

interface ThemeColors {
    // Basic colors
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;

    // Semantic colors
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;

    // Form elements
    border: string;
    input: string;
    ring: string;

    // Charts
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;

    // Sidebar
    sidebar: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
}

export type { ParsedTheme, ThemeColors };

export function parseThemeCSS(cssSheet: string): ParsedTheme {
    const rootMatch = cssSheet.match(/:root\s*\{([^}]+)\}/);
    const darkMatch = cssSheet.match(/\.dark\s*\{([^}]+)\}/);

    if (!rootMatch) {
        throw new Error('No :root selector found in CSS');
    }

    const lightMode = parseCSSVariables(rootMatch[1]);
    const darkMode = darkMatch ? parseCSSVariables(darkMatch[1]) : undefined;

    return {
        variables: lightMode.raw,
        lightMode: mapToThemeColors(lightMode.raw),
        darkMode: darkMode ? mapToThemeColors(darkMode.raw) : undefined,
        fonts: {
            sans: lightMode.raw['--font-sans'] || 'system-ui, sans-serif',
            serif: lightMode.raw['--font-serif'] || 'Georgia, serif',
            mono: lightMode.raw['--font-mono'] || 'Monaco, monospace',
        },
        radius: lightMode.raw['--radius'] || '0.5rem',
        shadows: extractShadows(lightMode.raw),
        spacing: lightMode.raw['--spacing'] || '0.25rem',
    };
}

function parseCSSVariables(cssBlock: string): { raw: Record<string, string> } {
    const variables: Record<string, string> = {};

    // Match CSS custom properties
    const variableRegex = /--([^:]+):\s*([^;]+);/g;
    let match;

    while ((match = variableRegex.exec(cssBlock)) !== null) {
        const property = `--${match[1].trim()}`;
        const value = match[2].trim();
        variables[property] = value;
    }

    return { raw: variables };
}

function mapToThemeColors(variables: Record<string, string>): ThemeColors {
    return {
        background: variables['--background'] || 'white',
        foreground: variables['--foreground'] || 'black',
        card: variables['--card'] || 'white',
        cardForeground: variables['--card-foreground'] || 'black',
        popover: variables['--popover'] || 'white',
        popoverForeground: variables['--popover-foreground'] || 'black',
        primary: variables['--primary'] || 'blue',
        primaryForeground: variables['--primary-foreground'] || 'white',
        secondary: variables['--secondary'] || 'gray',
        secondaryForeground: variables['--secondary-foreground'] || 'black',
        muted: variables['--muted'] || 'lightgray',
        mutedForeground: variables['--muted-foreground'] || 'gray',
        accent: variables['--accent'] || 'blue',
        accentForeground: variables['--accent-foreground'] || 'white',
        destructive: variables['--destructive'] || 'red',
        destructiveForeground: variables['--destructive-foreground'] || 'white',
        border: variables['--border'] || 'lightgray',
        input: variables['--input'] || 'white',
        ring: variables['--ring'] || 'blue',
        chart1: variables['--chart-1'] || 'blue',
        chart2: variables['--chart-2'] || 'green',
        chart3: variables['--chart-3'] || 'yellow',
        chart4: variables['--chart-4'] || 'red',
        chart5: variables['--chart-5'] || 'purple',
        sidebar: variables['--sidebar'] || 'white',
        sidebarForeground: variables['--sidebar-foreground'] || 'black',
        sidebarPrimary: variables['--sidebar-primary'] || 'blue',
        sidebarPrimaryForeground: variables['--sidebar-primary-foreground'] || 'white',
        sidebarAccent: variables['--sidebar-accent'] || 'lightgray',
        sidebarAccentForeground: variables['--sidebar-accent-foreground'] || 'black',
        sidebarBorder: variables['--sidebar-border'] || 'lightgray',
        sidebarRing: variables['--sidebar-ring'] || 'blue',
    };
}

function extractShadows(variables: Record<string, string>): Record<string, string> {
    const shadows: Record<string, string> = {};
    const shadowKeys = [
        'shadow-2xs',
        'shadow-xs',
        'shadow-sm',
        'shadow',
        'shadow-md',
        'shadow-lg',
        'shadow-xl',
        'shadow-2xl',
    ];

    shadowKeys.forEach(key => {
        const varKey = `--${key}`;
        if (variables[varKey]) {
            shadows[key] = variables[varKey];
        }
    });

    return shadows;
}

export function generatePreviewCSS(theme: ParsedTheme, mode: 'light' | 'dark'): string {
    const colors = mode === 'dark' && theme.darkMode ? theme.darkMode : theme.lightMode;

    return `
    .theme-preview {
      background-color: ${colors.background};
      color: ${colors.foreground};
      font-family: ${theme.fonts.sans};
      border-radius: ${theme.radius};
      padding: ${theme.spacing};
      min-height: 200px;
      border: 1px solid ${colors.border};
    }
    
    .theme-preview .btn {
      padding: 0.5rem 1rem;
      border-radius: ${theme.radius};
      border: 1px solid ${colors.border};
      font-family: ${theme.fonts.sans};
      cursor: pointer;
      transition: all 0.2s;
      margin: 0.25rem;
      display: inline-block;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    .theme-preview .btn:hover {
      opacity: 0.9;
    }
    
    .theme-preview .btn-primary {
      background-color: ${colors.primary};
      color: ${colors.primaryForeground};
      border-color: ${colors.primary};
    }
    
    .theme-preview .btn-secondary {
      background-color: ${colors.secondary};
      color: ${colors.secondaryForeground};
      border-color: ${colors.secondary};
    }
    
    .theme-preview .btn-destructive {
      background-color: ${colors.destructive};
      color: ${colors.destructiveForeground};
      border-color: ${colors.destructive};
    }
    
    .theme-preview .preview-card {
      background-color: ${colors.card};
      color: ${colors.cardForeground};
      border: 1px solid ${colors.border};
      border-radius: ${theme.radius};
      padding: 1rem;
      margin: 1rem 0;
      box-shadow: ${theme.shadows['shadow'] || 'none'};
    }
    
    .theme-preview .preview-card h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 600;
    }
    
    .theme-preview .preview-card p {
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }
    
    .theme-preview .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .theme-preview .input {
      background-color: ${colors.input};
      color: ${colors.foreground};
      border: 1px solid ${colors.border};
      border-radius: ${theme.radius};
      padding: 0.5rem;
      font-family: ${theme.fonts.sans};
      width: 100%;
      margin: 0.25rem 0;
      font-size: 0.875rem;
    }
    
    .theme-preview .input:focus {
      outline: 2px solid ${colors.ring};
      outline-offset: 2px;
      border-color: ${colors.ring};
    }
    
    .theme-preview .input::placeholder {
      color: ${colors.mutedForeground};
    }
    
    .theme-preview .text-muted {
      color: ${colors.mutedForeground};
    }
    
    .theme-preview .preview-nav {
      background-color: ${colors.sidebar};
      color: ${colors.sidebarForeground};
      border: 1px solid ${colors.sidebarBorder};
      border-radius: ${theme.radius};
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1rem 0;
    }
    
    .theme-preview .nav-brand {
      font-weight: 600;
      font-size: 1.125rem;
    }
    
    .theme-preview .nav-links {
      display: flex;
      gap: 0.5rem;
    }
    
    .theme-preview .nav-link {
      color: ${colors.sidebarForeground};
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: ${theme.radius};
      font-size: 0.875rem;
      transition: all 0.2s;
    }
    
    .theme-preview .nav-link:hover {
      background-color: ${colors.sidebarAccent};
      color: ${colors.sidebarAccentForeground};
    }
    
    .theme-preview .nav-link.active {
      background-color: ${colors.sidebarPrimary};
      color: ${colors.sidebarPrimaryForeground};
    }
    
    .theme-preview .preview-form {
      padding: 1rem 0;
    }
    
    .theme-preview .preview-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      padding: 1rem 0;
    }
  `;
}

export function extractColorPalette(
    theme: ParsedTheme
): Array<{ name: string; value: string; category: string }> {
    const palette: Array<{ name: string; value: string; category: string }> = [];
    const colors = theme.lightMode;

    // Primary colors
    palette.push(
        { name: 'Primary', value: colors.primary, category: 'Brand' },
        { name: 'Primary Foreground', value: colors.primaryForeground, category: 'Brand' },
        { name: 'Secondary', value: colors.secondary, category: 'Brand' },
        { name: 'Secondary Foreground', value: colors.secondaryForeground, category: 'Brand' }
    );

    // Background colors
    palette.push(
        { name: 'Background', value: colors.background, category: 'Surface' },
        { name: 'Foreground', value: colors.foreground, category: 'Surface' },
        { name: 'Card', value: colors.card, category: 'Surface' },
        { name: 'Card Foreground', value: colors.cardForeground, category: 'Surface' }
    );

    // Interactive colors
    palette.push(
        { name: 'Accent', value: colors.accent, category: 'Interactive' },
        { name: 'Destructive', value: colors.destructive, category: 'Interactive' },
        { name: 'Border', value: colors.border, category: 'Interactive' },
        { name: 'Ring', value: colors.ring, category: 'Interactive' }
    );

    // Chart colors
    palette.push(
        { name: 'Chart 1', value: colors.chart1, category: 'Data' },
        { name: 'Chart 2', value: colors.chart2, category: 'Data' },
        { name: 'Chart 3', value: colors.chart3, category: 'Data' },
        { name: 'Chart 4', value: colors.chart4, category: 'Data' },
        { name: 'Chart 5', value: colors.chart5, category: 'Data' }
    );

    return palette;
}

// Utility function to convert OKLCH to hex for better compatibility
export function oklchToHex(oklchValue: string): string {
    // For now, return the original value
    // In a real implementation, you'd convert OKLCH to hex
    return oklchValue;
}
