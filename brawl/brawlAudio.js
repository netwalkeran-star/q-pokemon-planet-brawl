// High-end WebAudio Synthesizer & Adaptive Action BGM for Brawl Mode

class BrawlAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbSend = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.bgmRunning = false;
    this.bgmTimer = null;
    this.stepIndex = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;

      // Warm Stereo Slapback / Damped Reverb Bus
      const delayL = this.ctx.createDelay(1.0);
      const delayR = this.ctx.createDelay(1.0);
      delayL.delayTime.value = 0.17;
      delayR.delayTime.value = 0.25;

      const fbFilter = this.ctx.createBiquadFilter();
      fbFilter.type = 'lowpass';
      fbFilter.frequency.value = 2100;

      const fbGain = this.ctx.createGain();
      fbGain.gain.value = 0.28;

      const wetGain = this.ctx.createGain();
      wetGain.gain.value = 0.26;

      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 1.0;

      this.reverbSend.connect(delayL);
      delayL.connect(delayR);
      delayR.connect(fbFilter);
      fbFilter.connect(fbGain);
      fbGain.connect(delayL);

      delayL.connect(wetGain);
      delayR.connect(wetGain);
      wetGain.connect(this.compressor);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate 1.5s white noise buffer for crisp percussion & whooshes
      const sampleRate = this.ctx.sampleRate;
      const len = Math.floor(sampleRate * 1.5);
      this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Synchronous silent-buffer trigger to reliably unlock iOS / iPadOS Safari WebAudio
    if (this.ctx && !this._iosUnlocked) {
      try {
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);
        this._iosUnlocked = true;
      } catch {
        // Ignore
      }
    }
  }

  playStartJingle() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [392.0, 523.25, 659.25].forEach((f, idx) => {
      const st = t + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.16, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.24);
      osc.connect(g);
      this.connectOut(g, 0.45);
      osc.start(st);
      osc.stop(st + 0.26);
    });
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.03);
    }
  }

  connectOut(node, wetAmount = 0.22) {
    node.connect(this.compressor);
    if (wetAmount > 0 && this.reverbSend) {
      const send = this.ctx.createGain();
      send.gain.value = wetAmount;
      node.connect(send);
      send.connect(this.reverbSend);
    }
  }

  // ==========================================================================
  // ADAPTIVE HEROIC ACTION BGM (124 BPM, Cm9 -> Abmaj7 -> Fm9 -> G7sus4)
  // ==========================================================================
  startBGM() {
    this.init();
    if (!this.ctx || this.bgmRunning) return;
    this.bgmRunning = true;
    this.stepIndex = 0;

    const stepMs = (60 / 124 / 4) * 1000; // 16th notes (~121ms)
    const chords = [
      { bass: 65.41, notes: [261.63, 311.13, 392.0, 466.16, 587.33] }, // Cm9
      { bass: 51.91, notes: [207.65, 261.63, 311.13, 392.0, 466.16] }, // Abmaj9
      { bass: 43.65, notes: [174.61, 207.65, 261.63, 311.13, 392.0] }, // Fm9
      { bass: 49.0, notes: [196.0, 261.63, 293.66, 392.0, 466.16] } // Gsus4/G
    ];
    const arpPattern = [0, 2, 4, 3, 1, 2, 4, 2, 0, 3, 4, 2, 1, 4, 3, 2];

    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex % 16;
      const bar = Math.floor(this.stepIndex / 16) % chords.length;
      const chord = chords[bar];

      // 1. Punchy Sub Kick (steps 0, 6, 8, 14)
      if (step === 0 || step === 6 || step === 8 || step === 14) {
        this.bgmKick(now);
      }
      // 2. Crisp Snare / Clap (steps 4, 12)
      if (step === 4 || step === 12) {
        this.bgmSnare(now);
      }
      // 3. Soft 16th Hi-Hat Groove
      if (step % 2 === 1) {
        this.bgmHat(now, step % 4 === 3 ? 0.04 : 0.02);
      }
      // 4. Warm Filtered Analog Bass (rolling 8ths)
      if (step % 2 === 0) {
        const oct = step === 6 || step === 14 ? 2 : 1;
        this.bgmBass(now, chord.bass * oct, 0.16);
      }
      // 5. Lush Pad on bar start
      if (step === 0) {
        this.bgmPad(now, chord.notes.slice(0, 3), 1.85);
      }
      // 6. Crystal Marimba / Synth Pluck Arpeggio
      if (step % 2 === 0 || step === 11 || step === 15) {
        const noteFreq = chord.notes[arpPattern[step] % chord.notes.length];
        this.bgmPluck(now, noteFreq, 0.22);
      }

      this.stepIndex = (this.stepIndex + 1) % 64;
    }, stepMs);
  }

  stopBGM() {
    this.bgmRunning = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  bgmKick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    this.connectOut(g, 0.0);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  bgmSnare(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1850;
    bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp);
    bp.connect(g);
    this.connectOut(g, 0.25);
    src.start(t);
    src.stop(t + 0.13);
  }

  bgmHat(t, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(hp);
    hp.connect(g);
    this.connectOut(g, 0.08);
    src.start(t);
    src.stop(t + 0.05);
  }

  bgmBass(t, freq, dur) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + dur);
    filter.Q.value = 3.2;

    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter);
    filter.connect(g);
    this.connectOut(g, 0.05);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  bgmPad(t, freqs, dur) {
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      filter.type = 'lowpass';
      filter.frequency.value = 1100;

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.032, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(filter);
      filter.connect(g);
      this.connectOut(g, 0.45);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  }

  bgmPluck(t, freq, dur) {
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    sub.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    sub.frequency.setValueAtTime(freq * 2, t);

    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    sub.connect(g);
    this.connectOut(g, 0.48);
    osc.start(t);
    sub.start(t);
    osc.stop(t + dur + 0.02);
    sub.stop(t + dur + 0.02);
  }

  // ==========================================================================
  // HIGH-END LAYERED SOUND EFFECTS
  // ==========================================================================
  playSwordSlash() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Air whoosh
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(750, t + 0.11);
    bp.Q.value = 1.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.16, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp);
    bp.connect(ng);
    this.connectOut(ng, 0.22);
    src.start(t);
    src.stop(t + 0.13);

    // Metallic blade shimmer
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.08);
    og.gain.setValueAtTime(0.09, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og);
    this.connectOut(og, 0.25);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playDartShot() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.09);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    this.connectOut(g, 0.3);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  playLaserShot() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Deep sub punch
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, t);
    sub.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    sg.gain.setValueAtTime(0.24, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    sub.connect(sg);
    this.connectOut(sg, 0.1);
    sub.start(t);
    sub.stop(t + 0.17);

    // Resonant railgun sweep
    const beam = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const bg = this.ctx.createGain();
    beam.type = 'sawtooth';
    beam.frequency.setValueAtTime(1500, t);
    beam.frequency.exponentialRampToValueAtTime(280, t + 0.16);
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 2.4;
    bg.gain.setValueAtTime(0.14, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    beam.connect(filter);
    filter.connect(bg);
    this.connectOut(bg, 0.35);
    beam.start(t);
    beam.stop(t + 0.18);
  }

  playNovaPulse() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, t);
    sub.frequency.exponentialRampToValueAtTime(36, t + 0.24);
    sg.gain.setValueAtTime(0.28, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    sub.connect(sg);
    this.connectOut(sg, 0.2);
    sub.start(t);
    sub.stop(t + 0.28);
  }

  playTurretFire() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046.5, t);
    osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.08);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g);
    this.connectOut(g, 0.38);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playDash() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(550, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp);
    bp.connect(g);
    this.connectOut(g, 0.3);
    src.start(t);
    src.stop(t + 0.24);
  }

  playUltimate() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Cinematic sub impact
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    sg.gain.setValueAtTime(0.45, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    sub.connect(sg);
    this.connectOut(sg, 0.2);
    sub.start(t);
    sub.stop(t + 0.5);

    // Shockwave roar
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.42);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.26, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    src.connect(lp);
    lp.connect(ng);
    this.connectOut(ng, 0.4);
    src.start(t);
    src.stop(t + 0.46);

    // Shimmering golden chord
    [523.25, 783.99, 1046.5].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
      osc.connect(g);
      this.connectOut(g, 0.55);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  playKill() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.06);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    this.connectOut(g, 0.25);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playPickup(tier = 'xp') {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const notes =
      tier === 'special'
        ? [523.25, 659.25, 783.99, 1046.5]
        : tier === 'essence'
          ? [587.33, 880.0]
          : [659.25, 987.77];

    notes.forEach((f, idx) => {
      const st = t + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.12, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.16);
      osc.connect(g);
      this.connectOut(g, 0.4);
      osc.start(st);
      osc.stop(st + 0.18);
    });
  }

  playCapture() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Triumphant brass-bell fanfare + firework pops
    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((f, i) => {
      const st = t + i * 0.09;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.16, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.38);
      osc.connect(g);
      this.connectOut(g, 0.5);
      osc.start(st);
      osc.stop(st + 0.4);
    });
  }

  playBossSpawn() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    [65.41, 98.0].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, t);
      filter.frequency.linearRampToValueAtTime(180, t + 0.55);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
      osc.connect(filter);
      filter.connect(g);
      this.connectOut(g, 0.35);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  playHurt() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    this.connectOut(g, 0.12);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playVictory() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const melody = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    const times = [0, 0.11, 0.22, 0.34, 0.52, 0.66];
    melody.forEach((f, i) => {
      const st = t + times[i];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.18, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.45);
      osc.connect(g);
      this.connectOut(g, 0.55);
      osc.start(st);
      osc.stop(st + 0.48);
    });
  }
}

export const brawlAudio = new BrawlAudioEngine();
