/**
 * Procedural Web Audio synthesizer for mechanical Solari split-flap clatter.
 * Generates an authentic, crisp mechanical flap sound with organic pitch variation.
 */

class SolariAudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.volume = 0.4;
        this.lastSoundTime = 0;
        this.minSoundInterval = 0.025; // Max 40 clacks/sec to prevent audio clutter
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.muted = muted;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    }

    playFlap() {
        if (this.muted || this.volume <= 0) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        if (now - this.lastSoundTime < this.minSoundInterval) {
            return;
        }
        this.lastSoundTime = now;

        try {
            // 1. Noise burst for the crisp plastic flap edge snap
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.02); // 20ms burst
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = this.ctx.createBufferSource();
            whiteNoise.buffer = buffer;

            // Bandpass filter for distinct Solari mechanical plastic snap (2.2kHz - 3.8kHz)
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            const randomPitch = 2600 + (Math.random() * 800 - 400);
            filter.frequency.setValueAtTime(randomPitch, now);
            filter.Q.setValueAtTime(3.0, now);

            // Fast decay envelope
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(this.volume * 0.7, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

            whiteNoise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);

            whiteNoise.start(now);
            whiteNoise.stop(now + 0.025);

            // 2. Low-frequency thud for the solenoid / wheel drum resonance
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120 + Math.random() * 30, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.03);

            oscGain.gain.setValueAtTime(this.volume * 0.4, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.035);

        } catch (e) {
            // Audio error fallback
        }
    }
}

// Global audio singleton
window.solariAudio = new SolariAudioEngine();
