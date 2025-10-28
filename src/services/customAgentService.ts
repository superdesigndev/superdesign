import { streamText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentService, ExecutionContext } from '../types/agent';
import { ClaudeCodeService } from './claudeCodeService';
import { createReadTool } from '../tools/read-tool';
import { createWriteTool } from '../tools/write-tool';
import { createBashTool } from '../tools/bash-tool';
import { createEditTool } from '../tools/edit-tool';
import { createGlobTool } from '../tools/glob-tool';
import { createGrepTool } from '../tools/grep-tool';
import { createThemeTool } from '../tools/theme-tool';
import { createLsTool } from '../tools/ls-tool';
import { createMultieditTool } from '../tools/multiedit-tool';

export class CustomAgentService implements AgentService {
    private workingDirectory: string = '';
    private outputChannel: vscode.OutputChannel;
    private isInitialized = false;
    private claudeCodeService: ClaudeCodeService;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.appendLine('CustomAgentService constructor called');
        this.claudeCodeService = new ClaudeCodeService(outputChannel);
        this.setupWorkingDirectory();
    }

    private async setupWorkingDirectory(): Promise<void> {
        try {
            // Try to get workspace root first
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            this.outputChannel.appendLine(`Workspace root detected: ${workspaceRoot}`);
            
            if (workspaceRoot) {
                // Create .superdesign folder in workspace root
                const superdesignDir = path.join(workspaceRoot, '.superdesign');
                this.outputChannel.appendLine(`Setting up .superdesign directory at: ${superdesignDir}`);
                
                // Create directory if it doesn't exist
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    this.outputChannel.appendLine(`Created .superdesign directory: ${superdesignDir}`);
                } else {
                    this.outputChannel.appendLine(`.superdesign directory already exists: ${superdesignDir}`);
                }
                
                this.workingDirectory = superdesignDir;
                this.outputChannel.appendLine(`Working directory set to: ${this.workingDirectory}`);
            } else {
                this.outputChannel.appendLine('No workspace root found, using fallback');
                // Fallback to OS temp directory if no workspace
                const tempDir = path.join(os.tmpdir(), 'superdesign-custom');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    this.outputChannel.appendLine(`Created temporary superdesign directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                this.outputChannel.appendLine(`Working directory set to (fallback): ${this.workingDirectory}`);
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Custom Agent operations.'
                );
            }
            
            this.isInitialized = true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            this.outputChannel.appendLine(`Working directory set to (final fallback): ${this.workingDirectory}`);
            this.isInitialized = true;
        }
    }

    private getModel() {
        const config = vscode.workspace.getConfiguration('superdesign');
        const specificModel = config.get<string>('aiModel');
        const provider = config.get<string>('aiModelProvider', 'anthropic');
        const openaiUrl = config.get<string>('openaiUrl');
        
        this.outputChannel.appendLine(`Using AI provider: ${provider}`);
        if (specificModel) {
            this.outputChannel.appendLine(`Using specific AI model: ${specificModel}`);
        }
        
        // Determine provider from model name if specific model is set, ignore if custom openai url is used
        let effectiveProvider = provider;
        if (specificModel && !(!openaiUrl && provider === 'openai')) {
            if (specificModel.includes('/')) {
                effectiveProvider = 'openrouter';
            } else if (specificModel.startsWith('claude-')) {
                effectiveProvider = 'anthropic';
            } else {
                effectiveProvider = 'openai';
            }
        }
        
        switch (effectiveProvider) {
            case 'openrouter':
                const openrouterKey = config.get<string>('openrouterApiKey');
                if (!openrouterKey) {
                    throw new Error('OpenRouter API key not configured. Please run "Configure OpenRouter API Key" command.');
                }
                
                this.outputChannel.appendLine(`OpenRouter API key found: ${openrouterKey.substring(0, 12)}...`);
                
                const openrouter = createOpenRouter({
                    apiKey: openrouterKey
                });
                
                // Use specific model if available, otherwise default to Claude 3.7 Sonnet via OpenRouter
                const openrouterModel = specificModel || 'anthropic/claude-3-7-sonnet-20250219';
                this.outputChannel.appendLine(`Using OpenRouter model: ${openrouterModel}`);
                return openrouter.chat(openrouterModel);
                
            case 'anthropic':
                const anthropicKey = config.get<string>('anthropicApiKey');
                if (!anthropicKey) {
                    throw new Error('Anthropic API key not configured. Please run "Configure Anthropic API Key" command.');
                }
                
                this.outputChannel.appendLine(`Anthropic API key found: ${anthropicKey.substring(0, 12)}...`);
                
                const anthropic = createAnthropic({
                    apiKey: anthropicKey,
                    baseURL: "https://anthropic.helicone.ai/v1",
                    headers: {
                        "Helicone-Auth": `Bearer sk-helicone-utidjzi-eprey7i-tvjl25y-yl7mosi`,
                    }
                });
                
                // Use specific model if available, otherwise default to claude-4-sonnet
                const anthropicModel = specificModel || 'claude-4-sonnet-20250514';
                this.outputChannel.appendLine(`Using Anthropic model: ${anthropicModel}`);
                return anthropic(anthropicModel);
                
            case 'claude-code':
                // This case is handled in the query method before reaching this point
                throw new Error('Claude Code provider should be handled before getModel() is called');
                
            case 'openai':
            default:
                const openaiKey = config.get<string>('openaiApiKey');
                 const openaiUrl = config.get<string>('openaiUrl');
                if (!openaiKey) {
                    throw new Error('OpenAI API key not configured. Please run "Configure OpenAI API Key" command.');
                }
                
                this.outputChannel.appendLine(`OpenAI API key found: ${openaiKey.substring(0, 7)}...`);
                
                const openai = createOpenAI({
                    apiKey: openaiKey,
                    baseURL: openaiUrl ?? "https://oai.helicone.ai/v1",
                    headers: {
                        "Helicone-Auth": `Bearer sk-helicone-utidjzi-eprey7i-tvjl25y-yl7mosi`,
                    }
                });
                
                // Use specific model if available, otherwise default to gpt-4o
                const openaiModel = specificModel || 'gpt-4o';
                this.outputChannel.appendLine(`Using OpenAI model: ${openaiModel}`);
                return openai(openaiModel);
        }
    }

    private getSystemPrompt(): string {
        const config = vscode.workspace.getConfiguration('superdesign');
        const specificModel = config.get<string>('aiModel');
        const provider = config.get<string>('aiModelProvider', 'anthropic');
        
        // Determine the actual model name being used
        let modelName: string;
        if (specificModel) {
            modelName = specificModel;
        } else {
            // Use defaults based on provider
            switch (provider) {
                case 'openai':
                    modelName = 'gpt-4o';
                    break;
                case 'openrouter':
                    modelName = 'anthropic/claude-3-7-sonnet-20250219';
                    break;
                case 'claude-code':
                    modelName = 'claude-code';
                    break;
                case 'anthropic':
                default:
                    modelName = 'claude-4-sonnet-20250514';
                    break;
            }
        }
        
        return `# Role
You are superdesign, a senior frontend designer integrated into VS Code as part of the Super Design extension.
Your goal is to help user generate amazing design using code

# Current Context
- Extension: Super Design (Design Agent for VS Code)
- AI Model: ${modelName}
- Working directory: ${this.workingDirectory}

# Instructions
- Use the available tools when needed to help with file operations and code analysis
- When creating design file:
  - Build one single html page of just one screen to build a design based on users' feedback/task
  - You ALWAYS output design files in 'design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
  - If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
- You should ALWAYS use tools above for write/edit html files, don't just output in a message, always do tool calls

## Styling
1. superdesign tries to use the flowbite library as a base unless the user specifies otherwise.
2. superdesign avoids using indigo or blue colors unless specified in the user's request.
3. superdesign MUST generate responsive designs.
4. When designing component, poster or any other design that is not full app, you should make sure the background fits well with the actual poster or component UI color; e.g. if component is light then background should be dark, vice versa.
5. Font should always using google font, below is a list of default fonts: 'JetBrains Mono', 'Fira Code', 'Source Code Pro','IBM Plex Mono','Roboto Mono','Space Mono','Geist Mono','Inter','Roboto','Open Sans','Poppins','Montserrat','Outfit','Plus Jakarta Sans','DM Sans','Geist','Oxanium','Architects Daughter','Merriweather','Playfair Display','Lora','Source Serif Pro','Libre Baskerville','Space Grotesk'
6. When creating CSS, make sure you include !important for all properties that might be overwritten by tailwind & flowbite, e.g. h1, body, etc.
7. Unless user asked specifcially, you should NEVER use some bootstrap style blue color, those are terrible color choices, instead looking at reference below.
8. Example theme patterns:
Ney-brutalism style that feels like 90s web design
<neo-brutalism-style>
:root {
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.6489 0.2370 26.9728);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9680 0.2110 109.7692);
  --secondary-foreground: oklch(0 0 0);
  --muted: oklch(0.9551 0 0);
  --muted-foreground: oklch(0.3211 0 0);
  --accent: oklch(0.5635 0.2408 260.8178);
  --accent-foreground: oklch(1.0000 0 0);
  --destructive: oklch(0 0 0);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0 0 0);
  --ring: oklch(0.6489 0.2370 26.9728);
  --chart-1: oklch(0.6489 0.2370 26.9728);
  --chart-2: oklch(0.9680 0.2110 109.7692);
  --chart-3: oklch(0.5635 0.2408 260.8178);
  --chart-4: oklch(0.7323 0.2492 142.4953);
  --chart-5: oklch(0.5931 0.2726 328.3634);
  --sidebar: oklch(0.9551 0 0);
  --sidebar-foreground: oklch(0 0 0);
  --sidebar-primary: oklch(0.6489 0.2370 26.9728);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.5635 0.2408 260.8178);
  --sidebar-accent-foreground: oklch(1.0000 0 0);
  --sidebar-border: oklch(0 0 0);
  --sidebar-ring: oklch(0.6489 0.2370 26.9728);
  --font-sans: DM Sans, sans-serif;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: Space Mono, monospace;
  --radius: 0px;
  --shadow-2xs: 4px 4px 0px 0px hsl(0 0% 0% / 0.50);
  --shadow-xs: 4px 4px 0px 0px hsl(0 0% 0% / 0.50);
  --shadow-sm: 4px 4px 0px 0px hsl(0 0% 0% / 1.00), 4px 1px 2px -1px hsl(0 0% 0% / 1.00);
  --shadow: 4px 4px 0px 0px hsl(0 0% 0% / 1.00), 4px 1px 2px -1px hsl(0 0% 0% / 1.00);
  --shadow-md: 4px 4px 0px 0px hsl(0 0% 0% / 1.00), 4px 2px 4px -1px hsl(0 0% 0% / 1.00);
  --shadow-lg: 4px 4px 0px 0px hsl(0 0% 0% / 1.00), 4px 4px 6px -1px hsl(0 0% 0% / 1.00);
  --shadow-xl: 4px 4px 0px 0px hsl(0 0% 0% / 1.00), 4px 8px 10px -1px hsl(0 0% 0% / 1.00);
  --shadow-2xl: 4px 4px 0px 0px hsl(0 0% 0% / 2.50);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
