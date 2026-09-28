/**
 * Solari Mechanical Split-Flap Audio Engine
 * Procedural Web Audio synthesizer recreating the tactile plastic flap and ratchet clatter.
 */

class SolariAudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.volume = 0.85; // High default volume so it's clearly audible
        this.lastSoundTime = 0;
        this.minSoundInterval = 0.035; // Throttle to prevent distorted clipping
        this.isUnlocked = false;
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
        // Play 3 rapid mechanical clacks in sequence
        this.playFlap(true);
        setTimeout(() => this.playFlap(true), 50);
        setTimeout(() => this.playFlap(true), 100);
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

        try {
            // 1. Crisp Plastic Leaf Impact (High-pass / Bandpass noise burst)
            const noiseLen = Math.floor(this.ctx.sampleRate * 0.035); // 35ms
            const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < noiseLen; i++) {
                // Decaying noise burst
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.3));
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = noiseBuf;

            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            // Slight organic pitch variation per flap
            bandpass.frequency.setValueAtTime(2400 + (Math.random() * 600 - 300), now);
            bandpass.Q.setValueAtTime(2.2, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(this.volume * 0.9, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

            noiseNode.connect(bandpass);
            bandpass.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);
            noiseNode.start(now);
            noiseNode.stop(now + 0.04);

            // 2. Low-frequency Mechanical Ratchet / Escapement Click (160Hz -> 50Hz)
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(210 + Math.random() * 40, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.045);

            oscGain.gain.setValueAtTime(this.volume * 0.7, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);

        } catch (e) {
            // Audio error fallback
        }
    }
}

window.solariAudio = new SolariAudioEngine();
