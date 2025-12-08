const { ipcRenderer } = require('electron');

// Timer Settings (default values)
let WORK_TIME = 25 * 60;
let BREAK_TIME = 5 * 60;
let IDLE_TIME = 10; // seconds
let AUTO_LOOP = true;
let VIBE_CODING_MODE = false; // New Vibe Coding mode setting
let AUTO_STOP_CONTINUE = false; // New auto-stop/continue setting

const CIRCLE_RADIUS = 100;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

// Timer State
let timerInterval;
let timeLeft = WORK_TIME;
let totalTime = WORK_TIME;
let currentMode = 'work';
let timerState = 'stopped';
let cycleCount = 0;
let totalWorkSeconds = 0; // Total work time in seconds
let totalVibeCodingSeconds = 0; // Total Vibe Coding time in seconds

// DOM Elements
const timeDisplay = document.getElementById('time');
const modeText = document.getElementById('mode-text');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const statusIcon = document.getElementById('status-icon');
const progressCircle = document.querySelector('.progress-ring__circle');
const cycleCountDisplay = document.getElementById('cycle-count');
const totalWorkTimeDisplay = document.getElementById('total-work-time');
const iconTrigger = document.getElementById('icon-trigger');
const body = document.body;

// Header Controls
const btnBubble = document.getElementById('btn-bubble');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const workTimeInput = document.getElementById('work-time-input');
const breakTimeInput = document.getElementById('break-time-input');
const idleTimeInput = document.getElementById('idle-time-input');
const autoLoopToggle = document.getElementById('auto-loop-toggle');
const vibeCodingToggle = document.getElementById('vibe-coding-toggle');
const autoStopContinueToggle = document.getElementById('auto-stop-continue-toggle');
const saveSettingsBtn = document.getElementById('save-settings');

// Initialize
function init() {
    progressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = 0;

    // Load saved settings first
    loadSettings();

    // Load saved state
    loadState();
    updateDisplay();
    updateStateVisuals();
    updateButtons();
}

// Settings Management
function loadSettings() {
    const savedSettings = localStorage.getItem('pomodoroSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        WORK_TIME = settings.workTime || 25 * 60;
        BREAK_TIME = settings.breakTime || 5 * 60;
        IDLE_TIME = settings.idleTime || 10;
        AUTO_LOOP = settings.autoLoop !== undefined ? settings.autoLoop : true;
        VIBE_CODING_MODE = settings.vibeCodingMode !== undefined ? settings.vibeCodingMode : false;
        AUTO_STOP_CONTINUE = settings.autoStopContinue !== undefined ? settings.autoStopContinue : false;
    }

    // Update input fields
    workTimeInput.value = Math.floor(WORK_TIME / 60);
    breakTimeInput.value = Math.floor(BREAK_TIME / 60);
    idleTimeInput.value = IDLE_TIME;
    autoLoopToggle.checked = AUTO_LOOP;
    vibeCodingToggle.checked = VIBE_CODING_MODE;
    autoStopContinueToggle.checked = AUTO_STOP_CONTINUE;

    // Send idle time to main process
    ipcRenderer.send('idle-time-changed', IDLE_TIME);

    // Send auto-stop/continue setting to main process
    ipcRenderer.send('auto-stop-continue-changed', AUTO_STOP_CONTINUE);

    // Send Vibe Coding mode state to main process
    ipcRenderer.send('vibe-coding-mode-changed', VIBE_CODING_MODE);

    // Update timeLeft if timer is stopped
    if (timerState === 'stopped' && currentMode === 'work') {
        timeLeft = WORK_TIME;
        totalTime = WORK_TIME;
    }
}

function saveSettings() {
    const settings = {
        workTime: WORK_TIME,
        breakTime: BREAK_TIME,
        idleTime: IDLE_TIME,
        autoLoop: AUTO_LOOP,
        vibeCodingMode: VIBE_CODING_MODE,
        autoStopContinue: AUTO_STOP_CONTINUE
    };
    localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
}