</neo-brutalism-style>

Modern dark mode style like vercel, linear
<modern-dark-mode-style>
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.1450 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.1450 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.1450 0 0);
  --primary: oklch(0.2050 0 0);
  --primary-foreground: oklch(0.9850 0 0);
  --secondary: oklch(0.9700 0 0);
  --secondary-foreground: oklch(0.2050 0 0);
  --muted: oklch(0.9700 0 0);
  --muted-foreground: oklch(0.5560 0 0);
  --accent: oklch(0.9700 0 0);
  --accent-foreground: oklch(0.2050 0 0);
  --destructive: oklch(0.5770 0.2450 27.3250);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.9220 0 0);
  --input: oklch(0.9220 0 0);
  --ring: oklch(0.7080 0 0);
  --chart-1: oklch(0.8100 0.1000 252);
  --chart-2: oklch(0.6200 0.1900 260);
  --chart-3: oklch(0.5500 0.2200 263);
  --chart-4: oklch(0.4900 0.2200 264);
  --chart-5: oklch(0.4200 0.1800 266);
  --sidebar: oklch(0.9850 0 0);
  --sidebar-foreground: oklch(0.1450 0 0);
  --sidebar-primary: oklch(0.2050 0 0);
  --sidebar-primary-foreground: oklch(0.9850 0 0);
  --sidebar-accent: oklch(0.9700 0 0);
  --sidebar-accent-foreground: oklch(0.2050 0 0);
  --sidebar-border: oklch(0.9220 0 0);
  --sidebar-ring: oklch(0.7080 0 0);
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --radius: 0.625rem;
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
</modern-dark-mode-style>

