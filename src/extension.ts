// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CustomAgentService } from './services/customAgentService';
import { ChatSidebarProvider } from './providers/chatSidebarProvider';
import { Logger, LogLevel } from './services/logger';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

// Function to save uploaded images to moodboard directory
async function saveImageToMoodboard(data: {
	fileName: string;
	originalName: string;
	base64Data: string;
	mimeType: string;
	size: number;
}, sidebarProvider: ChatSidebarProvider) {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		Logger.error('No workspace folder found for saving image');
		return;
	}

	try {
		// Create .superdesign/moodboard directory if it doesn't exist
		const moodboardDir = vscode.Uri.joinPath(workspaceFolder.uri, '.superdesign', 'moodboard');
		
		try {
			await vscode.workspace.fs.stat(moodboardDir);
		} catch {
			// Directory doesn't exist, create it
			await vscode.workspace.fs.createDirectory(moodboardDir);
			Logger.info('Created .superdesign/moodboard directory');
		}

		// Convert base64 to buffer and save file
		const base64Content = data.base64Data.split(',')[1]; // Remove data:image/jpeg;base64, prefix
		const buffer = Buffer.from(base64Content, 'base64');
		const filePath = vscode.Uri.joinPath(moodboardDir, data.fileName);
		
		await vscode.workspace.fs.writeFile(filePath, buffer);
		
		Logger.info(`Image saved to moodboard: ${data.fileName} (${(data.size / 1024).toFixed(1)} KB)`);
		
		// Send back the full absolute path to the webview
		sidebarProvider.sendMessage({
			command: 'imageSavedToMoodboard',
			data: {
				fileName: data.fileName,
				originalName: data.originalName,
				fullPath: filePath.fsPath
			}
		});
		
	} catch (error) {
		Logger.error(`Error saving image to moodboard: ${error}`);
		vscode.window.showErrorMessage(`Failed to save image: ${error}`);
		
		// Send error back to webview
		sidebarProvider.sendMessage({
			command: 'imageSaveError',
			data: {
				fileName: data.fileName,
				originalName: data.originalName,
				error: error instanceof Error ? error.message : String(error)
			}
		});
	}
}