function applySettings() {
    const newWorkTime = parseInt(workTimeInput.value) * 60;
    const newBreakTime = parseInt(breakTimeInput.value) * 60;
    const newIdleTime = parseInt(idleTimeInput.value);
    const newAutoLoop = autoLoopToggle.checked;
    const newVibeCodingMode = vibeCodingToggle.checked;
    const newAutoStopContinue = autoStopContinueToggle.checked;

    WORK_TIME = newWorkTime;
    BREAK_TIME = newBreakTime;
    IDLE_TIME = newIdleTime;
    AUTO_LOOP = newAutoLoop;
    VIBE_CODING_MODE = newVibeCodingMode;
    AUTO_STOP_CONTINUE = newAutoStopContinue;

    saveSettings();

    // Send idle time to main process
    ipcRenderer.send('idle-time-changed', IDLE_TIME);

    // Send auto-stop/continue setting to main process
    ipcRenderer.send('auto-stop-continue-changed', AUTO_STOP_CONTINUE);

    // Reset timer if stopped
    if (timerState === 'stopped') {
        if (currentMode === 'work') {
            timeLeft = WORK_TIME;
            totalTime = WORK_TIME;
        } else if (currentMode === 'waiting') {
            timeLeft = BREAK_TIME;
            totalTime = BREAK_TIME;
        }
        updateDisplay();
        setProgress(totalTime);
    }

    // Close settings panel
    settingsPanel.classList.add('hidden');
}

// State Management (localStorage for Electron)
function saveState() {
    const state = {
        timeLeft,
        totalTime,
        currentMode,
        timerState,
        cycleCount,
        totalWorkSeconds,
        totalVibeCodingSeconds,
        lastUpdated: Date.now(),
        currentDate: getTodayString()
    };
    localStorage.setItem('pomodoroState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('pomodoroState');
    if (saved) {
        const state = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - state.lastUpdated) / 1000);
        const savedDate = state.currentDate || getTodayString();
        const today = getTodayString();

        // Check if it's a new day - export and reset
        if (savedDate !== today) {
            exportDailyStats(savedDate, state.cycleCount || 0, state.totalWorkSeconds || 0);
            // Reset for new day
            cycleCount = 0;
            totalWorkSeconds = 0;
            totalVibeCodingSeconds = 0;
            timeLeft = WORK_TIME;
            totalTime = WORK_TIME;
            currentMode = 'work';
            timerState = 'stopped';
        } else {
            timeLeft = state.timeLeft;
            totalTime = state.totalTime;
            currentMode = state.currentMode;
            timerState = state.timerState;
            cycleCount = state.cycleCount || 0;
            totalWorkSeconds = state.totalWorkSeconds || 0;
            totalVibeCodingSeconds = state.totalVibeCodingSeconds || 0;

            if (timerState === 'running') {
                // Add elapsed work time if was in work mode
                if (currentMode === 'work') {
                    if (VIBE_CODING_MODE) {
                        totalVibeCodingSeconds += elapsed;
                    } else {
                        totalWorkSeconds += elapsed;
                    }
                }
                timeLeft -= elapsed;
                if (timeLeft <= 0) {
                    timeLeft = 0;
                    timerState = 'stopped';
                    completeCycle();
                } else {
                    startTimer();
                }
            }
        }

        cycleCountDisplay.textContent = cycleCount;
        updateTotalWorkTimeDisplay();
    }
}

