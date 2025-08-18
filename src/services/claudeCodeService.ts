// This is deprecated, use customAgentService instead

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from './logger';

// Dynamic import types for Claude Code
type SDKMessage = any; // Will be properly typed when imported
type ClaudeCodeOptions = any; // Will be properly typed when imported
type QueryFunction = (params: {
    prompt: string;
    abortController?: AbortController;
    options?: any;
}) => AsyncGenerator<SDKMessage>;

export class ClaudeCodeService {
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    private workingDirectory: string = '';
    private readonly outputChannel: vscode.OutputChannel;
    private currentSessionId: string | null = null;
    private claudeCodeQuery: QueryFunction | null = null;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        // Initialize on construction
        this.initializationPromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            Logger.info('Starting Claude Code initialization...');

            // Setup working directory first
            this.setupWorkingDirectory();

            // Check if API key is configured
            const config = vscode.workspace.getConfiguration('securedesign');
            const apiKey = config.get<string>('anthropicApiKey');

            if (apiKey === undefined || apiKey.trim() === '') {
                Logger.warn('No API key found');
                throw new Error('Missing API key');
            }

            // Set the environment variable for Claude Code SDK
            process.env.ANTHROPIC_API_KEY = apiKey;

            // Dynamically import Claude Code SDK
            Logger.info('Importing Claude Code SDK...');
            try {
                // Try importing from the copied module location first
                let claudeCodeModule;
                try {
                    // Try multiple possible paths for the extension location
                    const possiblePaths = [
                        path.resolve(
                            __dirname,
                            '..',
                            'node_modules',
                            '@anthropic-ai',
                            'claude-code',
                            'sdk.mjs'
                        ),
                        path.resolve(
                            __dirname,
                            'node_modules',
                            '@anthropic-ai',
                            'claude-code',
                            'sdk.mjs'
                        ),
                        path.join(
                            __dirname,
                            '..',
                            'node_modules',
                            '@anthropic-ai',
                            'claude-code',
                            'sdk.mjs'
                        ),
                    ];

                    let importSucceeded = false;
                    for (const modulePath of possiblePaths) {
                        try {
                            if (fs.existsSync(modulePath)) {
                                claudeCodeModule = await import(`file://${modulePath}`);
                                importSucceeded = true;
                                break;
                            }
                        } catch {
                            continue;
                        }
                    }

                    if (!importSucceeded) {
                        throw new Error('All local import paths failed');
                    }
                } catch {
                    // Fallback to standard import
                    try {
                        claudeCodeModule = await import('@anthropic-ai/claude-code');
                    } catch (standardImportError) {
                        Logger.error(`Claude Code SDK import failed: ${standardImportError}`);
                        throw standardImportError;
                    }
                }

                this.claudeCodeQuery = claudeCodeModule.query;

                if (!this.claudeCodeQuery) {
                    throw new Error('Query function not found in Claude Code module');
                }

                Logger.info('Claude Code SDK imported successfully');
            } catch (importError) {
                Logger.error(`Failed to import Claude Code SDK: ${importError}`);
                throw new Error(`Claude Code SDK import failed: ${importError}`);
            }