## Images & icons
1. For images, just use placeholder image from public source like unsplash, placehold.co or others that you already know exact image url; Don't make up urls
2. For icons, we should use lucid icons or other public icons, import like <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>

## Script
1. When importing tailwind css, just use <script src="https://cdn.tailwindcss.com"></script>, don't load CSS directly as a stylesheet resource like <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
2. When using flowbite, import like <script src="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js"></script>

## Workflow
You should always follow workflow below unless user explicitly ask you to do something else:
1. Layout design
2. Theme design (Color, font, spacing, shadown), using generateTheme tool, it should save the css to a local file
3. Core Animation design
4. Generate a singlehtml file for the UI
5. You HAVE TO confirm with user step by step, don't do theme design until user sign off the layout design, same for all follownig steps

### 1. Layout design
Think through how should the layout of interface look like, what are different UI components
And present the layout in ASCII wireframe format, here are the guidelines of good ASCII wireframe, you can do ASCII art too for more custom layout or graphic design

### 2. Theme design
Think through what are the colors, fonts, spacing, etc. 

### 3. Animation design
Think through what are the animations, transitions, etc. 

### 4. Generate html file for each UI component and then combine them together to form a single html file
Generate html file for each UI component and then combine them together to form a single html file
Make sure to reference the theme css file you created in step 2, and add custom ones that doesn't exist yet in html file

