# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SuperDesign is a VS Code extension that provides AI-powered design capabilities directly within the IDE. It's the first open-source design agent that generates UI mockups, components, and wireframes from natural language prompts, integrating with Cursor, Windsurf, Claude Code, and VS Code.

## Development Commands

### Build and Development
```bash
# Install dependencies
npm install

# Development mode with watching
npm run watch

# Compile TypeScript and run linting
npm run compile

# Type checking only
npm run check-types

# Linting
npm run lint

# Production build
npm run package
```

### Testing
```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:llm        # LLM service tests
npm run test:core       # Core component tests  
npm run test:read       # Read tool tests
npm run test:write-edit # Write/edit tool tests
npm run test:ls-grep-glob # File operation tool tests

# Combined test suites
npm run test:agent      # LLM + core tests
npm run test:tools      # All tool tests
```

### Extension Development
```bash
# Prepare for VS Code marketplace
npm run vscode:prepublish

# Watch for TypeScript compilation errors
npm run watch:tsc

# Watch for esbuild changes
npm run watch:esbuild
```

## Architecture Overview

### Core Components

**Extension Entry Point** (`src/extension.ts`)
- Main activation function and command registration
- Manages WebView panels for chat sidebar and canvas view
- Handles file operations (image saving, CSS reading)
- Coordinates between different services and providers

**Chat Sidebar Provider** (`src/providers/chatSidebarProvider.ts`)
- Implements the main chat interface in VS Code sidebar
- Handles AI model selection and provider switching
- Manages communication between webview and extension backend
- Supports Anthropic, OpenAI, and OpenRouter models

**Services Layer**
- `CustomAgentService`: Manages AI interactions with multiple providers
- `ClaudeCodeService`: (Deprecated) Legacy Claude Code SDK integration
- `ChatMessageService`: Processes chat messages and streams responses
- `Logger`: Centralized logging system

**Tools System** (`src/tools/`)
- File operations: `read-tool.ts`, `write-tool.ts`, `edit-tool.ts`, `multiedit-tool.ts`
- Search operations: `grep-tool.ts`, `glob-tool.ts`, `ls-tool.ts`
- Build operations: `bash-tool.ts`
- Theme operations: `theme-tool.ts`

**WebView Components** (`src/webview/`)
- React-based UI for chat interface and canvas view
- Supports both sidebar and panel layouts
- Theme-aware design system with color palette management
- Canvas view for design file visualization

### Build System

**Dual Build Configuration** (`esbuild.js`)
- Extension bundle: CommonJS for Node.js environment
- WebView bundle: ESM for browser environment
- Automatic asset copying (Claude Code SDK, images)
- Development and production modes

**TypeScript Configuration**
- Strict typing enabled
- React JSX support
- ES2020 target with DOM libraries
- Source maps for development

### Design File Management

**File Structure**
- Design files stored in `.superdesign/design_iterations/`
- Supports HTML and SVG formats
- CSS theme files for consistent styling
- Automatic file watching and live updates

**Design Agent Integration**
- Integrated design rules for AI agents
- Template system for generating consistent UI components
- Theme generation tools
- Responsive design patterns

### AI Model Support

**Multi-Provider Architecture**
- Anthropic Claude (primary)
- OpenAI GPT models
- OpenRouter (for additional model access)
- AWS Bedrock (Claude, Llama, Nova, Mistral, and other models)
- Dynamic model switching with API key management

**Custom Agent System**
- Streaming response handling
- Conversation context management
- Tool integration for file operations
- Error handling and retry logic

## Key Patterns

### Message Handling
All communication between webview and extension uses a command-based message system with typed interfaces defined in `src/types/`.

### File Operations
Uses VS Code's workspace filesystem API for secure file access. All design files are contained within the workspace's `.superdesign` folder.

### Error Handling
Centralized error handling with user-friendly messages and actionable error responses (e.g., API key configuration prompts).

### Extension Lifecycle
Proper disposal patterns for file watchers, webview panels, and event subscriptions to prevent memory leaks.

## Development Notes

### Testing Strategy
- Unit tests for core services and tools
- Integration tests for AI model interactions
- Separate test configurations for different components

### Security Considerations
- API keys stored in VS Code's secure configuration system
- Content Security Policy enforcement for webviews
- Sandboxed file operations within workspace boundaries

### Performance Optimizations
- Lazy loading of AI services
- Efficient file watching with pattern matching
- Optimized bundle sizes for both extension and webview