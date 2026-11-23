// Cute Web Audio Synth Sound Effects & Relaxing Travel Background Music
class SoundController {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgmPlaying = false;
    this.bgmMuted = false;
    this.isMuted = false;
    this.bgmTimer = null;
    this.bgmStep = 0;

    // Load saved mute state
    try {
      this.isMuted = localStorage.getItem('pokemon_planet_snake_sound_muted') === 'true';
      this.bgmMuted = this.isMuted;
    } catch (e) {}
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(this.isMuted || this.bgmMuted ? 0 : 0.9, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.bgmPlaying && !this.isMuted && !this.bgmMuted) {
      this.startBGM();
    }
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    this.bgmMuted = this.isMuted;
    try {
      localStorage.setItem('pokemon_planet_snake_sound_muted', this.isMuted ? 'true' : 'false');
    } catch (e) {}

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, now);
      if (this.bgmGain) this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.9, now);
      if (this.sfxGain) this.sfxGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, now);
    }

    if (!this.isMuted && !this.bgmPlaying) {
      this.startBGM();
    }
    return this.isMuted;
  }

  toggleMute() {
    this.init();
    return this.setMuted(!this.isMuted);
  }

  getMuted() {
    return this.isMuted;
  }

  /**
   * 🎵 Relaxing Acoustic Travel / Island Breeze Background Music
   */
  startBGM() {
    if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;

    // Warm progression: Cmaj7 -> Am7 -> Fmaj7 -> G6
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 329.63]  // G6
    ];

    // Gentle Kalimba / Marimba pentatonic travel melody notes
    const melody = [
      523.25, 659.25, 783.99, 659.25,  880.00, 783.99, 659.25, 587.33,
      523.25, 440.00, 523.25, 659.25,  587.33, 493.88, 392.00, 440.00,
      349.23, 440.00, 523.25, 659.25,  783.99, 659.25, 523.25, 440.00,
      392.00, 493.88, 587.33, 783.99,  659.25, 587.33, 523.25, 392.00
    ];

    const playNote = (freq, time, duration, vol = 0.045, type = 'sine') => {
      if (!this.ctx || this.isMuted || this.bgmMuted) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      // Soft acoustic pluck envelope
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, time + duration);

      osc.connect(gain);
      const dest = this.bgmGain || this.masterGain || this.ctx.destination;
      gain.connect(dest);

      osc.start(time);
      osc.stop(time + duration + 0.02);
    };

    const tick = () => {
      if (!this.bgmPlaying) return;
      if (this.ctx && this.ctx.state === 'running' && !this.isMuted && !this.bgmMuted) {
        const now = this.ctx.currentTime;
        const stepInBar = this.bgmStep % 8;
        const chordIdx = Math.floor(this.bgmStep / 8) % chords.length;
        const currentChord = chords[chordIdx];

        // Strum warm acoustic pad chord on beat 0 and 4
        if (stepInBar === 0) {
          currentChord.forEach((f, idx) => {
            playNote(f, now + idx * 0.045, 1.9, 0.028, 'triangle');
          });
        } else if (stepInBar === 4) {
          playNote(currentChord[0] * 0.5, now, 1.2, 0.035, 'sine');
          playNote(currentChord[2], now + 0.04, 1.1, 0.022, 'triangle');
        }

        // Gentle kalimba melody note
        const melNote = melody[this.bgmStep % melody.length];
        if (melNote && stepInBar !== 7) {
          playNote(melNote, now, 0.65, 0.042, 'sine');
          playNote(melNote * 2, now, 0.25, 0.01, 'sine');
        }

        this.bgmStep++;
      }
      this.bgmTimer = setTimeout(tick, 340);
    };

    tick();
  }

  toggleBGM() {
    this.init();
    return this.toggleMute();
  }

  // 跳躍音效 (Q彈輕快音) - 嚴格受靜音控制
  playJump() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.20);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.20);

    osc.connect(gain);
    const dest = this.sfxGain || this.masterGain || this.ctx.destination;
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.20);
  }

  /**
   * ⭐ 跳殺音效改音樂！ (升級版五音符晶瑩勝利排鐘，清脆治癒，絕對靜音控制)
   */
  playChomp() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // 愉悅的 C5-E5-G5-C6-E6 晶亮勝利和弦
    const melodyNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51];

    melodyNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.04;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(gain);
      const dest = this.sfxGain || this.masterGain || this.ctx.destination;
      gain.connect(dest);

      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  // 吃到寶石：晶瑩閃耀音效
  playEat() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880.0, 1174.66];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.20, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.16);
      osc.connect(gain);
      const dest = this.sfxGain || this.masterGain || this.ctx.destination;
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  // 元素轉化 / 升級音效
  playEvolve() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      const dest = this.sfxGain || this.masterGain || this.ctx.destination;
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  // 傳送門或獲得道具特定音效
  playDungeonPortal() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.002, t + 0.25);
      osc.connect(gain);
      const dest = this.sfxGain || this.masterGain || this.ctx.destination;
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  // 發動技能 (衝刺)
  playSkill(type = 'speed') {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.26);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.26);

    osc.connect(gain);
    const dest = this.sfxGain || this.masterGain || this.ctx.destination;
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  playBossSpawn() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.4);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    const dest = this.sfxGain || this.masterGain || this.ctx.destination;
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playBossHit() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.22);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    const dest = this.sfxGain || this.masterGain || this.ctx.destination;
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  playVictory() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      const dest = this.sfxGain || this.masterGain || this.ctx.destination;
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  playHurt() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.18);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    const dest = this.sfxGain || this.masterGain || this.ctx.destination;
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.18);
  }
}

export const sound = new SoundController();
