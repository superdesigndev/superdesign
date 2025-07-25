# Change Log

All notable changes to the "superdesign" extension will be documented in this file.

## [0.0.9] - 2025-07-25

### Added

- Google Gemini as a new AI provider
- Command to configure Google API Key (`superdesign.configureGoogleApiKey`)
- Model selection for Gemini in the chat interface

### Improved

- Extended provider support in the backend service
- Enhanced error handling for API key configuration across all providers

## [0.0.8] - 2025-07-01

### Added

- Settings icon in chat sidebar for easy access to extension configuration
- In-chat action buttons for API key configuration and settings access
- Enhanced error handling with user-friendly action options

### Improved

- Error messages now specifically mention "Anthropic API key" for clarity
- API key validation and authentication error detection
- User experience with cleaner error handling workflow
- Settings integration with direct commands for API key configuration

### Fixed

- Raw JSON error messages no longer display in chat interface
- Notification popups replaced with cleaner in-chat error messages
- Error message filtering to prevent duplicate or confusing displays
- Process exit errors now properly handled with action buttons

### Technical

- Enhanced `ClaudeCodeService` error detection patterns
- Improved `ChatMessageService` error filtering and handling
- Better error message routing between extension and webview
- Streamlined API key refresh and validation logic

## [0.0.7] - 2025-07-01

### Added

- Default style sheet integration for enhanced design consistency
- Project initialization command (`superdesign.initializeProject`)
- CSS file loading support for custom styling
- Copy file path functionality in Design Frame component

### Improved

- Updated icon design and visual elements
- Enhanced Design Frame component with better user interactions
- Extended file handling capabilities

### Documentation

- Updated README with improved instructions and examples

## [0.0.6] - 2025-06-26

### Added

- Centralized logging system with configurable log levels
- Enhanced error handling and debugging capabilities
- Improved Claude Code service integration

### Fixed

- Performance optimizations and stability improvements
- Better error messages and user feedback

## [0.0.5] - 2025-06-26

### Added

- Enhanced chat interface functionality
- Improved AI provider integrations

## [0.0.4] - 2025-06-26

### Added

- Additional design tools and utilities
- Better canvas interaction features

## [0.0.3] - 2025-06-25

### Added

- Enhanced design frame capabilities
- Improved user experience features

## [0.0.2] - 2025-06-25

### Added

- Publish to Open VSX Registry

## [0.0.1] - 2025-06-24

### Added

- Initial release of Super Design VS Code extension
- Interactive chat interface with AI assistance
- Canvas view for visual design layout
- Design frame components for organizing content
- Connection lines for linking design elements
- Welcome screen for first-time users
- Claude Code service integration
- Chat sidebar provider for seamless VS Code integration
- Support for multiple AI provider logos (Claude, Cursor, Bolt, Lovable, Windsurf)
- Markdown rendering capabilities
- Grid layout utilities for canvas organization
- TypeScript support with comprehensive type definitions

### Features

- **Chat Interface**: Real-time conversation with AI assistants
- **Visual Canvas**: Drag-and-drop design environment
- **Design Frames**: Organized content containers
- **Welcome Experience**: Guided onboarding for new users
- **Multi-Provider Support**: Integration with various AI coding assistants
