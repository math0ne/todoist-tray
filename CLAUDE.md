# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a minimal Windows system tray application for Todoist built with Electron. The app provides quick access to view and add todos directly from the system tray without opening the full Todoist application.

## Common Commands

- **Start development**: `npm start`
- **Build for production**: `npm run build`
- **Create distribution package**: `npm run dist`

## Architecture

### Main Process (main.js)
- **Tray Management**: Creates and manages the system tray icon with context menu
- **Window Management**: Creates a frameless, always-on-top popup window that auto-positions near the tray icon
- **API Integration**: Handles IPC communication with Todoist REST API v2 for fetching and creating tasks
- **Key IPC Handlers**:
  - `get-todos`: Fetches incomplete tasks (limited to 10)
  - `add-todo`: Creates new tasks via API

### Renderer Process (renderer/)
- **index.html**: Simple popup UI with todo list, add todo input, and refresh button
- **renderer.js**: Handles UI interactions, API communication via IPC, and DOM manipulation
- **styles.css**: Minimal styling for the popup interface

### Configuration Setup
- Requires `config.json` file with Todoist API token
- Copy from `config.example.json` and update with your token
- Token obtained from Todoist Integrations settings
- Config file is gitignored for security

### Window Behavior
- Window auto-hides on blur (clicking outside)
- Intelligent positioning relative to tray icon with screen boundary detection
- Frameless design with custom close behavior

### Security Notes
- Uses `nodeIntegration: true` and `contextIsolation: false` for simplicity
- API token loaded from config.json in main process only
- No sensitive data stored in renderer process
- config.json is excluded from version control

## File Structure
```
main.js              # Main Electron process
renderer/
├── index.html       # Popup window UI
├── styles.css       # Styling
└── renderer.js      # Frontend logic
assets/
└── tray-icon.png    # System tray icon (16x16 PNG)
```