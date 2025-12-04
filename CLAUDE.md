# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron-based desktop Pomodoro Timer application with a unique "bubble mode" feature. The application uses vanilla JavaScript, HTML, and CSS with no external frameworks.

## Development Commands

```bash
# Start the application in development mode
npm start

# Build the application for Windows
npm run build
```

Note: The build outputs to the `dist/` directory as a portable Windows application (not an installer).

## Architecture

### Core Components

1. **Main Process (`main.js`)**
   - Electron main process handling window management
   - System tray integration with context menu
   - Bubble mode implementation with idle detection
   - IPC communication bridge
   - Window positioning and sizing logic

2. **Renderer Process (`index.html`, `script.js`, `style.css`)**
   - Timer functionality with state persistence
   - Visual feedback with SVG progress rings
   - Mode switching (work/break)
   - Notification system
   - Bubble mode UI adaptation

### Key Features

- **Pomodoro Timer**: 25-minute work sessions, 5-minute short breaks, 10-minute long breaks
- **Bubble Mode**: Miniaturized 100x100px floating mode that auto-exits after 10 seconds of system idle
- **State Persistence**: Timer state saved to localStorage across app restarts
- **System Tray**: Tray icon with Show/Hide, Bubble Mode, and Quit options
- **Always on Top**: Window stays floating above other applications
- **Custom Window Frame**: Frameless window with custom draggable header

### File Structure

```
pomodorov1.2/
├── main.js          # Electron main process
├── index.html       # Main UI (Vietnamese language)
├── script.js        # Timer logic and IPC handling
├── style.css        # UI styling with CSS custom properties
├── assets/          # Images and icons
│   ├── Fire.gif     # Work mode animation
│   ├── freeze.webp  # Break mode icon
│   ├── icon.png     # App icon
│   └── tray-icon.png # System tray icon
└── package.json     # Project configuration
```

### Important Technical Details

1. **Security Configuration**
   - Uses `nodeIntegration: true` and `contextIsolation: false`
   - When modifying, consider implementing preload scripts for better security

2. **Window Modes**
   - Full mode: 320x520px
   - Bubble mode: 100x100px
   - Automatic positioning to bottom-right corner in bubble mode
   - Centered window when exiting bubble mode

3. **Timer State Management**
   - State saved with timestamp for accurate time recovery
   - Automatic completion detection if timer was running during app restart
   - Cycle counting for long break triggers (after 5 work sessions)

4. **IPC Communication**
   - `toggle-bubble`: Switch between normal and bubble mode
   - `close-app`: Application termination
   - `bubble-mode`: Renderer notification of mode change
   - `start-shaking`/`stop-shaking`: Visual feedback animations

### Development Notes

- The UI text is in Vietnamese, but code comments and variable names are in English
- The app uses CSS custom properties for easy theming
- Progress visualization uses SVG with stroke-dasharray animation
- Shake animation is implemented via CSS keyframes
- The app monitors system idle time via Electron's powerMonitor API

### Build Configuration

- App ID: `com.hqhai.pomodoro-timer`
- Product Name: `Pomodoro Timer`
- Windows target: directory output (not NSIS installer)
- All files except `node_modules/` and `dist/` are included in the build