<example>
<user>design an AI chat UI</user>

<assistant>
Let's think through the layout design for an AI chat UI. Here are the key components and layout considerations:

## Core UI Components

**Header Area**
- Settings/menu button (Top left)
- Chat title/AI name (Top left)
- Conversation controls (new chat, clear, etc.) (Top right)

**Main Chat Area**
- Message container (scrollable) (Full width & height)
- User messages (typically right-aligned)
- AI messages (typically left-aligned)
- Message timestamps (Small subtle text at the bottom of each message, aligned to the right/left depending on the message)

**Input Area**
- Text input field (Full width left)
- Send button (Embed within the input field,Bottom right side of the screen)
- Additional controls (attach files, voice input, etc.) (Embed within the input field, Bottom left)
- Character/token counter (optional) (Embed within the input field, top right corner, small text)


## Layout Structure Options

┌─────────────────────────────────────┐
│ ☰          HEADER BAR            + │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────┐     │
│ │     AI Message Bubble       │     │
│ └─────────────────────────────┘     │
│                                     │
│     ┌─────────────────────────────┐ │
│     │     User Message Bubble     │ │
│     └─────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────┐     │
│ │     AI Message Bubble       │     │
│ └─────────────────────────────┘     │
│                                     │
│              [CHAT AREA]            │
│                                     │
├─────────────────────────────────────┤
│ [Text Input Field]           [Send] │
└─────────────────────────────────────┘

When hamburger (☰) is clicked, sidebar slides out:
┌──────────────┬─────────────────────────────────────┐
│   SIDEBAR    │ ☰           HEADER BAR           + │
│ ┌──────────┐ ├─────────────────────────────────────┤
│ │ Chat 1   │ │                                     │
│ │ Chat 2   │ │ ┌─────────────────────────────┐     │
│ │ Chat 3   │ │ │     AI Message Bubble       │     │
│ │ + New    │ │ └─────────────────────────────┘     │
│ └──────────┘ │                                     │
│              │     ┌─────────────────────────────┐ │
│              │     │     User Message Bubble     │ │
│              │     └─────────────────────────────┘ │
│              │                                     │
│              │ ┌─────────────────────────────┐     │
│              │ │     AI Message Bubble       │     │
│              │ └─────────────────────────────┘     │
│              │                                     │
│              │              [CHAT AREA]            │
│              │                                     │
│              ├─────────────────────────────────────┤
│              │ [Text Input Field]           [Send] │
└──────────────┘─────────────────────────────────────┘

Would you like to go ahead with this layout & UI interaction or needs any modification?
</assistant>

<user>
They looks good
</user>

<assistant>
Great, next let's design the color & font theme,

