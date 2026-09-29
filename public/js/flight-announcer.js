/**
 * FlightAnnouncer
 * Provides authentic airport PA chimes and professional female voice announcements
 * for flights in "BOARDING" status (strictly limited to max twice per flight).
 */

const AIRLINE_NAMES = {
    // Frontier Airlines
    'FRONT': 'Frontier Airlines',
    'FRONTIER': 'Frontier Airlines',
    'F9': 'Frontier Airlines',
    'FFT': 'Frontier Airlines',

    // Southwest Airlines
    'SW': 'Southwest Airlines',
    'SOUTHWEST': 'Southwest Airlines',
    'WN': 'Southwest Airlines',
    'SWA': 'Southwest Airlines',

    // Alaska Airlines
    'ALASKA': 'Alaska Airlines',
    'ALK': 'Alaska Airlines',
    'AS': 'Alaska Airlines',
    'ASA': 'Alaska Airlines',

    // American Airlines
    'AMER': 'American Airlines',
    'AMERICAN': 'American Airlines',
    'AA': 'American Airlines',
    'AAL': 'American Airlines',

    // Delta Air Lines
    'DELTA': 'Delta Air Lines',
    'DL': 'Delta Air Lines',
    'DAL': 'Delta Air Lines',

    // United Airlines
    'UNITED': 'United Airlines',
    'UAL': 'United Airlines',
    'UA': 'United Airlines',

    // Hawaiian Airlines
    'HAWAII': 'Hawaiian Airlines',
    'HAWAIIAN': 'Hawaiian Airlines',
    'HA': 'Hawaiian Airlines',
    'HAL': 'Hawaiian Airlines',

    // Volaris
    'VOLARIS': 'Volaris',
    'VOI': 'Volaris',
    'Y4': 'Volaris',

    // JetBlue
    'JETBLUE': 'JetBlue',
    'B6': 'JetBlue',
    'JBU': 'JetBlue',

    // SkyWest Airlines
    'SKYWEST': 'SkyWest Airlines',
    'SKW': 'SkyWest Airlines',
    'OO': 'SkyWest Airlines',

    // Spirit Airlines
    'SPIRIT': 'Spirit Airlines',
    'NK': 'Spirit Airlines',
    'NKS': 'Spirit Airlines',

    // Allegiant Air
    'ALLEGIANT': 'Allegiant Air',
    'G4': 'Allegiant Air',
    'AAY': 'Allegiant Air',
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
        const masterVol = (window.solariAudio.volume || 0.85) * 0.95;

        // Terminal Spatial Reverb & Warm Lowpass Filter
        const terminalFilter = ctx.createBiquadFilter();
        terminalFilter.type = 'lowpass';
        terminalFilter.frequency.setValueAtTime(3600, now);
        terminalFilter.Q.setValueAtTime(0.7, now);

        // Terminal reflections network (recreates the spacious acoustics of high-ceiling airport halls)
        const delayEarly = ctx.createDelay();
        delayEarly.delayTime.setValueAtTime(0.048, now); // 48ms early floor/glass reflection

        const delayLate = ctx.createDelay();
        delayLate.delayTime.setValueAtTime(0.185, now); // 185ms terminal hall echo

        const earlyGain = ctx.createGain();
        earlyGain.gain.setValueAtTime(0.24, now);

        const lateGain = ctx.createGain();
        lateGain.gain.setValueAtTime(0.15, now);

        const directGain = ctx.createGain();
        directGain.gain.setValueAtTime(0.78, now);

        directGain.connect(terminalFilter);
        delayEarly.connect(earlyGain);
        earlyGain.connect(terminalFilter);
        delayLate.connect(lateGain);
        lateGain.connect(terminalFilter);

        terminalFilter.connect(ctx.destination);

        // Iconic soothing F-Major triad airport chime:
        // C5 (523.25 Hz) -> F5 (698.46 Hz) -> A5 (880.00 Hz)
        const notes = [
            { freq: 523.25, time: 0.00, dur: 1.4, gain: 0.33 },
            { freq: 698.46, time: 0.42, dur: 1.4, gain: 0.35 },
            { freq: 880.00, time: 0.84, dur: 2.4, gain: 0.38 }
        ];

        notes.forEach(note => {
            const t0 = now + note.time;

            // 1. Resonant fundamental (pure sine with silky soft mallet attack)
            const oscFund = ctx.createOscillator();
            const gainFund = ctx.createGain();
            oscFund.type = 'sine';
            oscFund.frequency.setValueAtTime(note.freq, t0);

            gainFund.gain.setValueAtTime(0.0001, t0);
            gainFund.gain.linearRampToValueAtTime(note.gain * masterVol, t0 + 0.022); // Felt mallet strike attack
            gainFund.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);

            oscFund.connect(gainFund);
            gainFund.connect(directGain);
            gainFund.connect(delayEarly);
            gainFund.connect(delayLate);

            oscFund.start(t0);
            oscFund.stop(t0 + note.dur + 0.1);

            // 2. Chime modal overtone at 2.76x (natural acoustic vibration of tubular chime bars)
            const oscModal = ctx.createOscillator();
            const gainModal = ctx.createGain();
            oscModal.type = 'sine';
            oscModal.frequency.setValueAtTime(note.freq * 2.76, t0);

            gainModal.gain.setValueAtTime(0.0001, t0);
            gainModal.gain.linearRampToValueAtTime(note.gain * masterVol * 0.22, t0 + 0.015);
            gainModal.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur * 0.52);

            oscModal.connect(gainModal);
            gainModal.connect(directGain);
            gainModal.connect(delayEarly);

            oscModal.start(t0);
            oscModal.stop(t0 + note.dur * 0.55);

            // 3. Shimmer overtone at 5.4x (crystalline metallic sheen)
            const oscShimmer = ctx.createOscillator();
            const gainShimmer = ctx.createGain();
            oscShimmer.type = 'sine';
            oscShimmer.frequency.setValueAtTime(note.freq * 5.40, t0);

            gainShimmer.gain.setValueAtTime(0.0001, t0);
            gainShimmer.gain.linearRampToValueAtTime(note.gain * masterVol * 0.05, t0 + 0.010);
            gainShimmer.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

            oscShimmer.connect(gainShimmer);
            gainShimmer.connect(directGain);

            oscShimmer.start(t0);
            oscShimmer.stop(t0 + 0.2);

            // 4. Soft felt mallet strike body (triangle wave impulse)
            const oscThump = ctx.createOscillator();
            const gainThump = ctx.createGain();
            oscThump.type = 'triangle';
            oscThump.frequency.setValueAtTime(note.freq * 0.5, t0);

            gainThump.gain.setValueAtTime(note.gain * masterVol * 0.10, t0);
            gainThump.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

            oscThump.connect(gainThump);
            gainThump.connect(directGain);

            oscThump.start(t0);
            oscThump.stop(t0 + 0.06);
        });
    }

    formatFlightText(row) {
        const svcParts = (row.service || '').trim().split(/\s+/);
        const prefix = (svcParts[0] || '').toUpperCase();
        const flightNum = svcParts[1] || '';

        // Prioritize full airline name from row or dictionary
        let airline = row.airline || AIRLINE_NAMES[prefix];
        if (!airline) {
            // Check prefix without trailing digits or partial matches
            for (const [key, val] of Object.entries(AIRLINE_NAMES)) {
                if (prefix.startsWith(key) || key.startsWith(prefix)) {
                    airline = val;
                    break;
                }
            }
        }
        if (!airline) {
            airline = `${prefix} flight`;
        }

        // Separate digits so speech engine reads numbers cleanly: "1 5 9 0"
        const spokenFlightNum = flightNum.split('').join(' ');

        // Clean destination (remove parentheses / IATA code if any, e.g. "DENVER (DEN)" -> "Denver")
        let dest = (row.destination || '').replace(/\(.*?\)/g, '').trim();
        dest = dest.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

        // Parse gate cleanly
        let gate = (row.track || '').replace(/GT|GATE/i, '').trim();
        const gateStr = gate ? `at Gate ${gate}` : '';

        // Natural, professional airport announcement phrasing
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
            // 1. Play authentic pleasant airport terminal chime
            this.playAirportChime();

            // 2. Wait 1.9s for the 3-tone chime to ring out with terminal hall echo before speaking
            await new Promise(r => setTimeout(r, 1900));

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

    playTerminalVoiceBuffer(audioBuffer) {
        return new Promise((resolve) => {
            const ctx = window.solariAudio ? window.solariAudio.ctx : null;
            if (!ctx) {
                resolve();
                return;
            }

            const now = ctx.currentTime;
            const masterVol = (window.solariAudio.volume || 0.85) * 1.0;

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            // 1. PA Speaker System Horn EQ
            // High-pass filter (cuts low rumble below 220 Hz)
            const paHighpass = ctx.createBiquadFilter();
            paHighpass.type = 'highpass';
            paHighpass.frequency.setValueAtTime(220, now);

            // Vocal presence boost at 2400 Hz for clarity through the terminal
            const paPresence = ctx.createBiquadFilter();
            paPresence.type = 'peaking';
            paPresence.frequency.setValueAtTime(2400, now);
            paPresence.gain.setValueAtTime(2.5, now);
            paPresence.Q.setValueAtTime(1.0, now);

            // High-frequency roll-off of ceiling horn speakers (5500 Hz)
            const paRollOff = ctx.createBiquadFilter();
            paRollOff.type = 'lowpass';
            paRollOff.frequency.setValueAtTime(5500, now);
            paRollOff.Q.setValueAtTime(0.7, now);

            source.connect(paHighpass);
            paHighpass.connect(paPresence);
            paPresence.connect(paRollOff);

            // 2. Direct Voice Output
            const dryGain = ctx.createGain();
            dryGain.gain.setValueAtTime(masterVol * 0.85, now);
            paRollOff.connect(dryGain);
            dryGain.connect(ctx.destination);

            // 3. Terminal Concourse Spatial Reflections & Hall Echo Network
            // Early reflection 1 (42ms - floor and podium bounce)
            const delayEarly1 = ctx.createDelay();
            delayEarly1.delayTime.setValueAtTime(0.042, now);
            const gainEarly1 = ctx.createGain();
            gainEarly1.gain.setValueAtTime(0.26, now);

            // Early reflection 2 (98ms - concourse window and wall bounce)
            const delayEarly2 = ctx.createDelay();
            delayEarly2.delayTime.setValueAtTime(0.098, now);
            const gainEarly2 = ctx.createGain();
            gainEarly2.gain.setValueAtTime(0.18, now);

            // Cavernous terminal hall echo (270ms with air-damped feedback loop)
            const delayEcho = ctx.createDelay();
            delayEcho.delayTime.setValueAtTime(0.270, now);

            const echoFeedback = ctx.createGain();
            echoFeedback.gain.setValueAtTime(0.30, now);

            const airDamping = ctx.createBiquadFilter();
            airDamping.type = 'lowpass';
            airDamping.frequency.setValueAtTime(2200, now); // high frequencies lose energy in large halls

            // Feedback loop: delayEcho -> airDamping -> echoFeedback -> delayEcho
            delayEcho.connect(airDamping);
            airDamping.connect(echoFeedback);
            echoFeedback.connect(delayEcho);

            // Master Terminal Echo Wet Gain
            const wetGain = ctx.createGain();
            wetGain.gain.setValueAtTime(masterVol * 0.44, now);

            paRollOff.connect(delayEarly1);
            delayEarly1.connect(gainEarly1);
            gainEarly1.connect(wetGain);

            paRollOff.connect(delayEarly2);
            delayEarly2.connect(gainEarly2);
            gainEarly2.connect(wetGain);

            paRollOff.connect(delayEcho);
            airDamping.connect(wetGain);

            wetGain.connect(ctx.destination);

            source.onended = () => resolve();
            source.start(now);
        });
    }

    async speak(text) {
        if (!this.enabled) return;

        // Try OpenRouter Carolyn Hopkins archetype neural voice with terminal echo
        try {
            const resp = await fetch('/api/announce-speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.audio_url && window.solariAudio && window.solariAudio.ctx) {
                    const ctx = window.solariAudio.ctx;
                    if (ctx.state !== 'running') {
                        await ctx.resume();
                    }
                    const audioResp = await fetch(data.audio_url);
                    const arrayBuffer = await audioResp.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    await this.playTerminalVoiceBuffer(audioBuffer);
                    return;
                }
            }
        } catch (err) {
            console.warn('[FlightAnnouncer] Neural voice error, falling back to Web Speech:', err);
        }

        // Graceful fallback to client-side Web Speech API
        await this.speakNative(text);
    }

    speakNative(text) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window) || !this.enabled) {
                resolve();
                return;
            }

            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            if (this.preferredVoice) {
                utterance.voice = this.preferredVoice;
            }
            utterance.pitch = 1.02;
            utterance.rate = 0.88;
            utterance.volume = 1.0;

            const safetyTimer = setTimeout(() => resolve(), 9000);
            utterance.onend = () => {
                clearTimeout(safetyTimer);
                resolve();
            };
            utterance.onerror = () => {
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
            service: 'FRONT 1191',
            airline: 'Frontier Airlines',
            destination: 'PHOENIX (PHX)',
            track: 'GT 21',
            status: 'BOARDING'
        };
        const testKey = `TEST_${Date.now()}`;
        this.announcementCounts.set(testKey, 1);
        this.queue.push({ row: sampleRow, flightKey: testKey });
        this.processQueue();
    }
}

window.flightAnnouncer = new FlightAnnouncer();
