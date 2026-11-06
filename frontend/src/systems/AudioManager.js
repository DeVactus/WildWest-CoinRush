import { CONFIG, asset } from '../config.js';

const STORE = 'coinrush.audio.v1';
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- Lagu buatan sendiri (synth, tanpa file) ----------
const TRACKS = {
    // Gameplay: gallop western, E minor
    game: {
        bpm: 148,
        bars: [
            { root: 40, chord: [64, 67, 71], lead: [76,0,0,74, 71,0,67,0, 71,0,74,0, 76,0,0,0] },
            { root: 36, chord: [60, 64, 67], lead: [72,0,0,71, 67,0,64,0, 67,0,71,0, 72,0,0,0] },
            { root: 38, chord: [62, 66, 69], lead: [74,0,0,72, 69,0,66,0, 69,0,72,0, 74,0,0,0] },
            { root: 40, chord: [64, 67, 71], lead: [76,0,74,0, 71,0,67,0, 64,0,67,71, 76,0,0,0] }
        ]
    },
    // Fallback lobby: pelan, harmonika
    lobby: {
        bpm: 88,
        bars: [
            { root: 45, chord: [57, 60, 64], lead: [76,0,0,0, 72,0,0,0, 74,0,76,0, 72,0,0,0] },
            { root: 41, chord: [60, 65, 69], lead: [77,0,0,0, 76,0,0,0, 72,0,0,0, 69,0,0,0] },
            { root: 48, chord: [60, 64, 67], lead: [72,0,0,0, 76,0,0,0, 79,0,0,76, 74,0,0,0] },
            { root: 40, chord: [56, 59, 64], lead: [71,0,0,0, 74,0,76,0, 80,0,0,0, 76,0,0,0] }
        ]
    }
};

class AudioManager {
    constructor() {
        this.ctx = null;
        this.unlocked = false;
        this.want = null;          // 'lobby' | 'game' | null
        this.seqName = null;
        this.timer = null;
        this.step = 0;
        this.next = 0;
        this.intensity = 0;
        this.ducked = false;

        this.lobbyMode = null;     // 'local' | 'yt' | 'synth'
        this.localAudio = null;
        this.yt = null;
        this.ytReady = false;
        this.ytFailed = false;
        this.ytLoading = false;
        this.localChecked = null;

        const def = { music: 0.6, sfx: 0.8, muted: false };
        try { this.settings = { ...def, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
        catch { this.settings = def; }
    }

    // ---------- setup ----------
    unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            const comp = this.ctx.createDynamicsCompressor();
            this.musicBus = this.ctx.createGain();
            this.sfxBus = this.ctx.createGain();
            this.musicBus.connect(this.master);
            this.sfxBus.connect(this.master);
            this.master.connect(comp);
            comp.connect(this.ctx.destination);

            const len = this.ctx.sampleRate * 2;
            this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = this.noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const first = !this.unlocked;
        this.unlocked = true;
        this.applyVolumes();
        if (first) this.apply();
        else if (this.want === 'lobby' && this.lobbyMode === 'yt') this.ytPlay();
    }

    save() {
        try { localStorage.setItem(STORE, JSON.stringify(this.settings)); } catch { /* ignore */ }
    }

    setMusicVolume(v) { this.settings.music = v; this.save(); this.applyVolumes(); }
    setSfxVolume(v) { this.settings.sfx = v; this.save(); this.applyVolumes(); }
    setMuted(m) { this.settings.muted = m; this.save(); this.applyVolumes(); }
    toggleMute() { this.setMuted(!this.settings.muted); return this.settings.muted; }
    duck(on) { this.ducked = on; this.applyVolumes(); }

    applyVolumes() {
        const s = this.settings;
        const mv = s.muted ? 0 : s.music * (this.ducked ? 0.3 : 1);
        if (this.ctx) {
            this.musicBus.gain.value = mv * 0.9;
            this.sfxBus.gain.value = s.muted ? 0 : s.sfx;
            this.master.gain.value = 1;
        }
        if (this.localAudio) { this.localAudio.volume = Math.min(1, mv); this.localAudio.muted = s.muted; }
        if (this.yt && this.ytReady) {
            try {
                this.yt.setVolume(Math.round(mv * 100));
                s.muted ? this.yt.mute() : this.yt.unMute();
            } catch { /* ignore */ }
        }
    }

    // ---------- pilih lagu ----------
    play(name) {
        this.want = name;
        this.apply();
    }

    setIntensity(n) { this.intensity = Math.min(8, Math.max(0, n)); }

    apply() {
        if (!this.unlocked) return;
        if (this.want === 'game') {
            this.stopLobby();
            if (this.seqName !== 'game') this.startSeq('game');
        } else if (this.want === 'lobby') {
            if (this.seqName && this.seqName !== 'lobby') this.stopSeq();
            this.startLobby();
        } else {
            this.stopSeq();
            this.stopLobby();
        }
    }

    // ---------- lobby: lokal -> YouTube -> synth ----------
    async startLobby() {
        if (this.lobbyMode === 'local' && this.localAudio) { this.localAudio.play().catch(() => {}); return; }
        if (this.lobbyMode === 'yt') { this.ytPlay(); return; }
        if (this.lobbyMode === 'synth') { if (this.seqName !== 'lobby') this.startSeq('lobby'); return; }
        if (this.lobbyStarting) return;
        this.lobbyStarting = true;

        if (this.localChecked === null) this.localChecked = await this.probeLocal();
        if (this.want !== 'lobby') { this.lobbyStarting = false; return; }

        if (this.localChecked) {
            this.lobbyMode = 'local';
            this.localAudio = new Audio(asset(CONFIG.LOBBY_LOCAL_FILE));
            this.localAudio.loop = true;
            this.applyVolumes();
            this.localAudio.play().catch(() => {});
        } else if (!this.ytFailed && CONFIG.LOBBY_YT_ID) {
            this.lobbyMode = 'yt';
            this.initYT();
        } else {
            this.lobbyMode = 'synth';
            this.startSeq('lobby');
        }
        this.lobbyStarting = false;
    }

    stopLobby() {
        if (this.localAudio) this.localAudio.pause();
        if (this.yt && this.ytReady) { try { this.yt.pauseVideo(); } catch { /* ignore */ } }
        if (this.seqName === 'lobby') this.stopSeq();
    }

    async probeLocal() {
        try {
            const r = await fetch(asset(CONFIG.LOBBY_LOCAL_FILE), { method: 'HEAD' });
            const type = r.headers.get('content-type') || '';
            return r.ok && (type.startsWith('audio') || type.includes('octet-stream') || type.includes('mpeg'));
        } catch { return false; }
    }

    loadYTApi() {
        return new Promise((resolve, reject) => {
            if (window.YT && window.YT.Player) return resolve();
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            s.onerror = () => reject(new Error('yt api blocked'));
            document.head.appendChild(s);
            setTimeout(() => reject(new Error('yt api timeout')), 7000);
        });
    }

    async initYT() {
        if (this.ytLoading || this.yt) return;
        this.ytLoading = true;
        try {
            await this.loadYTApi();
            const holder = document.getElementById('yt-holder');
            holder.innerHTML = '<div id="yt-player"></div>';
            const id = CONFIG.LOBBY_YT_ID;
            this.yt = new window.YT.Player('yt-player', {
                width: '64', height: '64', videoId: id,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, loop: 1, playlist: id,
                    playsinline: 1, rel: 0, modestbranding: 1
                },
                events: {
                    onReady: (e) => {
                        this.ytReady = true;
                        this.applyVolumes();
                        if (this.want === 'lobby') e.target.playVideo();
                    },
                    onStateChange: (e) => { if (e.data === 0 && this.want === 'lobby') e.target.playVideo(); },
                    onError: () => this.ytFallback()
                }
            });
        } catch {
            this.ytFallback();
        }
        this.ytLoading = false;
    }

