import React, { useEffect, useRef } from 'react';

interface ThemePreviewProps {
    theme: any;
    isDarkMode: boolean;
    cssSheet: string;
}

// System fonts that should not be loaded from Google Fonts
const SYSTEM_FONTS = [
    'system-ui',
    'sans-serif',
    'serif',
    'monospace',
    'cursive',
    'fantasy',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
    'ui-rounded',
    'Arial',
    'Helvetica',
    'Times',
    'Times New Roman',
    'Courier',
    'Courier New',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Impact',
    'Comic Sans MS',
    'MS Sans Serif',
    'MS Serif',
    'Pixelated MS Sans Serif',
];

// Extract font families from CSS variables
const extractFontsFromCSS = (cssSheet: string): string[] => {
    const fonts = new Set<string>();

    // Look for font-family declarations
    const fontRegex = /--font-[^:]*:\s*["']?([^"';,]+)/g;
    let match;

    while ((match = fontRegex.exec(cssSheet)) !== null) {
        const fontName = match[1].trim();

        // Skip system fonts and empty values
        if (fontName && !SYSTEM_FONTS.includes(fontName)) {
            fonts.add(fontName);
        }
    }

    return Array.from(fonts);
};

// Load Google Fonts dynamically
const loadGoogleFonts = (fontNames: string[]): Promise<void> => {
    if (fontNames.length === 0) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        try {
            // Check if we already have a Google Fonts link
            const existingLink = document.querySelector(
                'link[href*="fonts.googleapis.com"]'
            ) as HTMLLinkElement;

            // Convert font names to Google Fonts URL format
            const fontParams = fontNames
                .map(name => {
                    try {
                        const urlName = name.replace(/\s+/g, '+');
                        // Load multiple weights for better coverage
                        return `${urlName}:300,400,500,600,700`;
                    } catch (error) {
                        console.warn(`Failed to process font name: ${name}`, error);
                        return null;
                    }
                })
                .filter(Boolean)
                .join('&family=');

            // If no valid fonts to load, just resolve
            if (!fontParams) {
                resolve();
                return;
            }

            const fontUrl = `https://fonts.googleapis.com/css2?family=${fontParams}&display=swap`;

            if (existingLink) {
                existingLink.href = fontUrl;
                existingLink.onload = () => resolve();
                existingLink.onerror = error => {
                    console.warn('Failed to load Google Fonts (existing link):', fontNames, error);
                    resolve(); // Continue even if fonts fail to load
                };
            } else {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fontUrl;
                link.onload = () => resolve();
                link.onerror = error => {
                    console.warn('Failed to load Google Fonts (new link):', fontNames, error);
                    resolve(); // Continue even if fonts fail to load
                };
                document.head.appendChild(link);
            }

            // Fallback timeout - resolve after 2 seconds even if fonts haven't loaded
            setTimeout(() => {
                console.warn('Google Fonts loading timeout for:', fontNames);
                resolve();
            }, 2000);
        } catch (error) {
            console.warn('Error in loadGoogleFonts:', error);
            resolve(); // Always resolve, never reject
        }
    });
};

