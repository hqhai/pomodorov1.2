const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerMonitor } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isBubbleMode = false;
let idleCheckInterval = null;
const IDLE_THRESHOLD = 10; // seconds

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
        startIdleCheck();

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
        stopIdleCheck();

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
        if (idleTime >= IDLE_THRESHOLD && isBubbleMode) {
            // Exit bubble mode, center window, and shake
            exitBubbleAndShake();
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

app.whenReady().then(() => {
    createWindow();
    createTray();
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