    ytPlay() {
        if (this.yt && this.ytReady && this.want === 'lobby') {
            try {
                const st = this.yt.getPlayerState();
                if (st !== 1 && st !== 3) this.yt.playVideo();
            } catch { /* ignore */ }
        }
    }

    ytFallback() {
        this.ytFailed = true;
        this.yt = null;
        this.ytReady = false;
        this.lobbyMode = 'synth';
        if (this.want === 'lobby') this.startSeq('lobby');
    }

    // ---------- sequencer ----------
    startSeq(name) {
        if (!this.ctx) return;
        this.stopSeq();
        this.seqName = name;
        this.step = 0;
        this.next = this.ctx.currentTime + 0.08;
        this.timer = setInterval(() => this.tick(), 25);
    }

    stopSeq() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.seqName = null;
    }

    tick() {
        const tr = TRACKS[this.seqName];
        if (!tr || !this.ctx) return;
        const bpm = tr.bpm + (this.seqName === 'game' ? this.intensity * 4 : 0);
        const stepDur = 60 / bpm / 4;
        while (this.next < this.ctx.currentTime + 0.15) {
            this.playStep(this.seqName, tr, this.step, this.next, stepDur);
            this.next += stepDur;
            this.step = (this.step + 1) % (tr.bars.length * 16);
        }
    }

    playStep(name, tr, step, t, sd) {
        const bar = tr.bars[Math.floor(step / 16)];
        const s = step % 16;
        const beat = s % 4;
        const bus = this.musicBus;

        if (name === 'game') {
            if (beat === 0 || beat === 2 || beat === 3) {
                this.pluck(mtof(bar.root + (beat === 3 ? 12 : 0)), t, sd * 1.7, 'triangle', 0.5, 700, bus);
            }
            if (s === 0 || s === 6 || s === 8 || s === 14) {
                bar.chord.forEach((m, i) => this.pluck(mtof(m), t + i * 0.012, 0.3, 'sawtooth', 0.07, 2400, bus));
            }
            const L = bar.lead[s];
            if (L) this.lead(mtof(L), t, sd * 3, 0.13, bus);
            if (s === 0 || s === 8) this.kick(t, bus);
            if (s === 4 || s === 12) this.noise(t, 0.12, 'bandpass', 1800, 0.22, bus);
            if (s % 2 === 0) this.noise(t, 0.04, 'highpass', 7000, s % 4 === 0 ? 0.07 : 0.04, bus);
            if (this.intensity >= 3 && s % 2 === 1) this.noise(t, 0.03, 'highpass', 8000, 0.03, bus);
        } else {
            if (s === 0 || s === 8) this.pluck(mtof(bar.root), t, sd * 6, 'triangle', 0.45, 600, bus);
            if (s % 2 === 0) {
                const m = bar.chord[(s / 2) % 3];
                this.pluck(mtof(m), t, 0.5, 'triangle', 0.16, 2600, bus);
            }
            const L = bar.lead[s];
            if (L) {
                let len = 1;
                while (len < 16 - s && !bar.lead[s + len]) len++;
                this.lead(mtof(L), t, sd * len * 0.95, 0.09, bus);
            }
            if (s === 0 || s === 8) this.noise(t, 0.05, 'lowpass', 300, 0.12, bus);
        }
    }

    // ---------- voices ----------
    pluck(f, t, dur, type, gain, cutoff, bus) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
        o.type = type; o.frequency.value = f;
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t);
        fl.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.3), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(bus);
        o.start(t); o.stop(t + dur + 0.05);
    }

    lead(f, t, dur, gain, bus) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
        const lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f;
        lfo.frequency.value = 5.5; lg.gain.value = f * 0.01;
        lfo.connect(lg); lg.connect(o.frequency);
        fl.type = 'bandpass'; fl.frequency.value = Math.min(3500, f * 2.2); fl.Q.value = 1.1;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
        g.gain.setValueAtTime(gain, t + Math.max(0.04, dur - 0.08));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(bus);
        o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }

    kick(t, bus) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.55, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + 0.2);
    }

    noise(t, dur, ftype, freq, gain, bus, sweepTo) {
        const c = this.ctx;
        const src = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter();
        src.buffer = this.noiseBuf;
        fl.type = ftype; fl.frequency.setValueAtTime(freq, t);
        if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(fl); fl.connect(g); g.connect(bus);
        src.start(t, Math.random()); src.stop(t + dur + 0.02);
    }

    tone(f, f2, t, dur, type, gain) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfxBus);
        o.start(t); o.stop(t + dur + 0.03);
    }

    // ---------- SFX ----------
    sfx(name) {
        if (!this.ctx || !this.unlocked || this.settings.muted) return;
        const t = this.ctx.currentTime;
        const b = this.sfxBus;
        switch (name) {
            case 'click': this.tone(520, 380, t, 0.07, 'square', 0.12); break;
            case 'coin':
                this.tone(988, null, t, 0.08, 'square', 0.12);
                this.tone(1319, null, t + 0.07, 0.16, 'square', 0.12); break;
            case 'gold':
                [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, null, t + i * 0.06, 0.14, 'triangle', 0.16)); break;
            case 'jump': this.tone(260, 560, t, 0.18, 'sine', 0.2); break;
            case 'land': this.noise(t, 0.08, 'lowpass', 600, 0.15, b); break;
            case 'shoot':
                this.noise(t, 0.16, 'bandpass', 2600, 0.45, b, 600);
                this.tone(240, 70, t, 0.12, 'square', 0.18); break;
            case 'hit':
                this.noise(t, 0.25, 'lowpass', 1200, 0.5, b, 150);
                this.tone(200, 60, t, 0.3, 'sawtooth', 0.25); break;
            case 'fuse': this.noise(t, 0.35, 'highpass', 4500, 0.1, b); break;
            case 'boom':
                this.noise(t, 0.9, 'lowpass', 1500, 0.8, b, 80);
                this.tone(110, 30, t, 0.7, 'sine', 0.6); break;
            case 'power':
                [523, 659, 784, 1047].forEach((f, i) => this.tone(f, null, t + i * 0.07, 0.15, 'triangle', 0.2)); break;
            case 'wave':
                [392, 494, 587, 784].forEach((f, i) => this.tone(f, null, t + i * 0.1, 0.25, 'sawtooth', 0.12)); break;
            case 'warn': this.tone(880, 880, t, 0.1, 'square', 0.1); break;
            case 'gameover':
                [392, 349, 311, 262].forEach((f, i) => this.tone(f, f * 0.97, t + i * 0.28, 0.4, 'sawtooth', 0.18)); break;
            default: break;
        }
    }
}

export const audio = new AudioManager();