// Function to convert image files to base64 for AI SDK
async function getBase64Image(filePath: string, sidebarProvider: ChatSidebarProvider) {
	try {
		// Read the image file
		const fileUri = vscode.Uri.file(filePath);
		const fileData = await vscode.workspace.fs.readFile(fileUri);
		
		// Determine MIME type from file extension
		const extension = filePath.toLowerCase().split('.').pop();
		let mimeType: string;
		switch (extension) {
			case 'jpg':
			case 'jpeg':
				mimeType = 'image/jpeg';
				break;
			case 'png':
				mimeType = 'image/png';
				break;
			case 'gif':
				mimeType = 'image/gif';
				break;
			case 'webp':
				mimeType = 'image/webp';
				break;
			case 'bmp':
				mimeType = 'image/bmp';
				break;
			default:
				mimeType = 'image/png'; // Default fallback
		}
		
		// Convert to base64
		const base64Content = Buffer.from(fileData).toString('base64');
		const base64DataUri = `data:${mimeType};base64,${base64Content}`;
		
		console.log(`Converted image to base64: ${filePath} (${(fileData.length / 1024).toFixed(1)} KB)`);
		
		// Send back the base64 data to webview
		sidebarProvider.sendMessage({
			command: 'base64ImageResponse',
			filePath: filePath,
			base64Data: base64DataUri,
			mimeType: mimeType,
			size: fileData.length
		});
		
	} catch (error) {
		console.error('Error converting image to base64:', error);
		
		// Send error back to webview
		sidebarProvider.sendMessage({
			command: 'base64ImageResponse',
			filePath: filePath,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

// Function to read CSS file content for theme preview
async function getCssFileContent(filePath: string, sidebarProvider: ChatSidebarProvider) {
	try {
		// Handle relative paths - resolve them to workspace root
		let resolvedPath = filePath;
		
		if (!path.isAbsolute(filePath)) {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				throw new Error('No workspace folder found');
			}
			
			// If path doesn't start with .superdesign, add it
			if (!filePath.startsWith('.superdesign/') && filePath.startsWith('design_iterations/')) {
				resolvedPath = `.superdesign/${filePath}`;
			}
			
			resolvedPath = path.join(workspaceFolder.uri.fsPath, resolvedPath);
		}
		
		// Read the CSS file
		const fileUri = vscode.Uri.file(resolvedPath);
		const fileData = await vscode.workspace.fs.readFile(fileUri);
		
		// Convert to string
		const cssContent = Buffer.from(fileData).toString('utf8');
		
		console.log(`Read CSS file: ${resolvedPath} (${(fileData.length / 1024).toFixed(1)} KB)`);
		
		// Send back the CSS content to webview
		sidebarProvider.sendMessage({
			command: 'cssFileContentResponse',
			filePath: filePath,
			content: cssContent,
			size: fileData.length
		});
		
	} catch (error) {
		console.error('Error reading CSS file:', error);
		
		// Send error back to webview
		sidebarProvider.sendMessage({
			command: 'cssFileContentResponse',
			filePath: filePath,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

// Function to submit email to Supabase API
async function submitEmailToSupabase(email: string, sidebarProvider: ChatSidebarProvider) {
	try {
		const https = require('https');
		const postData = JSON.stringify({ email });

		const options = {
			hostname: 'egcidyvbkguhrjltyszr.supabase.co',
			port: 443,
			path: '/rest/v1/forms',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY2lkeXZia2d1aHJqbHR5c3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDU5MjMsImV4cCI6MjA3NzE4MTkyM30.88sJiWsp4AHW9cIFD9ghlfkxA1e2ph5J8XzARLCSLoo',
				'Content-Length': Buffer.byteLength(postData)
			}
		};

		const req = https.request(options, (res: any) => {
			let data = '';

			res.on('data', (chunk: string) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					Logger.info(`Email submitted successfully: ${email}`);
					sidebarProvider.sendMessage({
						command: 'emailSubmitSuccess',
						email: email
					});
				} else {
					Logger.error(`Email submission failed: ${res.statusCode} ${data}`);
					sidebarProvider.sendMessage({
						command: 'emailSubmitError',
						error: 'Failed to submit email. Please try again.'
					});
				}
			});
		});

		req.on('error', (error: any) => {
			Logger.error(`Email submission request error: ${error}`);
			sidebarProvider.sendMessage({
				command: 'emailSubmitError',
				error: 'Failed to submit email. Please try again.'
			});
		});

		req.write(postData);
		req.end();

	} catch (error) {
		Logger.error(`Email submission error: ${error}`);
		sidebarProvider.sendMessage({
			command: 'emailSubmitError',
			error: 'Failed to submit email. Please try again.'
		});
	}
}

// Function to initialize Superdesign project structure
async function initializeSuperdesignProject() {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder found. Please open a workspace first.');
		return;
	}

	const workspaceRoot = workspaceFolder.uri;
	const superdesignFolder = vscode.Uri.joinPath(workspaceRoot, '.superdesign');

	// Detect OS for correct keyboard shortcut
	const isWindows = process.platform === 'win32';
	const shortcut = isWindows ? 'Ctrl+Shift+P' : 'Command+Shift+P';

	const designRuleContent = `When asked to design UI & frontend interface
When asked to design UI & frontend interface
# Role
You are superdesign, a senior frontend designer integrated into VS Code as part of the Super Design extension.
Your goal is to help user generate amazing design using code

# Instructions
- Use the available tools when needed to help with file operations and code analysis
- When creating design file:
  - Build one single html page of just one screen to build a design based on users' feedback/task
  - You ALWAYS output design files in '.superdesign/design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
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
Output type: Just text
Think through how should the layout of interface look like, what are different UI components
And present the layout in ASCII wireframe format, here are the guidelines of good ASCII wireframe, you can do ASCII art too for more custom layout or graphic design

### 2. Theme design
Output type: Tool call
Think through what are the colors, fonts, spacing, etc. 
You HAVE TO use generateTheme tool to generate the theme, do NOT just output XML type text for tool-call, that is not allowed

### 3. Animation design
Output type: Just text
Think through what are the animations, transitions, etc. 

### 4. Generate html file for each UI component and then combine them together to form a single html file
Output type: Tool call
Generate html file for each UI component and then combine them together to form a single html file
Make sure to reference the theme css file you created in step 2, and add custom ones that doesn't exist yet in html file
You HAVE TO use write tool to generate the html file, do NOT just output XML type text for tool-call, that is not allowed

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

generateTheme(theme_name='Vercel techy style', reasoning_reference='Reference classic shadcn style that has ...', cssFilePath='.superdesign/design_iterations/theme_1.css', cssSheet=':root {
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

write(file_path='.superdesign/design_iterations/chat_ui.css', content='...')
write(file_path='.superdesign/design_iterations/chat_ui.html', content='...')

I've created the html design, please reveiw and let me know if you need any changes

</example>

IMPORTANT RULES:
1. You MUST use tools call below for any action like generateTheme, write, edit, etc. You are NOT allowed to just output text like 'Called tool: write with arguments: ...' or <tool-call>...</tool-call>; MUST USE TOOL CALL (This is very important!!)
2. You MUST confirm the layout, and then theme style, and then animation
3. You MUST use .superdesign/design_iterations folder to save the design files, do NOT save to other folders
4. You MUST create follow the workflow above

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

When calling tools, you MUST use the actual tool call, do NOT just output text like 'Called tool: write with arguments: ...' or <tool-call>...</tool-call>, this won't actually call the tool. (This is very important to my life, please follow)`;

	const designRuleMdcContent = `---
description: Use this rule when asked to do any frontend or UI design
globs: 
alwaysApply: false
---
${designRuleContent}`;

	const defaultCssContent = `/* ========================================
   Dark Mode UI Framework
   A beautiful dark mode design system
   ======================================== */

/* ========================================
   CSS Variables & Theme
   ======================================== */
:root {
    /* Dark Mode Color Palette */
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    
    /* Spacing & Layout */
    --radius: 0.625rem;
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 0.75rem;
    --spacing-lg: 1rem;
    --spacing-xl: 1.5rem;
    --spacing-2xl: 2rem;
    --spacing-3xl: 3rem;
    
    /* Typography */
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 1.875rem;
    --font-size-4xl: 2.25rem;
}

/* ========================================
   Base Styles
   ======================================== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-family);
    line-height: 1.6;
    min-height: 100vh;
}

html.dark {
    color-scheme: dark;
}

/* ========================================
   Layout Components
   ======================================== */
.container {
    max-width: 64rem;
    margin: 0 auto;
    padding: var(--spacing-2xl) var(--spacing-lg);
}

.container-sm {
    max-width: 42rem;
}

.container-lg {
    max-width: 80rem;
}

.grid {
    display: grid;
}

.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-auto { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }

.gap-sm { gap: var(--spacing-sm); }
.gap-md { gap: var(--spacing-md); }
.gap-lg { gap: var(--spacing-lg); }
.gap-xl { gap: var(--spacing-xl); }

.flex {
    display: flex;
}

.flex-col {
    flex-direction: column;
}

.items-center {
    align-items: center;
}

.justify-center {
    justify-content: center;
}

.justify-between {
    justify-content: space-between;
}

.text-center {
    text-align: center;
}

/* ========================================
   Card Components
   ======================================== */
.card {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(var(--radius) + 4px);
    padding: var(--spacing-xl);
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    transition: all 0.2s ease;
}

.card:hover {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* ========================================
   Button Components
   ======================================== */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    white-space: nowrap;
    border-radius: var(--radius);
    font-size: var(--font-size-sm);
    font-weight: 500;
    transition: all 0.2s;
    border: none;
    cursor: pointer;
    padding: var(--spacing-sm) var(--spacing-lg);
    min-height: 2.25rem;
    outline: none;
    text-decoration: none;
}

.btn:disabled {
    pointer-events: none;
    opacity: 0.5;
}

.btn-primary {
    background-color: var(--primary);
    color: var(--primary-foreground);
}

.btn-primary:hover {
    background-color: rgba(236, 236, 236, 0.9);
}

.btn-outline {
    background-color: transparent;
    border: 1px solid var(--border);
    color: var(--foreground);
}

.btn-outline:hover {
    background-color: var(--accent);
}

.btn-ghost {
    background-color: transparent;
    color: var(--foreground);
}

.btn-ghost:hover {
    background-color: var(--accent);
}

.btn-destructive {
    background-color: var(--destructive);
    color: white;
}

.btn-destructive:hover {
    background-color: rgba(220, 38, 38, 0.9);
}

/* Button Sizes */
.btn-sm {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-xs);
    min-height: 2rem;
}

.btn-lg {
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: var(--font-size-base);
    min-height: 2.75rem;
}

.btn-icon {
    padding: var(--spacing-sm);
    width: 2.25rem;
    height: 2.25rem;
}

/* ========================================
   Form Components
   ======================================== */
.form-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--foreground);
    font-size: var(--font-size-sm);
    outline: none;
    transition: all 0.2s;
}

.form-input:focus {
    border-color: var(--ring);
    box-shadow: 0 0 0 3px rgba(136, 136, 136, 0.5);
}

.form-input::placeholder {
    color: var(--muted-foreground);
}

/* ========================================
   Badge Components
   ======================================== */
.badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
    border: 1px solid;
    padding: 0.125rem var(--spacing-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
    white-space: nowrap;
}

/* Priority Badge Variants */
.badge-priority-high {
    background: rgba(127, 29, 29, 0.3);
    color: rgb(252, 165, 165);
    border: 1px solid rgba(153, 27, 27, 0.5);
}

.badge-priority-medium {
    background: rgba(120, 53, 15, 0.3);
    color: rgb(252, 211, 77);
    border: 1px solid rgba(146, 64, 14, 0.5);
}

.badge-priority-low {
    background: rgba(20, 83, 45, 0.3);
    color: rgb(134, 239, 172);
    border: 1px solid rgba(22, 101, 52, 0.5);
}

/* ========================================
   Tab Components
   ======================================== */
.tab-list {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xl);
}

.tab-button {
    background-color: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--foreground);
    text-transform: capitalize;
    font-weight: 500;
    transition: all 0.2s ease;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: var(--font-size-sm);
}

.tab-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
}

.tab-button.active {
    background-color: #f8f9fa !important;
    color: #1a1a1a !important;
    border-color: #f8f9fa !important;
    font-weight: 600;
}

.tab-button.active:hover {
    background-color: #e9ecef !important;
    border-color: #e9ecef !important;
}

/* ========================================
   Typography
   ======================================== */
.text-xs { font-size: var(--font-size-xs); }
.text-sm { font-size: var(--font-size-sm); }
.text-base { font-size: var(--font-size-base); }
.text-lg { font-size: var(--font-size-lg); }
.text-xl { font-size: var(--font-size-xl); }
.text-2xl { font-size: var(--font-size-2xl); }
.text-3xl { font-size: var(--font-size-3xl); }
.text-4xl { font-size: var(--font-size-4xl); }

.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }

.text-primary { color: var(--primary); }
.text-muted { color: var(--muted-foreground); }
.text-destructive { color: var(--destructive); }

.gradient-text {
    background: linear-gradient(to right, var(--primary), rgba(236, 236, 236, 0.6));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* ========================================
   Icon System
   ======================================== */
.icon {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
    flex-shrink: 0;
}

.icon-sm { width: 0.875rem; height: 0.875rem; }
.icon-lg { width: 1.25rem; height: 1.25rem; }
.icon-xl { width: 1.5rem; height: 1.5rem; }
.icon-2xl { width: 2rem; height: 2rem; }

/* ========================================
   Interactive Components
   ======================================== */
.checkbox {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.2s;
}

.checkbox:hover {
    border-color: var(--ring);
}

.checkbox.checked {
    background-color: rgb(22, 163, 74);
    border-color: rgb(22, 163, 74);
}

.checkbox.checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 0.75rem;
    font-weight: bold;
}

/* ========================================
   List Components
   ======================================== */
.list-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background-color 0.2s;
}

.list-item:hover {
    background-color: rgba(255, 255, 255, 0.025);
}

.list-item:last-child {
    border-bottom: none;
}

.list-item.completed {
    opacity: 0.6;
}

/* ========================================
   Empty State Component
   ======================================== */
.empty-state {
    text-align: center;
    padding: var(--spacing-3xl) var(--spacing-lg);
    color: var(--muted-foreground);
}

.empty-state .icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto var(--spacing-lg);
    opacity: 0.5;
}

/* ========================================
   Utility Classes
   ======================================== */
.hidden { display: none; }
.block { display: block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }

.w-full { width: 100%; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }

.opacity-50 { opacity: 0.5; }
.opacity-60 { opacity: 0.6; }
.opacity-75 { opacity: 0.75; }

.transition-all { transition: all 0.2s ease; }
.transition-colors { transition: color 0.2s ease, background-color 0.2s ease; }
.transition-opacity { transition: opacity 0.2s ease; }

/* ========================================
   Responsive Design
   ======================================== */
@media (max-width: 768px) {
    .container {
        padding: var(--spacing-lg);
    }
    
    .grid-cols-auto {
        grid-template-columns: 1fr;
    }
    
    .flex-col-mobile {
        flex-direction: column;
    }
    
    .text-center-mobile {
        text-align: center;
    }
    
    .gap-sm-mobile { gap: var(--spacing-sm); }
    
    .hidden-mobile { display: none; }
    .block-mobile { display: block; }
}

@media (max-width: 640px) {
    .text-2xl { font-size: var(--font-size-xl); }
    .text-3xl { font-size: var(--font-size-2xl); }
    .text-4xl { font-size: var(--font-size-3xl); }
    
    .container {
        padding: var(--spacing-lg) var(--spacing-sm);
    }
}

/* ========================================
   Animation Utilities
   ======================================== */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

/* ========================================
   Focus & Accessibility
   ======================================== */
.focus-visible:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}`;

	try {
		// Create .superdesign/design_iterations directory
		const designIterationsFolder = vscode.Uri.joinPath(superdesignFolder, 'design_iterations');
		await vscode.workspace.fs.createDirectory(designIterationsFolder);

		// Create default_ui_darkmode.css file
		const defaultCssPath = vscode.Uri.joinPath(designIterationsFolder, 'default_ui_darkmode.css');
		try {
			// Check if file already exists
			await vscode.workspace.fs.stat(defaultCssPath);
			Logger.debug('default_ui_darkmode.css already exists, skipping creation');
		} catch {
			// File doesn't exist, create it
			await vscode.workspace.fs.writeFile(defaultCssPath, Buffer.from(defaultCssContent, 'utf8'));
			Logger.info('Created default_ui_darkmode.css file');
		}

		// Create .cursor/rules directory if it doesn't exist
		const cursorRulesFolder = vscode.Uri.joinPath(workspaceRoot, '.cursor', 'rules');
		try {
			await vscode.workspace.fs.stat(cursorRulesFolder);
		} catch {
			await vscode.workspace.fs.createDirectory(cursorRulesFolder);
		}

		// Create or append to design.mdc
		const designMdcPath = vscode.Uri.joinPath(cursorRulesFolder, 'design.mdc');
		try {
			const existingContent = await vscode.workspace.fs.readFile(designMdcPath);
			const currentContent = Buffer.from(existingContent).toString('utf8');
			if (!currentContent.includes('superdesign: Open Canvas View')) {
				const updatedContent = currentContent + '\n\n' + designRuleMdcContent;
				await vscode.workspace.fs.writeFile(designMdcPath, Buffer.from(updatedContent, 'utf8'));
			}
		} catch {
			// File doesn't exist, create it
			await vscode.workspace.fs.writeFile(designMdcPath, Buffer.from(designRuleMdcContent, 'utf8'));
		}

		// Create or append to CLAUDE.md
		const claudeMdPath = vscode.Uri.joinPath(workspaceRoot, 'CLAUDE.md');
		try {
			const existingContent = await vscode.workspace.fs.readFile(claudeMdPath);
			const currentContent = Buffer.from(existingContent).toString('utf8');
			if (!currentContent.includes('superdesign: Open Canvas View')) {
				const updatedContent = currentContent + '\n\n' + designRuleContent;
				await vscode.workspace.fs.writeFile(claudeMdPath, Buffer.from(updatedContent, 'utf8'));
			}
		} catch {
			// File doesn't exist, create it
			await vscode.workspace.fs.writeFile(claudeMdPath, Buffer.from(designRuleContent, 'utf8'));
		}

		// Create or append to .windsurfrules
		const windsurfRulesPath = vscode.Uri.joinPath(workspaceRoot, '.windsurfrules');
		try {
			const existingContent = await vscode.workspace.fs.readFile(windsurfRulesPath);
			const currentContent = Buffer.from(existingContent).toString('utf8');
			if (!currentContent.includes('superdesign: Open Canvas View')) {
				const updatedContent = currentContent + '\n\n' + designRuleContent;
				await vscode.workspace.fs.writeFile(windsurfRulesPath, Buffer.from(updatedContent, 'utf8'));
			}
		} catch {
			// File doesn't exist, create it
			await vscode.workspace.fs.writeFile(windsurfRulesPath, Buffer.from(designRuleContent, 'utf8'));
		}

		vscode.window.showInformationMessage('✅ Superdesign project initialized successfully! Created .superdesign folder and design rules for Cursor, Claude, and Windsurf.');
		
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to initialize Superdesign project: ${error}`);
	}
}

export function activate(context: vscode.ExtensionContext) {
	// Initialize the centralized logger
	Logger.initialize();
	Logger.info('Superdesign extension is now active!');
	// Note: Users can manually open output via View → Output → Select "Superdesign" if needed

	// Initialize Custom Agent service
	Logger.info('Creating CustomAgentService...');
	const customAgent = new CustomAgentService(Logger.getOutputChannel());
	Logger.info('CustomAgentService created');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloWorldDisposable = vscode.commands.registerCommand('superdesign.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from superdesign!');
	});

	// Register API key configuration commands
	const configureApiKeyDisposable = vscode.commands.registerCommand('superdesign.configureApiKey', async () => {
		await configureAnthropicApiKey();
	});

	const configureOpenAIApiKeyDisposable = vscode.commands.registerCommand('superdesign.configureOpenAIApiKey', async () => {
		await configureOpenAIApiKey();
	});

	const configureOpenRouterApiKeyDisposable = vscode.commands.registerCommand('superdesign.configureOpenRouterApiKey', async () => {
		await configureOpenRouterApiKey();
	});

  const configureOpenAIUrlDisposable = vscode.commands.registerCommand('superdesign.configureOpenAIUrl', async () => {
    await configureOpenAIUrl();
  });

	// Create the chat sidebar provider
	const sidebarProvider = new ChatSidebarProvider(context.extensionUri, customAgent, Logger.getOutputChannel());
	
	// Register the webview view provider for sidebar
	const sidebarDisposable = vscode.window.registerWebviewViewProvider(
		ChatSidebarProvider.VIEW_TYPE,
		sidebarProvider,
		{
			webviewOptions: {
				retainContextWhenHidden: true
			}
		}
	);

	// Register command to show sidebar
	const showSidebarDisposable = vscode.commands.registerCommand('superdesign.showChatSidebar', () => {
		vscode.commands.executeCommand('workbench.view.extension.superdesign-sidebar');
	});

	// Register canvas command
	const openCanvasDisposable = vscode.commands.registerCommand('superdesign.openCanvas', () => {
		SuperdesignCanvasPanel.createOrShow(context.extensionUri, sidebarProvider);
	});

	// Register clear chat command
	const clearChatDisposable = vscode.commands.registerCommand('superdesign.clearChat', () => {
		sidebarProvider.sendMessage({
			command: 'clearChat'
		});
	});

	// Register reset welcome command
	const resetWelcomeDisposable = vscode.commands.registerCommand('superdesign.resetWelcome', () => {
		sidebarProvider.sendMessage({
			command: 'resetWelcome'
		});
		vscode.window.showInformationMessage('Welcome screen has been reset. Refresh the sidebar to see the welcome screen again.');
	});

	// Register initialize project command
	const initializeProjectDisposable = vscode.commands.registerCommand('superdesign.initializeProject', async () => {
		await initializeSuperdesignProject();
	});

	// Register open settings command
	const openSettingsDisposable = vscode.commands.registerCommand('superdesign.openSettings', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', '@ext:SuperdesignDev.superdesign-official');
	});

	// Register configure API key command (alternative to the existing one)
	const configureApiKeyQuickDisposable = vscode.commands.registerCommand('superdesign.configureApiKeyQuick', async () => {
		await configureAnthropicApiKey();
	});

	// Set up message handler for auto-canvas functionality
	sidebarProvider.setMessageHandler((message) => {
		switch (message.command) {
			case 'checkCanvasStatus':
				// Check if canvas panel is currently open
				const isCanvasOpen = SuperdesignCanvasPanel.currentPanel !== undefined;
				sidebarProvider.sendMessage({
					command: 'canvasStatusResponse',
					isOpen: isCanvasOpen
				});
				break;
				
			case 'autoOpenCanvas':
				// Auto-open canvas if not already open
				SuperdesignCanvasPanel.createOrShow(context.extensionUri, sidebarProvider);
				break;

			case 'setContextFromCanvas':
				// Forward context from canvas to chat sidebar
				sidebarProvider.sendMessage({
					command: 'contextFromCanvas',
					data: message.data
				});
				break;

			case 'saveImageToMoodboard':
				// Save uploaded image to moodboard directory
				saveImageToMoodboard(message.data, sidebarProvider);
				break;

			case 'getBase64Image':
				// Convert saved image to base64 for AI SDK
				getBase64Image(message.filePath, sidebarProvider);
				break;

			case 'getCssFileContent':
				// Read CSS file content for theme preview
				getCssFileContent(message.filePath, sidebarProvider);
				break;

			case 'showError':
				// Show error message to user
				vscode.window.showErrorMessage(message.data);
				break;

			case 'submitEmail':
				// Handle email submission from welcome screen
				submitEmailToSupabase(message.email, sidebarProvider);
				break;

			case 'initializeSuperdesign':
				// Auto-trigger initialize Superdesign command
				console.log('🚀 Received initializeSuperdesign command from webview');
				vscode.commands.executeCommand('superdesign.initializeProject');
				break;
		}
	});

	context.subscriptions.push(
		helloWorldDisposable, 
		configureApiKeyDisposable,
		configureOpenAIApiKeyDisposable,
		configureOpenRouterApiKeyDisposable,
    configureOpenAIUrlDisposable,
		sidebarDisposable,
		showSidebarDisposable,
		openCanvasDisposable,
		clearChatDisposable,
		resetWelcomeDisposable,
		initializeProjectDisposable,
		openSettingsDisposable,
		configureApiKeyQuickDisposable
	);
}

// Function to configure Anthropic API key
async function configureAnthropicApiKey() {
	const currentKey = vscode.workspace.getConfiguration('superdesign').get<string>('anthropicApiKey');

	const input = await vscode.window.showInputBox({
		title: 'Configure Anthropic API Key',
		prompt: 'Enter your Anthropic API key (get one from https://console.anthropic.com/)',
		value: currentKey ? '••••••••••••••••' : '',
		password: true,
		placeHolder: 'sk-ant-...',
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'API key cannot be empty';
			}
			if (value === '••••••••••••••••') {
				return null; // User didn't change the masked value, that's OK
			}
			if (!value.startsWith('sk-ant-')) {
				return 'Anthropic API keys should start with "sk-ant-"';
			}
			return null;
		}
	});

	if (input !== undefined) {
		// Only update if user didn't just keep the masked value
		if (input !== '••••••••••••••••') {
			try {
				await vscode.workspace.getConfiguration('superdesign').update(
					'anthropicApiKey', 
					input.trim(), 
					vscode.ConfigurationTarget.Global
				);
				vscode.window.showInformationMessage('✅ Anthropic API key configured successfully!');
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
			}
		} else if (currentKey) {
			vscode.window.showInformationMessage('API key unchanged (already configured)');
		} else {
			vscode.window.showWarningMessage('No API key was set');
		}
	}
}

// Function to configure OpenAI API key
async function configureOpenAIApiKey() {
	const currentKey = vscode.workspace.getConfiguration('superdesign').get<string>('openaiApiKey');

	const input = await vscode.window.showInputBox({
		title: 'Configure OpenAI API Key',
		prompt: 'Enter your OpenAI API key (get one from https://platform.openai.com/api-keys)',
		value: currentKey ? '••••••••••••••••' : '',
		password: true,
		placeHolder: 'sk-...',
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'API key cannot be empty';
			}
			if (value === '••••••••••••••••') {
				return null; // User didn't change the masked value, that's OK
			}
			if (!value.startsWith('sk-')) {
				return 'OpenAI API keys should start with "sk-"';
			}
			return null;
		}
	});

	if (input !== undefined) {
		// Only update if user didn't just keep the masked value
		if (input !== '••••••••••••••••') {
			try {
				await vscode.workspace.getConfiguration('superdesign').update(
					'openaiApiKey', 
					input.trim(), 
					vscode.ConfigurationTarget.Global
				);
				vscode.window.showInformationMessage('✅ OpenAI API key configured successfully!');
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
			}
		} else if (currentKey) {
			vscode.window.showInformationMessage('API key unchanged (already configured)');
		} else {
			vscode.window.showWarningMessage('No API key was set');
		}
	}
}

// Function to configure OpenRouter API key
async function configureOpenRouterApiKey() {
	const currentKey = vscode.workspace.getConfiguration('superdesign').get<string>('openrouterApiKey');

	const input = await vscode.window.showInputBox({
		title: 'Configure OpenRouter API Key',
		prompt: 'Enter your OpenRouter API key (get one from https://openrouter.ai/)',
		value: currentKey ? '••••••••••••••••' : '',
		password: true,
		placeHolder: 'sk-...',
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'API key cannot be empty';
			}
			if (value === '••••••••••••••••') {
				return null; // User didn't change the masked value, that's OK
			}
			if (!value.startsWith('sk-')) {
				return 'OpenRouter API keys should start with "sk-"';
			}
			return null;
		}
	});

	if (input !== undefined) {
		// Only update if user didn't just keep the masked value
		if (input !== '••••••••••••••••') {
			try {
				await vscode.workspace.getConfiguration('superdesign').update(
					'openrouterApiKey', 
					input.trim(), 
					vscode.ConfigurationTarget.Global
				);
				vscode.window.showInformationMessage('✅ OpenRouter API key configured successfully!');
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
			}
		} else if (currentKey) {
			vscode.window.showInformationMessage('API key unchanged (already configured)');
		} else {
			vscode.window.showWarningMessage('No API key was set');
		}
	}
}

// Function to configure OpenAI url
async function configureOpenAIUrl() {
  const currentKey = vscode.workspace.getConfiguration('superdesign').get<string>('openaiUrl');

  const input = await vscode.window.showInputBox({
    title: 'Configure OpenAI url',
    prompt: 'Enter your OpenAI url',
    value: currentKey ?? '',
    password: false,
    placeHolder: 'http://localhost:1234/v1',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Url cannot be empty';
      }
      if (!value.startsWith('http')) {
        return 'Url should start with "http"';
      }
      return null;
    }
  });

  if (input !== undefined) {
    if (input !== '') {
      try {
        await vscode.workspace
          .getConfiguration('superdesign')
          .update('openaiUrl', input.trim(), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('✅ OpenAI url configured successfully!');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save url: ${error}`);
      }
    } else if (currentKey) {
      vscode.window.showInformationMessage('Url unchanged (already configured)');
    } else {
      vscode.window.showWarningMessage('No Url was set');
    }
  }
}

