/**
 * Solari Split-Flap Board Application Controller
 * Supports dual hubs:
 * - San Jose Regional Hub (SJC, Caltrain, BART, Amtrak, ACE, VTA Branham & 64B)
 * - Nürnberg Hauptbahnhof (Deutsche Bahn ICE, IC, RE, RB, S-Bahn Nürnberg)
 * With authentic split-flap mechanics, clock synchronization, and flight boarding voice.
 */

const HUBS = {
    sanjose: {
        id: 'sanjose',
        name: 'SAN JOSE REGIONAL HUB',
        defaultMode: 'unified',
        timeZone: 'America/Los_Angeles',
        modes: [
            { id: 'unified', label: 'Unified Hub (By Time)' },
            { id: 'sjc', label: 'SJC Flights' },
            { id: 'caltrain', label: 'Caltrain Diridon' },
            { id: 'bart', label: 'BART Berryessa' },
            { id: 'amtrak', label: 'Amtrak Diridon' },
            { id: 'ace', label: 'ACE Train' },
            { id: 'vta', label: 'VTA Branham & 64B' },
        ],
        pills: [
            'SJC Airspace (All Flights)',
            'BART Berryessa Hub',
            'Caltrain Diridon Hub',
            'Amtrak Diridon Hub',
            'ACE Train Diridon',
            'VTA Branham & 64B Meridian'
        ],
        colHeaders: ['TYP', 'TIME', 'SERVICE', 'DEST / ORIGIN', 'TRK/GT', 'STATUS']
    },
    nuernberg: {
        id: 'nuernberg',
        name: 'NÜRNBERG HAUPTBAHNHOF',
        defaultMode: 'nuernberg',
        timeZone: 'Europe/Berlin',
        modes: [
            { id: 'nuernberg', label: 'Alle Züge (All Trains)' },
            { id: 'nuernberg_fern', label: 'Fernverkehr (ICE/IC)' },
            { id: 'nuernberg_regio', label: 'Regionalverkehr (RE/RB)' },
            { id: 'nuernberg_sbahn', label: 'S-Bahn Nürnberg' },
        ],
        pills: [
            'DB Fernverkehr (ICE / IC)',
            'DB Regio Bayern (RE / RB)',
            'S-Bahn Nürnberg (S1-S4)',
            'ÖBB Railjet (RJX)'
        ],
        colHeaders: ['TYP', 'ZEIT', 'ZUG / SERVICE', 'NACH / DESTINATION', 'GLEIS', 'STATUS']
    }
};

class SolariApp {
    constructor() {
        this.board = null;
        const urlParams = new URLSearchParams(window.location.search);
        const hubParam = urlParams.get('hub');
        this.currentHub = (hubParam && HUBS[hubParam]) ? hubParam : (localStorage.getItem('solari_current_hub') || 'sanjose');
        const modeParam = urlParams.get('mode');
        this.currentMode = modeParam || localStorage.getItem(`solari_current_mode_${this.currentHub}`) || HUBS[this.currentHub].defaultMode;
        this.fetchTimer = null;
        this.idleTimeout = null;
        this.soundEnabled = true;
        this.voiceEnabled = true;

        this.init();
    }

    init() {
        // Create 12-row x 52-column Solari Board to fill window height and width nicely
        this.board = new SplitFlapBoard('solariGrid', 12, 52);

        this.renderHubUI();
        this.setupEventListeners();
        this.setupAudioUnblocker();
        this.setupScreensaverIdle();
        this.startClock();

        // Initial fetch
        this.loadDepartures();

        // Background poll every 15 seconds: keeps board updated IN PLACE without auto-cycling
        this.fetchTimer = setInterval(() => this.loadDepartures(), 15000);
    }

