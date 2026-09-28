/**
 * Solari Mechanical Split-Flap Audio Engine
 * Uses authentic recorded Solari split-flap samples (click.wav, td_clack.wav, board_cascade.mp3)
 * with dynamic pitch/volume randomization and Web Audio buffer streaming.
 */

class SolariAudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.volume = 0.9;
        this.lastSoundTime = 0;
        this.minSoundInterval = 0.022; // 22ms throttle for organic multi-tile texture
        this.isUnlocked = false;

        // Decoded AudioBuffers for authentic mechanical playback
        this.buffers = [];
        this.cascadeBuffer = null;
        this.samplesLoaded = false;
        this.lastCascadeTime = 0;

        // Auto-preload audio buffers
        this.loadAudioFiles();
    }

    async loadAudioFiles() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            if (!this.ctx) {
                this.ctx = new AudioContext();
            }

            const sampleUrls = [
                'audio/td_clack.wav',
                'audio/click.wav',
                'audio/td_clack_noverb.wav'
            ];

            const loadBuffer = async (url) => {
                const res = await fetch(url);
                const arrayBuf = await res.arrayBuffer();
                return await this.ctx.decodeAudioData(arrayBuf);
            };

            // Load single flap clicks in parallel
            const loadedBuffers = await Promise.allSettled(sampleUrls.map(url => loadBuffer(url)));
            this.buffers = loadedBuffers
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            // Load board cascade flutter loop
            try {
                this.cascadeBuffer = await loadBuffer('audio/board_cascade.mp3');
            } catch (err) {
                console.warn('Cascade audio load deferred:', err);
            }

            if (this.buffers.length > 0) {
                this.samplesLoaded = true;
                console.log(`[SolariAudio] Loaded ${this.buffers.length} authentic mechanical split-flap samples.`);
            }
        } catch (e) {
            console.warn('[SolariAudio] Sample loading error, using synthesized fallback:', e);
        }
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                this.isUnlocked = true;
                this.notifyAudioUnlocked();
                // Ensure samples are loaded once context is active
                if (!this.samplesLoaded) {
                    this.loadAudioFiles();
                }
            }).catch(() => {});
        } else if (this.ctx && this.ctx.state === 'running') {
            this.isUnlocked = true;
            this.notifyAudioUnlocked();
        }
    }

    notifyAudioUnlocked() {
        const prompt = document.getElementById('audioUnlockPrompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }

    setMuted(muted) {
        this.muted = muted;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    }

    testClack() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // Play 3 rapid authentic mechanical clacks in sequence
        this.playFlap(true);
        setTimeout(() => this.playFlap(true), 55);
        setTimeout(() => this.playFlap(true), 115);
    }

    onBoardUpdate() {
        if (this.muted || this.volume <= 0) return;
        this.init();
        if (!this.ctx || this.ctx.state !== 'running') return;

        const now = this.ctx.currentTime;
        if (now - this.lastCascadeTime < 4.0) {
            return; // Don't overlap cascades too frequently
        }
        this.lastCascadeTime = now;

        if (this.cascadeBuffer) {
            try {
                const src = this.ctx.createBufferSource();
                src.buffer = this.cascadeBuffer;
                
                const gain = this.ctx.createGain();
                // Subtle background mechanical roar beneath individual tile clacks
                gain.gain.setValueAtTime(this.volume * 0.35, now);
                gain.gain.linearRampToValueAtTime(this.volume * 0.45, now + 0.8);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

                src.connect(gain);
                gain.connect(this.ctx.destination);
                src.start(now, 0.2, 3.2);
            } catch (e) {}
        }
    }

    playFlap(force = false) {
        if (this.muted || this.volume <= 0) return;
        this.init();
        if (!this.ctx || this.ctx.state !== 'running') return;

        const now = this.ctx.currentTime;
        if (!force && (now - this.lastSoundTime < this.minSoundInterval)) {
            return;
        }
        this.lastSoundTime = now;

        // 1. Primary: Authentic sampled mechanical flap playback
        if (this.buffers && this.buffers.length > 0) {
            try {
                const buffer = this.buffers[Math.floor(Math.random() * this.buffers.length)];
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;

                // Subtle organic pitch jitter (real Solari drums have slight mechanical tolerance differences)
                source.playbackRate.value = 0.93 + (Math.random() * 0.14);

                const gainNode = this.ctx.createGain();
                const randomGain = (0.75 + Math.random() * 0.25) * this.volume;
                gainNode.gain.setValueAtTime(randomGain, now);

                source.connect(gainNode);
                gainNode.connect(this.ctx.destination);

                source.start(now);
                return;
            } catch (e) {
                // Fall through to procedural fallback if buffer node fails
            }
        }

        // 2. Procedural Fallback if audio files are still downloading
        try {
            const noiseLen = Math.floor(this.ctx.sampleRate * 0.04);
            const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < noiseLen; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.25));
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = noiseBuf;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1800 + (Math.random() * 400 - 200), now);
            filter.Q.setValueAtTime(3.0, now);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(this.volume * 0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            noiseNode.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noiseNode.start(now);
            noiseNode.stop(now + 0.045);
        } catch (e) {}
    }
}

window.solariAudio = new SolariAudioEngine();