// Get today's date as string (YYYY-MM-DD)
function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Export daily stats to txt file
function exportDailyStats(date, cycles, workSeconds, vibeCodingSeconds = 0) {
    const hours = Math.floor(workSeconds / 3600);
    const minutes = Math.floor((workSeconds % 3600) / 60);
    const seconds = workSeconds % 60;

    const vibeHours = Math.floor(vibeCodingSeconds / 3600);
    const vibeMinutes = Math.floor((vibeCodingSeconds % 3600) / 60);
    const vibeSeconds = vibeCodingSeconds % 60;

    const totalSeconds = workSeconds + vibeCodingSeconds;
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

    let content = `=== Pomodoro Timer - Báo cáo ngày ${date} ===

Số chu kỳ hoàn thành: ${cycles}
Tổng thời gian làm việc: ${hours}h ${minutes}m ${seconds}s`;

    if (vibeCodingSeconds > 0) {
        content += `\nThời gian Vibe Coding: ${vibeHours}h ${vibeMinutes}m ${vibeSeconds}s`;
    }

    content += `\nTổng thời gian: ${totalHours}h ${totalMinutes}m
Tổng số giây: ${totalSeconds}

---
Xuất lúc: ${new Date().toLocaleString('vi-VN')}
`;

    // Send to main process to save file
    ipcRenderer.send('export-daily-stats', { date, content });
}

// Timer Logic
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerState = 'running';
    updateStateVisuals();
    updateButtons();
    saveState();
    notifyTimerState();

    timerInterval = setInterval(() => {
        timeLeft--;

        // Track work time
        if (currentMode === 'work') {
            if (VIBE_CODING_MODE) {
                totalVibeCodingSeconds++;
            } else {
                totalWorkSeconds++;
            }
            updateTotalWorkTimeDisplay();
        }

        updateDisplay();
        setProgress(timeLeft);
        saveState();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            completeCycle();
        }
    }, 1000);
}

function pauseTimer() {
    if (timerState !== 'running') return;
    clearInterval(timerInterval);
    timerState = 'paused';
    updateStateVisuals();
    updateButtons();
    saveState();
    notifyTimerState();
}

function stopTimer() {
    clearInterval(timerInterval);
    timerState = 'stopped';
    resetTimer();
    updateStateVisuals();
    updateButtons();
    setProgress(totalTime);
    saveState();
    notifyTimerState();
}

function resetTimer() {
    if (currentMode === 'work') {
        timeLeft = WORK_TIME;
        totalTime = WORK_TIME;
    } else if (currentMode === 'waiting') {
        timeLeft = BREAK_TIME;
        totalTime = BREAK_TIME;
    }
    updateDisplay();
}

function completeCycle() {
    // Show notification
    const notificationBody = currentMode === 'work' ? 'Thời gian làm việc kết thúc!' : 'Thời gian nghỉ kết thúc!';
    new Notification('Pomodoro Timer', {
        body: notificationBody,
        icon: 'assets/icon.png'
    });

    if (currentMode === 'work') {
        // Work finished -> switch to break
        cycleCount++;
        cycleCountDisplay.textContent = cycleCount;
        switchMode('waiting');

        timerState = 'stopped';
        updateButtons();
        updateStateVisuals();
        saveState();

        // Auto-loop: only auto-start break after work
        if (AUTO_LOOP) {
            setTimeout(() => {
                startTimer();
            }, 1000);
        }
    } else {
        // Break finished -> switch to work, show popup and shake
        switchMode('work');

        timerState = 'stopped';
        updateButtons();
        updateStateVisuals();
        saveState();

        // Request main process to exit bubble mode (if in bubble) and shake
        ipcRenderer.send('break-finished');
    }
}

function switchMode(mode) {
    currentMode = mode;
    if (mode === 'work') {
        timeLeft = WORK_TIME;
        totalTime = WORK_TIME;
        modeText.textContent = 'POMODORO';
    } else if (mode === 'waiting') {
        timeLeft = BREAK_TIME;
        totalTime = BREAK_TIME;
        modeText.textContent = 'NGHỈ NGƠI';
    }
    updateDisplay();
    setProgress(totalTime);

    // Notify main process about mode change
    ipcRenderer.send('timer-mode-changed', mode);
}

// Notify main process about timer state changes
function notifyTimerState() {
    ipcRenderer.send('timer-state-changed', timerState);
}

