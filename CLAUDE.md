# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SecureDesign is an open-source VS Code extension that serves as an AI design agent for creating UI mockups, components, and wireframes directly within IDEs. It integrates with multiple AI providers (Anthropic, OpenAI, OpenRouter) and provides both chat and canvas interfaces for design work.

## Build Commands

```bash
# Development
npm run compile          # Compile TypeScript and run checks
npm run watch           # Watch mode for development
npm run check-types     # TypeScript type checking
npm run lint            # ESLint code linting

# Production
npm run package         # Production build with checks and linting
npm run vscode:prepublish  # Pre-publish build (runs package)

# Testing
npm run test           # Run VS Code extension tests
npm run test:llm       # Test LLM service components
npm run test:core      # Test core components
npm run test:agent     # Test agent functionality
npm run test:tools     # Test file operation tools
```

## Architecture Overview

### Extension Structure

- **`src/extension.ts`**: Main extension entry point and activation logic
- **`src/providers/chatSidebarProvider.ts`**: Manages the chat sidebar webview interface
- **`src/services/`**: Core services including AI agent integration and logging
- **`src/webview/`**: React-based webview components for chat and canvas interfaces
- **`src/tools/`**: File system operation tools (read, write, edit, grep, glob, etc.)
- **`src/types/`**: TypeScript type definitions for agents and context

### Key Components

**Extension Entry Point** (`src/extension.ts`)

- Main activation function and command registration
- Manages WebView panels for chat sidebar and canvas view
- Handles file operations (image saving, CSS reading)
- Coordinates between different services and providers

**CustomAgentService** (`src/services/customAgentService.ts`):

- Handles AI provider integration (OpenAI, Anthropic, OpenRouter)
- Manages tool execution context and file operations
- Creates `.superdesign` directory for design storage

**ChatSidebarProvider** (`src/providers/chatSidebarProvider.ts`):

- Provides the main chat interface as a VS Code webview
- Handles message routing between extension and webview
- Manages webview lifecycle and context

**Canvas Components** (`src/webview/components/`):

