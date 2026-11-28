/* ==========================================================================
   1142949 HW06 — 原立繪分層角色演員（取代 anime-rig-engine.js 的程序重畫角色）
   - 以首頁原立繪去背後的分層素材演出：眨眼、呼吸、髮尾／袖口／狐尾擺動、對嘴
   - 擺動用 WebGL 網格只變形「袖口、髮尾、狐尾、衣襬」，臉部權重為 0，不扭曲整張立繪
   - 招式動作：重心前傾、手部符咒／掌心狐火發光（大動作改用特寫鏡頭，見 key-move-shots.js）
   - 對外提供 HW06_ACTORS（給片頭／特寫用）與相容舊介面的 HW06_RIGS（給對弈畫面用）
   ========================================================================== */
(function () {
  "use strict";

  const SRC_W = 896, SRC_H = 1200;
  const ART = window.HW06_ART || {};

  /* ---------- 角色定義（座標皆為原立繪 896×1200 像素） ---------- */
  const CAST = {
    ren: {
      cut: "ren_cut", blink: "ren_blink", blinkAt: [364, 272],
      portrait: "./assets/char_ren.jpg",
      mouth: [441, 363, 15], lipColor: "#6b2a26",
      mouthShape: { a: [424, 364.2], c: [441, 365], b: [458, 364.6], dmax: 4.6, patch: [414, 365.2, 54, 16], col: "#4a1716", tongue: "#a9524c" },
      eyes: [[395, 288], [492, 286]],
      hand: [556, 468],          // 符咒
      finger: [470, 528],        // 劍指
      aura: "#ffcf6b", auraDeep: "#e0452f",
      cardCrop: { cx: 452, top: 46, h: 990 },
      faceCrop: [330, 215, 230, 125],   // 眼部特寫
      handCrop: [400, 340, 330, 330],   // 符咒手特寫
      weight(x, y) {
        const fx = (x - 440) / 150, fy = (y - 300) / 205;
        const face = fx * fx + fy * fy;
        if (face < 1) return [0, 0, 0];
        const guard = Math.min(1, (face - 1) / 0.6);
        // 袖口與衣襬：越往下、越往外擺越大
        const low = smooth(470, 1150, y);
        const side = 0.35 + 0.65 * Math.min(1, Math.abs(x - 445) / 330);
        let cloth = low * side;
        // 髮尾：頭頂與兩側翹髮
        let hair = 0;
        if (y < 330) hair = 0.45 * smooth(120, 230, Math.abs(x - 440)) + 0.35 * (1 - smooth(70, 170, y));
        return [guard * Math.min(1, cloth + hair), 0, x * 0.004];
      }
    },
    tamamo: {
      cut: "tamamo_cut", blink: "tamamo_blink", blinkAt: [387, 315],
      portrait: "./assets/char_tamamo.jpg",
      mouth: [455, 383, 13], lipColor: "#7a2333",
      mouthShape: { a: [440, 382.2], c: [454, 386.5], b: [468, 378.6], dmax: 3.6, patch: [432, 383.5, 46, 13], col: "#561321", tongue: "#b94b5a" },
      eyes: [[414, 337], [481, 329]],
      hand: [412, 640],          // 掌心狐火
      finger: [412, 640],
      aura: "#6ff7ea", auraDeep: "#13a596",
      cardCrop: { cx: 455, top: 40, h: 1000 },
      faceCrop: [355, 268, 200, 110],
      handCrop: [270, 500, 300, 300],
      weight(x, y) {
        const fx = (x - 446) / 125, fy = (y - 335) / 150;
        const face = fx * fx + fy * fy;
        if (face < 1) return [0, 0, 0];
        const guard = Math.min(1, (face - 1) / 0.5);
        // 狐尾（左右兩團）
        const tl = ell(x, y, 165, 520, 175, 350), tr = ell(x, y, 760, 520, 165, 350);
        const tail = Math.max(0, 1 - Math.min(tl, tr));
        // 銀色長髮兩側
        const hair = 0.65 * smooth(110, 210, Math.abs(x - 446)) * smooth(230, 360, y) * (1 - smooth(900, 1100, y));
        const cloth = 0.6 * smooth(640, 1200, y) * (0.4 + 0.6 * Math.min(1, Math.abs(x - 446) / 330));
        const ears = y < 200 ? 0.25 * (1 - smooth(80, 200, y)) : 0;
        return [guard * Math.min(1, hair + cloth + ears), guard * Math.min(1, tail), smooth(300, 600, x) * 1.7];
      }
    }
  };

  function smooth(a, b, v) { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
  function ell(x, y, cx, cy, rx, ry) { const a = (x - cx) / rx, b = (y - cy) / ry; return Math.sqrt(a * a + b * b); }
  const now = () => performance.now() / 1000;

  /* ---------- 圖片載入 ---------- */
  const images = {};
  function loadImg(key, src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => { images[key] = im; res(im); };
      im.onerror = () => res(null);
      im.src = src;
    });
  }
  const ready = Promise.all([
    loadImg("ren_cut", ART.ren_cut || "./assets/layers/ren_cut.webp"),
    loadImg("tamamo_cut", ART.tamamo_cut || "./assets/layers/tamamo_cut.webp"),
    loadImg("ren_blink", ART.ren_blink || "./assets/layers/ren_blink.png"),
    loadImg("tamamo_blink", ART.tamamo_blink || "./assets/layers/tamamo_blink.png"),
    loadImg("ren_portrait", "./assets/char_ren.jpg"),
    loadImg("tamamo_portrait", "./assets/char_tamamo.jpg")
  ]);

  /* ---------- WebGL 局部擺動渲染器 ---------- */
  const WarpGL = {
    canvas: null, gl: null, ok: false, progs: null, meshes: {}, scale: 0.75,
    init() {
      if (this.canvas) return this.ok;
      this.canvas = document.createElement("canvas");
      this.canvas.width = Math.round(SRC_W * this.scale);
      this.canvas.height = Math.round(SRC_H * this.scale);
      let gl = null;
      try {
        gl = this.canvas.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false }) ||
             this.canvas.getContext("experimental-webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true });
      } catch (_) { gl = null; }
      if (!gl) return (this.ok = false);
      const vs = `attribute vec2 aP; attribute vec3 aW; uniform float uT; uniform float uAmp; uniform float uGust; uniform float uDir;
        varying vec2 vUV;
        void main(){
          vec2 p = aP;
          float c = aW.x, tl = aW.y, ph = aW.z;
          float dx = c * (sin(uT*1.55 + p.y*0.011 + ph) * 1.0 + uGust * uDir * 2.2)
                   + tl * (sin(uT*0.95 + p.y*0.0085 + ph) * 2.1 + sin(uT*1.9 + p.x*0.01) * 0.6);
          float dy = c * sin(uT*1.25 + p.x*0.010 + ph) * 0.35 + tl * cos(uT*0.8 + p.y*0.01 + ph) * 0.9 - uGust * c * 1.2;
          p += vec2(dx, dy) * uAmp;
          vUV = aP / vec2(${SRC_W}.0, ${SRC_H}.0);
          vec2 clip = p / vec2(${SRC_W}.0, ${SRC_H}.0) * 2.0 - 1.0;
          gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        }`;
      const fs = `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; void main(){ gl_FragColor = texture2D(uTex, vUV); }`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return (this.ok = false);
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return (this.ok = false);
      this.gl = gl; this.prog = p;
      this.loc = {
        aP: gl.getAttribLocation(p, "aP"), aW: gl.getAttribLocation(p, "aW"),
        uT: gl.getUniformLocation(p, "uT"), uAmp: gl.getUniformLocation(p, "uAmp"),
        uGust: gl.getUniformLocation(p, "uGust"), uDir: gl.getUniformLocation(p, "uDir"), uTex: gl.getUniformLocation(p, "uTex")
      };
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      return (this.ok = true);
    },
    mesh(id) {
      if (this.meshes[id]) return this.meshes[id];
      const gl = this.gl, def = CAST[id], img = images[def.cut];
      if (!img) return null;
      const NX = 30, NY = 40, pos = [], wts = [], idx = [];
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const x = (i / NX) * SRC_W, y = (j / NY) * SRC_H;
        pos.push(x, y); const w = def.weight(x, y); wts.push(w[0], w[1], w[2]);
      }
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
      const m = { n: idx.length };
      m.pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      m.wb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.wb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wts), gl.STATIC_DRAW);
      m.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      m.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, m.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (_) { return null; }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.meshes[id] = m;
      return m;
    },
    render(id, t, amp, gust, dir) {
      if (!this.ok) return null;
      const gl = this.gl, m = this.mesh(id);
      if (!m) return null;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.enableVertexAttribArray(this.loc.aP); gl.vertexAttribPointer(this.loc.aP, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.wb); gl.enableVertexAttribArray(this.loc.aW); gl.vertexAttribPointer(this.loc.aW, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.uniform1i(this.loc.uTex, 0);
      gl.uniform1f(this.loc.uT, t); gl.uniform1f(this.loc.uAmp, amp); gl.uniform1f(this.loc.uGust, gust); gl.uniform1f(this.loc.uDir, dir);
      gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
      return this.canvas;
    }
  };

  /* ---------- 角色狀態 ---------- */
  const STATE = {};
  Object.keys(CAST).forEach((id) => {
    STATE[id] = { nextBlink: now() + 1 + Math.random() * 2, blinkStart: -9, action: "idle", actStart: -9, actDur: 0, look: [0, 0], lookCur: [0, 0] };
  });

  function setAction(id, action, ms) {
    const s = STATE[id]; if (!s) return;
    s.action = action || "idle"; s.actStart = now(); s.actDur = Math.max(0.2, (ms || 700) / 1000);
  }

  function actionInfo(s, t) {
    const k = (t - s.actStart) / s.actDur;
    if (s.action === "idle" || k >= 1.35 || k < 0) return { name: "idle", k: 1, env: 0 };
    const env = k < 0.18 ? k / 0.18 : k < 1 ? 1 : Math.max(0, 1 - (k - 1) / 0.35);
    return { name: s.action, k, env };
  }

  /**
   * 在 ctx 上畫一個角色（目的座標：原立繪左上角在 dx,dy、每原圖像素 = s 個畫面像素）
   * opts: { t, mouth(0..1), facing(1=朝右), fx(true), amp, dim(0..1) }
   */
  function drawActor(ctx, id, dx, dy, s, opts) {
    opts = opts || {};
    const def = CAST[id], st = STATE[id];
    if (!def) return;
    const t = opts.t != null ? opts.t : now();
    const act = actionInfo(st, t);
    const casting = /attack|chant|counter|pierce|ultimate|taunt/.test(act.name);

    // 呼吸與動作姿態（以腳底為軸）
    const breath = Math.sin(t * 1.65 + (id === "tamamo" ? 1.2 : 0));
    let lean = 0, punch = 0, shakeX = 0, drop = 0;
    // 落點決定施法方向：目標偏向自己這側＝小幅揮手；偏向對側＝大幅前傾；中央＝雙手結印（放大）
    const lx = st.lookCur[0] * (id === "ren" ? 1 : -1);
    if (casting) {
      lean = 0.022 * act.env * (opts.facing || (id === "ren" ? 1 : -1)) * (1 + 0.9 * lx);
      punch = (Math.abs(st.lookCur[0]) < 0.2 ? 0.045 : 0.03) * act.env;
    }
    if (act.name === "hit_recoil") {
      // 受擊方向：依棋盤位置往對應方向側身
      shakeX = Math.sin(t * 70) * 7 * act.env - (id === "ren" ? 1 : -1) * 10 * act.env * (0.5 + Math.abs(st.lookCur[1]));
      lean = -0.014 * act.env * (id === "ren" ? 1 : -1) * (1 + 0.6 * Math.abs(st.lookCur[0]));
    }
    if (act.name === "seal_bow") { drop = 14 * act.env; lean = 0.03 * act.env * (id === "ren" ? 1 : -1); }
    if (act.name === "victory") { punch = 0.02 * act.env; }
    st.lookCur[0] += (st.look[0] - st.lookCur[0]) * 0.08;
    st.lookCur[1] += (st.look[1] - st.lookCur[1]) * 0.08;

    ctx.save();
    ctx.translate(dx + (SRC_W / 2) * s + shakeX * s + st.lookCur[0] * 6 * s, dy + SRC_H * s + drop * s);
    ctx.rotate(lean);
    ctx.scale(s * (1 + punch + 0.003 * breath), s * (1 + punch + 0.0075 * breath));
    ctx.translate(-SRC_W / 2, -SRC_H);

    // 1. 本體（局部擺動）
    const amp = (opts.amp != null ? opts.amp : 1) * 5.5;
    const gust = casting ? act.env : 0;
    const warped = opts.noWarp ? null : WarpGL.render(id, t, amp, gust, id === "ren" ? 1 : -1);
    if (warped) ctx.drawImage(warped, 0, 0, SRC_W, SRC_H);
    else if (images[def.cut]) ctx.drawImage(images[def.cut], 0, 0, SRC_W, SRC_H);

    // 2. 眨眼
    if (t > st.nextBlink) { st.blinkStart = t; st.nextBlink = t + 2.4 + Math.random() * 3.2; if (Math.random() < 0.18) st.nextBlink = t + 0.32; }
    const bk = (t - st.blinkStart) / 0.16;
    const bimg = images[def.blink];
    if (bimg && bk >= 0 && bk <= 1) {
      ctx.globalAlpha = bk < 0.3 || bk > 0.75 ? 0.6 : 1;
      ctx.drawImage(bimg, def.blinkAt[0], def.blinkAt[1]);
      ctx.globalAlpha = 1;
    }

    // 3. 對嘴：沿原畫的嘴線張開（下唇往下移、縫隙填入口腔色），不另外貼圓形嘴巴
    const mouth = opts.mouth != null ? opts.mouth : lip(id);
    const MS = def.mouthShape, cutImg = images[def.cut];
    if (MS && cutImg && mouth > 0.05) {
      const d = MS.dmax * Math.min(1, mouth);
      const [px, py, pw, ph] = MS.patch;
      // 下唇與下巴往下移（左右與下緣羽化，不留方框）
      const fp = featherPatch(id, cutImg, MS.patch, (MS.b[0] - MS.a[0]) * 0.9);
      if (fp) ctx.drawImage(fp, px - 0, py + d, pw, ph);
      // 口腔畫在最上層，蓋住接縫
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(MS.a[0], MS.a[1]);
      ctx.quadraticCurveTo(MS.c[0], MS.c[1], MS.b[0], MS.b[1]);
      ctx.quadraticCurveTo(MS.c[0], MS.c[1] + d * 2.1, MS.a[0], MS.a[1]);
      ctx.closePath();
      ctx.fillStyle = MS.col; ctx.fill();
      ctx.clip();
      ctx.fillStyle = MS.tongue; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(MS.c[0] + 1, MS.c[1] + d * 1.25, (MS.b[0] - MS.a[0]) * 0.26, d * 0.55 + 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 4. 招式光效（畫在原圖座標）
    if (opts.fx !== false && act.name !== "idle") drawActionFx(ctx, id, def, act, t);
    if (opts.dim) { ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = `rgba(6,8,14,${opts.dim})`; ctx.fillRect(0, 0, SRC_W, SRC_H); ctx.globalCompositeOperation = "source-over"; }
    ctx.restore();
  }

  const patchCache = {};
  function featherPatch(id, img, patch, lensW) {
    if (patchCache[id]) return patchCache[id];
    const [px, py, pw, ph] = patch, K = 4;
    const cxp = px + pw / 2;   // 4 倍解析度
    const c = document.createElement("canvas"); c.width = Math.round(pw * K); c.height = Math.round(ph * K);
    const g = c.getContext("2d");
    try { g.drawImage(img, px, py, pw, ph, 0, 0, c.width, c.height); } catch (_) { return null; }
    g.globalCompositeOperation = "destination-in";
    // 橢圓羽化：以上緣中央為圓心，越往左右與下方越透明（上緣中央被口腔蓋住）
    g.save(); g.translate(c.width / 2, 0); g.scale(c.width / 2, c.height);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(0.5, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(-1, 0, 2, 1); g.restore();
    // 上緣也羽化，只保留被口腔蓋住的中段，避免出現一條細縫線
    const m = document.createElement("canvas"); m.width = c.width; m.height = c.height;
    const mg = m.getContext("2d");
    const vy = mg.createLinearGradient(0, 0, 0, c.height * 0.45);
    vy.addColorStop(0, "rgba(0,0,0,0)"); vy.addColorStop(1, "rgba(0,0,0,1)");
    mg.fillStyle = vy; mg.fillRect(0, 0, m.width, m.height);
    const lw = (lensW || pw * 0.6) * K;
    const hx = mg.createLinearGradient(m.width / 2 - lw / 2, 0, m.width / 2 + lw / 2, 0);
    hx.addColorStop(0, "rgba(0,0,0,0)"); hx.addColorStop(0.25, "rgba(0,0,0,1)"); hx.addColorStop(0.75, "rgba(0,0,0,1)"); hx.addColorStop(1, "rgba(0,0,0,0)");
    mg.fillStyle = hx; mg.fillRect(m.width / 2 - lw / 2, 0, lw, m.height * 0.5);
    g.drawImage(m, 0, 0);
    patchCache[id] = c;
    return c;
  }

  function lip(id) {
    const v = window.HW06_VOICE;
    if (!v || typeof v.getLipSyncState !== "function") return 0;
    const s = v.getLipSyncState(id);
    return s && s.speaking ? (s.mouth != null ? s.mouth : s.mouthOpen || 0) : 0;
  }

  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.25, hexA(color, a * 0.85));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }

  function drawActionFx(ctx, id, def, act, t) {
    const e = act.env;
    if (e <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const [hx, hy] = def.hand;
    if (act.name === "hit_recoil") {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = hexA(id === "ren" ? "#7ff5ea" : "#ffb070", 0.32 * e);
      ctx.fillRect(0, 0, SRC_W, SRC_H);
      ctx.restore(); return;
    }
    if (act.name === "seal_bow") { ctx.restore(); return; }
    if (act.name === "victory") {
      glow(ctx, 448, 520, 520, def.aura, 0.28 * e * (0.8 + 0.2 * Math.sin(t * 6)));
      ctx.restore(); return;
    }
    const strong = /counter|pierce|ultimate/.test(act.name) ? 1.4 : 1;
    if (id === "ren") {
      // 符咒金光＋旋轉五芒法陣
      glow(ctx, hx, hy, 150 * strong * e, def.aura, 0.75 * e);
      glow(ctx, def.finger[0], def.finger[1], 70 * e, "#fff1b8", 0.6 * e);
      ctx.translate(hx, hy); ctx.rotate(t * 1.8);
      ctx.strokeStyle = hexA("#ffd77a", 0.85 * e); ctx.lineWidth = 4;
      const R = 95 * strong * (0.7 + 0.3 * e);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); const px = Math.cos(a) * R * 0.92, py = Math.sin(a) * R * 0.92; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    } else {
      // 掌心狐火聚集
      const r = (60 + 50 * strong) * e;
      glow(ctx, hx, hy, r * 2.1, def.aura, 0.7 * e);
      for (let i = 0; i < 9; i++) {
        const a = t * (2.2 + i * 0.13) + i * 0.7;
        const rr = r * (1.25 + 0.35 * Math.sin(t * 3 + i));
        glow(ctx, hx + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.65 - (i % 3) * 10, 26 * e, "#49f2e1", 0.65 * e);
      }
      if (strong > 1) def.eyes.forEach(([ex, ey]) => glow(ctx, ex, ey, 26 * e, "#8ffff4", 0.9 * e));
    }
    ctx.restore();
  }

  /* ==========================================================================
     HW06_RIGS 相容層：對弈畫面左右兩張角色卡
     ========================================================================== */
  const Rigs = {
    stages: {}, tier: "ultra", raf: 0, lastDraw: 0, boss: "tamamo",
    mountBattleStages(heroCanvas, bossCanvas) {
      WarpGL.init();
      if (heroCanvas) this.stages.ren = { canvas: heroCanvas, ctx: heroCanvas.getContext("2d") };
      if (bossCanvas) this.stages.tamamo = { canvas: bossCanvas, ctx: bossCanvas.getContext("2d") };
      const loop = (ms) => {
        this.raf = requestAnimationFrame(loop);
        const minGap = this.tier === "compat" ? 66 : this.tier === "lite" || this.tier === "balanced" ? 40 : 30;
        if (ms - this.lastDraw < minGap) return;
        this.lastDraw = ms;
        this.drawAll();
      };
      ready.then(() => { if (!this.raf) this.raf = requestAnimationFrame(loop); });
    },
    fit(stage) {
      const c = stage.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(60, Math.round((c.clientWidth || 280) * dpr)), h = Math.max(60, Math.round((c.clientHeight || 330) * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      return [w, h];
    },
    layout(id, w, h) {
      const cr = CAST[id].cardCrop;
      const s = h / cr.h;
      return { s, dx: w / 2 - cr.cx * s, dy: -cr.top * s };
    },
    drawAll() {
      const hidden = document.hidden;
      if (hidden) return;
      Object.keys(this.stages).forEach((id) => {
        const st = this.stages[id];
        if (!st.ctx || st.canvas.offsetParent === null) return;
        const [w, h] = this.fit(st);
        const L = this.layout(id, w, h);
        st.ctx.setTransform(1, 0, 0, 1, 0, 0);
        st.ctx.clearRect(0, 0, w, h);
        drawActor(st.ctx, id, L.dx, L.dy, L.s, { amp: this.tier === "compat" ? 0 : 1, noWarp: this.tier === "compat" });
      });
    },
    setBossCharacter(id) { this.boss = id; },
    setPerformanceTier(tier) { this.tier = tier || "ultra"; },
    setLookTarget(x, y) { Object.values(STATE).forEach((s) => { s.look = [x || 0, y || 0]; }); },
    triggerCharacterAction(id, action, ms) {
      setAction(id, action, ms);
      return this.handScreen(id);
    },
    pointScreen(id, key) {
      const st = this.stages[id];
      if (!st) return null;
      const r = st.canvas.getBoundingClientRect();
      const L = this.layout(id, st.canvas.width, st.canvas.height);
      const [hx, hy] = CAST[id][key] || CAST[id].hand;
      return { handScreenX: r.left + ((L.dx + hx * L.s) / st.canvas.width) * r.width, handScreenY: r.top + ((L.dy + hy * L.s) / st.canvas.height) * r.height };
    },
    handScreen(id) {
      const st = this.stages[id];
      if (!st) return null;
      const r = st.canvas.getBoundingClientRect();
      const [w, h] = [st.canvas.width, st.canvas.height];
      const L = this.layout(id, w, h);
      const [hx, hy] = CAST[id].hand;
      return { handScreenX: r.left + ((L.dx + hx * L.s) / w) * r.width, handScreenY: r.top + ((L.dy + hy * L.s) / h) * r.height };
    }
  };

  window.HW06_ACTORS = { ready, drawActor, setAction, images, CAST, SRC_W, SRC_H, warpAvailable: () => WarpGL.init() };
  window.HW06_RIGS = Rigs;
})();
