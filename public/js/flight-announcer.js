/**
 * FlightAnnouncer
 * Provides authentic airport PA chimes and professional female voice announcements
 * for flights in "BOARDING" status (strictly limited to max twice per flight).
 */

const AIRLINE_NAMES = {
    'WN': 'Southwest Airlines',
    'SWA': 'Southwest Airlines',
    'AS': 'Alaska Airlines',
    'ASA': 'Alaska Airlines',
    'UA': 'United Airlines',
    'UAL': 'United Airlines',
    'AA': 'American Airlines',
    'AAL': 'American Airlines',
    'DL': 'Delta Air Lines',
    'DAL': 'Delta Air Lines',
    'F9': 'Frontier Airlines',
    'FFT': 'Frontier Airlines',
    'OO': 'SkyWest Airlines',
    'SKW': 'SkyWest Airlines',
    'HA': 'Hawaiian Airlines',
    'HAL': 'Hawaiian Airlines',
    'B6': 'JetBlue',
    'JBU': 'JetBlue',
    'Y4': 'Volaris',
    'VOI': 'Volaris',
};

class FlightAnnouncer {
    constructor() {
        this.announcementCounts = new Map(); // flightKey -> number of announcements (max 2)
        this.queue = [];
        this.isProcessing = false;
        this.enabled = true;
        this.preferredVoice = null;
        this.lastAnnouncementTime = 0;
        this.minGapBetweenAnnouncements = 14000; // 14 seconds between consecutive announcements

        this.initVoices();
    }

    initVoices() {
        if (!('speechSynthesis' in window)) return;

        const pickVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            if (!voices || voices.length === 0) return;

            // Preferred female voices on macOS, iOS, Windows, Chrome
            const priorityFemaleNames = [
                'samantha',   // macOS Apple Female (clean, natural, soothing)
                'karen',       // macOS Australian / UK Female
                'victoria',    // macOS Female
                'serena',      // UK Female
                'fiona',       // Scottish Female
                'moira',       // Irish Female
                'google us english', // Chrome standard female
                'zira',        // Windows standard female
                'jenny',       // Windows natural female
                'aria',        // Windows natural female
            ];

            let found = null;
            for (const name of priorityFemaleNames) {
                found = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes(name));
                if (found) break;
            }

            if (!found) {
                // Any English female voice
                found = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'));
            }

            if (!found) {
                // Fallback to any en-US voice
                found = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en'));
            }

