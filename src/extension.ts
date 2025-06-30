// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AgentFactory, CodingAgentService } from './core/agent-factory';
import { ChatSidebarProvider } from './providers/chatSidebarProvider';
import { ChatMessageService } from './services/chatMessageService';
import { ConfigManager, SuperDesignConfig } from './core/config-manager';
import { generateWebviewHtml } from './templates/webviewTemplate';
import { WebviewContext } from './types/context';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel('Superdesign');

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
		console.error('No workspace folder found for saving image');
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
			console.log('Created .superdesign/moodboard directory');
		}

		// Convert base64 to buffer and save file
		const base64Content = data.base64Data.split(',')[1]; // Remove data:image/jpeg;base64, prefix
		const buffer = Buffer.from(base64Content, 'base64');
		const filePath = vscode.Uri.joinPath(moodboardDir, data.fileName);
		
		await vscode.workspace.fs.writeFile(filePath, buffer);
		
		console.log(`Image saved to moodboard: ${data.fileName} (${(data.size / 1024).toFixed(1)} KB)`);
		
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
		console.error('Error saving image to moodboard:', error);
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

// Function to submit email to Supabase API
async function submitEmailToSupabase(email: string, sidebarProvider: ChatSidebarProvider) {
	try {
		const https = require('https');
		const postData = JSON.stringify({ email });

		const options = {
			hostname: 'uqofryalyuvdvlbbutvi.supabase.co',
			port: 443,
			path: '/rest/v1/forms',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxb2ZyeWFseXV2ZHZsYmJ1dHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NDUxMTUsImV4cCI6MjA2NjMyMTExNX0.xyIw5nMK_ltpU64Z95E5xsnl8Uw3P0Y0UZaJKiX65MI',
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
					console.log('✅ Email submitted successfully:', email);
					sidebarProvider.sendMessage({
						command: 'emailSubmitSuccess',
						email: email
					});
				} else {
					console.error('❌ Email submission failed:', res.statusCode, data);
					sidebarProvider.sendMessage({
						command: 'emailSubmitError',
						error: 'Failed to submit email. Please try again.'
					});
				}
			});
		});

		req.on('error', (error: any) => {
			console.error('❌ Email submission request error:', error);
			sidebarProvider.sendMessage({
				command: 'emailSubmitError',
				error: 'Failed to submit email. Please try again.'
			});
		});

		req.write(postData);
		req.end();

	} catch (error) {
		console.error('❌ Email submission error:', error);
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

1. Build one single html page of just one screen to build a design based on users' feedback/task (Can create separate css for style if needed)
2. You ALWAYS output design files in '.superdesign/design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
3. If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
4. If not specificied specific style, you can use default_ui_darkmode.css stylesheet in \`.superdesign/design_iterations/default_ui_darkmode.css\`
5. No need to reference existing html pages unless user specifically prompted you to do so
6. After finished creating, prompt users to use ${shortcut} to search for \`superdesign: Open Canvas View\` to preview design

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



## default_ui_darkmode.css

### **Layout**
* \`.container\`, \`.container-sm\`, \`.container-lg\`
* \`.grid\`, \`.grid-cols-1\`, \`.grid-cols-2\`, \`.grid-cols-3\`, \`.grid-cols-auto\`
* \`.gap-sm\`, \`.gap-md\`, \`.gap-lg\`, \`.gap-xl\`
* \`.flex\`, \`.flex-col\`, \`.items-center\`, \`.justify-center\`, \`.justify-between\`
* \`.text-center\`

**Mobile:**
\`.flex-col-mobile\`, \`.text-center-mobile\`, \`.gap-sm-mobile\`, \`.hidden-mobile\`, \`.block-mobile\`

### **Card**
* \`.card\`

### **Button**
* \`.btn\`, \`.btn-primary\`, \`.btn-outline\`, \`.btn-ghost\`, \`.btn-destructive\`
* \`.btn-sm\`, \`.btn-lg\`, \`.btn-icon\`

### **Input**
* \`.form-input\`

### **Badge**
* \`.badge\`, \`.badge-priority-high\`, \`.badge-priority-medium\`, \`.badge-priority-low\`

### **Tabs**
* \`.tab-list\`, \`.tab-button\`, \`.tab-button.active\`

### **Typography**
* \`.text-xs\`, \`.text-sm\`, \`.text-base\`, \`.text-lg\`, \`.text-xl\`, \`.text-2xl\`, \`.text-3xl\`, \`.text-4xl\`
* \`.font-normal\`, \`.font-medium\`, \`.font-semibold\`, \`.font-bold\`
* \`.text-primary\`, \`.text-muted\`, \`.text-destructive\`, \`.gradient-text\`

### **Icon**
* \`.icon\`, \`.icon-sm\`, \`.icon-lg\`, \`.icon-xl\`, \`.icon-2xl\`

### **Checkbox**
* \`.checkbox\`, \`.checkbox.checked\`

### **List**
* \`.list-item\`, \`.list-item.completed\`

### **Empty State**
* \`.empty-state\`

### **Utility**
* \`.hidden\`, \`.block\`, \`.inline-flex\`, \`.w-full\`, \`.h-full\`, \`.min-h-screen\`
* \`.opacity-50\`, \`.opacity-60\`, \`.opacity-75\`
* \`.transition-all\`, \`.transition-colors\`, \`.transition-opacity\`

### **Animation**
* \`.animate-fade-in\`

### **Accessibility**
* \`.focus-visible:focus-visible\``;

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
			console.log('default_ui_darkmode.css already exists, skipping creation');
		} catch {
			// File doesn't exist, create it
			await vscode.workspace.fs.writeFile(defaultCssPath, Buffer.from(defaultCssContent, 'utf8'));
			console.log('Created default_ui_darkmode.css file');
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

export async function activate(context: vscode.ExtensionContext) {
	outputChannel.appendLine('Superdesign extension is now active!');
	// Note: Users can manually open output via View → Output → Select "Superdesign" if needed

	// Initialize agent service using factory
	outputChannel.appendLine('🚀 Extension: Creating coding agent via AgentFactory...');
	const agentFactory = AgentFactory.getInstance(outputChannel);
	const agentService = await agentFactory.getOrCreateAgent();
	outputChannel.appendLine('✅ Extension: Coding agent created successfully');
	
	// Log current agent info for debugging
	const currentAgentInfo = agentFactory.getCurrentAgentInfo();
	if (currentAgentInfo) {
		outputChannel.appendLine(`📊 Extension: Current agent info: provider=${currentAgentInfo.provider}, ready=${currentAgentInfo.isReady}`);
	} else {
		outputChannel.appendLine(`📊 Extension: No current agent info available`);
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloWorldDisposable = vscode.commands.registerCommand('superdesign.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from superdesign!');
	});

	// Register API key configuration command
	const configureApiKeyDisposable = vscode.commands.registerCommand('superdesign.configureApiKey', async () => {
		await configureAnthropicApiKey();
	});

	// Register multi-provider API key configuration command
	const configureMultipleApiKeysDisposable = vscode.commands.registerCommand('superdesign.configureMultipleApiKeys', async () => {
		await configureMultipleApiKeys();
	});

	// Register model selection command
	const selectModelDisposable = vscode.commands.registerCommand('superdesign.selectModel', async () => {
		await selectAIModel();
	});

	// Register agent status command for debugging
	const showAgentStatusDisposable = vscode.commands.registerCommand('superdesign.showAgentStatus', async () => {
		const config = vscode.workspace.getConfiguration('superdesign');
		const currentProvider = config.get<string>('agentProvider', 'claude-code');
		const currentModel = config.get<string>('preferredModel', 'claude-3-5-sonnet-20241022');
		
		const agentInfo = agentFactory.getCurrentAgentInfo();
		
		let statusMessage = `**SuperDesign Agent Status (Debug)**\n\n`;
		statusMessage += `**Configuration:**\n`;
		statusMessage += `- Agent Provider: ${currentProvider}\n`;
		statusMessage += `- Preferred Model: ${currentModel}\n\n`;
		
		if (agentInfo) {
			statusMessage += `**Runtime Status:**\n`;
			statusMessage += `- Active Provider: ${agentInfo.provider}\n`;
			statusMessage += `- Agent Ready: ${agentInfo.isReady}\n`;
			statusMessage += `- Agent Service Type: ${agentService.constructor.name}\n`;
		} else {
			statusMessage += `**Runtime Status:** No agent info available\n`;
		}
		
		statusMessage += `\n**Sidebar Provider:**\n`;
		statusMessage += `- Sidebar Provider Type: ${sidebarProvider.constructor.name}\n`;
		
		// Output to both VS Code message and output channel
		vscode.window.showInformationMessage(statusMessage, { modal: true });
		outputChannel.appendLine(`🔍 Agent Status Debug Info:`);
		outputChannel.appendLine(statusMessage.replace(/\*\*/g, ''));
	});

	// Create the chat sidebar provider
	const sidebarProvider = new ChatSidebarProvider(context.extensionUri, agentFactory, outputChannel);
	
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

	// Register switch agent command
	const switchAgentDisposable = vscode.commands.registerCommand('superdesign.switchAgent', async () => {
		const config = vscode.workspace.getConfiguration('superdesign');
		const currentProvider = config.get<string>('agentProvider', 'claude-code');
		
		outputChannel.appendLine(`🔄 Extension: Starting agent switch process. Current provider: ${currentProvider}`);
		
		const options = [
			{ label: 'Claude Code Agent', value: 'claude-code', description: 'Original Claude Code integration' },
			{ label: 'Custom SuperDesign Agent', value: 'custom', description: 'Multi-model SuperDesign agent with advanced tools' }
		];
		
		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: `Current: ${currentProvider === 'claude-code' ? 'Claude Code Agent' : 'Custom SuperDesign Agent'}`,
			title: 'Choose Coding Agent'
		});
		
		if (selected && selected.value !== currentProvider) {
			outputChannel.appendLine(`🔄 Extension: User selected: ${selected.value} (was: ${currentProvider})`);
			
			try {
				outputChannel.appendLine(`🔄 Extension: Updating VS Code configuration...`);
				await config.update('agentProvider', selected.value, vscode.ConfigurationTarget.Global);
				
				// Verify the configuration was updated
				const updatedProvider = config.get<string>('agentProvider', 'claude-code');
				outputChannel.appendLine(`🔄 Extension: Configuration updated. New value: ${updatedProvider}`);
				
				// Switch the agent
				outputChannel.appendLine(`🔄 Extension: Calling agentFactory.switchAgent()...`);
				const newAgent = await agentFactory.switchAgent();
				outputChannel.appendLine(`🔄 Extension: agentFactory.switchAgent() completed successfully`);
				
				// The existing sidebar provider will automatically use the new agent from the factory
				outputChannel.appendLine(`✅ Extension: Existing sidebar provider will use the new agent automatically`);
				
				vscode.window.showInformationMessage(`✅ Switched to ${selected.label}`);
				outputChannel.appendLine(`✅ Extension: Agent switch process completed`);
				
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to switch agent: ${error}`);
				outputChannel.appendLine(`❌ Extension: Agent switch failed: ${error}`);
				outputChannel.appendLine(`❌ Extension: Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
			}
		} else if (selected && selected.value === currentProvider) {
			outputChannel.appendLine(`🔄 Extension: User selected same provider (${currentProvider}), no switch needed`);
		} else {
			outputChannel.appendLine(`🔄 Extension: User cancelled agent switch`);
		}
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

			case 'showError':
				// Show error message to user
				vscode.window.showErrorMessage(message.data);
				break;

			case 'submitEmail':
				// Handle email submission from welcome screen
				submitEmailToSupabase(message.email, sidebarProvider);
				break;
		}
	});

	context.subscriptions.push(
		helloWorldDisposable, 
		configureApiKeyDisposable,
		configureMultipleApiKeysDisposable,
		selectModelDisposable,
		showAgentStatusDisposable,
		sidebarDisposable,
		showSidebarDisposable,
		openCanvasDisposable,
		clearChatDisposable,
		resetWelcomeDisposable,
		initializeProjectDisposable,
		switchAgentDisposable
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

// Function to configure multiple API keys
async function configureMultipleApiKeys() {
	const configManager = new ConfigManager(outputChannel);
	
	const providers = [
		{ label: '🤖 Anthropic (Claude)', value: 'anthropic', placeholder: 'sk-ant-...', description: 'Required for Claude models and Claude Code agent' },
		{ label: '🚀 OpenAI (GPT)', value: 'openai', placeholder: 'sk-...', description: 'Required for GPT models' },
		{ label: '🧠 Google (Gemini)', value: 'google', placeholder: 'AIza...', description: 'Required for Gemini models' },
		{ label: '🌐 OpenRouter (100+ models)', value: 'openrouter', placeholder: 'sk-or-...', description: 'Optional: Access to 100+ models via unified API' }
	];
	
	const selectedProvider = await vscode.window.showQuickPick(providers, {
		placeHolder: 'Select AI provider to configure',
		title: 'Configure AI Provider API Keys'
	});
	
	if (!selectedProvider) {
		return;
	}
	
	const providerKey = selectedProvider.value as 'anthropic' | 'openai' | 'google' | 'openrouter';
	const config = configManager.getConfig();
	
	// Get current key based on provider
	let currentKey: string | undefined;
	switch (providerKey) {
		case 'anthropic':
			currentKey = config.anthropicApiKey;
			break;
		case 'openai':
			currentKey = config.openaiApiKey;
			break;
		case 'google':
			currentKey = config.googleApiKey;
			break;
		case 'openrouter':
			currentKey = config.openrouterApiKey;
			break;
	}
	
	const placeholder = currentKey ? '••••••••••••••••' : selectedProvider.placeholder;
	
	const apiKey = await vscode.window.showInputBox({
		title: `Configure ${selectedProvider.label} API Key`,
		placeHolder: placeholder,
		prompt: `Enter your ${selectedProvider.label} API key`,
		password: true,
		ignoreFocusOut: true,
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'API key cannot be empty';
			}
			if (value === '••••••••••••••••') {
				return null; // User didn't change the masked value
			}
			
			// Basic validation based on provider
			if (providerKey === 'anthropic' && !value.startsWith('sk-ant-')) {
				return 'Anthropic API keys should start with "sk-ant-"';
			}
			if (providerKey === 'openai' && !value.startsWith('sk-')) {
				return 'OpenAI API keys should start with "sk-"';
			}
			if (providerKey === 'openrouter' && !value.startsWith('sk-or-')) {
				return 'OpenRouter API keys should start with "sk-or-"';
			}
			if (providerKey === 'google' && value.length < 20) {
				return 'Google API keys should be longer';
			}
			
			return null;
		}
	});
	
	if (apiKey && apiKey !== '••••••••••••••••') {
		try {
			// Use explicit key names based on provider
			let configKey: keyof SuperDesignConfig;
			switch (providerKey) {
				case 'anthropic':
					configKey = 'anthropicApiKey';
					break;
				case 'openai':
					configKey = 'openaiApiKey';
					break;
				case 'google':
					configKey = 'googleApiKey';
					break;
				case 'openrouter':
					configKey = 'openrouterApiKey';
					break;
				default:
					throw new Error(`Unknown provider: ${providerKey}`);
			}
			
			await configManager.updateConfig(configKey, apiKey.trim());
			vscode.window.showInformationMessage(`✅ ${selectedProvider.label} API key configured successfully!`);
			
			// Show validation status
			const validation = configManager.validateCurrentModelApiKey();
			if (!validation.isValid && providerKey !== 'openrouter') {
				vscode.window.showInformationMessage(
					`💡 Tip: Set this as your preferred model to use ${selectedProvider.label}`,
					'Select Model'
				).then(selection => {
					if (selection === 'Select Model') {
						vscode.commands.executeCommand('superdesign.selectModel');
					}
				});
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
		}
	}
}