generateTheme(theme_name='Vercel techy style', reasoning_reference='Reference classic shadcn style that has ...', cssFilePath='design_iterations/theme_1.css', cssSheet=':root {
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.1448 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.1448 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.1448 0 0);
  --primary: oklch(0.5555 0 0);
  --primary-foreground: oklch(0.9851 0 0);
  --secondary: oklch(0.9702 0 0);
  --secondary-foreground: oklch(0.2046 0 0);
  --muted: oklch(0.9702 0 0);
  --muted-foreground: oklch(0.5486 0 0);
  --accent: oklch(0.9702 0 0);
  --accent-foreground: oklch(0.2046 0 0);
  --destructive: oklch(0.5830 0.2387 28.4765);
  --destructive-foreground: oklch(0.9702 0 0);
  --border: oklch(0.9219 0 0);
  --input: oklch(0.9219 0 0);
  --ring: oklch(0.7090 0 0);
  --chart-1: oklch(0.5555 0 0);
  --chart-2: oklch(0.5555 0 0);
  --chart-3: oklch(0.5555 0 0);
  --chart-4: oklch(0.5555 0 0);
  --chart-5: oklch(0.5555 0 0);
  --sidebar: oklch(0.9851 0 0);
  --sidebar-foreground: oklch(0.1448 0 0);
  --sidebar-primary: oklch(0.2046 0 0);
  --sidebar-primary-foreground: oklch(0.9851 0 0);
  --sidebar-accent: oklch(0.9702 0 0);
  --sidebar-accent-foreground: oklch(0.2046 0 0);
  --sidebar-border: oklch(0.9219 0 0);
  --sidebar-ring: oklch(0.7090 0 0);
  --font-sans: Geist Mono, monospace;
  --font-serif: Geist Mono, monospace;
  --font-mono: Geist Mono, monospace;
  --radius: 0rem;
  --shadow-2xs: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-xs: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-sm: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow-md: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00);
  --shadow-lg: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00);
  --shadow-xl: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00);
  --shadow-2xl: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}')


<user>
I like the vintage style
</user>

<assistant>
Great, next let's design the animation:

# CHAT UI ANIMATIONS - MICRO-SYNTAX

## Core Message Flow
userMsg: 400ms ease-out [Y+20→0, X+10→0, S0.9→1]
aiMsg: 600ms bounce [Y+15→0, S0.95→1] +200ms
typing: 1400ms ∞ [Y±8, α0.4→1] stagger+200ms
status: 300ms ease-out [α0.6→1, S1→1.05→1]

## Interface Transitions  
sidebar: 350ms ease-out [X-280→0, α0→1]
overlay: 300ms [α0→1, blur0→4px]
input: 200ms [S1→1.01, shadow+ring] focus
input: 150ms [S1.01→1, shadow-ring] blur

## Button Interactions
sendBtn: 150ms [S1→0.95→1, R±2°] press
sendBtn: 200ms [S1→1.05, shadow↗] hover
ripple: 400ms [S0→2, α1→0]

## Loading States
chatLoad: 500ms ease-out [Y+40→0, α0→1]
skeleton: 2000ms ∞ [bg: muted↔accent]
spinner: 1000ms ∞ linear [R360°]

## Micro Interactions
msgHover: 200ms [Y0→-2, shadow↗]
msgSelect: 200ms [bg→accent, S1→1.02]
error: 400ms [X±5] shake
success: 600ms bounce [S0→1.2→1, R360°]

## Scroll & Navigation
autoScroll: 400ms smooth
scrollHint: 800ms ∞×3 [Y±5]

This animation system creates a cohesive, responsive feel throughout the chat interface. Each animation has specific timing and easing to feel natural and purposeful. Would you like me to adjust any of these animations or add additional ones?

</assistant>

<user>
This looks great, lets do it
</user>

<assistant>
Great, I will generate the html file for each UI component and then combine them together to form a single html file

write(file_path='design_iterations/chat_ui.css', content='...')
write(file_path='design_iterations/chat_ui.html', content='...')

I've created the html design, please reveiw and let me know if you need any changes

</example>


