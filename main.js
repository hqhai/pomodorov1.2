const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerMonitor } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isBubbleMode = false;
let idleCheckInterval = null;
let isShaking = false; // Track if currently shaking
let currentTimerMode = 'work'; // Track timer mode: 'work' or 'waiting'
let currentTimerState = 'stopped'; // Track timer state: 'running', 'paused', 'stopped'
let IDLE_THRESHOLD = 10; // seconds (can be changed via settings)

const FULL_WIDTH = 320;
const FULL_HEIGHT = 520;
const BUBBLE_SIZE = 80;
const BUBBLE_WINDOW_SIZE = 100; // Extra space for X button

function createWindow() {
    mainWindow = new BrowserWindow({
        width: FULL_WIDTH,
        height: FULL_HEIGHT,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Keep window on top
    mainWindow.setAlwaysOnTop(true, 'floating');

    // Allow dragging the window
    mainWindow.setMovable(true);
}

function createTray() {
    // Create a simple 16x16 tray icon
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'freeze.webp'));
    const trayIcon = icon.resize({ width: 16, height: 16 });

    try {
        tray = new Tray(trayIcon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show/Hide',
                click: () => {
                    if (mainWindow.isVisible()) {
                        mainWindow.hide();
                    } else {
                        mainWindow.show();
                    }
                }
            },
            {
                label: 'Bubble Mode',
                click: () => toggleBubbleMode()
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => app.quit()
            }
        ]);

        tray.setToolTip('Pomodoro Timer');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        });
    } catch (e) {
        console.log('Tray icon error:', e);
    }
}

function toggleBubbleMode() {
    isBubbleMode = !isBubbleMode;

    if (isBubbleMode) {
        mainWindow.setMinimumSize(BUBBLE_WINDOW_SIZE, BUBBLE_WINDOW_SIZE);
        mainWindow.setSize(BUBBLE_WINDOW_SIZE, BUBBLE_WINDOW_SIZE);
        mainWindow.webContents.send('bubble-mode', true);

        // Move to bottom-right corner
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const x = width - BUBBLE_WINDOW_SIZE - 10; // 10px margin from right
        const y = height - BUBBLE_WINDOW_SIZE - 10; // 10px margin from bottom
        mainWindow.setPosition(x, y);
    } else {
        mainWindow.setMinimumSize(FULL_WIDTH, FULL_HEIGHT);
        mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
        mainWindow.webContents.send('bubble-mode', false);
        mainWindow.webContents.send('stop-shaking');

        // Center window when exiting bubble mode (zoom in)
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const x = Math.round((width - FULL_WIDTH) / 2);
        const y = Math.round((height - FULL_HEIGHT) / 2);
        mainWindow.setPosition(x, y);
    }
}

function startIdleCheck() {
    stopIdleCheck();
    idleCheckInterval = setInterval(() => {
        const idleTime = powerMonitor.getSystemIdleTime();
        // Only trigger idle shake when:
        // 1. In work mode
        // 2. Timer is RUNNING (not paused or stopped - freeze mode)
        // 3. Not already shaking
        // Works in both bubble mode and popup mode
        if (idleTime >= IDLE_THRESHOLD && currentTimerMode === 'work' && currentTimerState === 'running' && !isShaking) {
            // Show popup, center window, and shake
            showPopupAndShake();
        }

        // Stop shaking when user returns (idle time resets)
        if (isShaking && idleTime < IDLE_THRESHOLD) {
            stopShaking();
        }
    }, 1000);
}

function stopIdleCheck() {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
}

function exitBubbleAndShake() {
    // Exit bubble mode
    isBubbleMode = false;
    mainWindow.setMinimumSize(FULL_WIDTH, FULL_HEIGHT);
    mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
    mainWindow.webContents.send('bubble-mode', false);
    stopIdleCheck();

    // Center window on screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const x = Math.round((width - FULL_WIDTH) / 2);
    const y = Math.round((height - FULL_HEIGHT) / 2);
    mainWindow.setPosition(x, y);

    // Start shaking
    mainWindow.webContents.send('start-shaking');
}

function showPopupAndShake() {
    // If in bubble mode, exit it first
    if (isBubbleMode) {
        isBubbleMode = false;
        mainWindow.setMinimumSize(FULL_WIDTH, FULL_HEIGHT);
        mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
        mainWindow.webContents.send('bubble-mode', false);
    }

    // Center window on screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const x = Math.round((width - FULL_WIDTH) / 2);
    const y = Math.round((height - FULL_HEIGHT) / 2);
    mainWindow.setPosition(x, y);

    // Show window if hidden
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }

    // Start shaking continuously
    isShaking = true;
    mainWindow.webContents.send('start-shaking');
}

function stopShaking() {
    isShaking = false;
    mainWindow.webContents.send('stop-shaking');
}

// IPC handlers
ipcMain.on('toggle-bubble', () => {
    toggleBubbleMode();
});

ipcMain.on('close-app', () => {
    app.quit();
});

ipcMain.on('minimize-to-tray', () => {
    mainWindow.hide();
});

// Listen for timer mode changes from renderer
ipcMain.on('timer-mode-changed', (event, mode) => {
    currentTimerMode = mode;
});

// Listen for timer state changes from renderer
ipcMain.on('timer-state-changed', (event, state) => {
    currentTimerState = state;
});

// Listen for idle time setting changes from renderer
ipcMain.on('idle-time-changed', (event, idleTime) => {
    IDLE_THRESHOLD = idleTime;
});

// Handle break finished - show popup and shake until user activity detected
ipcMain.on('break-finished', () => {
    // If in bubble mode, exit it first
    if (isBubbleMode) {
        isBubbleMode = false;
        mainWindow.setMinimumSize(FULL_WIDTH, FULL_HEIGHT);
        mainWindow.setSize(FULL_WIDTH, FULL_HEIGHT);
        mainWindow.webContents.send('bubble-mode', false);
    }

    // Center window on screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const x = Math.round((width - FULL_WIDTH) / 2);
    const y = Math.round((height - FULL_HEIGHT) / 2);
    mainWindow.setPosition(x, y);

    // Show window if hidden
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }

    // Start shaking and track state
    isShaking = true;
    mainWindow.webContents.send('start-shaking');

    // Start checking for user activity to stop shaking
    startBreakShakeCheck();
});

let breakShakeCheckInterval = null;

function startBreakShakeCheck() {
    if (breakShakeCheckInterval) {
        clearInterval(breakShakeCheckInterval);
    }

    breakShakeCheckInterval = setInterval(() => {
        const idleTime = powerMonitor.getSystemIdleTime();
        // Stop shaking when user activity detected (idle time < 2 seconds)
        if (isShaking && idleTime < 2) {
            stopShaking();
            clearInterval(breakShakeCheckInterval);
            breakShakeCheckInterval = null;
        }
    }, 500);
}

app.whenReady().then(() => {
    createWindow();
    createTray();
    startIdleCheck(); // Start idle check on app launch
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
