/**
 * Solari Split-Flap Board Application Controller
 * Handles live API updates, column formatting, mode switching, and screensaver behavior.
 */

const MODES = [
    { id: 'unified', label: 'Unified Regional Hub' },
    { id: 'sjc', label: 'SJC Airport Flights' },
    { id: 'caltrain', label: 'Caltrain Commuter' },
    { id: 'bart', label: 'BART Transit' },
    { id: 'amtrak', label: 'Amtrak California' },
    { id: 'vta', label: 'VTA Light Rail' },
];

class SolariApp {
    constructor() {
        this.board = null;
        this.currentMode = 'unified';
        this.autoCycle = true;
        this.cycleInterval = 25; // seconds per mode
        this.cycleTimer = null;
        this.fetchTimer = null;
        this.idleTimeout = null;
        this.soundEnabled = true;

        this.init();
    }

    init() {
        // Create 8-row x 51-column Solari Board
        this.board = new SplitFlapBoard('solariGrid', 8, 51);

        this.setupEventListeners();
        this.setupScreensaverIdle();
        this.startClock();
        
        // Initial fetch
        this.loadDepartures();

        // Background poll every 15 seconds
        this.fetchTimer = setInterval(() => this.loadDepartures(), 15000);

        // Auto cycle timer
        this.resetCycleTimer();
    }

    setupEventListeners() {
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.getAttribute('data-mode');
                this.setMode(mode);
            });
        });

        // Sound Toggle Button
        const soundBtn = document.getElementById('soundToggleBtn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                this.soundEnabled = !this.soundEnabled;
                window.solariAudio.setMuted(!this.soundEnabled);
                soundBtn.classList.toggle('active', this.soundEnabled);
                soundBtn.innerHTML = this.soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
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

        // First click unlocks Web Audio in browsers with autoplay restrictions
        document.addEventListener('click', () => {
            if (window.solariAudio) {
                window.solariAudio.init();
            }
        }, { once: true });
    }

    setupScreensaverIdle() {
        const onActivity = () => {
            document.body.classList.remove('idle');
            clearTimeout(this.idleTimeout);
            this.idleTimeout = setTimeout(() => {
                document.body.classList.add('idle');
            }, 3500); // Hide cursor & controls after 3.5s of inactivity
        };

        window.addEventListener('mousemove', onActivity);
        window.addEventListener('mousedown', onActivity);
        window.addEventListener('keydown', onActivity);
        window.addEventListener('touchstart', onActivity);
        this.idleTimeout = setTimeout(() => document.body.classList.add('idle'), 3500);
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

        // Update UI buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-mode') === modeId);
        });

        this.resetCycleTimer();
        this.loadDepartures();
    }

    formatRow(item) {
        // Columns:
        // TIME (5) + ' ' (1) + SERVICE (10) + ' ' (1) + DEST (18) + ' ' (1) + TRK (6) + ' ' (1) + STATUS (8) = 51 chars
        const time = (item.time || '--:--').padEnd(5, ' ').slice(0, 5);
        const service = (item.service || '').padEnd(10, ' ').slice(0, 10);
        const dest = (item.destination || '').padEnd(18, ' ').slice(0, 18);
        const track = (item.track || '').padEnd(6, ' ').slice(0, 6);
        const status = (item.status || '').padEnd(8, ' ').slice(0, 8);

        return `${time} ${service} ${dest} ${track} ${status}`;
    }

    async loadDepartures() {
        try {
            const resp = await fetch(`/api/departures?mode=${this.currentMode}&limit=8`);
            if (!resp.ok) return;

            const data = await resp.json();
            
            // Update Title Header
            const titleEl = document.getElementById('stationTitle');
            if (titleEl && data.header) {
                titleEl.textContent = data.header;
            }

            // Convert rows to Solari format strings
            const rowStrings = (data.rows || []).map(r => this.formatRow(r));

            // Pad to 8 rows if fewer exist
            while (rowStrings.length < 8) {
                rowStrings.push(''.padEnd(51, ' '));
            }

            // Trigger the split-flap drum rotation!
            this.board.updateRows(rowStrings);

            // Update footer timestamp
            const statusEl = document.getElementById('lastUpdatedText');
            if (statusEl) {
                statusEl.textContent = `Live Feed Active • Last updated: ${new Date().toLocaleTimeString()}`;
            }

        } catch (err) {
            console.error('Failed to load departures:', err);
        }
    }
}

// Start application once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.solariApp = new SolariApp();
});