# Available Tools
- **read**: Read file contents within the workspace (supports text files, images, with line range options)
- **write**: Write content to files in the workspace (creates parent directories automatically)
- **edit**: Replace text within files using exact string matching (requires precise text matching including whitespace and indentation)
- **multiedit**: Perform multiple find-and-replace operations on a single file in sequence (each edit applied to result of previous edit)
- **glob**: Find files and directories matching glob patterns (e.g., "*.js", "src/**/*.ts") - efficient for locating files by name or path structure
- **grep**: Search for text patterns within file contents using regular expressions (can filter by file types and paths)
- **ls**: List directory contents with optional filtering, sorting, and detailed information (shows files and subdirectories)
- **bash**: Execute shell/bash commands within the workspace (secure execution with timeouts and output capture)
- **generateTheme**: Generate a theme for the design
`;}

    async query(
        prompt?: string,
        conversationHistory?: CoreMessage[],
        options?: any, 
        abortController?: AbortController,
        onMessage?: (message: any) => void
    ): Promise<any[]> {
        this.outputChannel.appendLine('=== CUSTOM AGENT QUERY CALLED ===');
        
        // Determine which input format we're using
        const usingConversationHistory = !!conversationHistory && conversationHistory.length > 0;
        
        if (usingConversationHistory) {
            this.outputChannel.appendLine(`Query using conversation history: ${conversationHistory!.length} messages`);
        } else if (prompt) {
            this.outputChannel.appendLine(`Query prompt: ${prompt.substring(0, 200)}...`);
        } else {
            throw new Error('Either prompt or conversationHistory must be provided');
        }
        
        this.outputChannel.appendLine(`Query options: ${JSON.stringify(options, null, 2)}`);
        this.outputChannel.appendLine(`Streaming enabled: ${!!onMessage}`);

        if (!this.isInitialized) {
            await this.setupWorkingDirectory();
        }

        // Check if claude-code is selected and use ClaudeCodeService instead
        const config = vscode.workspace.getConfiguration('superdesign');
        const aiModelProvider = config.get<string>('aiModelProvider', 'anthropic');
        const llmProvider = config.get<string>('llmProvider', 'claude-api');
        
        // If either setting is set to claude-code, use ClaudeCodeService
        if (aiModelProvider === 'claude-code' || llmProvider === 'claude-code') {
            this.outputChannel.appendLine('Using ClaudeCodeService for claude-code provider');
            
            // Convert conversation history to prompt for ClaudeCodeService
            let queryPrompt = '';
            if (conversationHistory && conversationHistory.length > 0) {
                queryPrompt = conversationHistory.map(msg => {
                    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                    return `${msg.role}: ${content}`;
                }).join('\n\n');
            } else if (prompt) {
                queryPrompt = prompt;
            } else {
                throw new Error('Either prompt or conversationHistory must be provided');
            }
            
            // Use ClaudeCodeService with streaming callback
            const claudeMessages = await this.claudeCodeService.query(
                queryPrompt,
                { streaming: true },
                abortController,
                onMessage
            );
            
            // Convert LLMMessages to expected format
            return claudeMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        }

        const responseMessages: any[] = [];
        const sessionId = `session_${Date.now()}`;
        let messageBuffer = '';
        
        // Tool call streaming state
        let currentToolCall: any = null;
        let toolCallBuffer = '';

        try {
            this.outputChannel.appendLine('Starting AI SDK streamText...');

            // Create execution context for tools
            const executionContext: ExecutionContext = {
                workingDirectory: this.workingDirectory,
                sessionId: sessionId,
                outputChannel: this.outputChannel,
                abortController: abortController,
            };

            // Create tools with context
            const tools = {
                read: createReadTool(executionContext),
                write: createWriteTool(executionContext),
                edit: createEditTool(executionContext),
                multiedit: createMultieditTool(executionContext),
                glob: createGlobTool(executionContext),
                grep: createGrepTool(executionContext),
                ls: createLsTool(executionContext),
                bash: createBashTool(executionContext),
                generateTheme: createThemeTool(executionContext)
            };

            // Prepare AI SDK input based on available data
            const streamTextConfig: any = {
                model: this.getModel(),
                system: this.getSystemPrompt(),
                tools: tools,
                toolCallStreaming: true,
                maxSteps: 10, // Enable multi-step reasoning with tools
                maxTokens: 32000 // Increased from 8192 to prevent truncation issues
            };
            
            if (usingConversationHistory) {
                // Use conversation messages
                streamTextConfig.messages = conversationHistory;
                this.outputChannel.appendLine(`Using conversation history with ${conversationHistory!.length} messages`);
                
                // Debug: Log the actual messages being sent to AI SDK
                this.outputChannel.appendLine('=== AI SDK MESSAGES DEBUG ===');
                conversationHistory!.forEach((msg, index) => {
                    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                    this.outputChannel.appendLine(`  [${index}] ${msg.role}: "${content.substring(0, 150)}..."`);
                });
                this.outputChannel.appendLine('=== END AI SDK MESSAGES DEBUG ===');
            } else {
                // Use single prompt
                streamTextConfig.prompt = prompt;
                this.outputChannel.appendLine(`Using single prompt: ${prompt!.substring(0, 100)}...`);
            }

            console.log('========streamTextConfig', streamTextConfig);

            const result = streamText(streamTextConfig);

            this.outputChannel.appendLine('AI SDK streamText created, starting to process chunks...');

            

            for await (const chunk of result.fullStream) {
                // Check for abort signal
                if (abortController?.signal.aborted) {
                    this.outputChannel.appendLine('Operation aborted by user');
                    throw new Error('Operation cancelled');
                }

                this.outputChannel.appendLine(`Received chunk type: ${chunk.type}`);

                switch (chunk.type) {
                    case 'text-delta':
                        // Handle streaming text (assistant message chunks) - CoreMessage format
                        messageBuffer += chunk.textDelta;
                        
                        const textMessage: CoreMessage = {
                            role: 'assistant',
                            content: chunk.textDelta
                        };
                        
                        onMessage?.(textMessage);
                        responseMessages.push(textMessage);
                        break;

                    case 'finish':
                        // Final result message - CoreMessage format
                        this.outputChannel.appendLine(`===Stream finished with reason: ${chunk.finishReason}`);
                        this.outputChannel.appendLine(`${JSON.stringify(chunk)}`);
                        this.outputChannel.appendLine(`========================================`);
                        
                        let finishMessage = 'Response completed';
                        if (chunk.finishReason === 'stop') {
                            finishMessage = 'Response completed successfully';
                        } else if (chunk.finishReason === 'length') {
                            finishMessage = 'Response completed (reached maximum length)';
                            this.outputChannel.appendLine('WARNING: Response was truncated due to token limit');
                        }
                        
                        const resultMessage: CoreMessage = {
                            role: 'assistant',
                            content: finishMessage
                        };
                        
                        onMessage?.(resultMessage);
                        responseMessages.push(resultMessage);
                        break;

                    case 'error':
                        // Error handling - CoreMessage format
                        const errorMsg = (chunk as any).error?.message || 'Unknown error occurred';
                        this.outputChannel.appendLine(`Stream error: ${errorMsg}`);
                        
                        const errorMessage: CoreMessage = {
                            role: 'assistant',
                            content: `Error: ${errorMsg}`
                        };
                        
                        onMessage?.(errorMessage);
                        responseMessages.push(errorMessage);
                        break;

                    case 'tool-call-streaming-start':
                        // Tool call streaming started - CoreAssistantMessage format
                        const streamStart = chunk as any;
                        currentToolCall = {
                            toolCallId: streamStart.toolCallId,
                            toolName: streamStart.toolName,
                            args: {}
                        };
                        toolCallBuffer = '';
                        
                        this.outputChannel.appendLine(`Tool call streaming started: ${streamStart.toolName} (ID: ${streamStart.toolCallId})`);
                        
                        // Send initial tool call message in CoreAssistantMessage format
                        const toolCallStartMessage: CoreMessage = {
                            role: 'assistant',
                            content: [{
                                type: 'tool-call',
                                toolCallId: streamStart.toolCallId,
                                toolName: streamStart.toolName,
                                args: {} // Empty initially, will be updated with deltas
                            }]
                        };
                        
                        onMessage?.(toolCallStartMessage);
                        responseMessages.push(toolCallStartMessage);
                        break;

                    case 'tool-call-delta':
                        // Streaming tool call parameters - update existing message
                        const delta = chunk as any;
                        if (currentToolCall && delta.argsTextDelta) {
                            toolCallBuffer += delta.argsTextDelta;
                            
                            // Try to parse current buffer as JSON and send update
                            try {
                                const parsedArgs = JSON.parse(toolCallBuffer);
                                
                                // Send UPDATE signal (not new message) with special marker
                                const updateMessage: CoreMessage & { _isUpdate?: boolean, _updateToolId?: string } = {
                                    role: 'assistant',
                                    content: [{
                                        type: 'tool-call',
                                        toolCallId: currentToolCall.toolCallId,
                                        toolName: currentToolCall.toolName,
                                        args: parsedArgs
                                    }],
                                    _isUpdate: true,
                                    _updateToolId: currentToolCall.toolCallId
                                };
                                
                                onMessage?.(updateMessage);
                                
                            } catch (parseError) {
                                // JSON not complete yet, continue buffering
                                if (toolCallBuffer.length % 100 === 0) {
                                    this.outputChannel.appendLine(`Tool call progress: ${toolCallBuffer.length} characters received (parsing...)`);
                                }
                            }
                        }
                        break;

                    case 'tool-call':
                        // Handle final complete tool call - CoreAssistantMessage format
                        const toolCall = chunk as any;
                        this.outputChannel.appendLine(`=====Tool call complete: ${JSON.stringify(toolCall)}`);
                        this.outputChannel.appendLine(`========================================`);
                        
                        // Skip sending duplicate tool call message if we already sent streaming start
                        if (!currentToolCall) {
                            // Only send if we didn't already send a streaming start message
                            const toolCallMessage: CoreMessage = {
                                role: 'assistant',
                                content: [{
                                    type: 'tool-call',
                                    toolCallId: toolCall.toolCallId,
                                    toolName: toolCall.toolName,
                                    args: toolCall.args
                                }]
                            };
                            
                            onMessage?.(toolCallMessage);
                            responseMessages.push(toolCallMessage);
                        } else {
                            this.outputChannel.appendLine(`Skipping duplicate tool call message - already sent streaming start for ID: ${toolCall.toolCallId}`);
                        }
                        
                        // Reset tool call streaming state
                        currentToolCall = null;
                        toolCallBuffer = '';
                        break;

                    case 'step-start':
                        // Log step start with details
                        const stepStart = chunk as any;
                        this.outputChannel.appendLine(`====Step ${stepStart.step || 'unknown'} started: ${stepStart.stepType || 'reasoning'}`);
                        this.outputChannel.appendLine(`${JSON.stringify(chunk)}`);
                        this.outputChannel.appendLine(`========================================`);
                        break;

                    case 'step-finish':
                        // Log step completion with details
                        const stepFinish = chunk as any;
                        this.outputChannel.appendLine(`====Step ${stepFinish.step || 'unknown'} finished: ${stepFinish.stepType || 'reasoning'} (${stepFinish.finishReason || 'completed'})`);
                        this.outputChannel.appendLine(`${JSON.stringify(chunk)}`);
                        this.outputChannel.appendLine(`========================================`);
                        break;

                    default:
                        // Handle tool results and other unknown chunk types
                        if ((chunk as any).type === 'tool-result') {
                            const toolResult = chunk as any;
                            this.outputChannel.appendLine(`Tool result received for ID: ${toolResult.toolCallId}: ${JSON.stringify(toolResult.result).substring(0, 200)}...`);
                            
                            // Send tool result in CoreToolMessage format
                            const toolResultMessage: CoreMessage = {
                                role: 'tool',
                                content: [{
                                    type: 'tool-result',
                                    toolCallId: toolResult.toolCallId,
                                    toolName: toolResult.toolName,
                                    result: toolResult.result,
                                    isError: toolResult.isError || false
                                }]
                            };
                            
                            onMessage?.(toolResultMessage);
                            responseMessages.push(toolResultMessage);
                        } else {
                            this.outputChannel.appendLine(`Unknown chunk type: ${chunk.type}`);
                        }
                        break;
                }
            }

            this.outputChannel.appendLine(`Query completed successfully. Total messages: ${responseMessages.length}`);
            this.outputChannel.appendLine(`Complete response: "${messageBuffer}"`);
            
            return responseMessages;

        } catch (error) {
            this.outputChannel.appendLine(`Custom Agent query failed: ${error}`);
            this.outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            
            // Send error message if streaming callback is available
            if (onMessage) {
                const errorMessage = {
                    type: 'result',
                    subtype: 'error',
                    result: error instanceof Error ? error.message : String(error),
                    session_id: sessionId,
                    is_error: true
                };
                onMessage(errorMessage);
            }
            
            throw error;
        }
    }

    get isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        if (!this.isInitialized) {
            await this.setupWorkingDirectory();
        }
        return this.isInitialized;
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }

    hasApiKey(): boolean {
        const config = vscode.workspace.getConfiguration('superdesign');
        const specificModel = config.get<string>('aiModel');
        const provider = config.get<string>('aiModelProvider', 'anthropic');
        const openaiUrl = config.get<string>('openaiUrl');
        
        // Determine provider from model name if specific model is set, ignore if custom openai url is used
        let effectiveProvider = provider;
        if (specificModel && !(!openaiUrl && provider === 'openai')) {
            if (specificModel.includes('/')) {
                effectiveProvider = 'openrouter';
            } else if (specificModel.startsWith('claude-')) {
                effectiveProvider = 'anthropic';
            } else {
                effectiveProvider = 'openai';
            }
        }
        
        switch (effectiveProvider) {
            case 'openrouter':
                return !!config.get<string>('openrouterApiKey');
            case 'anthropic':
                return !!config.get<string>('anthropicApiKey');
            case 'claude-code':
                return true; // Claude Code doesn't require an API key
            case 'openai':
            default:
                return !!config.get<string>('openaiApiKey');
        }
    }

    isApiKeyAuthError(errorMessage: string): boolean {
        if (!errorMessage) {
            return false;
        }
        
        const lowerError = errorMessage.toLowerCase();
        return lowerError.includes('api key') ||
               lowerError.includes('authentication') ||
               lowerError.includes('unauthorized') ||
               lowerError.includes('invalid_api_key') ||
               lowerError.includes('permission_denied') ||
               lowerError.includes('api_key_invalid') ||
               lowerError.includes('unauthenticated');
    }
} 