- **CanvasView**: Main canvas interface for design previews
- **Chat/**: Chat interface components with model selection and theming
- **DesignFrame**: Renders design mockups and components
- **ConnectionLines**: Visual connections in design layouts

**Services Layer**

- `CustomAgentService`: Manages AI interactions with multiple providers
- `ClaudeCodeService`: (Deprecated) Legacy Claude Code SDK integration
- `ChatMessageService`: Processes chat messages and streams responses
- `Logger`: Centralized logging system

**WebView Components** (`src/webview/`)

- React-based UI for chat interface and canvas view
- Supports both sidebar and panel layouts
- Theme-aware design system with color palette management
- Canvas view for design file visualization

### Tool System

The extension includes a comprehensive tool system for file operations:

- **read-tool**: File reading with line-based access
- **write-tool**: File creation and modification
- **edit-tool**: In-place text replacements
- **multiedit-tool**: Batch file editing operations
- **grep-tool**: Text search across files
- **glob-tool**: File pattern matching
- **ls-tool**: Directory listing
- **bash-tool**: Shell command execution

### Configuration Management

- Extension settings stored in VS Code configuration
- API keys configured per provider (Anthropic, OpenAI, OpenRouter)
- Design files stored in `.superdesign/` directory
- Moodboard images saved to `.superdesign/moodboard/`

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

## Development Patterns

### Webview Communication

The extension uses a message-based system for webview communication:

- Commands sent via `vscode.postMessage()`
- Message handling in `ChatMessageService`
- Context propagation through `WebviewContext`

### AI Integration

- Multi-provider support with unified interface
- Streaming responses for real-time chat
- Tool execution within secure context
- Model selection per provider (configurable)

### File Operations

- All file operations go through VS Code's file system API
- Working directory managed relative to workspace root
- Tool results include proper error handling and validation

### Error Handling

Centralized error handling with user-friendly messages and actionable error responses (e.g., API key configuration prompts).

### Extension Lifecycle

Proper disposal patterns for file watchers, webview panels, and event subscriptions to prevent memory leaks.

## Testing Strategy

The project uses a modular testing approach:

- **Core tests**: Basic extension functionality
- **LLM tests**: AI service integration
- **Tool tests**: File operation tools
- **Agent tests**: Combined agent functionality

Run specific test suites based on the area being modified.

### Security Considerations

- API keys stored in VS Code's secure configuration system
- Content Security Policy enforcement for webviews
- Sandboxed file operations within workspace boundaries

## Important Notes

### Cursor Rules Integration

The project includes comprehensive Cursor rules in `.cursor/rules/`:

- Follow the dev workflow patterns in `dev_workflow.mdc`
- Use Taskmaster for complex feature development
- Reference `cursor_rules.mdc` for rule structure guidelines

### Security Considerations

- API keys stored in VS Code secure storage
- File operations restricted to workspace scope
- Webview content security policies enforced
- Base64 image handling with size limits

### Design Storage

- Generated designs saved locally in `.superdesign/`
- Moodboard images stored in `.superdesign/moodboard/`
- No external file dependencies for core functionality

# VSCode Extension Development Best Practices

## Important: You have access to VSCode API docs in the vscode-docs folder

## Project Setup & Structure

- Keep `package.json` manifest accurate with all contributions
- Use `.vscodeignore` to exclude test files and source maps from published extension
- Enable strict TypeScript: `"strict": true` in `tsconfig.json`
- Target ES2020+ for modern VSCode versions
- Use ESLint with `@typescript-eslint` parser
- Configure Prettier for consistent formatting

## TypeScript Best Practices

- Prefer `const` over `let`, never use `var`
- Use explicit return types for public APIs
- Leverage type inference for local variables
- Define interfaces for complex objects, not type aliases
- Use enums sparingly, prefer const assertions or union types
- Implement proper error types, not generic `Error`
- Use optional chaining `?.` and nullish coalescing `??`
- Prefer `readonly` arrays and properties where applicable
- Use generic constraints for reusable components
- Avoid `any`, use `unknown` when type is truly unknown
- Implement discriminated unions for state management
- Use template literal types for string patterns

## Extension Lifecycle

- Register all disposables in `activate()` context.subscriptions
- Implement proper `deactivate()` cleanup
- Use activation events precisely: `onCommand`, `onLanguage`, `onStartupFinished`
- Avoid `*` activation event unless absolutely necessary
- Defer heavy initialization until actually needed
- Cache expensive computations at module level
- Handle extension updates gracefully with migration logic

## Command Implementation

- Register commands in both `package.json` and code
- Use consistent command naming: `extension.commandName`
- Validate command arguments before execution
- Show progress for long-running commands: `vscode.window.withProgress`
- Provide keyboard shortcuts for common commands
- Implement command palette categories with prefixes
- Return promises from command handlers for testing
- Use `when` clauses for context-sensitive commands

## Configuration Management

- Define configuration schema in `package.json` contributes.configuration
- Use `vscode.workspace.getConfiguration()` with scope
- Listen to configuration changes: `vscode.workspace.onDidChangeConfiguration`
- Provide sensible defaults for all settings
- Validate configuration values before use
- Support workspace-specific settings
- Document settings with clear descriptions and examples
- Use enumerated values for limited options

## UI/UX Guidelines

- Use built-in VSCode UI components and themes
- Show information messages sparingly
- Prefer status bar for persistent status
- Use QuickPick for selection from lists
- Implement InputBox validation
- Provide clear error messages with recovery actions
- Use TreeView for hierarchical data
- Implement WebviewView for complex UI
- Follow VSCode's UI consistency guidelines
- Support both light and dark themes

## API Usage

- Check API version compatibility
- Use `vscode.ExtensionContext` for storage and secrets
- Leverage `vscode.Uri` for file operations
- Use `vscode.workspace.fs` for file system access
- Implement TextDocumentContentProvider for virtual documents
- Use diagnostic collections for problems reporting
- Leverage language features APIs appropriately
- Cache API results when possible
- Handle API deprecations gracefully

## Performance Optimization

- Lazy-load modules with dynamic imports
- Use webpack for bundling production builds
- Minimize extension size with tree-shaking
- Debounce frequent events like `onDidChangeTextDocument`
- Implement cancellation tokens for long operations
- Use workers for CPU-intensive tasks
- Profile with VSCode's Extension Host Profiler
- Avoid blocking the extension host
- Batch workspace edits
- Cache parsed ASTs and computations

## Testing Strategy

- Write unit tests with Mocha and vscode-test-cli
- Implement integration tests using `@vscode/test-electron`
- Mock VSCode API in unit tests
- Test multiple VSCode versions in CI
- Use snapshot testing for complex outputs
- Test with different workspace configurations
- Implement E2E tests for critical workflows
- Maintain >80% code coverage
- Test error scenarios and edge cases

## Error Handling

- Wrap all async operations in try-catch
- Log errors to output channel, not console
- Provide user-friendly error messages
- Implement fallback behaviors
- Use custom error classes with error codes
- Report telemetry for critical errors (with consent)
- Validate external data and API responses
- Handle network failures gracefully
- Implement retry logic with exponential backoff

## Security Practices

- Never store secrets in settings or state
- Use `ExtensionContext.secrets` for sensitive data
- Validate all user inputs
- Sanitize content for webviews
- Use Content Security Policy in webviews
- Avoid `eval()` and dynamic code execution
- Review dependencies for vulnerabilities
- Implement proper URI handling
- Use subprocess with caution
- Follow principle of least privilege

## Publishing & Distribution

- Semantic versioning: MAJOR.MINOR.PATCH
- Maintain comprehensive CHANGELOG.md
- Write clear README with features and usage
- Include screenshots and GIFs
- Set appropriate categories and keywords
- Use `vsce` CLI for packaging
- Test packaged extension before publishing
- Implement CI/CD pipeline
- Monitor user reviews and issues
- Provide migration guides for breaking changes

## Debugging & Logging

- Use output channels for extension logs
- Implement log levels (error, warn, info, debug)
- Add trace logging for troubleshooting
- Use VSCode's built-in debugger
- Set breakpoints in TypeScript source
- Debug webviews with Developer Tools
- Profile performance bottlenecks
- Monitor extension host memory usage
- Implement telemetry (with user consent)

## Language Server Protocol (LSP)

- Implement LSP for language support
- Use `vscode-languageclient` package
- Separate server logic from extension
- Implement incremental text synchronization
- Cache language server results
- Handle server crashes gracefully
- Support multiple workspace folders
- Implement custom LSP extensions carefully
- Profile server performance

## Webview Best Practices

- Use webview API v2 with retainContextWhenHidden
- Implement message passing protocol
- Sanitize all dynamic content
- Use VSCode's webview UI toolkit
- Implement state restoration
- Handle webview disposal properly
- Minimize webview resource usage
- Support VSCode themes in webview
- Use nonces for script security

## Multi-root Workspace Support

- Test with multi-root workspaces
- Use workspace folders API
- Handle workspace folder changes
- Scope settings per workspace folder
- Implement workspace-relative paths
- Support workspace trust API
- Handle untrusted workspace mode
- Validate cross-folder operations

## Accessibility

- Provide keyboard navigation for all features
- Include ARIA labels for custom UI
- Support screen readers
- Test with high contrast themes
- Implement focus management
- Provide text alternatives for icons
- Follow WCAG 2.1 guidelines
- Support reduced motion preferences

## Resource Management

- Dispose event listeners properly
- Clear timers and intervals
- Close file watchers when done
- Dispose webviews and views
- Clean up temporary files
- Implement disposable pattern
- Use WeakMap for object associations
- Monitor memory leaks in development
- Release large objects explicitly

## Documentation

- Document all public APIs with JSDoc
- Include code examples in documentation
- Maintain API compatibility
- Document breaking changes
- Provide troubleshooting guide
- Include contribution guidelines
- Document configuration options
- Create user-facing documentation

## Libraries

- Use zod v4, you can read documentation at https://zod.dev/v4/changelog
- Use Vercel AI SDK v5, you can read documentation at https://ai-sdk.dev/docs/reference/