            this.preferredVoice = found || null;
            if (this.preferredVoice) {
                console.log(`[FlightAnnouncer] Selected voice: ${this.preferredVoice.name} (${this.preferredVoice.lang})`);
            }
        };

        window.speechSynthesis.onvoiceschanged = pickVoice;
        pickVoice();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            this.queue = [];
            this.isProcessing = false;
        }
    }

    playAirportChime() {
        if (!window.solariAudio) return;
        const ctx = window.solariAudio.ctx;
        if (!ctx || ctx.state !== 'running') {
            window.solariAudio.init();
        }
        if (!ctx || ctx.state !== 'running') return;

        const now = ctx.currentTime;
        const vol = window.solariAudio.volume || 0.85;

        // Authentic 2-tone airport terminal chime: D5 (587.33 Hz) -> A4 (440 Hz)
        const chimeNotes = [
            { freq: 587.33, time: 0.0, dur: 0.75, gain: 0.38 },
            { freq: 440.00, time: 0.42, dur: 1.10, gain: 0.42 }
        ];

        chimeNotes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            // Gentle soft-chime envelope
            gain.gain.setValueAtTime(0.001, now + note.time);
            gain.gain.linearRampToValueAtTime(note.gain * vol, now + note.time + 0.035);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + note.time);
            osc.stop(now + note.time + note.dur + 0.1);
        });
    }

    formatFlightText(row) {
        const svcParts = (row.service || '').trim().split(/\s+/);
        const prefix = (svcParts[0] || '').toUpperCase();
        const flightNum = svcParts[1] || '';
        const airline = AIRLINE_NAMES[prefix] || `${prefix} flight`;

        // Separate digits so speech engine reads numbers cleanly: "3 5 9 2"
        const spokenFlightNum = flightNum.split('').join(' ');

        // Clean destination (remove parentheses / IATA code if any)
        let dest = (row.destination || '').replace(/\(.*?\)/g, '').trim();
        dest = dest.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

        // Parse gate
        let gate = (row.track || '').replace(/GT|GATE/i, '').trim();
        const gateStr = gate ? `at Gate ${gate}` : '';

        // Exact requested announcement phrasing: 'now boarding'
        return `Now boarding: ${airline}, flight ${spokenFlightNum}, with service to ${dest}, ${gateStr}.`;
    }

    checkRowsForBoarding(rows) {
        if (!this.enabled || !rows || !Array.isArray(rows)) return;

        rows.forEach(row => {
            // Must be a flight (agency === 'SJC'), departure, and in BOARDING status
            const isFlight = (row.agency === 'SJC') || (row.service && (row.track || '').startsWith('GT'));
            const isDeparture = (row.type === 'DEP');
            const isBoarding = (row.status || '').toUpperCase().includes('BOARD');

            if (isFlight && isDeparture && isBoarding) {
                const flightKey = `${row.service}_${row.destination}`.toUpperCase();
                const count = this.announcementCounts.get(flightKey) || 0;

                // STRICT LIMIT: Max twice per flight
                if (count < 2) {
                    this.queueAnnouncement(row, flightKey);
                }
            }
        });
    }

    queueAnnouncement(row, flightKey) {
        // Double check not already in queue
        if (this.queue.some(item => item.flightKey === flightKey)) {
            return;
        }

        const count = this.announcementCounts.get(flightKey) || 0;
        if (count >= 2) return;

        this.queue.push({ row, flightKey });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0 || !this.enabled) {
            return;
        }

        const now = Date.now();
        const elapsedSinceLast = now - this.lastAnnouncementTime;
        if (elapsedSinceLast < this.minGapBetweenAnnouncements) {
            setTimeout(() => this.processQueue(), this.minGapBetweenAnnouncements - elapsedSinceLast);
            return;
        }

        this.isProcessing = true;
        const item = this.queue.shift();

        // Increment count (max twice per flight)
        const currentCount = this.announcementCounts.get(item.flightKey) || 0;
        if (currentCount >= 2) {
            this.isProcessing = false;
            this.processQueue();
            return;
        }

        this.announcementCounts.set(item.flightKey, currentCount + 1);
        console.log(`[FlightAnnouncer] Announcing ${item.row.service} (announcement ${currentCount + 1} of 2)`);

        try {
            // 1. Play authentic airport terminal chime
            this.playAirportChime();

            // 2. Wait 1.05s for chime to finish echoing before speaking
            await new Promise(r => setTimeout(r, 1050));

            // 3. Announce with female voice
            const message = this.formatFlightText(item.row);
            await this.speak(message);
        } catch (e) {
            console.warn('[FlightAnnouncer] Speech error:', e);
        } finally {
            this.lastAnnouncementTime = Date.now();
            this.isProcessing = false;
            // Process next queued announcement after cooldown
            setTimeout(() => this.processQueue(), 4000);
        }
    }

    speak(text) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window) || !this.enabled) {
                resolve();
                return;
            }

            // Cancel any stale speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            if (this.preferredVoice) {
                utterance.voice = this.preferredVoice;
            }
            // Pleasant, clear airport announcer delivery
            utterance.pitch = 1.04;
            utterance.rate = 0.92;
            utterance.volume = 1.0;

            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();

            // Safety timeout in case speech engine hangs
            const safetyTimer = setTimeout(() => resolve(), 9000);

            utterance.onend = () => {
                clearTimeout(safetyTimer);
                resolve();
            };

            window.speechSynthesis.speak(utterance);
        });
    }

    testAnnouncement() {
        const sampleRow = {
            agency: 'SJC',
            type: 'DEP',
            service: 'WN 3592',
            destination: 'DENVER',
            track: 'GT 29',
            status: 'BOARDING'
        };
        const testKey = `TEST_${Date.now()}`;
        this.announcementCounts.set(testKey, 1);
        this.queue.push({ row: sampleRow, flightKey: testKey });
        this.processQueue();
    }
}

window.flightAnnouncer = new FlightAnnouncer();