// Function to select AI model
async function selectAIModel() {
	const configManager = new ConfigManager(outputChannel);
	const config = configManager.getConfig();
	
	// Get available models based on configured API keys
	const availableModels: { label: string; description: string; model: string; provider: string }[] = [];
	
	// Add Anthropic models if API key is configured
	if (config.anthropicApiKey) {
		availableModels.push(
			{ label: 'Claude 3.5 Sonnet (Latest)', description: 'Best for complex design tasks', model: 'claude-3-5-sonnet-20241022', provider: 'Anthropic' },
			{ label: 'Claude 3.5 Haiku', description: 'Fast and efficient', model: 'claude-3-5-haiku-20241022', provider: 'Anthropic' }
		);
	}
	
	// Add OpenAI models if API key is configured
	if (config.openaiApiKey) {
		availableModels.push(
			{ label: 'GPT-4 Turbo', description: 'Latest GPT-4 with improved capabilities', model: 'gpt-4-turbo', provider: 'OpenAI' },
			{ label: 'GPT-4o', description: 'Optimized for speed and efficiency', model: 'gpt-4o', provider: 'OpenAI' },
			{ label: 'GPT-4o Mini', description: 'Fast and cost-effective', model: 'gpt-4o-mini', provider: 'OpenAI' }
		);
	}
	
	// Add Google models if API key is configured
	if (config.googleApiKey) {
		availableModels.push(
			{ label: 'Gemini 1.5 Pro', description: 'Google\'s most capable model', model: 'gemini-1.5-pro', provider: 'Google' },
			{ label: 'Gemini 1.5 Flash', description: 'Fast and efficient Gemini model', model: 'gemini-1.5-flash', provider: 'Google' }
		);
	}
	
	// Add OpenRouter models if API key is configured
	if (config.openrouterApiKey) {
		availableModels.push(
			{ label: 'Claude 3.5 Sonnet (via OpenRouter)', description: 'Access Claude via OpenRouter', model: 'openrouter/anthropic/claude-3.5-sonnet', provider: 'OpenRouter' },
			{ label: 'GPT-4 Turbo (via OpenRouter)', description: 'Access GPT-4 via OpenRouter', model: 'openrouter/openai/gpt-4-turbo', provider: 'OpenRouter' },
			{ label: 'Gemini Pro (via OpenRouter)', description: 'Access Gemini via OpenRouter', model: 'openrouter/google/gemini-pro', provider: 'OpenRouter' }
		);
	}
	
	if (availableModels.length === 0) {
		vscode.window.showWarningMessage(
			'No API keys configured. Please configure API keys first.',
			'Configure API Keys'
		).then(selection => {
			if (selection === 'Configure API Keys') {
				vscode.commands.executeCommand('superdesign.configureMultipleApiKeys');
			}
		});
		return;
	}
	
	// Mark current model
	const currentModel = config.preferredModel;
	const modelOptions = availableModels.map(model => ({
		...model,
		label: model.model === currentModel ? `${model.label} ✓ (Current)` : model.label
	}));
	
	const selectedModel = await vscode.window.showQuickPick(modelOptions, {
		placeHolder: `Current: ${currentModel}`,
		title: 'Select AI Model for Design Tasks'
	});
	
	if (selectedModel && selectedModel.model !== currentModel) {
		try {
			await configManager.updateConfig('preferredModel', selectedModel.model);
			vscode.window.showInformationMessage(`✅ Selected model: ${selectedModel.label.replace(' ✓ (Current)', '')}`);
			
			// Validate API key for new model
			const validation = configManager.validateCurrentModelApiKey();
			if (!validation.isValid) {
				vscode.window.showWarningMessage(
					validation.errorMessage || 'API key validation failed',
					'Configure API Keys'
				).then(selection => {
					if (selection === 'Configure API Keys') {
						vscode.commands.executeCommand('superdesign.configureMultipleApiKeys');
					}
				});
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to update model: ${error}`);
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
						console.log('Frame selected:', message.data?.fileName);
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
			console.log('Design file created:', uri.fsPath);
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
			console.log('Design file modified:', uri.fsPath);
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
			console.log('Design file deleted:', uri.fsPath);
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
		console.log('Canvas Panel - Extension URI:', this._extensionUri.toString());
		console.log('Canvas Panel - Generated logo URIs:', logoUris);

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
					console.log('Created .superdesign/design_iterations directory');
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
						console.error(`Failed to read file ${fileName}:`, fileError);
						return null;
					}
				})
			);

			// Filter out any failed file reads
			const validFiles = loadedFiles.filter(file => file !== null);

			console.log(`Loaded ${validFiles.length} design files (HTML & SVG)`);
			
			this._panel.webview.postMessage({
				command: 'designFilesLoaded',
				data: { files: validFiles }
			});

		} catch (error) {
			console.error('Error loading design files:', error);
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
						
						console.log(`Inlined CSS file: ${cssFileName}`);
					} catch (cssError) {
						console.warn(`Could not read CSS file ${cssFileName}:`, cssError);
						// Leave the original link tag in place if CSS file can't be read
					}
				}
			} catch (error) {
				console.warn(`Error processing CSS link ${cssFileName}:`, error);
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
export function deactivate() {}