// Update total work time display
function updateTotalWorkTimeDisplay() {
    const totalSeconds = totalWorkSeconds + totalVibeCodingSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    totalWorkTimeDisplay.textContent = `${hours}h ${minutes}m`;

    // If in Vibe Coding mode, update the display text to show it
    if (VIBE_CODING_MODE && totalVibeCodingSeconds > 0) {
        const vibeHours = Math.floor(totalVibeCodingSeconds / 3600);
        const vibeMinutes = Math.floor((totalVibeCodingSeconds % 3600) / 60);
        totalWorkTimeDisplay.style.color = '#FDD357'; // Yellow color for Vibe Coding
        // Add tooltip or additional info if needed
        totalWorkTimeDisplay.title = `Vibe Coding: ${vibeHours}h ${vibeMinutes}m`;
    } else {
        totalWorkTimeDisplay.style.color = '#4facfe'; // Default blue color
        totalWorkTimeDisplay.title = '';
    }
}

// UI Updates
function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function setProgress(time) {
    const offset = CIRCLE_CIRCUMFERENCE - (time / totalTime) * CIRCLE_CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = offset;
}

function updateStateVisuals() {
    if (timerState === 'running') {
        if (currentMode === 'waiting') {
            statusIcon.src = 'assets/waiting.gif';
            statusIcon.classList.remove('fire', 'ice', 'vibe');
            statusIcon.classList.add('waiting');
            progressCircle.style.stroke = '#4CAF50'; // Green color for waiting
        } else {
            if (VIBE_CODING_MODE) {
                statusIcon.src = 'assets/vibeCoding.gif';
                statusIcon.classList.add('vibe');
                statusIcon.classList.remove('fire', 'ice', 'waiting');
                progressCircle.style.stroke = '#FDD357'; // Yellow color for Vibe Coding
                body.classList.add('vibe-mode');
            } else {
                statusIcon.src = 'assets/Fire.gif';
                statusIcon.classList.add('fire');
                statusIcon.classList.remove('ice', 'waiting', 'vibe');
                progressCircle.style.stroke = '#ff6b6b'; // Red color for work
                body.classList.remove('vibe-mode');
            }
        }
        body.classList.remove('paused-state');
    } else {
        if (currentMode === 'waiting') {
            statusIcon.src = 'assets/waiting.gif';
            statusIcon.classList.remove('fire', 'ice', 'vibe');
            statusIcon.classList.add('waiting');
            progressCircle.style.stroke = '#4CAF50'; // Green color for waiting
        } else {
            statusIcon.src = 'assets/freeze.webp';
            statusIcon.classList.add('ice');
            statusIcon.classList.remove('fire', 'waiting', 'vibe');
            progressCircle.style.stroke = '#4facfe'; // Blue color for frozen state
            body.classList.remove('vibe-mode');
        }
        body.classList.add('paused-state');
    }
}

function updateButtons() {
    if (timerState === 'running') {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
    } else if (timerState === 'paused') {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
    } else if (timerState === 'stopped') {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
    }
}

// Reset Stats Button
const resetStatsBtn = document.getElementById('reset-stats-btn');

// Reset stats function
function resetStats() {
    const today = getTodayString();

    // Export current stats before reset
    if (cycleCount > 0 || totalWorkSeconds > 0 || totalVibeCodingSeconds > 0) {
        exportDailyStats(today, cycleCount, totalWorkSeconds, totalVibeCodingSeconds);
    }

    // Reset values
    cycleCount = 0;
    totalWorkSeconds = 0;
    totalVibeCodingSeconds = 0;

    // Update display
    cycleCountDisplay.textContent = cycleCount;
    updateTotalWorkTimeDisplay();

    // Save state
    saveState();
}

// Event Listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
stopBtn.addEventListener('click', stopTimer);
resetStatsBtn.addEventListener('click', resetStats);

// Settings Event Listeners
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

settingsClose.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', applySettings);

