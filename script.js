const { ipcRenderer } = require('electron');

// Timer Constants
const WORK_TIME = 25 * 60;
const SHORT_BREAK_TIME = 5 * 60;
const LONG_BREAK_TIME = 10 * 60;
const CYCLES_BEFORE_LONG_BREAK = 5;

const CIRCLE_RADIUS = 100;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

// Timer State
let timerInterval;
let timeLeft = WORK_TIME;
let totalTime = WORK_TIME;
let currentMode = 'work';
let timerState = 'stopped';
let cycleCount = 0;

// DOM Elements
const timeDisplay = document.getElementById('time');
const modeText = document.getElementById('mode-text');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const statusIcon = document.getElementById('status-icon');
const progressCircle = document.querySelector('.progress-ring__circle');
const cycleCountDisplay = document.getElementById('cycle-count');
const iconTrigger = document.getElementById('icon-trigger');
const body = document.body;

// Header Controls
const btnBubble = document.getElementById('btn-bubble');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

// Initialize
function init() {
    progressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = 0;

    // Load saved state
    loadState();
    updateDisplay();
    updateStateVisuals();
    updateButtons();
}

// State Management (localStorage for Electron)
function saveState() {
    const state = {
        timeLeft,
        totalTime,
        currentMode,
        timerState,
        cycleCount,
        lastUpdated: Date.now()
    };
    localStorage.setItem('pomodoroState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('pomodoroState');
    if (saved) {
        const state = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - state.lastUpdated) / 1000);

        timeLeft = state.timeLeft;
        totalTime = state.totalTime;
        currentMode = state.currentMode;
        timerState = state.timerState;
        cycleCount = state.cycleCount || 0;

        if (timerState === 'running') {
            timeLeft -= elapsed;
            if (timeLeft <= 0) {
                timeLeft = 0;
                timerState = 'stopped';
                completeCycle();
            } else {
                startTimer();
            }
        }

        cycleCountDisplay.textContent = cycleCount;
    }
}

// Timer Logic
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerState = 'running';
    updateStateVisuals();
    updateButtons();
    saveState();

    timerInterval = setInterval(() => {
        timeLeft--;
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
}

function stopTimer() {
    clearInterval(timerInterval);
    timerState = 'stopped';
    resetTimer();
    updateStateVisuals();
    updateButtons();
    setProgress(totalTime);
    saveState();
}

function resetTimer() {
    if (currentMode === 'work') {
        timeLeft = WORK_TIME;
        totalTime = WORK_TIME;
    } else if (currentMode === 'shortBreak') {
        timeLeft = SHORT_BREAK_TIME;
        totalTime = SHORT_BREAK_TIME;
    } else if (currentMode === 'longBreak') {
        timeLeft = LONG_BREAK_TIME;
        totalTime = LONG_BREAK_TIME;
    }
    updateDisplay();
}

function completeCycle() {
    // Show notification
    new Notification('Pomodoro Timer', {
        body: 'Timer Finished!',
        icon: 'assets/icon.png'
    });

    if (currentMode === 'work') {
        cycleCount++;
        cycleCountDisplay.textContent = cycleCount;

        if (cycleCount % CYCLES_BEFORE_LONG_BREAK === 0) {
            switchMode('longBreak');
        } else {
            switchMode('shortBreak');
        }
    } else {
        switchMode('work');
    }

    timerState = 'stopped';
    updateButtons();
    updateStateVisuals();
    saveState();
}

function switchMode(mode) {
    currentMode = mode;
    if (mode === 'work') {
        timeLeft = WORK_TIME;
        totalTime = WORK_TIME;
        modeText.textContent = 'POMODORO';
    } else if (mode === 'shortBreak') {
        timeLeft = SHORT_BREAK_TIME;
        totalTime = SHORT_BREAK_TIME;
        modeText.textContent = 'SHORT BREAK';
    } else if (mode === 'longBreak') {
        timeLeft = LONG_BREAK_TIME;
        totalTime = LONG_BREAK_TIME;
        modeText.textContent = 'LONG BREAK';
    }
    updateDisplay();
    setProgress(totalTime);
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
        statusIcon.src = 'assets/Fire.gif';
        statusIcon.classList.add('fire');
        statusIcon.classList.remove('ice');
        body.classList.remove('paused-state');
    } else {
        statusIcon.src = 'assets/freeze.webp';
        statusIcon.classList.add('ice');
        statusIcon.classList.remove('fire');
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

// Event Listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
stopBtn.addEventListener('click', stopTimer);

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

// Stop shaking on any user interaction
document.addEventListener('click', () => {
    if (body.classList.contains('shaking')) {
        body.classList.remove('shaking');
    }
});

document.addEventListener('mousemove', () => {
    if (body.classList.contains('shaking')) {
        body.classList.remove('shaking');
    }
});

// Initialize
init();
