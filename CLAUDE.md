# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a minimal Windows system tray application for Todoist built with Electron. The app provides quick access to view todos, add new ones, and complete/uncomplete tasks directly from the system tray without opening the full Todoist application.

## Common Commands

- **Start development**: `npm start`
- **Build both installer and portable**: `npm run build`
- **Build portable exe only**: `npm run build-portable`
- **Build installer only**: `npm run build-installer`
- **Build without publishing**: `npm run dist`

## Architecture

### Main Process (main.js)
- **Tray Management**: Creates and manages the system tray icon with context menu including Settings option
- **Window Management**: Creates frameless, always-on-top popup windows that auto-position near the tray icon
- **Settings Window**: Separate modal window for API key configuration
- **API Integration**: Handles IPC communication with Todoist Sync API v9 and REST API v2
- **Configuration Management**: Handles reading/writing config.json with API token
- **Key IPC Handlers**:
  - `get-todos`: Fetches active and recently completed tasks (last 3 days)
  - `add-todo`: Creates new tasks via REST API v2
  - `complete-todo`: Marks tasks as complete via Sync API
  - `reopen-todo`: Reopens completed tasks via Sync API
  - `get-api-key`: Retrieves stored API token
  - `save-api-key`: Saves API token to config.json
  - `get-theme`: Returns system dark/light theme preference
  - `resize-window`: Dynamically resizes popup based on content

### Renderer Process (renderer/)
- **index.html**: Main popup UI with todo list, add todo input, and task management
- **renderer.js**: Handles UI interactions, API communication via IPC, theme detection, and DOM manipulation
- **styles.css**: Comprehensive styling with dark/light theme support
- **settings.html**: Settings dialog for API key configuration
- **settings.js**: Settings dialog functionality with password toggle and validation
- **settings.css**: Settings dialog styling matching main app theme

### Configuration Setup
- **Built-in Settings Dialog**: Users can configure API token via right-click → Settings
- **Automatic config.json creation**: Settings dialog creates config file if it doesn't exist
- **Fallback support**: Still supports manual config.json editing for advanced users
- **Security**: API token stored locally, not transmitted except to Todoist API

### Key Features
- **Todo Management**: View, add, complete, and uncomplete todos
- **Recent Completions**: Shows completed items from last 3 days
- **Auto-sync**: Refreshes todos every 30 seconds
- **Theme Support**: Automatic dark/light theme detection
- **Smart Positioning**: Window positions intelligently relative to tray with screen boundary detection
- **Keyboard Shortcuts**: Enter to add todos, Escape to close windows
- **Auto-hide**: Windows hide on blur (clicking outside)

### Window Behavior
- **Main Window**: Auto-hides on blur, positions near tray icon, resizes based on content
- **Settings Window**: Modal dialog, centers on screen, auto-focuses input, closes on blur/escape
- **Frameless Design**: Custom window controls and behaviors

### Security Notes
- Uses `nodeIntegration: true` and `contextIsolation: false` for simplicity
- API token stored in local config.json file only
- No sensitive data in renderer processes
- config.json excluded from version control

### Build & Distribution
- **GitHub Actions**: Automated builds on version tags (v1.0, v1.1, etc.)
- **Dual Output**: Creates both NSIS installer and portable executable
- **Auto-releases**: GitHub releases created automatically with built files
- **Windows-focused**: Optimized for Windows system tray integration

## File Structure
```
main.js                    # Main Electron process
renderer/
├── index.html            # Main popup window UI
├── styles.css            # Main app styling with theme support
├── renderer.js           # Main app frontend logic
├── settings.html         # Settings dialog UI
├── settings.css          # Settings dialog styling
└── settings.js           # Settings dialog functionality
assets/
├── tray-icon.png         # System tray icon (32x32 PNG)
└── icon.ico              # Application icon for builds
screenshots/
└── main.png              # App screenshot for README
.github/workflows/
└── release.yml           # GitHub Actions for automated builds
```