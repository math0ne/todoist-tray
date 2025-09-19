# Minimal Todoist - Windows System Tray App

A minimal Windows system tray application for Todoist using Electron. Click the tray icon to see your latest todos and add new ones quickly.

## Features

- System tray integration with click-to-show popup
- View latest 10 todos from any list
- Add new todos directly from the popup
- Clean, minimal interface
- Window positions automatically above tray icon

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get your Todoist API token:**
   - Go to [Todoist Integrations](https://todoist.com/prefs/integrations)
   - Copy your API token

3. **Create config file:**
   ```bash
   # Copy the example config file
   cp config.example.json config.json

   # Edit config.json and replace "your_todoist_api_token_here" with your actual token
   ```

4. **Create tray icon:**
   - Create a 16x16 pixel PNG icon named `tray-icon.png` in the `assets/` folder
   - You can use any simple icon - a red square with white "T" works well

5. **Run the app:**
   ```bash
   npm start
   ```

## Usage

- The app will appear in your system tray
- Click the tray icon to open the popup window
- The window shows your latest todos and has an input field to add new ones
- The window automatically hides when you click outside it
- Right-click the tray icon for context menu options

## Building for Distribution

```bash
npm run build
```

This creates an installer in the `dist/` folder.

## File Structure

```
minimal-todoist/
├── main.js              # Main Electron process
├── renderer/
│   ├── index.html       # Popup window UI
│   ├── styles.css       # Styling
│   └── renderer.js      # Frontend logic
├── assets/
│   └── tray-icon.png    # System tray icon
└── package.json
```