const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, isDarkMode, cssSheet }) => {
    const previewRef = useRef<HTMLDivElement>(null);
    const styleRef = useRef<HTMLStyleElement | null>(null);
    const fontsLoadedRef = useRef<boolean>(false);

    useEffect(() => {
        if (!cssSheet || !previewRef.current) {
            return;
        }

        const setupPreview = () => {
            // Remove existing style element first
            if (styleRef.current) {
                styleRef.current.remove();
            }

            // Create new style element with the actual CSS immediately
            const styleElement = document.createElement('style');
            styleElement.textContent = `
        ${cssSheet}
        
        .theme-preview-live {
          background: var(--background);
          color: var(--foreground);
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
          border-radius: var(--radius);
          overflow: hidden;
          min-height: 400px;
          border: 1px solid var(--border);
        }
        
        .theme-preview-live.dark {
          /* Dark mode will use the .dark selector variables from cssSheet */
        }
        
        .theme-preview-live * {
          box-sizing: border-box;
        }
        
        .theme-preview-live .preview-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: var(--sidebar);
          color: var(--sidebar-foreground);
          border-bottom: 1px solid var(--sidebar-border);
        }
        
        .theme-preview-live .nav-brand {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--sidebar-primary);
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }
        
        .theme-preview-live .nav-links {
          display: flex;
          gap: 0.5rem;
        }
        
        .theme-preview-live .nav-link {
          color: var(--sidebar-foreground);
          text-decoration: none;
          padding: 0.5rem 1rem;
          border-radius: var(--radius);
          font-size: 0.875rem;
          transition: all 0.2s;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }
        
        .theme-preview-live .nav-link:hover {
          /* Fallback: subtle opacity change */
          background: rgba(255, 255, 255, 0.1);
          /* Modern approach with color-mix */
          background: color-mix(in srgb, var(--sidebar-foreground) 15%, var(--sidebar) 85%);
          color: var(--sidebar-foreground);
        }
        
        .theme-preview-live .nav-link.active {
          background: var(--sidebar-primary);
          color: var(--sidebar-primary-foreground);
        }
        
        .theme-preview-live .preview-card {
          background: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.5rem;
          margin: 1rem;
          box-shadow: var(--shadow);
          transition: all 0.2s;
        }
        
        .theme-preview-live .preview-card:hover {
          /* Fallback: enhanced existing shadow */
          transform: translateY(-1px);
          box-shadow: var(--shadow), 0 4px 12px rgba(0, 0, 0, 0.1);
          /* Modern approach with color-mix */
          border-color: color-mix(in srgb, var(--border) 60%, var(--foreground) 40%);
          box-shadow: var(--shadow), 0 4px 12px color-mix(in srgb, var(--foreground) 10%, transparent 90%);
          transform: none;
        }
        
        .theme-preview-live .preview-card h3 {
          margin: 0 0 0.5rem 0;
          color: var(--card-foreground);
          font-size: 1.25rem;
          font-weight: 600;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }
        
        .theme-preview-live .text-muted {
          color: var(--muted-foreground);
          margin: 0 0 1rem 0;
          line-height: 1.5;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }
        
        .theme-preview-live .card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }
        
        .theme-preview-live .preview-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin: 1rem;
        }
        
        .theme-preview-live .btn {
          padding: 0.5rem 1rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }
        
        .theme-preview-live .btn-primary {
          background: var(--primary);
          color: var(--primary-foreground);
          border-color: var(--primary);
        }
        
        .theme-preview-live .btn-primary:hover {
          /* Fallback: filter approach */
          filter: brightness(0.85) saturate(1.1);
          /* Modern approach with color-mix */
          background: color-mix(in srgb, var(--primary) 70%, black 30%);
          border-color: color-mix(in srgb, var(--primary) 70%, black 30%);
          filter: none;
        }
        
        .theme-preview-live .btn-secondary {
          background: var(--secondary);
          color: var(--secondary-foreground);
          border-color: var(--secondary);
        }
        
        .theme-preview-live .btn-secondary:hover {
          /* Fallback: filter approach */
          filter: brightness(0.9) contrast(1.1);
          /* Modern approach with color-mix */
          background: color-mix(in srgb, var(--secondary) 70%, var(--foreground) 30%);
          border-color: color-mix(in srgb, var(--secondary) 70%, var(--foreground) 30%);
          filter: none;
        }
        
        .theme-preview-live .btn-destructive {
          background: var(--destructive);
          color: var(--destructive-foreground);
          border-color: var(--destructive);
        }
        
        .theme-preview-live .btn-destructive:hover {
          /* Fallback: filter approach */
          filter: brightness(0.85) saturate(1.1);
          /* Modern approach with color-mix */
          background: color-mix(in srgb, var(--destructive) 70%, black 30%);
          border-color: color-mix(in srgb, var(--destructive) 70%, black 30%);
          filter: none;
        }
        
        .theme-preview-live .preview-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          margin: 1rem;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
        }
        
        .theme-preview-live .preview-form h3 {
          margin: 0 0 1rem 0;
          color: var(--card-foreground);
          font-size: 1.25rem;
          font-weight: 600;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }
        
        .theme-preview-live .input {
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--input);
          color: var(--foreground);
          font-size: 0.875rem;
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
          width: 100%;
        }
        
        .theme-preview-live .input:hover {
          /* Fallback: slight opacity overlay */
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
          /* Modern approach with color-mix */
          border-color: color-mix(in srgb, var(--border) 50%, var(--foreground) 50%);
          box-shadow: none;
        }
        
        .theme-preview-live .input:focus {
          outline: 2px solid var(--ring);
          outline-offset: 2px;
          border-color: var(--ring);
        }
        
        .theme-preview-live .input::placeholder {
          color: var(--muted-foreground);
        }
        
        .theme-preview-live .code-sample {
          font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
          background: var(--muted);
          color: var(--muted-foreground);
          padding: 0.75rem;
          border-radius: var(--radius);
          font-size: 0.8rem;
          border: 1px solid var(--border);
          margin: 0.5rem 0;
        }
        
        .theme-preview-live .serif-text {
          font-family: var(--font-serif, 'Merriweather', Georgia, serif);
          font-style: italic;
          color: var(--muted-foreground);
        }
        
        .theme-preview-live .serif-heading {
          font-family: var(--font-serif, 'Merriweather', Georgia, serif);
          font-size: 1.5rem;
          font-weight: 400;
          color: var(--foreground);
          margin: 0 0 0.5rem 0;
          line-height: 1.3;
        }
        
        .theme-preview-live .serif-quote {
          font-family: var(--font-serif, 'Merriweather', Georgia, serif);
          font-size: 1.1rem;
          font-style: italic;
          color: var(--muted-foreground);
          border-left: 3px solid var(--primary);
          padding-left: 1rem;
          margin: 1rem 0;
          line-height: 1.6;
        }
        
        .theme-preview-live .mono-terminal {
          font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
          background: var(--muted);
          color: var(--foreground);
          padding: 1rem;
          border-radius: var(--radius);
          font-size: 0.85rem;
          border: 1px solid var(--border);
          margin: 0.5rem 0;
          white-space: pre;
        }
        
        .theme-preview-live .mono-data {
          font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
          font-size: 0.8rem;
          color: var(--muted-foreground);
          background: var(--card);
          padding: 0.5rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
        }
      `;
            document.head.appendChild(styleElement);
            styleRef.current = styleElement;

            // Load Google Fonts asynchronously (non-blocking)
            const loadFonts = async () => {
                const requiredFonts = extractFontsFromCSS(cssSheet);

                if (requiredFonts.length > 0 && !fontsLoadedRef.current) {
                    try {
                        await loadGoogleFonts(requiredFonts);
                        // eslint-disable-next-line require-atomic-updates
                        fontsLoadedRef.current = true;
                    } catch (error) {
                        console.warn('Failed to load Google Fonts:', error);
                        // Continue without fonts rather than blocking
                    }
                }
            };

            // Start font loading in background
            void loadFonts();
        };

        void setupPreview();

        // Cleanup on unmount
        return () => {
            if (styleRef.current) {
                styleRef.current.remove();
            }
        };
    }, [cssSheet, isDarkMode]);

    const containerStyles = {
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: 'var(--vscode-editor-background)',
    };

    const contentStyles = {
        padding: '16px',
        minHeight: '400px',
    };

    if (!theme) {
        return (
            <div style={containerStyles}>
                <div
                    style={{
                        ...contentStyles,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <span
                        style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '12px' }}
                    >
                        No theme data available
                    </span>
                </div>
            </div>
        );
    }

    const sampleHTML = `
    <nav class="preview-nav">
      <div class="nav-brand">MyApp</div>
      <div class="nav-links">
        <a href="#" class="nav-link active">Home</a>
        <a href="#" class="nav-link">About</a>
        <a href="#" class="nav-link">Contact</a>
        <a href="#" class="nav-link">Blog</a>
      </div>
    </nav>

    <div class="preview-card">
      <h1 class="serif-heading">Design Philosophy</h1>
      <p class="text-muted">This showcase demonstrates how different font families work together to create a cohesive design system.</p>
      
      <div class="serif-quote">
        "Typography is the craft of endowing human language with a durable visual form."
      </div>
      
      <div class="code-sample">const theme = {
  fonts: {
    sans: "Inter, system-ui",
    serif: "Merriweather, Georgia", 
    mono: "JetBrains Mono, monospace"
  }
}</div>
      
      <div class="card-actions">
        <button class="btn btn-primary">Primary Action</button>
        <button class="btn btn-secondary">Secondary</button>
      </div>
    </div>

    <div class="preview-card">
      <h3>Terminal Output</h3>
      <div class="mono-terminal">$ npm run build
✓ Built successfully
  Output: 2.3 MB (gzipped: 847 KB)
  
$ git status
On branch main
Your branch is up to date</div>
      
      <div class="mono-data">
        API Response: 200 OK
        Content-Type: application/json
        Cache-Control: max-age=3600
        X-Rate-Limit: 1000/hour
      </div>
    </div>

    <div class="preview-card">
      <h2 class="serif-heading">Article Preview</h2>
      <p class="serif-text">This is an example of how serif fonts can be used for longer form content, providing excellent readability and a classic, editorial feeling that works well for articles, blog posts, and documentation.</p>
      
      <p class="text-muted">Meanwhile, sans-serif fonts remain perfect for UI elements, navigation, and general interface text where clarity and modern aesthetics are prioritized.</p>
    </div>

    <div class="preview-form">
      <h3>Contact Form</h3>
      <input class="input" placeholder="Enter your name" />
      <textarea class="input" placeholder="Your message..." rows="3"></textarea>
      <div class="card-actions">
        <button class="btn btn-primary">Submit</button>
        <button class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  `;

    return (
        <div style={containerStyles}>
            <div style={contentStyles}>
                <div
                    ref={previewRef}
                    className={`theme-preview-live ${isDarkMode ? 'dark' : ''}`}
                    dangerouslySetInnerHTML={{ __html: sampleHTML }}
                />
            </div>
        </div>
    );
};

export default ThemePreview;