class SuperdesignCanvasPanel {
	public static currentPanel: SuperdesignCanvasPanel | undefined;
	public static readonly viewType = 'superdesignCanvasPanel';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _sidebarProvider: ChatSidebarProvider;
	private _disposables: vscode.Disposable[] = [];
	private _fileWatcher: vscode.FileSystemWatcher | undefined;

	public static createOrShow(extensionUri: vscode.Uri, sidebarProvider: ChatSidebarProvider) {
		const column = vscode.window.activeTextEditor?.viewColumn;

		if (SuperdesignCanvasPanel.currentPanel) {
			SuperdesignCanvasPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			SuperdesignCanvasPanel.viewType,
			'Superdesign Canvas',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'dist'),
					vscode.Uri.joinPath(extensionUri, 'src', 'assets')
				]
			}
		);

		SuperdesignCanvasPanel.currentPanel = new SuperdesignCanvasPanel(panel, extensionUri, sidebarProvider);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, sidebarProvider: ChatSidebarProvider) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._sidebarProvider = sidebarProvider;

		this._update();
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		this._setupFileWatcher();

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'loadDesignFiles':
						this._loadDesignFiles();
						break;
					case 'selectFrame':
						Logger.debug(`Frame selected: ${message.data?.fileName}`);
						break;
					case 'setContextFromCanvas':
						// Forward context to chat sidebar
						this._sidebarProvider.sendMessage({
							command: 'contextFromCanvas',
							data: message.data
						});
						break;
					case 'setChatPrompt':
						// Forward prompt to chat sidebar
						this._sidebarProvider.sendMessage({
							command: 'setChatPrompt',
							data: message.data
						});
						break;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		SuperdesignCanvasPanel.currentPanel = undefined;
		
		// Dispose of file watcher
		if (this._fileWatcher) {
			this._fileWatcher.dispose();
			this._fileWatcher = undefined;
		}
		
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _setupFileWatcher() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		// Watch for changes in .superdesign/design_iterations/*.html, *.svg, and *.css
		const pattern = new vscode.RelativePattern(
			workspaceFolder, 
			'.superdesign/design_iterations/**/*.{html,svg,css}'
		);

		this._fileWatcher = vscode.workspace.createFileSystemWatcher(
			pattern,
			false, // Don't ignore create events
			false, // Don't ignore change events  
			false  // Don't ignore delete events
		);

		// Handle file creation
		this._fileWatcher.onDidCreate((uri) => {
			Logger.debug(`Design file created: ${uri.fsPath}`);
			this._panel.webview.postMessage({
				command: 'fileChanged',
				data: {
					fileName: uri.fsPath.split('/').pop() || '',
					changeType: 'created'
				}
			});
		});

		// Handle file modification
		this._fileWatcher.onDidChange((uri) => {
			Logger.debug(`Design file modified: ${uri.fsPath}`);
			this._panel.webview.postMessage({
				command: 'fileChanged',
				data: {
					fileName: uri.fsPath.split('/').pop() || '',
					changeType: 'modified'
				}
			});
		});

		// Handle file deletion
		this._fileWatcher.onDidDelete((uri) => {
			Logger.debug(`Design file deleted: ${uri.fsPath}`);
			this._panel.webview.postMessage({
				command: 'fileChanged',
				data: {
					fileName: uri.fsPath.split('/').pop() || '',
					changeType: 'deleted'
				}
			});
		});
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
		);

		// Generate webview URIs for logo images
		const logoUris = {
			cursor: webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'cursor_logo.png')).toString(),
			windsurf: webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'windsurf_logo.png')).toString(),
			claudeCode: webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'claude_code_logo.png')).toString(),
			lovable: webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'lovable_logo.png')).toString(),
			bolt: webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'assets', 'bolt_logo.jpg')).toString(),
		};

		// Debug logging
		Logger.debug(`Canvas Panel - Extension URI: ${this._extensionUri.toString()}`);
		Logger.debug(`Canvas Panel - Generated logo URIs: ${JSON.stringify(logoUris)}`);

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data: https: vscode-webview:; script-src 'nonce-${nonce}'; frame-src ${webview.cspSource};">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Superdesign Canvas</title>
			</head>
			<body>
				<div id="root" data-view="canvas" data-nonce="${nonce}"></div>
				<script nonce="${nonce}">
					// Debug: Check if context data is being generated
					console.log('Canvas Panel - About to set webview context. Logo URIs:', ${JSON.stringify(logoUris)});
					
					// Initialize context for React app
					window.__WEBVIEW_CONTEXT__ = {
						layout: 'panel',
						extensionUri: '${this._extensionUri.toString()}',
						logoUris: ${JSON.stringify(logoUris)}
					};
					
					// Debug logging in webview
					console.log('Canvas Panel - Webview context set:', window.__WEBVIEW_CONTEXT__);
					console.log('Canvas Panel - Logo URIs received in webview:', window.__WEBVIEW_CONTEXT__?.logoUris);
				</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private async _loadDesignFiles() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			this._panel.webview.postMessage({
				command: 'error',
				data: { error: 'No workspace folder found. Please open a workspace first.' }
			});
			return;
		}

		try {
			const designFolder = vscode.Uri.joinPath(workspaceFolder.uri, '.superdesign', 'design_iterations');
			
			// Check if the design_files folder exists
			try {
				await vscode.workspace.fs.stat(designFolder);
			} catch (error) {
				// Folder doesn't exist, create it
				try {
					await vscode.workspace.fs.createDirectory(designFolder);
					Logger.info('Created .superdesign/design_iterations directory');
				} catch (createError) {
					this._panel.webview.postMessage({
						command: 'error',
						data: { error: `Failed to create design_files directory: ${createError}` }
					});
					return;
				}
			}

			// Read all files in the directory
			const files = await vscode.workspace.fs.readDirectory(designFolder);
			const designFiles = files.filter(([name, type]) => 
				type === vscode.FileType.File && (
					name.toLowerCase().endsWith('.html') || 
					name.toLowerCase().endsWith('.svg')
				)
			);

			const loadedFiles = await Promise.all(
				designFiles.map(async ([fileName, _]) => {
					const filePath = vscode.Uri.joinPath(designFolder, fileName);
					
					try {
						// Read file stats and content
						const [stat, content] = await Promise.all([
							vscode.workspace.fs.stat(filePath),
							vscode.workspace.fs.readFile(filePath)
						]);

						const fileType = fileName.toLowerCase().endsWith('.svg') ? 'svg' : 'html';
						let htmlContent = Buffer.from(content).toString('utf8');
						
						// For HTML files, inline any external CSS files
						if (fileType === 'html') {
							htmlContent = await this._inlineExternalCSS(htmlContent, designFolder);
						}
						
						return {
							name: fileName,
							path: filePath.fsPath,
							content: htmlContent,
							size: stat.size,
							modified: new Date(stat.mtime),
							fileType
						};
					} catch (fileError) {
						Logger.error(`Failed to read file ${fileName}: ${fileError}`);
						return null;
					}
				})
			);

			// Filter out any failed file reads
			const validFiles = loadedFiles.filter(file => file !== null);

			Logger.info(`Loaded ${validFiles.length} design files (HTML & SVG)`);
			
			this._panel.webview.postMessage({
				command: 'designFilesLoaded',
				data: { files: validFiles }
			});

		} catch (error) {
			Logger.error(`Error loading design files: ${error}`);
			this._panel.webview.postMessage({
				command: 'error',
				data: { error: `Failed to load design files: ${error}` }
			});
		}
	}

	private async _inlineExternalCSS(htmlContent: string, designFolder: vscode.Uri): Promise<string> {
		// Match link tags that reference CSS files
		const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
		let modifiedContent = htmlContent;
		const matches = Array.from(htmlContent.matchAll(linkRegex));
		
		for (const match of matches) {
			const fullLinkTag = match[0];
			const cssFileName = match[1];
			
			try {
				// Only process relative paths (not absolute URLs)
				if (!cssFileName.startsWith('http') && !cssFileName.startsWith('//')) {
					const cssFilePath = vscode.Uri.joinPath(designFolder, cssFileName);
					
					// Check if CSS file exists
					try {
						const cssContent = await vscode.workspace.fs.readFile(cssFilePath);
						const cssText = Buffer.from(cssContent).toString('utf8');
						
						// Replace the link tag with a style tag containing the CSS content
						const styleTag = `<style>\n${cssText}\n</style>`;
						modifiedContent = modifiedContent.replace(fullLinkTag, styleTag);
						
						Logger.debug(`Inlined CSS file: ${cssFileName}`);
					} catch (cssError) {
						Logger.warn(`Could not read CSS file ${cssFileName}: ${cssError}`);
						// Leave the original link tag in place if CSS file can't be read
					}
				}
			} catch (error) {
				Logger.warn(`Error processing CSS link ${cssFileName}: ${error}`);
			}
		}
		
		return modifiedContent;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// This method is called when your extension is deactivated
export function deactivate() {
	Logger.dispose();
}