// Vibe Coding toggle immediate update
vibeCodingToggle.addEventListener('change', () => {
    VIBE_CODING_MODE = vibeCodingToggle.checked;
    saveSettings(); // Save immediately
    updateStateVisuals(); // Update visuals immediately
    updateTotalWorkTimeDisplay(); // Update display color
    // Send Vibe Coding mode state to main process
    ipcRenderer.send('vibe-coding-mode-changed', VIBE_CODING_MODE);
});

// Click on progress ring to toggle timer
iconTrigger.addEventListener('click', () => {
    if (timerState === 'running') {
        pauseTimer();
    } else {
        startTimer();
    }
});

// Double click to exit bubble mode
iconTrigger.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (body.classList.contains('bubble-mode')) {
        ipcRenderer.send('toggle-bubble');
    }
});

// Header Controls
btnBubble.addEventListener('click', () => {
    ipcRenderer.send('toggle-bubble');
});

// Bubble Exit Button
const bubbleExitBtn = document.getElementById('bubble-exit-btn');
bubbleExitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ipcRenderer.send('toggle-bubble');
});

btnMinimize.addEventListener('click', () => {
    ipcRenderer.send('minimize-to-tray');
});

btnClose.addEventListener('click', () => {
    ipcRenderer.send('close-app');
});

// IPC: Listen for bubble mode toggle from main process
ipcRenderer.on('bubble-mode', (event, isBubble) => {
    if (isBubble) {
        body.classList.add('bubble-mode');
    } else {
        body.classList.remove('bubble-mode');
    }
});

// IPC: Listen for shake events
ipcRenderer.on('start-shaking', () => {
    body.classList.add('shaking');
});

ipcRenderer.on('stop-shaking', () => {
    body.classList.remove('shaking');
});

// CSS animations are now handled inline

// IPC: Listen for auto-stop event
ipcRenderer.on('auto-stop', () => {
    if (timerState === 'running' && AUTO_STOP_CONTINUE) {
        // Only show indicator if NOT in bubble mode
        if (!body.classList.contains('bubble-mode')) {
            // Create indicator with absolute positioning relative to window, not body
            const indicator = document.createElement('div');
            indicator.className = 'auto-indicator';
            indicator.textContent = '⏸ Tự động dừng';

            // Use window dimensions for positioning
            const left = window.innerWidth / 2;
            const top = window.innerHeight / 2;

            indicator.style.cssText = `
                position: fixed;
                top: ${top}px;
                left: ${left}px;
                transform: translate(-50%, -50%);
                background: #ffc107;
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;

            // Add to document.body, not the body element in the DOM
            document.body.appendChild(indicator);

            // Fade in
            requestAnimationFrame(() => {
                indicator.style.opacity = '1';
            });

            // Fade out and remove
            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }, 800);
        }

        // Pause timer with a slight delay to avoid conflicts
        requestAnimationFrame(() => {
            pauseTimer();
        });
    }
});

// IPC: Listen for auto-continue event
ipcRenderer.on('auto-continue', () => {
    if (timerState === 'paused' && AUTO_STOP_CONTINUE) {
        // Only show indicator if NOT in bubble mode
        if (!body.classList.contains('bubble-mode')) {
            // Create indicator with absolute positioning
            const indicator = document.createElement('div');
            indicator.className = 'auto-indicator';
            indicator.textContent = '▶ Tự động tiếp tục';

            // Use window dimensions for positioning
            const left = window.innerWidth / 2;
            const top = window.innerHeight / 2;

            indicator.style.cssText = `
                position: fixed;
                top: ${top}px;
                left: ${left}px;
                transform: translate(-50%, -50%);
                background: #4caf50;
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;

            // Add to document.body
            document.body.appendChild(indicator);

            // Fade in
            requestAnimationFrame(() => {
                indicator.style.opacity = '1';
            });

            // Fade out and remove
            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }, 800);
        }

        // Start timer with a slight delay to avoid conflicts
        requestAnimationFrame(() => {
            startTimer();
        });
    }
});

// Initialize
init();