    renderHubUI() {
        const hubConfig = HUBS[this.currentHub] || HUBS.sanjose;

        // Update Hub Switcher buttons
        document.querySelectorAll('.hub-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-hub') === this.currentHub);
        });

        // Update Mode Buttons
        const modeContainer = document.getElementById('modeSelector');
        if (modeContainer) {
            modeContainer.innerHTML = '';
            hubConfig.modes.forEach(m => {
                const btn = document.createElement('button');
                btn.className = `mode-btn ${m.id === this.currentMode ? 'active' : ''}`;
                btn.setAttribute('data-mode', m.id);
                btn.textContent = m.label;
                btn.addEventListener('click', () => this.setMode(m.id));
                modeContainer.appendChild(btn);
            });
        }

        // Update Agency Status Pills
        const pillsContainer = document.getElementById('agencyPills');
        if (pillsContainer) {
            pillsContainer.innerHTML = '';
            hubConfig.pills.forEach(pillText => {
                const pill = document.createElement('div');
                pill.className = 'agency-pill';
                pill.innerHTML = `<span class="agency-pill-dot"></span> ${pillText}`;
                pillsContainer.appendChild(pill);
            });
        }

        // Update Column Headers
        const colHeaders = document.getElementById('columnHeaders');
        if (colHeaders && hubConfig.colHeaders) {
            colHeaders.innerHTML = `
                <span class="col-hdr-typ">${hubConfig.colHeaders[0]}</span>
                <span class="col-hdr-time">${hubConfig.colHeaders[1]}</span>
                <span class="col-hdr-service">${hubConfig.colHeaders[2]}</span>
                <span class="col-hdr-dest">${hubConfig.colHeaders[3]}</span>
                <span class="col-hdr-trk">${hubConfig.colHeaders[4]}</span>
                <span class="col-hdr-status">${hubConfig.colHeaders[5]}</span>
            `;
        }
    }

    setHub(hubId) {
        if (!HUBS[hubId] || hubId === this.currentHub) return;
        this.currentHub = hubId;
        localStorage.setItem('solari_current_hub', hubId);

        // Load saved mode for this hub or use default
        this.currentMode = localStorage.getItem(`solari_current_mode_${hubId}`) || HUBS[hubId].defaultMode;

        this.renderHubUI();
        this.loadDepartures();
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
            if (window.flightAnnouncer) {
                window.flightAnnouncer.initVoices();
            }
        };

        window.addEventListener('click', unlock);
        window.addEventListener('keydown', unlock);
        window.addEventListener('touchstart', unlock);

        setTimeout(() => {
            if (window.solariAudio && window.solariAudio.ctx && window.solariAudio.ctx.state === 'running') {
                if (unlockPrompt) unlockPrompt.style.display = 'none';
            }
        }, 500);
    }

    setupEventListeners() {
        // Hub switcher buttons
        document.querySelectorAll('.hub-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetHub = btn.getAttribute('data-hub');
                this.setHub(targetHub);
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

        // Flight Voice Announcement Toggle Button
        const voiceBtn = document.getElementById('voiceToggleBtn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.voiceEnabled = !this.voiceEnabled;
                if (window.flightAnnouncer) {
                    window.flightAnnouncer.setEnabled(this.voiceEnabled);
                }
                voiceBtn.classList.toggle('active', this.voiceEnabled);
                voiceBtn.innerHTML = this.voiceEnabled ? '📢 Voice: ON' : '🔇 Voice: OFF';
                if (this.voiceEnabled && window.flightAnnouncer) {
                    window.flightAnnouncer.testAnnouncement();
                }
            });
        }

        // Fullscreen Toggle
        const fsBtn = document.getElementById('fullscreenBtn');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            } else if (e.key === 'm' || e.key === 'M') {
                if (soundBtn) soundBtn.click();
            } else if (e.key === 'v' || e.key === 'V') {
                if (voiceBtn) voiceBtn.click();
            } else if (e.key === 't' || e.key === 'T') {
                if (testSoundBtn) testSoundBtn.click();
            } else if (e.key === 'h' || e.key === 'H') {
                // Toggle between hubs with key H
                const nextHub = this.currentHub === 'sanjose' ? 'nuernberg' : 'sanjose';
                this.setHub(nextHub);
            } else if (e.key >= '1' && e.key <= '7') {
                const idx = parseInt(e.key) - 1;
                const hubModes = HUBS[this.currentHub].modes;
                if (hubModes[idx]) {
                    this.setMode(hubModes[idx].id);
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
            const timeZone = HUBS[this.currentHub] ? HUBS[this.currentHub].timeZone : 'America/Los_Angeles';
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', { 
                timeZone: timeZone, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
            });
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

    setMode(modeId) {
        this.currentMode = modeId;
        localStorage.setItem(`solari_current_mode_${this.currentHub}`, modeId);

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-mode') === modeId);
        });

        this.loadDepartures();
    }

    formatRow(item) {
        // Layout:
        // TYPE (3) + ' ' (1) + TIME (5) + ' ' (1) + SERVICE (10) + ' ' (1) + DEST (15) + ' ' (1) + TRK (5) + ' ' (1) + STATUS (9) = 52 characters
        const type = (item.type || 'DEP').padEnd(3, ' ').slice(0, 3);
        const time = (item.time || '--:--').padEnd(5, ' ').slice(0, 5);
        const service = (item.service || '').padEnd(10, ' ').slice(0, 10);
        const dest = (item.destination || '').padEnd(15, ' ').slice(0, 15);
        const track = (item.track || '').padEnd(5, ' ').slice(0, 5);
        const status = (item.status || '').padEnd(9, ' ').slice(0, 9);

        return `${type} ${time} ${service} ${dest} ${track} ${status}`;
    }

    async loadDepartures() {
        try {
            const url = `/api/departures?hub=${this.currentHub}&mode=${this.currentMode}&limit=12`;
            const resp = await fetch(url);
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

            // Announce boarding flights for SJC in female voice (max twice per flight)
            if (this.currentHub === 'sanjose' && window.flightAnnouncer && this.voiceEnabled) {
                window.flightAnnouncer.checkRowsForBoarding(data.rows);
            }

            const statusEl = document.getElementById('lastUpdatedText');
            if (statusEl) {
                const label = this.currentHub === 'nuernberg' ? 'Live-Fahrplan Aktiv' : 'Live Feed Active';
                statusEl.textContent = `${label} • ${new Date().toLocaleTimeString()}`;
            }

        } catch (err) {
            console.error('Failed to load departures:', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.solariApp = new SolariApp();
});
