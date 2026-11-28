/* ==========================================================================
   1142949 HW06 — 京都百鬼夜行：陰陽鎮魂錄
   File: js/bgm-audio.js
   Multi-Track Japanese Anime Web Audio BGM Sequencer & Procedural SFX Studio
   - Synthesizes Koto (十三絃箏), Tsugaru Shamisen (三味線), Shakuhachi (尺八),
     O-Daiko / Shime-Daiko (和太鼓), Kagura Suzu (神樂鈴) & Warm Shrine Pad
   - 4 Full Looping Musical Tracks in Japanese Hirajoshi / In-Sen Pentatonic Scale
   - Lookahead Web Audio Scheduler (Zero main-thread lag, zero external MP3 404s!)
   ========================================================================== */

(function () {
  "use strict";

  // MIDI Note to Frequency helper (A4 = 440Hz)
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* --------------------------------------------------------------------------
     4 Original Japanese Anime Musical Scores (16-step bar patterns × 4 bars = 64 steps)
     Scale: D In-Sen / Hirajoshi Minor Pentatonic (D, Eb, G, A, Bb/C, D)
     MIDI Reference:
       D3=50, Eb3=51, G3=55, A3=57, Bb3=58, C4=60
       D4=62, Eb4=63, G4=67, A4=69, Bb4=70, C5=72, D5=74, Eb5=75, G5=79, A5=81
     -------------------------------------------------------------------------- */
  /* v11 激昂化：所有曲目加速、加上低音推進與重鼓（calm 曲目只加一半） */
  const ENERGY = { tempo: 1.16, calm: { eternal_seal: 1, moonlight: 1 } };
  const BGM_SCORES = {
    // Track 1: Ⅰ. 月下千本鳥居（箏・尺八）— Mystical Kyoto Shrine Night (92 BPM)
    moonlight: {
      id: "moonlight",
      name: "Ⅰ. 月下千本鳥居",
      bpm: 92,
      padChords: [
        [50, 57, 62],
        [51, 58, 63],
        [48, 55, 60],
        [50, 57, 62]
      ],
      koto: [
        // Bar 1 (Dm9 Japanese Koto Arpeggio)
        62, 0, 69, 0, 74, 0, 72, 0, 69, 0, 67, 0, 63, 0, 62, 0,
        // Bar 2 (EbMaj7#11 Koto)
        63, 0, 67, 0, 70, 0, 74, 0, 75, 0, 74, 0, 70, 0, 67, 0,
        // Bar 3 (Cm7 / G)
        60, 0, 67, 0, 72, 0, 74, 0, 79, 0, 74, 0, 72, 0, 67, 0,
        // Bar 4 (Resolve to D5 + Bell)
        62, 0, 69, 0, 74, 75, 74, 0, 69, 0, 67, 0, 62, 0, 57, 0
      ],
      flute: [
        // Expressive Shakuhachi long notes (note, 0 = rest/sustain)
        74, 0, 0, 0, 0, 0, 72, 0, 69, 0, 0, 0, 67, 0, 0, 0,
        70, 0, 0, 0, 74, 0, 75, 0, 74, 0, 0, 0, 0, 0, 0, 0,
        72, 0, 0, 0, 74, 0, 79, 0, 81, 0, 0, 0, 79, 0, 74, 0,
        69, 0, 0, 0, 67, 0, 63, 0, 62, 0, 0, 0, 0, 0, 0, 0
      ],
      shamisen: [],
      taikoLow: [
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
        1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0
      ],
      taikoRim: [
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0
      ]
    },

    // Track 2: Ⅱ. 陰陽九宮陣（三味線・太鼓）— Tactical Anime Duel Theme (124 BPM)
    shrine_duel: {
      id: "shrine_duel",
      name: "Ⅱ. 陰陽九宮陣",
      bpm: 124,
      padChords: [
        [50, 57, 62],
        [48, 55, 60],
        [51, 58, 63],
        [45, 57, 62]
      ],
      koto: [
        74, 0, 69, 0, 74, 0, 75, 0, 74, 0, 72, 0, 69, 0, 67, 0,
        72, 0, 67, 0, 72, 0, 74, 0, 72, 0, 70, 0, 67, 0, 63, 0,
        75, 0, 70, 0, 74, 0, 75, 0, 79, 0, 75, 0, 74, 0, 70, 0,
        69, 0, 74, 0, 72, 0, 69, 0, 67, 0, 63, 0, 62, 0, 69, 0
      ],
      shamisen: [
        50, 50, 0, 57, 62, 0, 58, 57, 50, 0, 55, 57, 62, 0, 57, 0,
        48, 48, 0, 55, 60, 0, 62, 60, 48, 0, 55, 58, 60, 0, 55, 0,
        51, 51, 0, 58, 63, 0, 62, 58, 51, 0, 58, 62, 63, 0, 58, 0,
        45, 45, 0, 57, 62, 0, 63, 62, 57, 0, 55, 51, 50, 0, 57, 0
      ],
      flute: [
        0, 0, 0, 0, 74, 0, 0, 0, 79, 0, 75, 0, 74, 0, 0, 0,
        0, 0, 0, 0, 72, 0, 0, 0, 74, 0, 72, 0, 67, 0, 0, 0,
        0, 0, 70, 0, 75, 0, 0, 0, 79, 0, 0, 0, 74, 0, 0, 0,
        81, 0, 0, 0, 79, 0, 75, 0, 74, 0, 0, 0, 0, 0, 0, 0
      ],
      taikoLow: [
        1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0
      ],
      taikoRim: [
        0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
        0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1,
        0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
        0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1
      ]
    },

    // Track 3: Ⅲ. 百鬼狂瀾破陣曲 — High-Octane Anime Boss Climax (146 BPM)
    yokai_storm: {
      id: "yokai_storm",
      name: "Ⅲ. 百鬼狂瀾破陣曲",
      bpm: 146,
      padChords: [
        [50, 57, 62],
        [51, 58, 63],
        [53, 60, 65],
        [45, 57, 61]
      ],
      koto: [
        74, 69, 74, 75, 79, 75, 74, 69, 74, 69, 75, 74, 72, 69, 67, 69,
        75, 70, 75, 79, 82, 79, 75, 70, 75, 70, 79, 75, 74, 70, 67, 70,
        77, 72, 77, 81, 84, 81, 77, 72, 79, 74, 79, 82, 79, 75, 74, 72,
        81, 74, 79, 74, 75, 74, 72, 69, 74, 69, 67, 63, 62, 69, 74, 0
      ],
      shamisen: [
        50, 50, 62, 50, 51, 50, 57, 50, 50, 50, 62, 50, 58, 57, 55, 51,
        51, 51, 63, 51, 55, 51, 58, 51, 51, 51, 63, 51, 62, 58, 55, 51,
        53, 53, 65, 53, 57, 53, 60, 53, 55, 55, 67, 55, 63, 62, 58, 55,
        45, 45, 57, 45, 61, 57, 55, 51, 50, 57, 62, 50, 62, 0, 50, 0
      ],
      flute: [
        81, 0, 0, 79, 75, 0, 74, 0, 79, 0, 81, 0, 86, 0, 0, 0,
        82, 0, 0, 79, 75, 0, 74, 0, 79, 0, 75, 0, 74, 0, 0, 0,
        84, 0, 0, 81, 77, 0, 79, 0, 82, 0, 79, 0, 74, 0, 0, 0,
        81, 0, 79, 0, 75, 0, 74, 0, 74, 0, 0, 0, 0, 0, 0, 0
      ],
      taikoLow: [
        1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
        1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0,
        1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
        1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0
      ],
      taikoRim: [
        0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
        0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1,
        0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
        1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1
      ]
    },

    // Track 4: Ⅳ. 陰陽鎮魂歌 — Serene Dawn Epilogue Theme (84 BPM)
    eternal_seal: {
      id: "eternal_seal",
      name: "Ⅳ. 陰陽鎮魂歌",
      bpm: 84,
      padChords: [
        [50, 57, 65],
        [48, 55, 64],
        [46, 53, 62],
        [50, 57, 62]
      ],
      koto: [
        62, 0, 65, 0, 69, 0, 74, 0, 77, 0, 74, 0, 69, 0, 65, 0,
        60, 0, 64, 0, 67, 0, 72, 0, 76, 0, 72, 0, 67, 0, 64, 0,
        58, 0, 62, 0, 65, 0, 69, 0, 74, 0, 69, 0, 65, 0, 62, 0,
        62, 0, 69, 0, 74, 0, 81, 0, 74, 0, 69, 0, 62, 0, 0, 0
      ],
      flute: [
        74, 0, 0, 0, 77, 0, 74, 0, 69, 0, 0, 0, 0, 0, 0, 0,
        72, 0, 0, 0, 76, 0, 72, 0, 67, 0, 0, 0, 0, 0, 0, 0,
        70, 0, 0, 0, 74, 0, 69, 0, 65, 0, 0, 0, 67, 0, 69, 0,
        74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
      ],
      shamisen: [],
      taikoLow: [
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0
      ],
      taikoRim: []
    },

    // Track 5: Ⅴ. 鞍馬天狗神風曲 — Soaring Celestial Wind Duel Theme (136 BPM)
    kurama_gale: {
      id: "kurama_gale",
      name: "Ⅴ. 鞍馬天狗神風曲",
      bpm: 136,
      padChords: [
        [52, 59, 64],
        [50, 57, 62],
        [48, 55, 60],
        [52, 59, 67]
      ],
      koto: [
        76, 0, 71, 74, 76, 0, 79, 0, 83, 0, 79, 76, 74, 0, 71, 0,
        74, 0, 69, 72, 74, 0, 76, 0, 79, 0, 76, 74, 71, 0, 69, 0,
        72, 0, 67, 71, 72, 0, 76, 0, 79, 0, 83, 79, 76, 0, 72, 0,
        76, 71, 76, 79, 83, 79, 76, 71, 76, 0, 71, 0, 64, 0, 0, 0
      ],
      shamisen: [
        52, 0, 52, 59, 64, 0, 59, 52, 52, 0, 59, 62, 64, 0, 59, 0,
        50, 0, 50, 57, 62, 0, 57, 50, 50, 0, 57, 60, 62, 0, 57, 0,
        48, 0, 48, 55, 60, 0, 55, 48, 48, 0, 55, 59, 60, 0, 55, 0,
        52, 52, 59, 52, 64, 59, 55, 52, 52, 0, 59, 0, 52, 0, 0, 0
      ],
      flute: [
        76, 0, 0, 0, 79, 0, 83, 0, 86, 0, 0, 0, 83, 0, 79, 0,
        74, 0, 0, 0, 76, 0, 79, 0, 81, 0, 0, 0, 76, 0, 74, 0,
        72, 0, 0, 0, 76, 0, 79, 0, 83, 0, 0, 0, 79, 0, 76, 0,
        76, 0, 0, 0, 71, 0, 74, 0, 76, 0, 0, 0, 0, 0, 0, 0
      ],
      taikoLow: [
        1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0,
        1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0,
        1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0
      ],
      taikoRim: [
        0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1,
        0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1,
        0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1,
        0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0
      ]
    }
  };

  /* --------------------------------------------------------------------------
     AnimeAudioStudio Class — Lookahead BGM Sequencer + Analyser + SFX
     -------------------------------------------------------------------------- */
  class AnimeAudioStudio {
    constructor() {
      this.ctx = null;
      this.masterBgmGain = null;
      this.masterSfxGain = null;
      this.analyser = null;
      this.freqData = null;

      this.bgmEnabled = true;
      this.sfxEnabled = true;
      this.bgmVolume = 0.68;

      this.modeSelect = "auto"; // 'auto' or explicit track id
      this.currentTrackId = "moonlight";
      this.isPlayingBgm = false;

      // Lookahead Scheduler state
      this.stepIndex = 0;
      this.nextNoteTime = 0;
      this.schedulerTimer = 0;
      this.noiseBuffer = null;

      this.bindGlobalUnlock();
    }

    bindGlobalUnlock() {
      const unlockOnce = () => {
        this.ensureContext();
        if (this.bgmEnabled && !this.isPlayingBgm) {
          this.startSequencer();
        }
      };
      window.addEventListener("pointerdown", unlockOnce, { once: true, passive: true });
      window.addEventListener("keydown", unlockOnce, { once: true, passive: true });
    }

    ensureContext() {
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return false;
          this.ctx = new AudioCtx();

          this.masterBgmGain = this.ctx.createGain();
          this.masterBgmGain.gain.value = this.bgmEnabled ? this.bgmVolume * 0.42 : 0;

          this.masterSfxGain = this.ctx.createGain();
          this.masterSfxGain.gain.value = this.sfxEnabled ? 0.85 : 0;

          this.analyser = this.ctx.createAnalyser();
          this.analyser.fftSize = 32;
          this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

          // v11：BGM 與音效各接一顆壓縮器，整體更飽滿、更有衝擊力，也不會爆音
          this.bgmComp = this.ctx.createDynamicsCompressor();
          this.bgmComp.threshold.value = -20; this.bgmComp.knee.value = 8; this.bgmComp.ratio.value = 4;
          this.bgmComp.attack.value = 0.004; this.bgmComp.release.value = 0.18;
          this.bgmMakeup = this.ctx.createGain(); this.bgmMakeup.gain.value = 1.55;
          this.sfxComp = this.ctx.createDynamicsCompressor();
          this.sfxComp.threshold.value = -16; this.sfxComp.knee.value = 6; this.sfxComp.ratio.value = 5;
          this.sfxComp.attack.value = 0.002; this.sfxComp.release.value = 0.15;
          this.sfxMakeup = this.ctx.createGain(); this.sfxMakeup.gain.value = 1.45;
          this.masterBgmGain.connect(this.analyser);
          this.analyser.connect(this.bgmComp); this.bgmComp.connect(this.bgmMakeup); this.bgmMakeup.connect(this.ctx.destination);
          this.masterSfxGain.connect(this.sfxComp); this.sfxComp.connect(this.sfxMakeup); this.sfxMakeup.connect(this.ctx.destination);

          this.buildNoiseBuffer();
        }
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    buildNoiseBuffer() {
      if (!this.ctx) return;
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 0.25);
      const buf = this.ctx.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }

    /* ------------------------------------------------------------------------
       Synthesized Traditional Japanese Instruments (Scheduled at Audio Time t)
       ------------------------------------------------------------------------ */
    // 1. 十三絃箏 (Koto Plucked String)
    scheduleKoto(midi, t, dur) {
      if (!this.ctx || !midi) return;
      const freq = midiToFreq(midi);
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = "triangle";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 2, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(freq * 4.5, t);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.3, t + dur);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.28;

      osc1.connect(filter);
      osc2.connect(subGain);
      subGain.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterBgmGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + dur + 0.02);
      osc2.stop(t + dur + 0.02);
    }

    // 2. 津輕三味線 (Tsugaru Shamisen Sharp Percussive Pluck)
    scheduleShamisen(midi, t, dur) {
      if (!this.ctx || !midi) return;
      const freq = midiToFreq(midi);
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq * 1.015, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.02);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq * 2.6, t);
      filter.Q.value = 1.8;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterBgmGain);

      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    // 3. 尺八 (Shakuhachi Bamboo Flute with Soft Attack & Pitch Vibrato)
    scheduleShakuhachi(midi, t, dur) {
      if (!this.ctx || !midi) return;
      const freq = midiToFreq(midi);
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.985, t);
      osc.frequency.linearRampToValueAtTime(freq, t + 0.06);

      lfo.type = "sine";
      lfo.frequency.value = 5.2;
      lfoGain.gain.value = freq * 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      filter.type = "lowpass";
      filter.frequency.value = 1800;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.07);
      gain.gain.setValueAtTime(0.14, t + dur * 0.72);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterBgmGain);

      osc.start(t);
      lfo.start(t);
      osc.stop(t + dur + 0.03);
      lfo.stop(t + dur + 0.03);
    }

    // 4. Warm Atmospheric Shrine Pad (Sustained Bar Chord)
    schedulePadChord(chordMidis, t, dur) {
      if (!this.ctx || !chordMidis) return;
      chordMidis.forEach((m) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(midiToFreq(m), t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.055, t + dur * 0.25);
        gain.gain.setValueAtTime(0.05, t + dur * 0.75);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(this.masterBgmGain);
        osc.start(t);
        osc.stop(t + dur + 0.04);
      });
    }

    // 5. 和太鼓 (O-Daiko Deep Drum & Shime-Daiko Wooden Rim)
    scheduleTaikoBgm(isRim, t) {
      if (!this.ctx) return;
      if (!isRim) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(130, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.22);
        gain.gain.setValueAtTime(0.42, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.masterBgmGain);
        osc.start(t);
        osc.stop(t + 0.31);
        // 鼓皮的「咚」聲＋次低頻，讓大太鼓更有份量
        const sub = this.ctx.createOscillator(), sg = this.ctx.createGain();
        sub.type = "sine"; sub.frequency.setValueAtTime(62, t); sub.frequency.exponentialRampToValueAtTime(34, t + 0.3);
        sg.gain.setValueAtTime(0.3, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        sub.connect(sg); sg.connect(this.masterBgmGain); sub.start(t); sub.stop(t + 0.35);
        if (this.noiseBuffer) {
          const n = this.ctx.createBufferSource(), lp = this.ctx.createBiquadFilter(), ng = this.ctx.createGain();
          n.buffer = this.noiseBuffer; lp.type = "lowpass"; lp.frequency.value = 900;
          ng.gain.setValueAtTime(0.16, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          n.connect(lp); lp.connect(ng); ng.connect(this.masterBgmGain); n.start(t); n.stop(t + 0.07);
        }
      } else if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1350;
        bp.Q.value = 3.2;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.masterBgmGain);
        src.start(t);
        src.stop(t + 0.06);
      }
    }

    /* ------------------------------------------------------------------------
       Lookahead BGM Sequencer Loop
       ------------------------------------------------------------------------ */
    startSequencer() {
      if (!this.ensureContext() || !this.ctx) return;
      if (this.isPlayingBgm) return;
      this.isPlayingBgm = true;
      this.stepIndex = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.06;

      this.updateMasterGain();

      this.schedulerTimer = window.setInterval(() => {
        if (!this.isPlayingBgm || !this.ctx || !this.bgmEnabled) return;
        const score = BGM_SCORES[this.currentTrackId] || BGM_SCORES.moonlight;
        const stepDur = 60 / (score.bpm * ENERGY.tempo) / 4; // 16th note duration in seconds（v11 整體加速）

        while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
          this.scheduleStep(score, this.stepIndex, this.nextNoteTime, stepDur);
          this.nextNoteTime += stepDur;
          this.stepIndex = (this.stepIndex + 1) % 64;
        }
      }, 65);
    }

    scheduleStep(score, step, t, stepDur) {
      // Bar boundary: schedule warm shrine pad chord
      if (step % 16 === 0 && score.padChords) {
        const barIdx = Math.floor(step / 16) % score.padChords.length;
        this.schedulePadChord(score.padChords[barIdx], t, stepDur * 16);
      }

      if (score.koto && score.koto[step]) {
        this.scheduleKoto(score.koto[step], t, stepDur * 3.2);
      }

      if (score.shamisen && score.shamisen[step]) {
        this.scheduleShamisen(score.shamisen[step], t, stepDur * 1.6);
      }

      if (score.flute && score.flute[step]) {
        this.scheduleShakuhachi(score.flute[step], t, stepDur * 5.2);
      }

      if (score.taikoLow && score.taikoLow[step]) {
        this.scheduleTaikoBgm(false, t);
      }

      if (score.taikoRim && score.taikoRim[step]) {
        this.scheduleTaikoBgm(true, t);
      }
      this.scheduleDrive(score, step, t, stepDur);
    }

    /* v11 推進層：八分音符低音、四拍重鼓、締太鼓滾奏、每 4 小節開頭一記鈸 */
    scheduleDrive(score, step, t, stepDur) {
      const calm = ENERGY.calm[score.id];
      const bar = Math.floor(step / 16) % (score.padChords ? score.padChords.length : 1);
      const root = score.padChords ? score.padChords[bar][0] : 50;
      if (step % 2 === 0 && (!calm || step % 4 === 0)) {
        const accent = step % 8 === 0 ? 1 : 0.7;
        this.scheduleBass(root - 12 + (step % 16 === 14 && !calm ? 7 : 0), t, stepDur * 1.7, (calm ? 0.07 : 0.11) * accent);
      }
      const kick = calm ? step % 8 === 0 : step % 4 === 0;
      if (kick && !(score.taikoLow && score.taikoLow[step])) this.scheduleTaikoBgm(false, t);
      if (!calm && step % 2 === 1 && score.bpm >= 120) this.scheduleShime(t, step % 4 === 3 ? 0.07 : 0.035);
      if (!calm && step >= 60) this.scheduleShime(t + stepDur * 0.5, 0.06);   // 小節尾滾奏
      if (step === 0) this.scheduleCrash(t, calm ? 0.05 : 0.09);
    }

    scheduleBass(midi, t, dur, vol) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = "sawtooth"; o2.type = "square";
      o.frequency.setValueAtTime(midiToFreq(midi), t); o2.frequency.setValueAtTime(midiToFreq(midi) / 2, t);
      f.type = "lowpass"; f.Q.value = 6;
      f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.masterBgmGain);
      o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    }

    scheduleShime(t, vol) {
      if (!this.noiseBuffer) return;
      const n = this.ctx.createBufferSource(), bp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      n.buffer = this.noiseBuffer; bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 2.4;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      n.connect(bp); bp.connect(g); g.connect(this.masterBgmGain); n.start(t, Math.random() * 0.3); n.stop(t + 0.05);
    }

    scheduleCrash(t, vol) {
      if (!this.noiseBuffer) return;
      const n = this.ctx.createBufferSource(), hp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      n.buffer = this.noiseBuffer; n.loop = true; hp.type = "highpass"; hp.frequency.value = 5200;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      n.connect(hp); hp.connect(g); g.connect(this.masterBgmGain); n.start(t); n.stop(t + 1.65);
    }

    /** 角色講話時壓低 BGM 與音效，講完再恢復 */
    duck(on) {
      this.ducked = Boolean(on);
      this.updateMasterGain();
      if (this.ctx && this.masterSfxGain) {
        this.masterSfxGain.gain.setTargetAtTime(this.sfxEnabled ? (this.ducked ? 0.55 : 0.85) : 0, this.ctx.currentTime, 0.12);
      }
    }

    setDecisionFocus(on) {
      this.decisionFocus = on;
      this.updateMasterGain();
    }

    updateMasterGain() {
      if (!this.ctx || !this.masterBgmGain) return;
      const target = this.bgmEnabled ? this.bgmVolume * 0.5 * (this.decisionFocus ? 0.18 : this.ducked ? 0.36 : 1) : 0;
      this.masterBgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }

    requestAutoTrack(trackId) {
      if (this.modeSelect !== "auto") return;
      this.setTrack(trackId);
    }

    setUserTrackSelection(selValue) {
      this.modeSelect = selValue;
      if (selValue !== "auto") {
        this.setTrack(selValue);
      }
      if (!this.isPlayingBgm && this.bgmEnabled) {
        this.startSequencer();
      }
    }

    setTrack(trackId) {
      if (!BGM_SCORES[trackId] || this.currentTrackId === trackId) return;
      this.currentTrackId = trackId;
      this.stepIndex = 0;
      if (this.ctx) {
        this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.05);
      }
    }

    toggleBgm() {
      this.bgmEnabled = !this.bgmEnabled;
      if (this.bgmEnabled) {
        this.ensureContext();
        if (!this.isPlayingBgm) this.startSequencer();
      }
      this.updateMasterGain();
      return this.bgmEnabled;
    }

    setVolume(vol0to1) {
      this.bgmVolume = Math.max(0, Math.min(1, vol0to1));
      this.updateMasterGain();
    }

    toggleSfx() {
      this.sfxEnabled = !this.sfxEnabled;
      if (this.ctx && this.masterSfxGain) {
        this.masterSfxGain.gain.setTargetAtTime(
          this.sfxEnabled ? 0.85 : 0,
          this.ctx.currentTime,
          0.03
        );
      }
      return this.sfxEnabled;
    }

    getEqualizerLevels() {
      const bars = new Array(8).fill(0.15);
      if (!this.bgmEnabled || !this.isPlayingBgm || !this.analyser || !this.ctx || this.ctx.state !== "running") {
        return bars;
      }
      this.analyser.getByteFrequencyData(this.freqData);
      for (let i = 0; i < 8; i++) {
        const raw = this.freqData[i + 1] || 0;
        bars[i] = Math.max(0.16, Math.min(1, raw / 210));
      }
      return bars;
    }

    /* ------------------------------------------------------------------------
       Interactive Anime SFX Suite (Voice Blips, Cut-Ins, Taiko Slam, Lightning)
       ------------------------------------------------------------------------ */
    playVoiceBlip(baseFreq) {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      const jitter = 0.94 + Math.random() * 0.12;
      osc.frequency.setValueAtTime((baseFreq || 340) * jitter, now);
      g.gain.setValueAtTime(0.055, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(g);
      g.connect(this.masterSfxGain);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    playUiClick() {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);
      g.gain.setValueAtTime(0.07, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g);
      g.connect(this.masterSfxGain);
      osc.start(now);
      osc.stop(now + 0.065);
    }

    playCutInSfx() {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;
      this._impact(0.8);
      this._noise(0.12, 0.45, 0, "bandpass", 800, 5000, 1.2);   // 破風
      // Dramatic anime blade unsheathe ring + wind sweep
      [1174.66, 1760, 2349.32].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq * 0.85, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.12);
        g.gain.setValueAtTime(0.075 / (idx + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(g);
        g.connect(this.masterSfxGain);
        osc.start(now);
        osc.stop(now + 0.38);
      });
    }

    playPlaceSlam(isHuman, bossId, cellIndex) {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;

      const pan = this.ctx.createStereoPanner?.();
      if (pan) {
        pan.pan.value = ((cellIndex % 3) - 1) * .58;
        pan.connect(this.masterSfxGain);
      }
      const output = pan || this.masterSfxGain;
      const pitch = cellIndex === 4 ? .9 : 1.04;
      this._impact(0.75);

      // Heavy Sub-Bass O-Daiko Impact
      const drum = this.ctx.createOscillator();
      const dGain = this.ctx.createGain();
      drum.type = "triangle";
      drum.frequency.setValueAtTime((isHuman ? 144 : 118) * pitch, now);
      drum.frequency.exponentialRampToValueAtTime(36, now + 0.24);
      dGain.gain.setValueAtTime(0.46, now);
      dGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
      drum.connect(dGain);
      dGain.connect(output);
      drum.start(now);
      drum.stop(now + 0.28);

      if (isHuman) {
        // Sacred Kagura Suzu Shrine Bell Triad
        [1046.5, 1567.98, 2093.0].forEach((f, i) => {
          const bell = this.ctx.createOscillator();
          const bG = this.ctx.createGain();
          bell.type = "sine";
          bell.frequency.setValueAtTime(f, now + i * 0.016);
          bG.gain.setValueAtTime(0.08, now + i * 0.016);
          bG.gain.exponentialRampToValueAtTime(0.001, now + 0.32 + i * 0.03);
          bell.connect(bG);
          bG.connect(output);
          bell.start(now + i * 0.016);
          bell.stop(now + 0.36 + i * 0.03);
        });
      } else {
        // Boss Faction Signature Accent (Fox Clack / Oni Thunder / Tengu Gale)
        const freqs =
          bossId === "ibaraki" ? [196, 392, 784] : bossId === "tengu" ? [587.33, 880, 1174.66] : [740, 1108.73];
        freqs.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = bossId === "ibaraki" ? "sawtooth" : "square";
          osc.frequency.setValueAtTime(f, now);
          osc.frequency.exponentialRampToValueAtTime(f * 0.66, now + 0.11);
          g.gain.setValueAtTime(0.065 / (i + 1), now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(g);
          g.connect(output);
          osc.start(now);
          osc.stop(now + 0.13);
        });
      }
    }

    playCounterThunder() {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;
      this._impact(0.9);
      this._noise(0.2, 1.1, 0.04, "lowpass", 1200, 90);
      [987.77, 1479.98, 1975.53].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.48, now + 0.26);
        g.gain.setValueAtTime(0.095 / (idx + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(g);
        g.connect(this.masterSfxGain);
        osc.start(now);
        osc.stop(now + 0.29);
      });
    }

    playVeinResonance(isHuman) {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = isHuman ? [587.33, 739.99, 880, 1174.66] : [440, 523.25, 659.25, 880];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, now + i * 0.045);
        g.gain.setValueAtTime(0.12, now + i * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.38);
        osc.connect(g);
        g.connect(this.masterSfxGain);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.4);
      });
    }

    /* v11 重擊層：次低頻爆破＋噪音炸裂＋高頻金屬聲，疊在關鍵音效上讓打擊更有力 */
    _impact(power, delay) {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const k = power || 1, d = delay || 0;
      this._tone(95, "sine", 0.34 * k, 0.55, d, 30);
      this._tone(180, "triangle", 0.16 * k, 0.22, d, 60);
      this._noise(0.22 * k, 0.32, d, "lowpass", 2600, 180);
      this._noise(0.08 * k, 0.5, d + 0.01, "highpass", 6000, 3000);
    }

    /* ---- 下棋動態用的小音效（短、輕，不蓋過語音） ---- */
    _tone(freq, type, gain, dur, delay, endFreq) {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.masterSfxGain); o.start(t); o.stop(t + dur + 0.02);
    }
    playFlightWhoosh(isHuman) {
      // 符紙破風／狐火呼嘯
      this._tone(isHuman ? 900 : 620, isHuman ? "sawtooth" : "triangle", 0.035, 0.45, 0, isHuman ? 260 : 1400);
      this._tone(isHuman ? 1800 : 1240, "sine", 0.025, 0.35, 0.05, isHuman ? 600 : 2200);
    }
    playTileLock(step) {
      this._tone(130 + step * 19, "triangle", .073, .15, 0, 80);
      this._tone(570 + step * 38, "sine", .025, .12);
    }

    playTransformation(human) {
      if (human) {
        [659, 784, 988, 1175, 1568].forEach((pitch, step) => {
          this._tone(pitch, "sine", .038, .22, step * .067);
        });
      } else {
        this._tone(154, "triangle", .074, .52, 0, 81);
        this._tone(246, "sawtooth", .026, .35, .12, 103);
      }
    }

    playFoxStep() {
      this._tone(225, "triangle", .078, .13, 0, 106);
      this._tone(960, "sine", .025, .18, .02, 410);
    }

    playSealClash() {
      this._tone(610, "sawtooth", .039, .13, 0, 180);
      this._tone(1920, "triangle", .034, .17, .02, 620);
    }

    playTailClamp() {
      this._tone(205, "triangle", .085, .33, .17, 81);
      this._tone(540, "sawtooth", .022, .18, .06, 1590);
    }

    playFinaleSeal() {
      this._tone(123, "triangle", .12, .36, 0, 53);
      this._tone(1175, "sine", .074, .48, .035, 780);
    }

    playStellarFlare() {
      this._tone(145, "triangle", .12, .28, 0, 58);
      [698, 1047, 1397, 2093].forEach((pitch, step) => this._tone(pitch, "sine", .027, .29, .06 + step * .042));
    }

    playPlanetOrbit() {
      this._tone(210, "sine", .062, .44, 0, 130);
      this._tone(349, "triangle", .032, .27, .12, 420);
      this._tone(587, "sine", .043, .28, .24, 377);
    }

    playSingularity() {
      this._tone(132, "triangle", .135, 1.10, 0, 42);
      this._tone(320, "sine", .059, .85, .18, 58);
      this._tone(830, "sawtooth", .018, .77, .20, 230);
      this._tone(62, "sine", .12, .46, 1.02, 30);
    }

    playFirstAlignment(human) {
      const pitches = human ? [523, 659, 784] : [330, 392, 523];
      pitches.forEach((pitch, step) => this._tone(pitch, "triangle", .075, .48, .18 * step));
    }

    playArenaCue(kind, human) {
      const direct = {
        stellar: () => this.playStellarFlare(),
        fox: () => this.playPlanetOrbit(),
        alignment: () => this.playFirstAlignment(human),
        gravity: () => this.playSingularity()
      };
      if (direct[kind]) {
        direct[kind]();
        return;
      }
      // Frequency, oscillator, gain, duration, delay, and optional ending pitch.
      const score = {
        gate: [[72, "triangle", .11, .43, 0, 45], [247, "sine", .054, .66, .11], [494, "sine", .041, .56, .27]],
        paper: [[880, "triangle", .051, .29, .08, 298], [1175, "sine", .042, .30, .27], [152, "sine", .088, .35, .65, 67]],
        fracture: [[330, "sawtooth", .046, .19, 0, 80], [1120, "square", .032, .12, .09, 350], [95, "triangle", .098, .36, .12, 49]],
        lift: [[392, "sine", .065, .52, 0, 784], [554, "triangle", .048, .56, .21, 1108]],
        crown: [[73, "triangle", .12, .5, 0, 43], [587, "sine", .044, .7, .12], [880, "sine", .035, .62, .25],
                [1319, "triangle", .035, .54, .4]]
      };
      score[kind]?.forEach((note) => this._tone(...note));
    }

    playInvalidCell() {
      this._tone(250, "triangle", .1, .12, 0, 130);
    }

    playThreat(human) {
      this._tone(human ? 670 : 310, "sine", .075, .2);
      this._tone(human ? 940 : 220, "triangle", .07, .23, .12);
    }

    playTalismanRush() {
      this._tone(1800, "sawtooth", .032, .14, 0, 840);
      this._tone(780, "triangle", .06, .31, .17, 155);
    }

    playTalismanImpact() {
      this._impact(0.7);
      this._tone(147, "triangle", .23, .38, 0, 40);
      this._tone(1250, "sine", .10, .32, .035, 680);
    }

    playShatter() {
      // 玻璃碎裂：高頻短音散落
      [2637, 3136, 2349, 3520, 2794].forEach((f, k) => this._tone(f, "square", 0.03, 0.12, k * 0.03, f * 0.7));
      this._tone(180, "triangle", 0.16, 0.3, 0, 70);
    }
    playRelayTick(n, isHuman) {
      const base = isHuman ? [1318.5, 1174.7, 1046.5, 880] : [987.8, 880, 784, 659.3];
      this._tone(base[n % 4], "sine", 0.045 / (1 + n * 0.4), 0.18);
    }
    playBarrier(isHuman) {
      this._tone(isHuman ? 220 : 196, "triangle", 0.18, 0.35, 0, isHuman ? 330 : 294);
      this._tone(isHuman ? 1760 : 1480, "sine", 0.06, 0.4, 0.04);
      this._tone(isHuman ? 660 : 587, "sawtooth", 0.05, 0.16, 0.12, 180);   // 能量切斷
    }
    playSettleTick(n, bright) {
      const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568];
      this._tone(scale[n % 9] * (bright ? 1 : 0.5), bright ? "triangle" : "sine", bright ? 0.12 : 0.06, bright ? 0.42 : 0.22);
    }
    playReversal(isHuman) {
      this._tone(110, "triangle", 0.25, 0.4, 0, 55);
      [0, 1, 2].forEach((k) => this._tone((isHuman ? 392 : 349.2) * Math.pow(1.26, k), "triangle", 0.1, 0.3, 0.32 + k * 0.08));
    }

    /* ---- v10 十大奧義音效（噪音＋振盪器合成，受音效開關控制） ---- */
    _noise(gain, dur, delay, type, freq, endFreq, q) {
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx || !this.noiseBuffer) return;
      const t = this.ctx.currentTime + (delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer; src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = type || "lowpass"; f.Q.value = q || 0.7;
      f.frequency.setValueAtTime(freq, t);
      if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.masterSfxGain);
      src.start(t, Math.random() * 0.2); src.stop(t + dur + 0.05);
    }

    playGrandCue(kind, step) {
      const n = step || 0;
      const cues = {
        name: () => { this._impact(1.1); this._tone(98, "sawtooth", .12, .6, 0, 49); this._noise(.14, .5, 0, "bandpass", 600, 4800, 1.2); [0, .09, .18].forEach((d) => this._tone(130.8, "triangle", .2, .25, d, 60)); },
        torii: () => { this._tone(82 - n * 2, "triangle", .13, .26, 0, 46); this._noise(.05, .16, 0, "lowpass", 900); },
        toriiSlam: () => { this._impact(1.2); this._tone(62, "sine", .26, .9, 0, 30); this._tone(147, "triangle", .14, .6, .02, 60); this._noise(.16, .5, 0, "lowpass", 1600, 200); this._tone(1568, "sine", .05, .9, .08); },
        eyeOpen: () => { this._tone(55, "sine", .2, 1.4, 0, 44); this._tone(880, "triangle", .03, 1.1, .1, 1320); this._noise(.05, 1.0, 0, "bandpass", 600, 2400, 3); },
        eyeLock: () => { this._impact(0.9); this._tone(1760, "sine", .06, .3, 0, 2637); this._tone(110, "triangle", .14, .4, 0, 55); },
        flip: () => { this._noise(.08, .8, 0, "bandpass", 300, 3000, 1.5); [523, 659, 784, 1047].forEach((f, k) => this._tone(f, "sine", .05, .4, .35 + k * .06)); },
        parade: () => { [0, .32, .64, .96, 1.28, 1.6].forEach((d, k) => this._tone(k % 2 ? 147 : 98, "triangle", .14, .22, d, 55)); this._tone(392, "sine", .03, 2.1, 0, 370); },
        thunder: () => { this._impact(1.2); this._noise(.42, .18, 0, "highpass", 2400); this._noise(.36, 1.6, .05, "lowpass", 1400, 80); this._tone(48, "sine", .3, 1.3, .03, 28); },
        brush: () => { this._noise(.08, .45, 0, "bandpass", 1800, 500, .9); },
        inkSplash: () => { this._impact(0.9); this._noise(.14, .5, 0, "lowpass", 900, 120); this._tone(73, "sine", .22, .7, 0, 36); },
        dragon: () => { this._tone(110, "sawtooth", .07, 1.6, 0, 220); this._tone(165, "sawtooth", .05, 1.5, .1, 330); this._noise(.07, 1.6, 0, "bandpass", 400, 1600, 1.2); },
        dragonBurst: () => { this._impact(0.9); this._tone(65, "sine", .24, .9, 0, 33); [784, 988, 1175, 1568, 1976].forEach((f, k) => this._tone(f, "triangle", .05, .5, k * .05)); },
        moon: () => { this._tone(55, "sine", .2, 2.2, 0, 41); this._tone(233, "triangle", .05, 2.0, .2, 207); this._tone(311, "sine", .035, 1.8, .5, 277); },
        moonRing: () => { this._tone(466 - n * 30, "sine", .05, .6); this._noise(.05, .5, 0, "bandpass", 1200 - n * 150, 300, 2); },
        sakura: () => { this._noise(.1, 2.2, 0, "bandpass", 500, 2600, .8); [1175, 1397, 1568, 1760, 2093].forEach((f, k) => this._tone(f, "sine", .025, .5, .3 + k * .23)); },
        sakuraBurst: () => { this._impact(0.9); this._noise(.16, .6, 0, "highpass", 1800, 5000); this._tone(98, "sine", .18, .5, 0, 49); },
        shatter: () => { this._impact(1.2); this.playShatter(); this._noise(.2, .6, 0, "highpass", 3000, 1500); },
        reform: () => { this._impact(0.9); this._noise(.1, .8, 0, "bandpass", 4000, 400, 1.4); this._tone(196, "triangle", .14, .7, .55, 98); },
        spin: () => { this._noise(.16, 1.9, 0, "bandpass", 300, 2400, 1.4); [0, .25, .5, .75, 1.0, 1.25].forEach((d, k) => this._tone(110 + k * 18, "sawtooth", .07, .22, d, 55)); },
        spinStop: () => { this._impact(1.1); this._tone(784, "triangle", .08, .6, .05); this._tone(1175, "sine", .05, .7, .1); },
        scatter: () => { this._impact(0.9); this._noise(.12, .5, 0, "highpass", 2500, 6000); [523, 659, 784, 988].forEach((f, k) => this._tone(f, "triangle", .05, .5, .2 + k * .12)); },
        scatterSnap: () => { this._impact(1.1); [0, .05, .1].forEach((d) => this._tone(1568, "square", .03, .1, d, 1046)); },
        foxfire: () => { this._noise(.2, 2.2, 0, "lowpass", 400, 2600, 0.8); this._tone(65, "sawtooth", .1, 2.0, 0, 98); this._tone(880, "triangle", .03, 1.6, .3, 1320); },
        foxOrbs: () => { [1318, 1568, 1760, 2093].forEach((f, k) => this._tone(f, "sine", .05, .35, k * .1)); },
        foxBoom: () => { this._impact(1.2); this._noise(.18, .9, 0, "lowpass", 1800, 120); },
        pentagram: () => { this._impact(0.8); [262, 330, 392, 523, 659].forEach((f, k) => this._tone(f, "triangle", .06, .9, k * .18)); this._noise(.08, 1.4, 0, "bandpass", 1200, 3600, 2); },
        pillar: () => { this._tone(523 * Math.pow(1.122, n), "sine", .07, .8, 0, 1046 * Math.pow(1.122, n)); this._noise(.06, .4, 0, "highpass", 3000); },
        pentaHit: () => { this._impact(1.2); [523, 784, 1046, 1568].forEach((f) => this._tone(f, "triangle", .06, 1.0)); },
        ninetails: () => { this._noise(.16, 1.2, 0, "bandpass", 200, 3000, 1); [659, 740, 880, 988, 1175].forEach((f, k) => this._tone(f, "sine", .04, .6, k * .08)); this._tone(73, "sawtooth", .1, 1.4, 0, 110); },
        tailSnap: () => { this._impact(0.9); this._noise(.14, .3, 0, "highpass", 2000, 7000); },
        meteor: () => { [0, .2, .4, .6, .8].forEach((d) => this._noise(.07, .35, d, "bandpass", 3000, 400, 2)); this._tone(55, "sawtooth", .09, 1.6, .3, 110); },
        meteorHit: () => { this._impact(1.4); this._noise(.3, 1.4, .02, "lowpass", 900, 60); },
        drop: () => { this._tone(1760, "sine", .06, .25, 0, 880); },
        splash: () => { this._noise(.12, .5, 0, "bandpass", 1600, 400, 1.2); [784, 1175, 1568].forEach((f, k) => this._tone(f, "sine", .04, 1.2, .08 + k * .12)); this._tone(98, "sine", .18, .8, 0, 49); },
        rift: () => { this._tone(40, "sawtooth", .12, 2.0, 0, 80); this._noise(.12, 1.8, 0, "bandpass", 120, 2400, 4); this._tone(1975, "sine", .03, 1.6, .2, 988); },
        riftClose: () => { this._impact(1.2); this._tone(2637, "triangle", .05, .4, 0, 1318); },
        phoenix: () => { this._noise(.2, 2.0, 0, "lowpass", 300, 2400, 0.9); this._tone(880, "sawtooth", .05, .9, .2, 1760); this._tone(1320, "triangle", .04, .9, .5, 2640); },
        phoenixBurst: () => { this._impact(1.3); this._noise(.24, 1.0, 0, "lowpass", 2400, 200); [784, 988, 1175, 1568].forEach((f, k) => this._tone(f, "triangle", .06, .6, k * .06)); },
        talismanRain: () => { for (let k = 0; k < 10; k++) this._noise(.05, .12, k * .07, "highpass", 3500); this._tone(196, "triangle", .08, 1.0, 0, 147); },
        ignite: () => { this._noise(.22, 1.6, 0, "lowpass", 500, 3000, 0.8); this._impact(0.8); },
        astrolabe: () => { [0, .15, .3, .45, .6, .75, .9].forEach((d, k) => this._tone(1046 + k * 80, "sine", .035, .2, d)); this._tone(65, "triangle", .1, 1.6, 0, 98); },
        astroLock: () => { this._impact(1.0); this._tone(1568, "triangle", .07, .7); this._tone(2349, "sine", .04, .8, .05); },
        swordRain: () => { for (let k = 0; k < 14; k++) this._noise(.06, .18, k * .07, "bandpass", 5000 - k * 150, 2000, 3); this._tone(98, "sawtooth", .08, 1.2, 0, 147); },
        swordStab: () => { this._tone(2637, "triangle", .05, .12, 0, 1760); this._tone(110, "triangle", .14, .2, 0, 55); },
        swordRise: () => { [1046, 1318, 1568, 2093].forEach((f, k) => this._tone(f, "triangle", .05, .9, k * .06, f * 1.06)); this._noise(.08, .8, 0, "highpass", 3000, 8000); },
        swordFire: () => { this._noise(.24, .5, 0, "bandpass", 600, 6000, 1.2); this._tone(220, "sawtooth", .1, .4, 0, 880); },
        swordBoom: () => { this._impact(1.5); this._noise(.3, 1.4, .02, "lowpass", 2200, 80); [2093, 2637, 3136].forEach((f, k) => this._tone(f, "sine", .05, 1.2, k * .05)); },
        jawsRumble: () => { this._tone(38, "sawtooth", .16, 2.4, 0, 30); this._noise(.14, 2.2, 0, "lowpass", 200, 120); },
        jawsEyes: () => { this._tone(1975, "sine", .05, .5, 0, 988); this._tone(55, "triangle", .2, .8, 0, 41); },
        jawsRoar: () => { this._tone(70, "sawtooth", .2, 1.4, 0, 45); this._tone(105, "square", .08, 1.3, 0, 70); this._noise(.26, 1.4, 0, "bandpass", 300, 900, 0.8); },
        jawsBite: () => { this._impact(1.6); this._noise(.3, .25, 0, "highpass", 1500, 4000); this._tone(196, "square", .12, .15, 0, 98); },
        orochiRise: () => { this._noise(.18, 2.0, 0, "lowpass", 250, 900, 0.8); for (let k = 0; k < 8; k++) this._noise(.07, .5, .1 + k * .14, "bandpass", 3500, 6500, 4); },
        orochiRoar: () => { [65, 69, 73, 78].forEach((f, k) => this._tone(f, "sawtooth", .12, 1.6, k * .05, f * 0.7)); this._noise(.24, 1.6, 0, "bandpass", 400, 1200, 0.9); },
        orochiStrike: () => { this._impact(1.5); for (let k = 0; k < 8; k++) this._noise(.08, .2, k * .03, "highpass", 2500); },
        sunRise: () => { [130.8, 196, 261.6, 392].forEach((f, k) => this._tone(f, "sawtooth", .05, 2.2, k * .15)); this._noise(.08, 2.0, 0, "bandpass", 400, 3000, 1); },
        sunBeam: () => { this._impact(1.1); this._tone(523, "sawtooth", .08, 1.2, 0, 1046); this._noise(.18, 1.0, 0, "highpass", 2000, 6000); },
        sunNova: () => { this._impact(1.6); this._noise(.32, 1.8, .02, "lowpass", 3000, 80); [523, 659, 784, 1046, 1318].forEach((f, k) => this._tone(f, "triangle", .07, 1.6, .1 + k * .04)); },
        lotus: () => { this._noise(.2, 2.0, 0, "lowpass", 300, 1800, 0.8); this._tone(55, "sawtooth", .12, 2.0, 0, 82); [392, 466, 523, 622].forEach((f, k) => this._tone(f, "triangle", .04, .9, .2 + k * .2)); },
        lotusIgnite: () => { this._impact(1.5); this._noise(.32, 1.6, .02, "lowpass", 2600, 120); this._tone(82, "sawtooth", .16, 1.2, 0, 41); },
        raikoStart: () => { this._tone(49, "sawtooth", .1, 1.2, 0, 65); this._noise(.08, 1.0, 0, "lowpass", 300); },
        drum: () => { this._impact(0.9); this._tone(98 - n * 3, "triangle", .3, .45, 0, 45); this._noise(.16, .14, 0, "highpass", 2500); },
        raikoAll: () => { this._impact(1.7); this._noise(.42, .2, 0, "highpass", 2400); this._noise(.36, 1.8, .05, "lowpass", 1400, 60); },
        skullRise: () => { for (let k = 0; k < 10; k++) this._tone(180 + (k % 3) * 60, "square", .05, .06, k * .11, 120); this._tone(41, "sawtooth", .14, 2.2, 0, 55); this._noise(.12, 2.0, 0, "lowpass", 250, 600); },
        skullSlam: () => { this._impact(1.7); this._noise(.34, 1.2, .02, "lowpass", 900, 60); },
        holeOpen: () => { this._tone(110, "sine", .14, 2.4, 0, 30); this._noise(.16, 2.2, 0, "bandpass", 3000, 120, 3); },
        holeCollapse: () => { this._tone(880, "sine", .08, .5, 0, 40); },
        holeBurst: () => { this._impact(1.7); this._noise(.36, 1.8, .02, "lowpass", 4000, 60); this._tone(1760, "sine", .05, 1.4, 0, 3520); },
        bellDrop: () => { this._noise(.16, .9, 0, "bandpass", 600, 3000, 1); },
        bellLand: () => { this._impact(1.6); this._tone(73, "sine", .3, 1.0, 0, 50); },
        bellDong: () => { [98, 196.4, 293.7, 523.5, 659].forEach((f, k) => this._tone(f * (1 + n * 0.002), "sine", [.26, .14, .08, .05, .03][k], 3.2 - k * 0.4)); },
        gateSlide: () => { this._noise(.16, .9, 0, "lowpass", 200, 600, 0.8); },
        gateSlam: () => { this._impact(1.8); this._noise(.36, 1.0, .02, "lowpass", 700, 50); },
        gateOpen: () => { this._tone(55, "sawtooth", .16, 1.6, 0, 110); this._noise(.24, 1.8, 0, "bandpass", 300, 3000, 0.9); [622, 740, 880].forEach((f, k) => this._tone(f, "sine", .05, 1.2, .3 + k * .1, f * 0.7)); },
        iceCreep: () => { for (let k = 0; k < 16; k++) this._tone(2000 + (k * 337) % 2600, "sine", .03, .15, k * .08); this._noise(.08, 1.6, 0, "highpass", 4000, 9000); },
        iceLock: () => { this._tone(1318, "triangle", .07, .6); this._tone(1976, "sine", .05, .8, .03); },
        iceShatter: () => { this._impact(1.4); for (let k = 0; k < 14; k++) this._tone(2600 + (k * 431) % 3000, "square", .03, .1, k * .025, 1800); this._noise(.24, .8, 0, "highpass", 3000, 7000); },
        taiji: () => { this._tone(130.8, "sine", .1, 2.6, 0); this._tone(196, "sine", .08, 2.6, .15); this._tone(261.6, "triangle", .04, 2.4, .3); this._noise(.05, 2.4, 0, "bandpass", 300, 900, 1.5); }
      };
      if (cues[kind]) cues[kind]();
    }

    playFinaleFanfare(winner) {
      this._impact(1.2);
      if (!this.sfxEnabled || !this.ensureContext() || !this.ctx) return;
      const now = this.ctx.currentTime;
      const chord =
        winner === -1
          ? [293.66, 349.23, 440.0, 587.33]
          : [587.33, 739.99, 880.0, 1174.66];

      chord.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, now + idx * 0.065);
        g.gain.setValueAtTime(0.14, now + idx * 0.065);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.78 + idx * 0.06);
        osc.connect(g);
        g.connect(this.masterSfxGain);
        osc.start(now + idx * 0.065);
        osc.stop(now + 0.82 + idx * 0.06);
      });
    }
  }

  window.HW06_AUDIO = new AnimeAudioStudio();
})();
