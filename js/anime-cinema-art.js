/* ==========================================================================
   1142949 HW06 — 原畫片頭導演（取代 cinema-cutscene.js 的程序畫面）
   - 每一鏡都以首頁原畫（bg_fushimi / bg_rashomon / bg_kurama）為底，Ken Burns 推鏡
   - 多層視差：近景花瓣（快）、中景燈火（同背景）、遠景血月（慢）
   - 羅生門：雨幕＋閃電＋濕地倒影；鞍馬山：雲海流動＋神木＋流光
   - 角色一律使用原立繪分層演員（HW06_ACTORS）
   - 鏡頭長度 = max(預設長度, 台詞講完 + 0.3 秒)；台詞講完才切鏡，不截斷
   ========================================================================== */
(function () {
  "use strict";

  const VW = 1280, VH = 720;
  const BG_W = 1376, BG_H = 768;
  const BASE = Math.max(VW / BG_W, VH / BG_H);
  const XFADE_MS = 380;
  const LINE_GAP_MS = 110;
  const CINE_RATE = 1.2;          // v11：劇情台詞念快 20%（保持音高）
  const NAR_MS = (text) => Math.min(3400, 700 + text.length * 105);   // 旁白字幕停留時間

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- 背景素材的關鍵位置（原畫 1376×768 座標） ---------- */
  const SCENES = {
    fushimi: {
      src: "./assets/bg_fushimi.jpg",
      moon: { x: 918, y: 145, r: 120 },
      lanterns: [[48, 55, 34], [92, 150, 30], [125, 228, 28], [168, 290, 22], [195, 320, 18], [355, 412, 20], [392, 500, 22],
                 [512, 432, 18], [565, 395, 16], [640, 425, 14], [697, 437, 14], [750, 440, 14], [800, 440, 14], [838, 432, 12],
                 [876, 425, 12], [716, 505, 16], [1350, 270, 30], [1318, 340, 26], [1287, 380, 22], [1262, 402, 18]],
      blueLights: [[1175, 412], [1200, 420], [1225, 425], [1245, 420], [130, 280], [1100, 240], [835, 380], [610, 510], [1160, 640]]
    },
    rashomon: {
      src: "./assets/bg_rashomon.jpg",
      bolts: [[430, 100, 430, 390, "#7ff5ff"], [160, 190, 140, 330, "#7ff5ff"], [1240, 120, 1150, 300, "#ff7aa0"], [905, 320, 900, 440, "#ff9ab8"], [540, 90, 580, 170, "#ff7aa0"]],
      torches: [[680, 445], [1033, 440]],
      river: { x: 760, y: 585, w: 616, h: 183 }
    },
    kurama: {
      src: "./assets/bg_kurama.jpg",
      moon: { x: 283, y: 345, r: 26 },
      lanterns: [[490, 465, 18], [637, 575, 20], [876, 612, 22], [812, 470, 14], [1003, 485, 14], [862, 420, 14], [965, 420, 14]],
      clouds: { x: 0, y: 430, w: 600, h: 338 },
      streams: [
        [[0, 280], [180, 370], [420, 345], [600, 280], [700, 210], [720, 140], [820, 60], [1000, 20]],
        [[0, 360], [250, 400], [480, 300], [600, 250], [690, 230]],
        [[850, 190], [1000, 200], [1150, 180], [1300, 215], [1360, 290], [1230, 360], [1100, 380]],
        [[1100, 300], [1250, 260], [1340, 310], [1290, 410], [1200, 470]]
      ]
    }
  };

  /* ---------- 劇本 ---------- */
  const NAR = "narrator";
  const CUTSCENES = {
    prologue_opening: {
      title: "序章 · 血月百鬼與晴明傳人", bgm: "moonlight",
      shots: [
        { bg: "fushimi", min: 1426, hold: 200, cam: [[688, 384, 1.0], [905, 300, 1.26]],
          caption: { who: NAR, text: "丑時三刻，京都伏見。", at: 125 } },
        { bg: "fushimi", min: 1984, blur: 3, cam: [[1010, 360, 1.18], [1040, 350, 1.24]],
          actors: [{ id: "tamamo", cx: 860, top: 34, s: 0.66, enter: 1, act: "taunt" }],
          line: { who: "tamamo", id: "t_m0" } },
        { bg: "fushimi", min: 1984, blur: 3, cam: [[360, 420, 1.2], [330, 430, 1.26]],
          actors: [{ id: "ren", cx: 430, top: 40, s: 0.64, enter: -1, act: "chant" }],
          line: { who: "ren", id: "r_m0" } },
        { bg: "fushimi", min: 1736, blur: 6, dark: 0.45, cam: [[918, 160, 1.6], [918, 170, 1.7]],
          closeup: { id: "tamamo", part: "face", z0: 1.0, z1: 1.08 },
          caption: { who: NAR, text: "蓮先手。九印落滿，再比雙方的成線數。", at: 150 } },
        { bg: "fushimi", min: 2108, blur: 2.5, cam: [[960, 380, 1.12], [960, 380, 1.18]],
          actors: [{ id: "ren", cx: 320, top: 90, s: 0.56, enter: -1, act: "attack_1", actAt: 0.2 },
                   { id: "tamamo", cx: 990, top: 84, s: 0.56, enter: 1 }],
          line: { who: "ren", id: "r_pro2" }, endFlash: true }
      ]
    },
    ch1_seal: {
      title: "終章 · 伏見靈脈封印", bgm: "eternal_seal",
      shots: [
        { bg: "fushimi", min: 1860, blur: 3, calm: true, cam: [[1000, 380, 1.15], [1020, 370, 1.2]],
          actors: [{ id: "tamamo", cx: 860, top: 40, s: 0.66, enter: 1, act: "seal_bow", actMs: 2600 }],
          line: { who: "tamamo", id: "t_seal" } },
        { bg: "fushimi", min: 1736, blur: 3, calm: true, cam: [[360, 420, 1.2], [340, 430, 1.25]],
          actors: [{ id: "ren", cx: 430, top: 40, s: 0.64, enter: -1, act: "victory", actMs: 2600 }],
          line: { who: "ren", id: "r_win" } },
        { bg: "fushimi", min: 2604, calm: true, cam: [[905, 300, 1.22], [688, 384, 1.0]],
          caption: { who: NAR, text: "血月退去，千本鳥居恢復寧靜——伏見結界，封印完成。", at: 250 } }
      ]
    },
    ch1_defeat: {
      title: "終章 · 百鬼夜行", bgm: "yokai_storm",
      shots: [
        { bg: "fushimi", min: 1860, blur: 3, red: true, cam: [[1000, 360, 1.15], [1030, 350, 1.22]],
          actors: [{ id: "tamamo", cx: 860, top: 34, s: 0.66, enter: 1, act: "victory", actMs: 3000 }],
          line: { who: "tamamo", id: "t_c2" } },
        { bg: "fushimi", min: 1860, blur: 3, red: true, cam: [[360, 420, 1.2], [340, 430, 1.25]],
          actors: [{ id: "ren", cx: 430, top: 40, s: 0.64, enter: -1, act: "chant", actMs: 1800 }],
          line: { who: "ren", id: "r_m1" } },
        { bg: "fushimi", min: 2356, red: true, cam: [[905, 300, 1.25], [905, 260, 1.32]],
          caption: { who: NAR, text: "血月還掛在鳥居上方……重新布陣，再戰一局。", at: 200 } }
      ]
    }
  };

  function lineText(id) {
    const L = (window.HW06_VOICE_LINES && window.HW06_VOICE_LINES.lines) || [];
    const hit = L.find((l) => l.id === id);
    return hit ? hit.text : "";
  }
  const SPEAKER = { ren: "神樂坂 蓮", tamamo: "九尾妖狐・玉藻前", narrator: "旁白" };

  /* ---------- 粒子 ---------- */
  function makePetals(n) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(newPetal(true));
    return arr;
  }
  function newPetal(anywhere) {
    const depth = Math.random();
    return {
      x: anywhere ? Math.random() * VW : VW + 40 + Math.random() * 200,
      y: anywhere ? Math.random() * VH : -40 + Math.random() * VH * 0.6,
      vx: -(40 + depth * 120), vy: 30 + depth * 70, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 4,
      size: 3 + depth * depth * 16, depth, ph: Math.random() * 6
    };
  }

  class ArtCinema {
    constructor() {
      this.els = null; this.ctx = null; this.playing = false; this.tier = "ultra";
      this.images = {}; this.moonSprite = null;
      this.petals = makePetals(46); this.rain = []; this.leaves = [];
      this.snap = document.createElement("canvas"); this.snap.width = VW; this.snap.height = VH;
      this.loaded = this._load();
    }

    _load() {
      const keys = Object.keys(SCENES);
      return Promise.all(keys.map((k) => new Promise((res) => {
        const im = new Image();
        im.onload = () => { this.images[k] = im; res(); };
        im.onerror = () => res();
        im.src = SCENES[k].src;
      }))).then(() => this._buildMoonSprite());
    }

    _buildMoonSprite() {
      const im = this.images.fushimi; if (!im) return;
      const m = SCENES.fushimi.moon, R = m.r + 26;
      const c = document.createElement("canvas"); c.width = c.height = R * 2;
      const g = c.getContext("2d");
      g.drawImage(im, m.x - R, m.y - R, R * 2, R * 2, 0, 0, R * 2, R * 2);
      g.globalCompositeOperation = "destination-in";
      const rg = g.createRadialGradient(R, R, m.r * 1.0, R, R, R);
      rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg; g.fillRect(0, 0, R * 2, R * 2);
      this.moonSprite = { canvas: c, R };
    }

    init(els) {
      this.els = els || null;
      if (!els || !els.canvasEl) return;
      this.ctx = els.canvasEl.getContext("2d");
      els.canvasEl.width = VW; els.canvasEl.height = VH;
      const tag = els.overlayEl && els.overlayEl.querySelector(".cinema-live-tag span:last-child");
      if (tag) tag.textContent = "ANIME CINEMA · 原畫鏡頭";
    }

    setPerformanceTier(t) { this.tier = t || "ultra"; }
    isPlaying() { return this.playing; }

    playCutscene(id, onDone) {
      const def = CUTSCENES[id] || CUTSCENES.prologue_opening;
      if (!this.els || !this.ctx) { if (onDone) onDone(); return; }
      this.stop(false);
      this.def = def; this.onDone = onDone || null;
      this.playing = true; this.shotIdx = -1; this._finishing = 0; this.token = {};
      window.HW06_VOICE && window.HW06_VOICE.stopAll && window.HW06_VOICE.stopAll();
      if (this.els.titleBadgeEl) this.els.titleBadgeEl.textContent = def.title;
      if (this.els.subtitleEl) this.els.subtitleEl.textContent = "";
      if (this.els.speakerEl) this.els.speakerEl.style.visibility = "hidden";
      this.els.overlayEl.classList.add("open");
      if (window.HW06_AUDIO && def.bgm && window.HW06_AUDIO.requestAutoTrack) window.HW06_AUDIO.requestAutoTrack(def.bgm);
      const tok = this.token;
      Promise.all([this.loaded, window.HW06_ACTORS ? window.HW06_ACTORS.ready : null]).then(() => {
        if (tok !== this.token || !this.playing) return;
        this.lastMs = performance.now();
        this._nextShot(performance.now());
        const loop = (ms) => {
          if (!this.playing || tok !== this.token) return;
          this._frame(ms);
          this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
      });
    }

    stop(invoke) {
      const was = this.playing;
      this.playing = false; this.token = {};
      cancelAnimationFrame(this.raf);
      if (was && window.HW06_VOICE && window.HW06_VOICE.stopAll) window.HW06_VOICE.stopAll();
      if (this.els && this.els.overlayEl) this.els.overlayEl.classList.remove("open");
      const cb = this.onDone; this.onDone = null;
      if (invoke && cb) cb();
    }

    /* ---------- 鏡頭流程 ---------- */
    _nextShot(ms) {
      // 轉場前先把目前畫面存起來做交叉淡化
      if (this.shotIdx >= 0) {
        const g = this.snap.getContext("2d");
        g.clearRect(0, 0, VW, VH); g.drawImage(this.els.canvasEl, 0, 0, VW, VH);
        this.xfadeStart = ms;
      } else this.xfadeStart = -1e9;
      this.shotIdx++;
      const shots = this.def.shots;
      if (this.shotIdx >= shots.length) { this._finishing = ms; return; }
      const sh = shots[this.shotIdx];
      this.shot = sh; this.shotStart = ms; this.lineDoneAt = sh.line || sh.caption ? Infinity : 0;
      this.lineStarted = false; this.actFired = {};
      if (this.els.progressFillEl) this.els.progressFillEl.style.width = ((this.shotIdx / shots.length) * 100) + "%";
      if (this.els.subtitleEl) this.els.subtitleEl.textContent = "";
      if (this.els.speakerEl) this.els.speakerEl.style.visibility = "hidden";
      if (sh.bg === "rashomon") this.rain = this._makeRain();
      // 預估這一鏡的長度（台詞音檔長度＋0.3 秒），讓推鏡速度配合台詞
      let est = 0;
      if (sh.line) {
        const V = window.HW06_VOICE, dur = V && V.clipDuration ? V.clipDuration(sh.line.id) : null;
        est = (sh.line.at || 200) + (dur ? dur * 1000 : 600 + lineText(sh.line.id).length * 240) / CINE_RATE + LINE_GAP_MS;
      } else if (sh.caption) est = (sh.caption.at || 200) + NAR_MS(sh.caption.text) + LINE_GAP_MS;
      this.expected = Math.max(sh.line || sh.caption ? 0 : sh.min || 2200, est);
    }

    _startLine(ms) {
      const sh = this.shot; this.lineStarted = true;
      const tok = this.token, idx = this.shotIdx;
      const L = sh.line, C = sh.caption;
      const who = L ? L.who : C.who;
      const text = L ? lineText(L.id) : C.text;
      if (this.els.speakerEl) {
        this.els.speakerEl.textContent = SPEAKER[who] || "";
        this.els.speakerEl.style.visibility = "visible";
        this.els.speakerEl.dataset.who = who;
      }
      if (this.els.subtitleEl) this.els.subtitleEl.textContent = text;
      let p;
      if (L && window.HW06_VOICE && window.HW06_VOICE.speakById) p = window.HW06_VOICE.speakById(L.id, { kind: "line", rate: CINE_RATE });
      else p = new Promise((r) => setTimeout(r, NAR_MS(text)));  // 旁白：只上字幕
      p.then(() => {
        if (tok !== this.token || idx !== this.shotIdx) return;
        this.lineDoneAt = performance.now();
      });
    }

    _frame(ms) {
      const ctx = this.ctx;
      if (this._finishing) {
        const k = clamp01((ms - this._finishing) / 380);
        ctx.globalAlpha = 1; ctx.fillStyle = `rgba(0,0,0,${k * 0.25})`; ctx.fillRect(0, 0, VW, VH);
        if (k >= 1) { this._finishing = 0; this.stop(true); }
        return;
      }
      const sh = this.shot, el = ms - this.shotStart;
      const startAt = sh.line ? (sh.line.at || 200) : sh.caption ? sh.caption.at || 200 : 0;
      if (!this.lineStarted && (sh.line || sh.caption) && el >= startAt) this._startLine(ms);

      // 總長：至少 min，且台詞講完後再 +0.3 秒
      const lineReady = ms >= this.lineDoneAt + LINE_GAP_MS;
      const planned = sh.line || sh.caption ? 0 : sh.min || 2200;
      if (this.lineDoneAt !== Infinity && this.lineDoneAt) this.expected = Math.max(planned, this.lineDoneAt + LINE_GAP_MS - this.shotStart);
      const prog = clamp01(el / this.expected);

      this._render(ctx, sh, el, prog, ms);

      // 交叉淡化
      const xf = (ms - this.xfadeStart) / XFADE_MS;
      if (xf < 1) { ctx.globalAlpha = 1 - easeInOut(clamp01(xf)); ctx.drawImage(this.snap, 0, 0); ctx.globalAlpha = 1; }

      if (el >= planned && lineReady) this._nextShot(ms);
    }

    _camAt(sh, el) {
      const [a, b] = sh.cam;
      const hold = sh.hold || 0;
      const k = el < hold ? 0 : easeInOut(clamp01((el - hold) / Math.max(800, this.expected - hold)));
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    }

    _applyCam(ctx, cam, depth, cam0) {
      // depth: 1=與背景同速，<1 遠景較慢，>1 近景較快
      const cx = lerp(cam0[0], cam[0], depth), cy = lerp(cam0[1], cam[1], depth), z = lerp(cam0[2], cam[2], depth);
      const S = BASE * z;
      // 夾住鏡頭，避免露出畫外
      const halfW = VW / 2 / S, halfH = VH / 2 / S;
      const x = Math.max(halfW, Math.min(BG_W - halfW, cx)), y = Math.max(halfH, Math.min(BG_H - halfH, cy));
      ctx.setTransform(S, 0, 0, S, VW / 2 - x * S, VH / 2 - y * S);
      return { S, x, y };
    }

    _render(ctx, sh, el, prog, ms) {
      const t = ms / 1000;
      const cam = this._camAt(sh, el), cam0 = sh.cam[0];
      const img = this.images[sh.bg];
      const scene = SCENES[sh.bg];
      const lite = this.tier === "compat" || this.tier === "lite";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, VW, VH);

      // ---- 背景（原畫） ----
      const view = this._applyCam(ctx, cam, 1, cam0);
      if (img) {
        if (sh.blur && !lite) ctx.filter = `blur(${sh.blur}px)`;
        ctx.drawImage(img, 0, 0, BG_W, BG_H);
        ctx.filter = "none";
      }
      if (sh.bg === "rashomon") this._rashomonWater(ctx, img, scene, t);
      if (sh.bg === "kurama") this._kuramaClouds(ctx, img, scene, t);

      // ---- 遠景：血月（較慢的視差） ----
      if (sh.bg === "fushimi" && this.moonSprite && !sh.closeup) {
        const far = this._applyCam(ctx, cam, 0.55, cam0);
        const m = scene.moon, R = this.moonSprite.R;
        // 遠景與背景的位移差
        const offX = Math.max(-8, Math.min(8, (view.x - far.x) * 0.12)), offY = Math.max(-8, Math.min(8, (view.y - far.y) * 0.12));
        ctx.setTransform(view.S, 0, 0, view.S, VW / 2 - view.x * view.S, VH / 2 - view.y * view.S);
        const sc = 1.03 + 0.015 * Math.sin(t * 0.8);
        if (!sh.blur) ctx.drawImage(this.moonSprite.canvas, m.x + offX - R * sc, m.y + offY - R * sc, 2 * R * sc, 2 * R * sc);
        ctx.globalCompositeOperation = "lighter";
        const pulse = 0.18 + 0.06 * Math.sin(t * 1.4);
        this._glow(ctx, m.x + offX * 2.5, m.y + offY * 2.5, m.r * 2.0, sh.calm ? "#ffd9a0" : "#ff5a3c", pulse);
        ctx.globalCompositeOperation = "source-over";
      }

      // ---- 中景：燈火（與背景同速，閃爍） ----
      ctx.setTransform(view.S, 0, 0, view.S, VW / 2 - view.x * view.S, VH / 2 - view.y * view.S);
      ctx.globalCompositeOperation = "lighter";
      (scene.lanterns || []).forEach(([x, y, r], i) => {
        const f = 0.22 + 0.12 * Math.sin(t * (5 + (i % 3)) + i * 1.7) + 0.06 * Math.sin(t * 13 + i);
        this._glow(ctx, x, y, r * 2.4, "#ffae4a", f * (sh.blur ? 0.7 : 1));
      });
      (scene.blueLights || []).forEach(([x, y], i) => {
        this._glow(ctx, x + Math.sin(t * 0.9 + i) * 6, y + Math.cos(t * 1.2 + i) * 5, 22, "#49f2e1", 0.22 + 0.12 * Math.sin(t * 3 + i));
      });
      if (sh.bg === "rashomon") (scene.torches || []).forEach(([x, y], i) => {
        const f = 0.4 + 0.18 * Math.sin(t * 17 + i * 3) + 0.1 * Math.sin(t * 7 + i);
        this._glow(ctx, x, y - 6, 46, "#ff9a3c", f);
        // 濕地倒影：火光在地面拉長
        ctx.save(); ctx.translate(x + Math.sin(t * 3 + i) * 2, y + 150 + i * 30); ctx.scale(0.35, 2.4);
        this._glow(ctx, 0, 0, 40, "#ff8a2a", f * 0.55); ctx.restore();
      });
      if (sh.bg === "kurama") this._kuramaStreams(ctx, scene, t);
      ctx.globalCompositeOperation = "source-over";

      // ---- 閃電 ----
      if (sh.bg === "rashomon") this._lightning(ctx, scene, sh, el, view);

      // ---- 色調 ----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (sh.red) { ctx.fillStyle = `rgba(120,10,10,${0.18 + 0.06 * Math.sin(t * 2)})`; ctx.fillRect(0, 0, VW, VH); }
      if (sh.dark) { ctx.fillStyle = `rgba(4,5,10,${sh.dark})`; ctx.fillRect(0, 0, VW, VH); }

      // ---- 角色 ----
      if (sh.actors && window.HW06_ACTORS) {
        sh.actors.forEach((a) => {
          if (a.act && !this.actFired[a.id] && el >= (a.actAt || 0) * (sh.min || 3000)) {
            this.actFired[a.id] = true; window.HW06_ACTORS.setAction(a.id, a.act, a.actMs || 1500);
          }
          const k = a.enter ? easeOut(clamp01(el / 700)) : 1;
          const slide = (1 - k) * 140 * a.enter;
          const z = 1 + 0.03 * clamp01(el / 6000);
          const s = a.s * z;
          ctx.globalAlpha = k;
          window.HW06_ACTORS.drawActor(ctx, a.id, a.cx + slide - (896 / 2) * s, a.top, s, {});
          ctx.globalAlpha = 1;
        });
      }
      if (sh.closeup && window.HW06_ACTORS) this._closeup(ctx, sh, el, prog, t);

      // ---- 近景：花瓣／雨（最快的視差） ----
      this._nearLayer(ctx, sh, view, t);

      // 收尾白光
      if (sh.endFlash && this.lineDoneAt !== Infinity) {
        const k = clamp01((performance.now() - this.lineDoneAt) / 300);
        ctx.fillStyle = `rgba(255,240,220,${0.55 * Math.sin(k * Math.PI)})`; ctx.fillRect(0, 0, VW, VH);
      }
      // 暗角
      const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
    }

    _closeup(ctx, sh, el, prog, t) {
      const A = window.HW06_ACTORS, def = A.CAST[sh.closeup.id];
      const [fx, fy, fw] = def.faceCrop;
      const z = lerp(sh.closeup.z0 || 1, sh.closeup.z1 || 1.08, easeInOut(prog));
      const s = (VW * 0.62 / fw) * z;                    // 眼部佔畫面 62% 寬
      const cx = fx + def.faceCrop[2] / 2, cy = fy + def.faceCrop[3] / 2;
      const k = easeOut(clamp01(el / 500));
      ctx.globalAlpha = k;
      A.drawActor(ctx, sh.closeup.id, VW * 0.52 - cx * s, VH * 0.44 - cy * s, s, { noWarp: true, fx: false });
      ctx.globalAlpha = 1;
      // 眼中光芒
      ctx.globalCompositeOperation = "lighter";
      def.eyes.forEach(([ex, ey]) => {
        const x = VW * 0.52 + (ex - cx) * s, y = VH * 0.44 + (ey - cy) * s;
        this._glow(ctx, x, y, 40 * z, "#49f2e1", 0.18 + 0.1 * Math.sin(t * 4));
      });
      ctx.globalCompositeOperation = "source-over";
      // 上下遮幅
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(0, 0, VW, VH * 0.1); ctx.fillRect(0, VH * 0.9, VW, VH * 0.1);
    }

    _nearLayer(ctx, sh, view, t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dt = Math.min(0.05, (performance.now() - (this._lastNear || performance.now())) / 1000);
      this._lastNear = performance.now();
      // 鏡頭移動造成的近景額外位移（近景比背景快 1.8 倍）
      const camDX = (this._lastViewX != null ? view.x - this._lastViewX : 0) * view.S * 0.8;
      const camDY = (this._lastViewY != null ? view.y - this._lastViewY : 0) * view.S * 0.8;
      this._lastViewX = view.x; this._lastViewY = view.y;
      if (sh.bg === "fushimi") {
        this.petals.forEach((p, i) => {
          p.x += p.vx * dt - camDX * (0.4 + p.depth); p.y += p.vy * dt - camDY * (0.4 + p.depth) + Math.sin(t * 2 + p.ph) * 0.4;
          p.rot += p.vr * dt;
          if (p.x < -60 || p.y > VH + 60) this.petals[i] = newPetal(false);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.35 * Math.sin(t * 3 + p.ph));
          ctx.globalAlpha = 0.55 + p.depth * 0.4;
          ctx.fillStyle = p.depth > 0.8 ? "rgba(255,190,210,0.85)" : "#ffc4d6";
          if (p.depth > 0.85 && this.tier !== "compat") ctx.filter = "blur(2px)";
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.filter = "none"; ctx.restore();
        });
        ctx.globalAlpha = 1;
      } else if (sh.bg === "rashomon") {
        ctx.lineCap = "round";
        this.rain.forEach((r) => {
          r.y += r.v * dt; r.x += r.v * 0.18 * dt - camDX * r.d;
          if (r.y > VH + 40) { r.y = -40 - Math.random() * 100; r.x = Math.random() * (VW + 200) - 100; }
          ctx.strokeStyle = `rgba(190,215,235,${0.12 + r.d * 0.3})`; ctx.lineWidth = 0.6 + r.d * 1.6;
          ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.len * 0.18, r.y - r.len); ctx.stroke();
        });
      } else if (sh.bg === "kurama") {
        if (!this.leaves.length) for (let i = 0; i < 26; i++) this.leaves.push({ x: Math.random() * VW, y: Math.random() * VH, d: Math.random(), ph: Math.random() * 6 });
        this.leaves.forEach((l) => {
          l.x += (-20 - l.d * 50) * dt - camDX * (0.4 + l.d); l.y += (18 + l.d * 30) * dt + Math.sin(t + l.ph) * 0.5;
          if (l.x < -30 || l.y > VH + 30) { l.x = VW + Math.random() * 100; l.y = Math.random() * VH * 0.7; }
          ctx.fillStyle = `rgba(255,205,70,${0.5 + l.d * 0.4})`;
          ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(t * 2 + l.ph);
          ctx.beginPath(); ctx.ellipse(0, 0, 3 + l.d * 8, 2 + l.d * 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
      }
    }

    _makeRain() {
      const n = this.tier === "compat" ? 70 : 170, arr = [];
      for (let i = 0; i < n; i++) { const d = Math.random(); arr.push({ x: Math.random() * (VW + 200) - 100, y: Math.random() * VH, d, v: 900 + d * 900, len: 18 + d * 40 }); }
      return arr;
    }

    _rashomonWater(ctx, img, scene, t) {
      if (!img || this.tier === "compat") return;
      // 河面與濕地：逐列輕微水平晃動，產生水光倒影
      const r = scene.river;
      for (let y = r.y; y < r.y + r.h; y += 3) {
        const dx = Math.sin(t * 2.6 + y * 0.18) * (1 + (y - r.y) / r.h * 2.5);
        ctx.drawImage(img, r.x, y, r.w, 3, r.x + dx, y, r.w, 3);
      }
    }

    _kuramaClouds(ctx, img, scene, t) {
      if (!img || this.tier === "compat") return;
      const c = scene.clouds;
      for (let y = c.y; y < c.y + c.h; y += 4) {
        const dx = Math.sin(t * 0.7 + y * 0.035) * 3 + Math.sin(t * 0.25 + y * 0.01) * 4;
        ctx.drawImage(img, c.x, y, c.w, 4, c.x + dx, y, c.w, 4);
      }
      ctx.globalCompositeOperation = "lighter";
      this._glow(ctx, scene.moon.x, scene.moon.y, 90, "#cfe6ff", 0.16 + 0.05 * Math.sin(t * 1.3));
      ctx.globalCompositeOperation = "source-over";
    }

    _kuramaStreams(ctx, scene, t) {
      scene.streams.forEach((pts, si) => {
        const segs = pts.length - 1;
        for (let k = 0; k < 14; k++) {
          const u = ((t * 0.09 * (1 + si * 0.2) + k / 14) % 1);
          const f = u * segs, i = Math.floor(f), w = f - i;
          const a = pts[i], b = pts[Math.min(segs, i + 1)];
          const x = lerp(a[0], b[0], w), y = lerp(a[1], b[1], w);
          this._glow(ctx, x, y, 26, "#6ff2c0", 0.28 * Math.sin(u * Math.PI));
          this._glow(ctx, x, y, 7, "#eafff6", 0.5 * Math.sin(u * Math.PI));
        }
      });
    }

    _lightning(ctx, scene, sh, el, view) {
      const flashes = sh.flashes || [];
      let k = 0, which = 0;
      flashes.forEach((f, i) => { const d = el - f; if (d >= 0 && d < 420) { const v = d < 60 ? 1 : d < 120 ? 0.35 : d < 170 ? 0.85 : Math.max(0, 1 - (d - 170) / 250); if (v > k) { k = v; which = i; } } });
      if (k <= 0) return;
      ctx.setTransform(view.S, 0, 0, view.S, VW / 2 - view.x * view.S, VH / 2 - view.y * view.S);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35 * k;
      if (this.images.rashomon) ctx.drawImage(this.images.rashomon, 0, 0, BG_W, BG_H);   // 雷光照亮整個場景
      ctx.globalAlpha = 1;
      scene.bolts.forEach((b, i) => {
        if ((i + which) % 2) return;
        const [x0, y0, x1, y1, col] = b;
        for (let j = 0; j <= 4; j++) this._glow(ctx, lerp(x0, x1, j / 4), lerp(y0, y1, j / 4), 70, col, 0.35 * k);
      });
      ctx.globalCompositeOperation = "source-over";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(210,240,255,${0.22 * k})`; ctx.fillRect(0, 0, VW, VH);
    }

    _glow(ctx, x, y, r, color, a) {
      if (a <= 0.004) return;
      const n = parseInt(color.slice(1), 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${R},${G},${B},${a})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  window.HW06_CINEMA = new ArtCinema();
  window.HW06_CINEMA_SCRIPTS = CUTSCENES;
})();