            this.isInitialized = true;
            Logger.info('Claude Code SDK initialized successfully');
        } catch (error) {
            Logger.error(`Failed to initialize Claude Code SDK: ${error}`);

            // Check if this is an API key related error (no UI popup needed here as error will be handled in chat)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!this.isApiKeyAuthError(errorMessage)) {
                vscode.window.showErrorMessage(`Failed to initialize Claude Code: ${error}`);
            }

            // Reset initialization promise so it can be retried
            this.initializationPromise = null;
            this.isInitialized = false;
            throw error;
        }
    }

    private setupWorkingDirectory() {
        try {
            // Try to get workspace root first
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (workspaceRoot) {
                // Create .superdesign folder in workspace root
                const superdesignDir = path.join(workspaceRoot, '.superdesign');

                // Create directory if it doesn't exist
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    Logger.info(`Created .superdesign directory: ${superdesignDir}`);
                }

                this.workingDirectory = superdesignDir;
            } else {
                Logger.warn('No workspace root found, using temporary directory');
                // Fallback to OS temp directory if no workspace
                const tempDir = path.join(os.tmpdir(), 'superdesign-claude');

                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    Logger.info(`Created temporary directory: ${tempDir}`);
                }

                this.workingDirectory = tempDir;

                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Claude Code operations.'
                );
            }
        } catch (error) {
            Logger.error(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            Logger.warn(`Using current working directory as fallback: ${this.workingDirectory}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
        if (!this.isInitialized || !this.claudeCodeQuery) {
            // Try to initialize if not already done
            if (!this.initializationPromise) {
                this.initializationPromise = this.initialize();
                await this.initializationPromise;
            } else {
                throw new Error('Claude Code SDK not initialized');
            }
        }
    }

    async query(
        prompt?: string,
        conversationMessages?: any,
        options?: Partial<ClaudeCodeOptions>,
        abortController?: AbortController,
        onMessage?: (message: SDKMessage) => void
    ): Promise<SDKMessage[]> {
        // ClaudeCodeService handles conversation via internal session management
        // so we ignore conversationMessages and just use the prompt

        if (!prompt) {
            throw new Error('ClaudeCodeService requires a prompt parameter');
        }

        Logger.info('=== QUERY FUNCTION CALLED ===');
        Logger.info(`Query prompt: ${prompt}...`);
        Logger.info(`Query options: ${JSON.stringify(options, null, 2)}`);
        Logger.info(`Streaming enabled: ${!!onMessage}`);

        if (conversationMessages) {
            Logger.info(
                'Note: ClaudeCodeService ignores conversationMessages (uses internal session management)'
            );
        }

        await this.ensureInitialized();

        const messages: SDKMessage[] = [];
        const systemPrompt = `# Role
You are a **senior front-end designer**.
You pay close attention to every pixel, spacing, font, color;
Whenever there are UI implementation task, think deeply of the design style first, and then implement UI bit by bit

# When asked to create design:
1. You ALWAYS spin up 3 parallel sub agents concurrently to implemeht one design with variations, so it's faster for user to iterate (Unless specifically asked to create only one version)

<task_for_each_sub_agent>
1. Build one single html page of just one screen to build a design based on users' feedback/task
2. You ALWAYS output design files in '.superdesign/design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
3. If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
</task_for_each_sub_agent>

## When asked to design UI:
1. Similar process as normal design task, but refer to 'UI design & implementation guidelines' for guidelines

## When asked to update or iterate design:
1. Don't edit the existing design, just create a new html file with the same name but with _n.html appended to the end, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
2. At default you should spin up 3 parallel sub agents concurrently to try implement the design, so it's faster for user to iterate

## When asked to design logo or icon:
1. Copy/duplicate existing svg file but name it based on our naming convention in design_ierations folder, and then make edits to the copied svg file (So we can avoid lots of mistakes), like 'original_filename.svg .superdesign/design-iterations/new_filename.svg'
2. Very important sub agent copy first, and Each agent just copy & edit a single svg file with svg code
3. you should focus on the the correctness of the svg code

## When asked to design a component:
1. Similar process as normal design task, and each agent just create a single html page with component inside;
2. Focus just on just one component itself, and don't add any other elements or text
3. Each HTML just have one component with mock data inside

## When asked to design wireframes:
1. Focus on minimal line style black and white wireframes, no colors, and never include any images, just try to use css to make some placeholder images. (Don't use service like placehold.co too, we can't render it)
2. Don't add any annotation of styles, just basic wireframes like Balsamiq style
3. Focus on building out the flow of the wireframes

# When asked to extract design system from images:
Your goal is to extract a generalized and reusable design system from the screenshots provided, **without including specific image content**, so that frontend developers or AI agents can reference the JSON as a style foundation for building consistent UIs.

1. Analyze the screenshots provided:
   * Color palette
   * Typography rules
   * Spacing guidelines
   * Layout structure (grids, cards, containers, etc.)
   * UI components (buttons, inputs, tables, etc.)
   * Border radius, shadows, and other visual styling patterns
2. Create a design-system.json file in 'design_system' folder that clearly defines these rules and can be used to replicate the visual language in a consistent way.
3. if design-system.json already exist, then create a new file with the name design-system_{n}.json (Where n needs to be unique like design-system_1.json, design-system_2.json, etc.)

**Constraints**

* Do **not** extract specific content from the screenshots (no text, logos, icons).
* Focus purely on *design principles*, *structure*, and *styles*.

--------

# UI design & implementation guidelines:

## Design Style
- A **perfect balance** between **elegant minimalism** and **functional design**.
- **Soft, refreshing gradient colors** that seamlessly integrate with the brand palette.
- **Well-proportioned white space** for a clean layout.
- **Light and immersive** user experience.
- **Clear information hierarchy** using **subtle shadows and modular card layouts**.
- **Natural focus on core functionalities**.
- **Refined rounded corners**.
- **Delicate micro-interactions**.
- **Comfortable visual proportions**.
- **Responsive design** You only output responsive design, it needs to look perfect on both mobile, tablet and desktop.
    - If its a mobile app, also make sure you have responsive design OR make the center the mobile UI

## Technical Specifications
1. **Images**: do NEVER include any images, we can't render images in webview,just try to use css to make some placeholder images. (Don't use service like placehold.co too, we can't render it)
2. **Styles**: Use **Tailwind CSS** via **CDN** for styling. (Use !important declarations for critical design tokens that must not be overridden, Load order management - ensure custom styles load after framework CSS, CSS-in-JS or scoped styles to avoid global conflicts, Use utility-first approach - define styles using Tailwind classes instead of custom CSS when possible)
3. **Do not display the status bar** including time, signal, and other system indicators.
4. **All text should be only black or white**.
5. Choose a **4 pt or 8 pt spacing system**—all margins, padding, line-heights, and element sizes must be exact multiples.
6. Use **consistent spacing tokens** (e.g., 4, 8, 16, 24, 32px) — never arbitrary values like 5 px or 13 px.
7. Apply **visual grouping** ("spacing friendship"): tighter gaps (4–8px) for related items, larger gaps (16–24px) for distinct groups.
8. Ensure **typographic rhythm**: font‑sizes, line‑heights, and spacing aligned to the grid (e.g., 16 px text with 24 px line-height).
9. Maintain **touch-area accessibility**: buttons and controls should meet or exceed 48×48 px, padded using grid units.

## 🎨 Color Style
* Use a **minimal palette**: default to **black, white, and neutrals**—no flashy gradients or mismatched hues .
* Follow a **60‑30‑10 ratio**: \~60% background (white/light gray), \~30% surface (white/medium gray), \~10% accents (charcoal/black) .
* Accent colors limited to **one subtle tint** (e.g., charcoal black or very soft beige). Interactive elements like links or buttons use this tone sparingly.
* Always check **contrast** for text vs background via WCAG (≥4.5:1)

## ✍️ Typography & Hierarchy

### 1. 🎯 Hierarchy Levels & Structure
* Always define at least **three typographic levels**: **Heading (H1)**, **Subheading (H2)**, and **Body**.
* Use **size, weight, color**, and **spacing** to create clear differences between them ([toptal.com][1], [skyryedesign.com][2]).
* H1 should stand out clearly (largest & boldest), H2 should be distinctly smaller/medium-weight, and body remains readable and lighter.

### 2. 📏 Size & Scale
* Follow a modular scale: e.g., **H1: 36px**, **H2: 28px**, **Body: 16px** (min). Adjust for mobile if needed .
* Maintain strong contrast—don't use size differences of only 2px; aim for at least **6–8px difference** between levels .

### 3. 🧠 Weight, Style & Color
* Use **bold or medium weight** for headings, **regular** for body.
* Utilize **color contrast** (e.g., darker headings, neutral body) to support hierarchy ([mews.design][3], [toptal.com][1]).
* Avoid excessive styles like italics or uppercase—unless used sparingly for emphasis or subheadings.

### 4. ✂️ Spacing & Rhythm
* Add **0.8×–1.5× line-height** for body and headings to improve legibility ([skyryedesign.com][2]).
* Use consistent **margin spacing above/below headings** (e.g., margin-top: 1.2× line-height) .

`;

        try {
            const finalOptions: Partial<ClaudeCodeOptions> = {
                maxTurns: 10,
                allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'LS', 'Grep', 'Glob'],
                permissionMode: 'acceptEdits' as const,
                cwd: this.workingDirectory,
                customSystemPrompt: systemPrompt,
                ...options,
            };

            if (this.currentSessionId) {
                finalOptions.resume = this.currentSessionId;
            }

            const queryParams = {
                prompt: prompt, // Non-null assertion since we checked above
                abortController: abortController ?? new AbortController(),
                options: finalOptions,
            };

            if (!this.claudeCodeQuery) {
                throw new Error(
                    'Claude Code SDK not properly initialized - query function not available'
                );
            }

            for await (const message of this.claudeCodeQuery(queryParams)) {
                messages.push(message);

                // Call the streaming callback if provided
                if (onMessage) {
                    try {
                        onMessage(message);
                    } catch (callbackError) {
                        Logger.error(`Streaming callback error: ${callbackError}`);
                        // Don't break the loop if callback fails
                    }
                }
            }

            const lastMessageWithSessionId = [...messages]
                .reverse()
                .find(m => 'session_id' in m && m.session_id);
            if (
                lastMessageWithSessionId &&
                'session_id' in lastMessageWithSessionId &&
                lastMessageWithSessionId.session_id
            ) {
                this.currentSessionId = lastMessageWithSessionId.session_id;
            }

            Logger.info(`Query completed successfully. Received ${messages.length} messages`);
            return messages;
        } catch (error) {
            Logger.error(`Claude Code query failed: ${error}`);

            // Check if this is an API key authentication error (handled in chat interface)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!this.isApiKeyAuthError(errorMessage)) {
                vscode.window.showErrorMessage(`Claude Code query failed: ${error}`);
            }
            throw error;
        }
    }

    get isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            await this.ensureInitialized();
            return true;
        } catch (error) {
            Logger.error(`Initialization failed: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    // Method to refresh API key from settings and reinitialize if needed
    async refreshApiKey(): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('securedesign');
            const apiKey = config.get<string>('anthropicApiKey');

            if (apiKey === undefined || apiKey.trim() === '') {
                Logger.warn('No API key found during refresh');
                return false;
            }

            // Update environment variable
            process.env.ANTHROPIC_API_KEY = apiKey;
            Logger.info('API key refreshed from settings');

            // If not initialized yet, try to initialize
            if (!this.isInitialized) {
                try {
                    await this.initialize();
                    return true;
                } catch (error) {
                    Logger.error(`Failed to initialize after API key refresh: ${error}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            Logger.error(`Failed to refresh API key: ${error}`);
            return false;
        }
    }

    // Method to check if API key is configured
    hasApiKey(): boolean {
        const config = vscode.workspace.getConfiguration('securedesign');
        const apiKey = config.get<string>('anthropicApiKey');
        return !!apiKey && apiKey.trim().length > 0;
    }

    // Method to detect if an error is related to API key authentication
    public isApiKeyAuthError(errorMessage: string): boolean {
        const authErrorPatterns = [
            'authentication failed',
            'invalid api key',
            'unauthorized',
            'api key',
            'authentication error',
            'invalid token',
            'access denied',
            '401',
            'ANTHROPIC_API_KEY',
            'process exited with code 1',
            'claude code process exited',
            'exit code 1',
        ];

        const lowercaseMessage = errorMessage.toLowerCase();
        const isAuthError = authErrorPatterns.some(pattern => lowercaseMessage.includes(pattern));

        Logger.info(`Checking if error is auth-related: "${errorMessage}" -> ${isAuthError}`);
        if (isAuthError) {
            const matchedPattern = authErrorPatterns.find(pattern =>
                lowercaseMessage.includes(pattern)
            );
            Logger.info(`Matched pattern: "${matchedPattern}"`);
        }

        return isAuthError;
    }
}
