/**
 * Solari Split-Flap Board Application Controller
 * Handles live API updates, column formatting, mode switching, and screensaver behavior.
 */

const MODES = [
    { id: 'unified', label: 'Unified Hub (By Time)' },
    { id: 'sjc', label: 'SJC Airport' },
    { id: 'caltrain', label: 'Caltrain Diridon' },
    { id: 'bart', label: 'BART Berryessa' },
    { id: 'amtrak', label: 'Amtrak Diridon' },
    { id: 'vta', label: 'VTA Branham' },
];

class SolariApp {
    constructor() {
        this.board = null;
        this.currentMode = 'unified';
        this.autoCycle = false; // Disabled by default as requested: Unified Hub stays unified
        this.cycleInterval = 25; // seconds per mode if enabled
        this.cycleTimer = null;
        this.fetchTimer = null;
        this.idleTimeout = null;
        this.soundEnabled = true;

        this.init();
    }

    init() {
        // Create 12-row x 52-column Solari Board to fill window height and width nicely
        this.board = new SplitFlapBoard('solariGrid', 12, 52);

        this.setupEventListeners();
        this.setupAudioUnblocker();
        this.setupScreensaverIdle();
        this.startClock();
        
        // Initial fetch
        this.loadDepartures();

        // Background poll every 15 seconds
        this.fetchTimer = setInterval(() => this.loadDepartures(), 15000);
    }

    setupAudioUnblocker() {
        const unlockPrompt = document.getElementById('audioUnlockPrompt');
        const unlock = () => {
            if (window.solariAudio) {
                window.solariAudio.init();
                if (window.solariAudio.ctx && window.solariAudio.ctx.state === 'running') {
                    if (unlockPrompt) unlockPrompt.style.display = 'none';
                }
            }
        };

        window.addEventListener('click', unlock);
        window.addEventListener('keydown', unlock);
        window.addEventListener('touchstart', unlock);

        // Check if already running
        setTimeout(() => {
            if (window.solariAudio && window.solariAudio.ctx && window.solariAudio.ctx.state === 'running') {
                if (unlockPrompt) unlockPrompt.style.display = 'none';
            }
        }, 500);
    }

    setupEventListeners() {
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.getAttribute('data-mode');
                this.setMode(mode);
            });
        });

        // Test Sound Button
        const testSoundBtn = document.getElementById('testSoundBtn');
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', () => {
                if (window.solariAudio) {
                    window.solariAudio.testClack();
                }
            });
        }

        // Sound Toggle Button
        const soundBtn = document.getElementById('soundToggleBtn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                this.soundEnabled = !this.soundEnabled;
                window.solariAudio.setMuted(!this.soundEnabled);
                soundBtn.classList.toggle('active', this.soundEnabled);
                soundBtn.innerHTML = this.soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
                if (this.soundEnabled) {
                    window.solariAudio.testClack();
                }
            });
        }

        // Fullscreen Toggle
        const fsBtn = document.getElementById('fullscreenBtn');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Auto Cycle Toggle
        const cycleBtn = document.getElementById('cycleToggleBtn');
        if (cycleBtn) {
            cycleBtn.classList.toggle('active', this.autoCycle);
            cycleBtn.innerHTML = this.autoCycle ? '⟳ Auto-Cycle: ON' : '⏸ Auto-Cycle: OFF';
            cycleBtn.addEventListener('click', () => {
                this.autoCycle = !this.autoCycle;
                cycleBtn.classList.toggle('active', this.autoCycle);
                cycleBtn.innerHTML = this.autoCycle ? '⟳ Auto-Cycle: ON' : '⏸ Auto-Cycle: OFF';
                if (this.autoCycle) {
                    this.resetCycleTimer();
                } else if (this.cycleTimer) {
                    clearInterval(this.cycleTimer);
                }
            });
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            } else if (e.key === 'm' || e.key === 'M') {
                if (soundBtn) soundBtn.click();
            } else if (e.key === 't' || e.key === 'T') {
                if (testSoundBtn) testSoundBtn.click();
            } else if (e.key === ' ') {
                e.preventDefault();
                this.nextMode();
            } else if (e.key >= '1' && e.key <= '6') {
                const idx = parseInt(e.key) - 1;
                if (MODES[idx]) {
                    this.setMode(MODES[idx].id);
                }
            }
        });
    }

    setupScreensaverIdle() {
        const onActivity = () => {
            document.body.classList.remove('idle');
            clearTimeout(this.idleTimeout);
            this.idleTimeout = setTimeout(() => {
                document.body.classList.add('idle');
            }, 4000);
        };

        window.addEventListener('mousemove', onActivity);
        window.addEventListener('mousedown', onActivity);
        window.addEventListener('keydown', onActivity);
        window.addEventListener('touchstart', onActivity);
        this.idleTimeout = setTimeout(() => document.body.classList.add('idle'), 4000);
    }

    startClock() {
        const clockEl = document.getElementById('stationClock');
        const update = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
            if (clockEl) {
                clockEl.textContent = timeStr;
            }
        };
        update();
        setInterval(update, 1000);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    resetCycleTimer() {
        if (this.cycleTimer) clearInterval(this.cycleTimer);
        if (!this.autoCycle) return;

        this.cycleTimer = setInterval(() => {
            this.nextMode();
        }, this.cycleInterval * 1000);
    }

    nextMode() {
        const currentIdx = MODES.findIndex(m => m.id === this.currentMode);
        const nextIdx = (currentIdx + 1) % MODES.length;
        this.setMode(MODES[nextIdx].id);
    }

    setMode(modeId) {
        this.currentMode = modeId;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-mode') === modeId);
        });

        if (this.autoCycle) {
            this.resetCycleTimer();
        }
        this.loadDepartures();
    }

    formatRow(item) {
        // Layout:
        // TYPE (3) + ' ' (1) + TIME (5) + ' ' (1) + SERVICE (10) + ' ' (1) + DEST (16) + ' ' (1) + TRK (5) + ' ' (1) + STATUS (8) = 52 characters
        const type = (item.type || 'DEP').padEnd(3, ' ').slice(0, 3);
        const time = (item.time || '--:--').padEnd(5, ' ').slice(0, 5);
        const service = (item.service || '').padEnd(10, ' ').slice(0, 10);
        const dest = (item.destination || '').padEnd(16, ' ').slice(0, 16);
        const track = (item.track || '').padEnd(5, ' ').slice(0, 5);
        const status = (item.status || '').padEnd(8, ' ').slice(0, 8);

        return `${type} ${time} ${service} ${dest} ${track} ${status}`;
    }

    async loadDepartures() {
        try {
            const resp = await fetch(`/api/departures?mode=${this.currentMode}&limit=12`);
            if (!resp.ok) return;

            const data = await resp.json();
            
            const titleEl = document.getElementById('stationTitle');
            if (titleEl && data.header) {
                titleEl.textContent = data.header;
            }

            const rowStrings = (data.rows || []).map(r => this.formatRow(r));

            // Pad to 12 rows
            while (rowStrings.length < 12) {
                rowStrings.push(''.padEnd(52, ' '));
            }

            this.board.updateRows(rowStrings);

            const statusEl = document.getElementById('lastUpdatedText');
            if (statusEl) {
                statusEl.textContent = `Live Feed Active • Updated ${new Date().toLocaleTimeString()}`;
            }

        } catch (err) {
            console.error('Failed to load departures:', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.solariApp = new SolariApp();
});
