/* ==========================================================================
   1142949 HW06 — v10 十大奧義（全螢幕、衝出棋盤、蓋過左右角色區）
   N1 千本鳥居穿越   N2 巨型狐眼凝視   N3 棋盤乾坤翻面   N4 百鬼夜行大遊行
   N5 天雷劈盤       N6 水墨巨筆「封」  N7 金龍繞盤       N8 血月月蝕
   N9 櫻吹雪龍捲     N10 棋盤碎裂重組／太極大漩渦
   - 排程器：所有奧義排隊播放，開始前先等舊特效（arena／關鍵分鏡）收尾，不會疊成一團
   - 播放中 isBusy() 為 true，遊戲會鎖住棋盤點擊
   - 畫質：跟隨三段護航（極致／流暢簡化／無 GPU 相容），播放中掉幀會再自動減粒子
   - 全部用 Canvas 2D + CSS transform，GPU 關閉時一樣能跑
   ========================================================================== */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const SLOW = 1.4;   // v11：所有奧義整體放慢 40%
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const bell = (p, a, b, c, d) => Math.min(seg(p, a, b), 1 - seg(p, c, d));
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const AUDIO = () => window.HW06_AUDIO;
  const cueSound = (kind, n) => { const a = AUDIO(); if (a && a.playGrandCue) a.playGrandCue(kind, n); };

  const TONE = {
    gold: { rgb: "255,190,70", hot: "#fff6c8", css: "gold" },
    jade: { rgb: "70,240,220", hot: "#dafffb", css: "jade" },
    blood: { rgb: "255,50,40", hot: "#ffd7cc", css: "blood" },
    violet: { rgb: "190,120,255", hot: "#f6e9ff", css: "violet" },
    sakura: { rgb: "255,150,200", hot: "#fff0f6", css: "sakura" },
    ink: { rgb: "90,220,210", hot: "#e8fffb", css: "ink" },
    storm: { rgb: "160,200,255", hot: "#ffffff", css: "storm" }
  };

  let canvas, ctx, nameCard, els = {}, tier = "high";
  let current = null, raf = 0, chain = Promise.resolve(), pending = 0, token = 0;
  const history = [];
  const timeline = [];   // 診斷用：每招實際開始／結束時間
  let onChange = null;
  const sprites = { ren: null, tamamo: null, petal: null };

  /* ------------------------------------------------------------------ utils */
  function quality() {
    const base = { high: 1, medium: 0.55, compat: 0.3 }[tier] || 0.55;
    return base * (current && current.lite ? 0.55 : 1);
  }

  function geom() {
    const W = innerWidth, H = innerHeight;
    const fr = els.frame.getBoundingClientRect();
    const B = { x: fr.left, y: fr.top, w: fr.width, h: fr.height, cx: fr.left + fr.width / 2, cy: fr.top + fr.height / 2 };
    const bd = els.board.getBoundingClientRect();
    const S = { x: bd.left, y: bd.top, w: bd.width, h: bd.height };
    const hero = els.heroCard.getBoundingClientRect(), boss = els.bossCard.getBoundingClientRect();
    const cell = (i) => { const r = els.cells[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; };
    return { W, H, B, S, hero, boss, cell, D: Math.hypot(W, H) };
  }

  function glow(x, y, r, rgb, a) {
    if (r < 1 || a <= 0.003) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${clamp(a)})`);
    g.addColorStop(0.45, `rgba(${rgb},${clamp(a * 0.4)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function veil(a, rgb) {
    if (a <= 0.003) return;
    ctx.fillStyle = `rgba(${rgb || "4,3,10"},${clamp(a)})`;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }

  function vignette(g, a, rgb) {
    if (a <= 0.003) return;
    const v = ctx.createRadialGradient(g.W / 2, g.H / 2, Math.min(g.W, g.H) * 0.25, g.W / 2, g.H / 2, g.D * 0.6);
    v.addColorStop(0, `rgba(${rgb},0)`);
    v.addColorStop(1, `rgba(${rgb},${clamp(a)})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function polyline(pts, rgb, width, a, hot) {
    if (pts.length < 2 || a <= 0) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = `rgba(${rgb},${clamp(a * 0.28)})`; ctx.lineWidth = width * 4.2; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${clamp(a * 0.7)})`; ctx.lineWidth = width * 1.8; ctx.stroke();
    ctx.strokeStyle = hot || "#fff"; ctx.globalAlpha = clamp(a); ctx.lineWidth = width * 0.7; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** 讓棋盤露出來：在目前畫好的圖層上，把棋盤範圍挖淡 */
  function boardHole(g, a) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${clamp(a)})`;
    const pad = 6;
    ctx.fillRect(g.B.x - pad, g.B.y - pad, g.B.w + pad * 2, g.B.h + pad * 2);
    ctx.restore();
  }

  function shake(amp, ms) {
    if (!els.shell || motion.matches || !els.shell.animate) return;
    const k = [];
    for (let i = 0; i <= 8; i++) {
      const d = amp * (1 - i / 8);
      k.push({ transform: `translate(${(rnd(i * 3.1 + amp) - 0.5) * 2 * d}px,${(rnd(i * 7.7 + amp) - 0.5) * 2 * d}px)` });
    }
    k[k.length - 1] = { transform: "none" };
    els.shell.animate(k, { duration: ms, easing: "linear" });
  }

  function once(e, key, at, p, fn) {
    if (p >= at && !e.cues[key]) { e.cues[key] = true; fn(); }
  }

  /* --------------------------------------------------- 棋子貼圖與花瓣貼圖 */
  function buildSprites() {
    const defs = document.querySelector("svg defs");
    if (!defs) return;
    const grads = Array.from(defs.querySelectorAll("linearGradient,radialGradient")).map((n) => n.outerHTML).join("");
    ["ren", "tamamo"].forEach((who) => {
      const sym = document.getElementById("seal-" + who);
      if (!sym) return;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><defs>${grads}</defs>${sym.innerHTML}</svg>`;
      const img = new Image();
      img.onload = () => { sprites[who] = img; };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const p = c.getContext("2d");
    const gr = p.createRadialGradient(16, 18, 1, 16, 16, 15);
    gr.addColorStop(0, "#fff4f8"); gr.addColorStop(0.55, "#ffb3d1"); gr.addColorStop(1, "#e8679b");
    p.fillStyle = gr;
    p.beginPath(); p.moveTo(16, 2);
    p.bezierCurveTo(30, 6, 30, 26, 16, 30); p.bezierCurveTo(2, 26, 2, 6, 16, 2);
    p.fill();
    p.fillStyle = "rgba(255,255,255,.55)"; p.beginPath(); p.moveTo(16, 2); p.lineTo(13, 7); p.lineTo(19, 7); p.fill();
    sprites.petal = c;
  }

  /* =========================================================== N1 千本鳥居 */
  function drawTorii(cx, cy, s, Wg, Hg, Bh, a, lit) {
    if (a <= 0.01 || s <= 0) return;
    const X = (x) => cx + x * s, Y = (y) => cy + y * s;
    const yb = Bh / 2, yk = yb - Hg;
    const pw = Wg * 0.075, px = Wg * 0.43;
    ctx.globalAlpha = clamp(a);
    // 柱
    for (const side of [-1, 1]) {
      const gr = ctx.createLinearGradient(X(side * px - pw / 2), 0, X(side * px + pw / 2), 0);
      gr.addColorStop(0, "#7c150c"); gr.addColorStop(0.45, "#e2431f"); gr.addColorStop(1, "#8e1a10");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(X(side * px - pw * 0.42), Y(yk + Hg * 0.12));
      ctx.lineTo(X(side * px + pw * 0.42), Y(yk + Hg * 0.12));
      ctx.lineTo(X(side * px + pw * 0.55), Y(yb));
      ctx.lineTo(X(side * px - pw * 0.55), Y(yb));
      ctx.fill();
      ctx.fillStyle = "#140906";
      ctx.fillRect(X(side * px - pw * 0.62), Y(yb - Hg * 0.05), pw * 1.24 * s, Hg * 0.05 * s);
    }
    // 貫
    ctx.fillStyle = "#c9341a";
    ctx.fillRect(X(-Wg * 0.53), Y(yk + Hg * 0.25), Wg * 1.06 * s, Hg * 0.055 * s);
    // 額束
    ctx.fillStyle = "#1c0d08";
    ctx.fillRect(X(-Wg * 0.06), Y(yk + Hg * 0.1), Wg * 0.12 * s, Hg * 0.15 * s);
    ctx.fillStyle = "#e6b84a";
    ctx.fillRect(X(-Wg * 0.045), Y(yk + Hg * 0.115), Wg * 0.09 * s, Hg * 0.12 * s);
    // 島木（紅）＋ 笠木（黑，兩端上翹）
    ctx.fillStyle = "#d43a1c";
    ctx.fillRect(X(-Wg * 0.6), Y(yk + Hg * 0.055), Wg * 1.2 * s, Hg * 0.055 * s);
    ctx.fillStyle = "#170a07";
    ctx.beginPath();
    ctx.moveTo(X(-Wg * 0.7), Y(yk - Hg * 0.03));
    ctx.quadraticCurveTo(X(0), Y(yk + Hg * 0.045), X(Wg * 0.7), Y(yk - Hg * 0.03));
    ctx.lineTo(X(Wg * 0.64), Y(yk + Hg * 0.06));
    ctx.quadraticCurveTo(X(0), Y(yk + Hg * 0.1), X(-Wg * 0.64), Y(yk + Hg * 0.06));
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    if (lit > 0) {
      // 柱腳燈籠
      for (const side of [-1, 1]) glow(X(side * Wg * 0.56), Y(yb - Hg * 0.14), Hg * 0.12 * s, "255,150,60", lit * a);
      for (const side of [-1, 1]) glow(X(side * px), Y(yk + Hg * 0.3), pw * 1.6 * s, "255,90,40", lit * a * 0.35);
    }
  }

  const FX = {};

  FX.torii = {
    title: "千本鳥居穿越", kicker: "奧義・其一", sub: "SENBON TORII RUSH", tone: "gold", dur: 2700,
    begin(e) {
      e.data.prevOpacity = els.frame.style.opacity;
      els.frame.style.opacity = "0";
    },
    draw(e, g, p) {
      const N = 14, GAP = 0.55, T = (N - 1) * GAP;
      const travel = T * (1 - Math.pow(1 - seg(p, 0.02, 0.8), 3.2));
      const env = bell(p, 0, 0.06, 0.86, 0.98);
      veil(env * 0.88, "8,2,6");
      const cx = g.B.cx, cy = g.B.cy;
      // 隧道地面與遠方光點
      glow(cx, cy, g.D * 0.35, "255,90,40", env * 0.35);
      // 速度線
      const speed = p < 0.8 ? (1 - seg(p, 0.02, 0.8)) : 0;
      const nLines = Math.round(70 * quality());
      ctx.lineCap = "round";
      for (let i = 0; i < nLines; i++) {
        const ang = rnd(i) * TAU, r0 = g.D * (0.12 + ((rnd(i + 9) + p * 3.2 * (0.5 + rnd(i + 3))) % 1) * 0.5);
        const len = g.D * 0.05 * (0.3 + speed * 2);
        ctx.strokeStyle = `rgba(255,${180 + (i % 3) * 25},120,${clamp(env * speed * 0.55)})`;
        ctx.lineWidth = 1 + (i % 3);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len));
        ctx.stroke();
      }
      const Wg = g.B.w, Hg = g.B.h * 1.3, Bh = g.B.h;
      for (let k = N - 1; k >= 0; k--) {
        // k = N-1 是最遠、最後落定成棋盤外框的那一座
        const zz = 1 + k * GAP - travel;
        const depth = k === N - 1 ? Math.max(1, zz) : zz;
        if (depth < 0.2) continue;
        const s = 1 / depth;
        if (s * Wg > g.D * 3) continue;
        const fog = clamp((7.5 - depth) / 4);
        const fadeLast = k === N - 1 ? 1 - seg(p, 0.86, 0.95) : 1;
        drawTorii(cx, cy, s, Wg, Hg, Bh, fog * env * fadeLast, 1);
        if (depth < 0.9 && k < N - 1) once(e, "pass" + k, 0, 1, () => cueSound("torii", k));
      }
      // 落定：最後一座鳥居「碰」一聲化成棋盤外框
      once(e, "slam", 0.8, p, () => { cueSound("toriiSlam"); shake(14, 520); });
      once(e, "show", 0.84, p, () => { els.frame.style.opacity = e.data.prevOpacity || ""; });
      if (p > 0.8) {
        const q = seg(p, 0.8, 1);
        glow(cx, cy, g.B.w * (0.7 + q * 1.4), "255,210,120", (1 - q) * 0.9);
        ctx.strokeStyle = `rgba(255,236,170,${clamp(1 - q)})`;
        ctx.lineWidth = 10 * (1 - q) + 2;
        const grow = 1 + easeOut(q) * 0.5;
        ctx.strokeRect(cx - g.B.w / 2 * grow, cy - g.B.h / 2 * grow, g.B.w * grow, g.B.h * grow);
        const n = Math.round(90 * quality());
        for (let i = 0; i < n; i++) {
          const a = rnd(i * 2.3) * TAU, r = g.B.w * 0.5 + easeOut(q) * g.D * (0.15 + rnd(i) * 0.35);
          ctx.fillStyle = `rgba(255,${200 + (i % 5) * 10},120,${clamp(1 - q)})`;
          ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 3, 3);
        }
      }
    },
    end(e) { els.frame.style.opacity = e.data.prevOpacity || ""; }
  };

  /* =========================================================== N2 巨型狐眼 */
  FX.eye = {
    title: "巨型狐眼凝視", kicker: "奧義・其二", sub: "KITSUNE EYE", tone: "jade", dur: 2400,
    draw(e, g, p) {
      const env = bell(p, 0, 0.1, 0.88, 1);
      veil(env * 0.72, "2,6,10");
      const cx = g.B.cx, cy = g.B.cy - g.B.h * 0.04;
      const EW = Math.min(g.W * 0.96, g.H * 1.9), EH = EW * 0.34;
      const open = easeOut(seg(p, 0.04, 0.24)) * (1 - easeIn(seg(p, 0.82, 0.95)));
      once(e, "open", 0.04, p, () => cueSound("eyeOpen"));
      // 外圍狐火
      const nf = Math.round(46 * quality());
      for (let i = 0; i < nf; i++) {
        const t = i / nf, side = t < 0.5 ? -1 : 1, u = (t * 2) % 1;
        const x = cx + (u - 0.5) * EW * 1.02;
        const y = cy + side * Math.sin(u * Math.PI) * EH * open * 1.18 - Math.abs(Math.sin(p * 18 + i)) * 14;
        glow(x, y, 26 + (i % 4) * 8, "60,230,255", env * 0.55 * (0.4 + open));
      }
      // 隈取紅紋，往兩側角色區延伸
      for (const side of [-1, 1]) {
        ctx.strokeStyle = `rgba(220,30,50,${clamp(env * open)})`;
        ctx.lineWidth = EH * 0.07; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx + side * EW * 0.46, cy - EH * 0.12);
        ctx.quadraticCurveTo(cx + side * EW * 0.58, cy - EH * 0.7, cx + side * EW * 0.66, cy - EH * 1.05);
        ctx.stroke();
        ctx.lineWidth = EH * 0.035;
        ctx.beginPath();
        ctx.moveTo(cx + side * EW * 0.44, cy + EH * 0.18);
        ctx.quadraticCurveTo(cx + side * EW * 0.56, cy + EH * 0.45, cx + side * EW * 0.63, cy + EH * 0.38);
        ctx.stroke();
      }
      if (open < 0.02) return;
      const L = cx - EW / 2, R = cx + EW / 2;
      const eyePath = () => {
        ctx.beginPath();
        ctx.moveTo(L, cy);
        ctx.quadraticCurveTo(cx, cy - EH * open * 1.15, R, cy);
        ctx.quadraticCurveTo(cx, cy + EH * open * 1.15, L, cy);
        ctx.closePath();
      };
      ctx.save();
      ctx.globalAlpha = clamp(env) * 0.92;
      eyePath();
      const sc = ctx.createRadialGradient(cx, cy, EH * 0.2, cx, cy, EW * 0.55);
      sc.addColorStop(0, "#5c1a0e"); sc.addColorStop(1, "#160404");
      ctx.fillStyle = sc; ctx.fill();
      ctx.clip();
      // 視線：先看正前方，再轉向電腦要下的格子
      const [tx, ty] = g.cell(e.opts.index == null ? 4 : e.opts.index);
      const look = easeInOut(seg(p, 0.32, 0.58));
      const dx = tx - cx, dy = ty - cy, dl = Math.hypot(dx, dy) || 1;
      const IR = EH * 0.52;
      const ix = cx + (dx / dl) * Math.min(EW * 0.24, dl) * look;
      const iy = cy + (dy / dl) * Math.min(EH * 0.32, dl * 0.5) * look;
      const ig = ctx.createRadialGradient(ix, iy, IR * 0.05, ix, iy, IR);
      ig.addColorStop(0, "#fffbd0"); ig.addColorStop(0.35, "#ffd24a"); ig.addColorStop(0.75, "#d9661c"); ig.addColorStop(0.95, "#5a1405"); ig.addColorStop(1, "#200402");
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, IR, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(120,40,0,.45)"; ctx.lineWidth = 1.5;
      const ns = Math.round(36 * Math.max(0.5, quality()));
      for (let i = 0; i < ns; i++) {
        const a = i / ns * TAU + p;
        ctx.beginPath();
        ctx.moveTo(ix + Math.cos(a) * IR * 0.3, iy + Math.sin(a) * IR * 0.3);
        ctx.lineTo(ix + Math.cos(a) * IR * 0.93, iy + Math.sin(a) * IR * 0.93);
        ctx.stroke();
      }
      const slit = mix(0.24, 0.07, seg(p, 0.55, 0.65));
      ctx.fillStyle = "#050000";
      ctx.beginPath(); ctx.ellipse(ix, iy, IR * slit, IR * 0.86, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath(); ctx.arc(ix - IR * 0.32, iy - IR * 0.36, IR * 0.09, 0, TAU); ctx.fill();
      ctx.restore();
      // 眼眶
      ctx.save();
      ctx.globalAlpha = clamp(env);
      eyePath();
      ctx.strokeStyle = "#120302"; ctx.lineWidth = EH * 0.08; ctx.stroke();
      ctx.strokeStyle = "rgba(255,60,70,.85)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      // 鎖定目標格
      if (p > 0.58) {
        const q = seg(p, 0.58, 0.72), fade = 1 - seg(p, 0.86, 1);
        once(e, "lock", 0.58, p, () => cueSound("eyeLock"));
        const cw = g.cell(e.opts.index == null ? 4 : e.opts.index)[2];
        polyline([[ix, iy], [tx, ty]], "70,240,220", 2.2, fade * q * 0.8, "#dafffb");
        ctx.strokeStyle = `rgba(90,255,235,${clamp(fade)})`;
        ctx.lineWidth = 4;
        const rr = cw * (0.9 - q * 0.38);
        ctx.beginPath(); ctx.arc(tx, ty, rr, 0, TAU); ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + p * 3;
          ctx.beginPath();
          ctx.moveTo(tx + Math.cos(a) * rr * 0.6, ty + Math.sin(a) * rr * 0.6);
          ctx.lineTo(tx + Math.cos(a) * rr * 1.35, ty + Math.sin(a) * rr * 1.35);
          ctx.stroke();
        }
        glow(tx, ty, cw * 0.9, "70,240,220", fade * 0.6);
      }
    }
  };

  /* ========================================================= N3 棋盤翻面 */
  function drawTaijiDisc(x, y, r, rot, a) {
    if (r < 2 || a <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = "#f4ead2"; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0b0a12";
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.arc(0, r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
    ctx.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r / 2, r * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = "#f4ead2"; ctx.beginPath(); ctx.arc(0, r / 2, r * 0.13, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ffcf63"; ctx.lineWidth = Math.max(2, r * 0.035);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  const TRIGRAMS = ["111", "110", "101", "100", "011", "010", "001", "000"];
  function drawBagua(x, y, r, rot, rgb, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = `rgba(${rgb},${clamp(a)})`;
    ctx.lineWidth = Math.max(2, r * 0.025);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},${clamp(a)})`;
    TRIGRAMS.forEach((tg, k) => {
      ctx.save(); ctx.rotate(k * TAU / 8);
      for (let line = 0; line < 3; line++) {
        const yy = -r * (0.79 + line * 0.065), w = r * 0.26, h = r * 0.035;
        if (tg[line] === "1") ctx.fillRect(-w / 2, yy, w, h);
        else { ctx.fillRect(-w / 2, yy, w * 0.42, h); ctx.fillRect(w * 0.08, yy, w * 0.42, h); }
      }
      ctx.restore();
    });
    ctx.restore();
  }


  /* ========================================================= N5 天雷劈盤 */
  function bolt(x0, y0, x1, y1, n, jit, seed) {
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) {
      const t = i / n, j = jit * Math.sin(t * Math.PI);
      pts.push([mix(x0, x1, t) + (rnd(seed + i * 3.3) - 0.5) * 2 * j, mix(y0, y1, t) + (rnd(seed + i * 5.1) - 0.5) * j * 0.3]);
    }
    pts.push([x1, y1]);
    return pts;
  }

  FX.thunder = {
    title: "天雷劈盤", kicker: "奧義・其五", sub: "HEAVEN'S THUNDER", tone: "storm", dur: 1700,
    draw(e, g, p) {
      const [tx, ty, cw] = g.cell(e.opts.index == null ? 4 : e.opts.index);
      const env = bell(p, 0, 0.02, 0.7, 1);
      veil(env * 0.5, "6,8,24");
      const flicker = Math.floor((performance.now() - e.start) / 60);
      const sx = tx + (rnd(e.seed) - 0.5) * g.W * 0.25;
      const main = bolt(sx, -30, tx, ty, 22, g.W * 0.06, e.seed + flicker * 0.37);
      const boltA = (p < 0.5 ? (0.65 + 0.35 * rnd(flicker)) : 1 - seg(p, 0.5, 0.8)) * seg(p, 0, 0.03);
      polyline(main, "150,190,255", 6, boltA, "#ffffff");
      const branches = Math.round(7 * Math.max(0.6, quality()));
      for (let b = 0; b < branches; b++) {
        const k = 4 + Math.floor(rnd(e.seed + b) * 14), from = main[k];
        const side = b % 2 ? 1 : -1;
        const ex = from[0] + side * g.W * (0.18 + rnd(b + e.seed) * 0.3), ey = from[1] + g.H * (0.08 + rnd(b * 2.1) * 0.25);
        polyline(bolt(from[0], from[1], ex, ey, 9, g.W * 0.025, e.seed + b * 11 + flicker * 0.21), "150,190,255", 2.4, boltA * 0.8, "#eef4ff");
      }
      once(e, "hit", 0.03, p, () => { cueSound("thunder"); shake(22, 640); });
      // 撞擊：格線裂開，裂紋一路延伸到兩側角色區
      const grow = easeOut(seg(p, 0.04, 0.32)), cf = 1 - seg(p, 0.6, 1);
      const nc = 12;
      for (let c = 0; c < nc; c++) {
        const ang = c / nc * TAU + rnd(c + e.seed) * 0.4;
        const len = g.D * (0.22 + rnd(c * 3 + e.seed) * 0.3) * grow;
        const pts = [[tx, ty]];
        for (let s = 1; s <= 7; s++) {
          const r = len * s / 7;
          pts.push([tx + Math.cos(ang + (rnd(c * 9 + s) - 0.5) * 0.5) * r, ty + Math.sin(ang + (rnd(c * 7 + s) - 0.5) * 0.5) * r * 0.8]);
        }
        polyline(pts, "120,180,255", 2 + (c % 3), cf * 0.9, "#f4f8ff");
      }
      glow(tx, ty, cw * 2.4, "190,220,255", cf * 0.9);
      const sc = ctx.createRadialGradient(tx, ty, 0, tx, ty, cw * 0.6);
      sc.addColorStop(0, `rgba(255,255,255,${clamp(cf)})`); sc.addColorStop(0.35, `rgba(150,190,255,${clamp(cf * 0.7)})`); sc.addColorStop(1, "rgba(20,30,60,0)");
      ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(tx, ty, cw * 0.6, 0, TAU); ctx.fill();
      const ns = Math.round(80 * quality());
      for (let i = 0; i < ns; i++) {
        const a = rnd(i * 1.7 + e.seed) * TAU, r = easeOut(seg(p, 0.04, 0.6)) * g.D * 0.3 * (0.2 + rnd(i));
        ctx.fillStyle = `rgba(220,235,255,${clamp(cf)})`;
        ctx.fillRect(tx + Math.cos(a) * r, ty + Math.sin(a) * r + seg(p, 0.1, 1) ** 2 * 60, 3, 3);
      }
      // 全螢幕白閃
      const flash = Math.max(1 - seg(p, 0.03, 0.12), (p > 0.15 && p < 0.19) ? 0.6 : 0);
      if (p > 0.02) veil(flash * 0.95, "235,242,255");
    }
  };

  /* ======================================================= N6 水墨「封」 */
  const FENG_STROKES = [
    [[0.12, 0.24], [0.46, 0.22]], [[0.29, 0.07], [0.29, 0.44]], [[0.06, 0.44], [0.5, 0.42]],
    [[0.12, 0.62], [0.46, 0.6]], [[0.29, 0.48], [0.29, 0.86]], [[0.04, 0.88], [0.53, 0.82]],
    [[0.55, 0.34], [0.98, 0.33]], [[0.82, 0.06], [0.82, 0.92], [0.74, 0.86]], [[0.63, 0.52], [0.7, 0.66]]
  ];
  function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function pointAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= l) { const t = l ? d / l : 0; return [mix(pts[i - 1][0], pts[i][0], t), mix(pts[i - 1][1], pts[i][1], t)]; }
      d -= l;
    }
    return pts[pts.length - 1].slice();
  }

  FX.ink = {
    title: "水墨巨筆「封」", kicker: "奧義・其六", sub: "GIANT BRUSH SEAL", tone: "ink", dur: 2600,
    begin(e, g) {
      const S = Math.round(Math.min(g.H * 0.9, g.W * 0.62));
      const glyph = document.createElement("canvas"); glyph.width = glyph.height = S;
      const gc = glyph.getContext("2d");
      gc.fillStyle = "#06100f";
      gc.textAlign = "center"; gc.textBaseline = "middle";
      gc.font = `900 ${Math.round(S * 0.92)}px "Yuji Syuku","DFKai-SB","BiauKai","標楷體","KaiTi","STKaiti","Noto Serif TC","Noto Serif CJK TC",serif`;
      gc.fillText("封", S / 2, S * 0.53);
      const mask = document.createElement("canvas"); mask.width = mask.height = S;
      const comp = document.createElement("canvas"); comp.width = comp.height = S;
      const lens = FENG_STROKES.map(pathLen), total = lens.reduce((a, b) => a + b, 0);
      e.data = { S, glyph, mask, comp, lens, total, last: null, drawn: 0 };
      e.data.blobs = Array.from({ length: Math.round(46 * Math.max(0.5, quality())) }, (_, i) => ({
        a: rnd(i * 3.3) * TAU, d: 0.35 + rnd(i * 1.9) * 0.9, r: 6 + rnd(i * 5.1) * 34
      }));
    },
    draw(e, g, p) {
      const D = e.data, S = D.S, cx = g.B.cx, cy = g.B.cy, x0 = cx - S / 2, y0 = cy - S / 2;
      const env = bell(p, 0, 0.06, 0.88, 1);
      veil(env * 0.42, "10,16,18");
      vignette(g, env * 0.5, "0,0,0");
      // 筆刷沿筆順前進，揭開字形
      const q = seg(p, 0.12, 0.68);
      const target = q * D.total;
      const mc = D.mask.getContext("2d");
      mc.fillStyle = "#000";
      const R = S * 0.085;
      let brush = null;
      while (D.drawn < target) {
        const step = Math.min(target, D.drawn + S * 0.006 / S);
        let acc = 0, idx = 0;
        while (idx < D.lens.length - 1 && acc + D.lens[idx] < step) { acc += D.lens[idx]; idx++; }
        const pt = pointAt(FENG_STROKES[idx], step - acc);
        mc.beginPath(); mc.arc(pt[0] * S, pt[1] * S, R, 0, TAU); mc.fill();
        if (D.lastStroke !== idx) { D.lastStroke = idx; cueSound("brush"); }
        D.drawn = step + 0.004;
      }
      if (q > 0 && q < 1) {
        let acc = 0, idx = 0;
        while (idx < D.lens.length - 1 && acc + D.lens[idx] < target) { acc += D.lens[idx]; idx++; }
        brush = pointAt(FENG_STROKES[idx], target - acc);
      }
      const full = seg(p, 0.66, 0.74);
      const cc = D.comp.getContext("2d");
      cc.globalCompositeOperation = "source-over";
      cc.clearRect(0, 0, S, S);
      cc.drawImage(D.glyph, 0, 0);
      cc.globalCompositeOperation = "destination-in";
      cc.drawImage(D.mask, 0, 0);
      if (full > 0) { cc.globalCompositeOperation = "source-over"; cc.globalAlpha = full; cc.drawImage(D.glyph, 0, 0); cc.globalAlpha = 1; }
      const dissolve = seg(p, 0.8, 0.97);
      // 字的青色光暈
      glow(cx, cy, S * 0.62, "70,220,210", env * 0.35 * (1 - dissolve));
      ctx.globalAlpha = clamp(1 - dissolve);
      ctx.drawImage(D.comp, x0, y0, S, S);
      ctx.globalAlpha = 1;
      // 墨點四濺
      once(e, "splash", 0.7, p, () => { cueSound("inkSplash"); shake(10, 420); });
      if (p > 0.7) {
        const k = easeOut(seg(p, 0.7, 0.82)), fa = 1 - seg(p, 0.85, 1);
        D.blobs.forEach((b, i) => {
          const r = b.d * k * g.D * 0.42;
          const bx = cx + Math.cos(b.a) * r, by = cy + Math.sin(b.a) * r * 0.75;
          ctx.fillStyle = `rgba(4,14,14,${clamp(fa * 0.9)})`;
          ctx.beginPath(); ctx.arc(bx, by, b.r * (0.4 + k * 0.6), 0, TAU); ctx.fill();
          if (i % 3 === 0) { ctx.beginPath(); ctx.arc(bx + b.r * 1.4, by - b.r * 0.6, b.r * 0.3, 0, TAU); ctx.fill(); }
        });
      }
      // 紅色落款印
      if (p > 0.74) {
        const k = easeOut(seg(p, 0.74, 0.8)), fa = 1 - dissolve;
        const sz = S * 0.13 * (2 - k), sx = x0 + S * 0.86, sy = y0 + S * 0.86;
        ctx.save(); ctx.globalAlpha = clamp(fa * k);
        ctx.translate(sx, sy); ctx.rotate(-0.08);
        ctx.fillStyle = "#c21d1d"; ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.fillStyle = "#ffe9df"; ctx.font = `900 ${sz * 0.36}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("玉藻", 0, 0);
        ctx.restore();
      }
      // 化成青煙散去
      if (dissolve > 0) {
        const n = Math.round(60 * quality()) + 10;
        for (let i = 0; i < n; i++) {
          const px = x0 + S * (0.1 + rnd(i * 2.7) * 0.8), py = y0 + S * (0.1 + rnd(i * 4.1) * 0.8) - dissolve * S * 0.25 * (0.5 + rnd(i));
          const rr = S * 0.03 + dissolve * S * 0.09 * rnd(i * 1.3);
          ctx.fillStyle = `rgba(110,150,150,${clamp((1 - dissolve) * 0.35)})`;
          ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
        }
      }
      // 巨筆：從畫面外甩進來，沿筆順寫字
      let bx, by;
      if (p < 0.12) { const k = easeOut(seg(p, 0, 0.12)); bx = mix(g.W + S * 0.3, x0 + S * 0.12, k); by = mix(-S * 0.4, y0 + S * 0.24, k); }
      else if (brush) { bx = x0 + brush[0] * S; by = y0 + brush[1] * S; }
      else { const k = easeIn(seg(p, 0.68, 0.8)); bx = mix(x0 + S * 0.7, g.W + S * 0.5, k); by = mix(y0 + S * 0.66, -S * 0.5, k); }
      if (p < 0.8) {
        ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.62);
        const L = S * 0.62, w = S * 0.05;
        ctx.fillStyle = "#050807";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-w * 1.1, -L * 0.1, -w * 0.9, -L * 0.2); ctx.lineTo(w * 0.9, -L * 0.2); ctx.quadraticCurveTo(w * 1.1, -L * 0.1, 0, 0); ctx.fill();
        ctx.fillStyle = "#c6a86b"; ctx.fillRect(-w * 0.95, -L * 0.26, w * 1.9, L * 0.07);
        const hg = ctx.createLinearGradient(-w, 0, w, 0);
        hg.addColorStop(0, "#5d3a16"); hg.addColorStop(0.5, "#b98a45"); hg.addColorStop(1, "#5d3a16");
        ctx.fillStyle = hg; ctx.fillRect(-w * 0.62, -L, w * 1.24, L * 0.74);
        ctx.fillStyle = "#3a230c";
        for (let k = 0; k < 4; k++) ctx.fillRect(-w * 0.62, -L * (0.45 + k * 0.14), w * 1.24, 3);
        ctx.restore();
      }
    }
  };

  /* ========================================================= N8 血月月蝕 */
  FX.moon = {
    title: "血月月蝕", kicker: "奧義・其八", sub: "BLOOD MOON ECLIPSE", tone: "blood", dur: 2900,
    begin(e) {
      cueSound("moon");
      e.data.bats = Array.from({ length: Math.round(16 * Math.max(0.5, quality())) }, (_, i) => ({ y: rnd(i) * 0.5 + 0.05, sp: 0.5 + rnd(i + 3), off: rnd(i + 8), sz: 8 + rnd(i * 2) * 14 }));
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.08, 0.88, 1);
      const MR = Math.min(g.W * 0.36, g.H * 0.6);
      const cx = g.B.cx, cy = mix(g.B.y + g.B.h + MR * 0.9, g.B.y + g.B.h * 0.38, easeOut(seg(p, 0.02, 0.38)));
      // 月亮（從棋盤背後升起）
      ctx.globalAlpha = clamp(env);
      glow(cx, cy, MR * 1.9, "255,40,30", 0.5);
      const mg = ctx.createRadialGradient(cx - MR * 0.25, cy - MR * 0.25, MR * 0.1, cx, cy, MR);
      mg.addColorStop(0, "#ffd0b5"); mg.addColorStop(0.45, "#e5452c"); mg.addColorStop(0.9, "#7d0e0a"); mg.addColorStop(1, "#4a0505");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, cy, MR, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(90,8,6,.35)";
      for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(cx + (rnd(k) - 0.5) * MR * 1.2, cy + (rnd(k + 5) - 0.5) * MR * 1.2, MR * (0.06 + rnd(k + 9) * 0.12), 0, TAU); ctx.fill(); }
      // 黑影吞噬（月蝕）
      const ec = easeInOut(seg(p, 0.32, 0.58));
      const sx = cx + (1 - ec) * MR * 2.3;
      ctx.fillStyle = "rgba(14,1,3,.93)";
      ctx.beginPath(); ctx.arc(sx, cy - (1 - ec) * MR * 0.25, MR * 1.02, 0, TAU); ctx.fill();
      if (ec > 0.5) glow(cx, cy, MR * 1.25, "255,40,30", (ec - 0.5) * 0.8);
      ctx.globalAlpha = 1;
      if (ec > 0.9) {
        // 日冕紅環
        const k = seg(p, 0.56, 0.62);
        ctx.strokeStyle = `rgba(255,80,60,${clamp(env * k)})`; ctx.lineWidth = MR * 0.06;
        ctx.beginPath(); ctx.arc(cx, cy, MR * 1.02, 0, TAU); ctx.stroke();
        for (let i = 0; i < 36; i++) {
          const a = i / 36 * TAU + p, l = MR * (0.12 + rnd(i) * 0.2) * k;
          ctx.strokeStyle = `rgba(255,${60 + (i % 3) * 40},50,${clamp(env * k * 0.7)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * MR * 1.04, cy + Math.sin(a) * MR * 1.04); ctx.lineTo(cx + Math.cos(a) * (MR * 1.04 + l), cy + Math.sin(a) * (MR * 1.04 + l)); ctx.stroke();
        }
      }
      boardHole(g, 0.78);
      // 整個網頁轉成暗紅色
      veil(env * 0.42 * (0.4 + ec * 0.6), "90,0,6");
      vignette(g, env * 0.8, "40,0,0");
      // 月蝕光環一圈圈往外擴散
      for (let r = 0; r < 4; r++) {
        const st = 0.58 + r * 0.07, q = seg(p, st, st + 0.3);
        once(e, "ring" + r, st, p, () => cueSound("moonRing", r));
        if (q <= 0 || q >= 1) continue;
        ctx.strokeStyle = `rgba(255,70,60,${clamp((1 - q) * env)})`;
        ctx.lineWidth = 16 * (1 - q) + 2;
        ctx.beginPath(); ctx.arc(cx, cy, MR + easeOut(q) * g.D * 0.7, 0, TAU); ctx.stroke();
      }
      // 蝙蝠
      ctx.fillStyle = `rgba(10,0,0,${clamp(env)})`;
      e.data.bats.forEach((b, i) => {
        const x = g.W * (1.1 - ((p * b.sp + b.off) % 1.3)), y = g.H * b.y + Math.sin(p * 30 + i) * 10;
        const f = Math.sin(p * 60 + i) * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - b.sz, y - b.sz * (0.6 + f), x - b.sz * 2, y + b.sz * 0.1);
        ctx.quadraticCurveTo(x - b.sz, y, x, y + b.sz * 0.3);
        ctx.quadraticCurveTo(x + b.sz, y, x + b.sz * 2, y + b.sz * 0.1);
        ctx.quadraticCurveTo(x + b.sz, y - b.sz * (0.6 + f), x, y); ctx.fill();
      });
    }
  };

  /* ================================================== N10 碎裂重組／太極 */
  function snapshotBoard(g, opts) {
    const c = document.createElement("canvas");
    const W = Math.round(g.B.w), H = Math.round(g.B.h);
    c.width = W; c.height = H;
    const s = c.getContext("2d");
    const wood = s.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, "#3a2413"); wood.addColorStop(1, "#1d1109");
    s.fillStyle = wood; s.fillRect(0, 0, W, H);
    s.strokeStyle = "#e0ad46"; s.lineWidth = 3; s.strokeRect(4, 4, W - 8, H - 8);
    const ox = g.S.x - g.B.x, oy = g.S.y - g.B.y, sw = g.S.w, sh = g.S.h;
    const paper = s.createRadialGradient(ox + sw / 2, oy + sh / 2, 10, ox + sw / 2, oy + sh / 2, sw * 0.75);
    paper.addColorStop(0, "#fbf1dc"); paper.addColorStop(1, "#dcc59b");
    s.fillStyle = paper; s.fillRect(ox, oy, sw, sh);
    s.strokeStyle = "rgba(59,37,22,.22)"; s.lineWidth = 2;
    s.beginPath(); s.arc(ox + sw / 2, oy + sh / 2, sw * 0.3, 0, TAU); s.stroke();
    s.strokeStyle = "#2d1d13"; s.lineWidth = 4.2; s.lineCap = "round";
    for (let k = 1; k < 3; k++) {
      s.beginPath(); s.moveTo(ox + sw * k / 3, oy + sh * 0.03); s.lineTo(ox + sw * k / 3, oy + sh * 0.97); s.stroke();
      s.beginPath(); s.moveTo(ox + sw * 0.03, oy + sh * k / 3); s.lineTo(ox + sw * 0.97, oy + sh * k / 3); s.stroke();
    }
    const board = opts.board || [];
    for (let i = 0; i < 9; i++) {
      const v = board[i]; if (!v) continue;
      const img = v === 1 ? sprites.ren : sprites.tamamo;
      const [x, y, w] = g.cell(i);
      const px = x - g.B.x, py = y - g.B.y, z = w * 0.86;
      if (img) s.drawImage(img, px - z / 2, py - z / 2, z, z);
      else { s.fillStyle = v === 1 ? "#d63826" : "#16a89a"; s.beginPath(); s.arc(px, py, z * 0.4, 0, TAU); s.fill(); }
    }
    if (opts.line && opts.line.length === 3) {
      const a = g.cell(opts.line[0]), b = g.cell(opts.line[2]);
      s.strokeStyle = opts.winner === 1 ? "rgba(255,190,70,.9)" : "rgba(70,240,220,.9)";
      s.lineWidth = 10;
      s.beginPath(); s.moveTo(a[0] - g.B.x, a[1] - g.B.y); s.lineTo(b[0] - g.B.x, b[1] - g.B.y); s.stroke();
    }
    return c;
  }

  FX.shatter = {
    title: "棋盤碎裂重組", kicker: "奧義・其十", sub: "SHATTER & REFORM", tone: "jade", dur: 3200,
    begin(e, g) {
      const snap = snapshotBoard(g, e.opts);
      const cols = 6, rows = 6, W = g.B.w, H = g.B.h;
      const grid = [];
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
        const edge = r === 0 || c === 0 || r === rows || c === cols;
        grid.push([c / cols * W + (edge ? 0 : (rnd(r * 13 + c) - 0.5) * W / cols * 0.6), r / rows * H + (edge ? 0 : (rnd(r * 7 + c * 3) - 0.5) * H / rows * 0.6)]);
      }
      const shards = [];
      const P = (r, c) => grid[r * (cols + 1) + c];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const tris = (r + c) % 2 ? [[P(r, c), P(r, c + 1), P(r + 1, c + 1)], [P(r, c), P(r + 1, c + 1), P(r + 1, c)]]
                                  : [[P(r, c), P(r, c + 1), P(r + 1, c)], [P(r, c + 1), P(r + 1, c + 1), P(r + 1, c)]];
        tris.forEach((tri, k) => {
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          const i = shards.length;
          const dx = cx - W / 2 + (rnd(i) - 0.5) * 40, dy = cy - H / 2 + (rnd(i + 3) - 0.5) * 40, dl = Math.hypot(dx, dy) || 1;
          const dist = g.D * (0.22 + rnd(i * 2.2) * 0.34);
          shards.push({ tri, cx, cy, tx: dx / dl * dist * 1.25, ty: dy / dl * dist * 0.8, rot: (rnd(i * 4.4) - 0.5) * 7, k });
        });
      }
      e.data = { snap, shards, prevOpacity: els.frame.style.opacity };
    },
    draw(e, g, p) {
      const D = e.data;
      const env = bell(p, 0, 0.06, 0.92, 1);
      veil(env * 0.55, "2,10,14");
      once(e, "hide", 0.08, p, () => { els.frame.style.opacity = "0"; cueSound("shatter"); shake(18, 560); });
      once(e, "reform", 0.6, p, () => cueSound("reform"));
      once(e, "show", 0.88, p, () => { els.frame.style.opacity = D.prevOpacity || ""; });
      if (p < 0.08) {
        ctx.drawImage(D.snap, g.B.x, g.B.y, g.B.w, g.B.h);
        const k = seg(p, 0, 0.08);
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + 0.3;
          polyline([[g.B.cx, g.B.cy], [g.B.cx + Math.cos(a) * g.B.w * 0.55 * k, g.B.cy + Math.sin(a) * g.B.h * 0.55 * k]], "200,255,250", 1.5, 1, "#fff");
        }
        return;
      }
      const out = easeOut(seg(p, 0.08, 0.42)), back = easeInOut(seg(p, 0.58, 0.86));
      const k = out * (1 - back);
      const hover = Math.sin(seg(p, 0.42, 0.58) * Math.PI);
      const lastAlpha = 1 - seg(p, 0.88, 0.94);
      if (lastAlpha <= 0) {
        const q = seg(p, 0.88, 1);
        ctx.strokeStyle = `rgba(140,255,240,${clamp(1 - q)})`; ctx.lineWidth = 8 * (1 - q) + 2;
        const gr = 1 + q * 0.25;
        ctx.strokeRect(g.B.cx - g.B.w / 2 * gr, g.B.cy - g.B.h / 2 * gr, g.B.w * gr, g.B.h * gr);
        glow(g.B.cx, g.B.cy, g.B.w * (0.8 + q), "120,255,235", (1 - q) * 0.7);
        return;
      }
      D.shards.forEach((sh, i) => {
        const x = g.B.x + sh.cx + sh.tx * k + Math.sin(p * 9 + i) * 6 * hover;
        const y = g.B.y + sh.cy + sh.ty * k + Math.cos(p * 7 + i) * 6 * hover;
        const r = sh.rot * k;
        ctx.save();
        ctx.globalAlpha = clamp(lastAlpha);
        ctx.translate(x, y); ctx.rotate(r);
        ctx.beginPath();
        ctx.moveTo(sh.tri[0][0] - sh.cx, sh.tri[0][1] - sh.cy);
        ctx.lineTo(sh.tri[1][0] - sh.cx, sh.tri[1][1] - sh.cy);
        ctx.lineTo(sh.tri[2][0] - sh.cx, sh.tri[2][1] - sh.cy);
        ctx.closePath();
        ctx.save(); ctx.clip();
        ctx.drawImage(D.snap, -sh.cx, -sh.cy, g.B.w, g.B.h);
        ctx.restore();
        ctx.strokeStyle = `rgba(150,255,245,${clamp(0.25 + k * 0.7)})`; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
      });
      if (k > 0.3) glow(g.B.cx, g.B.cy, g.B.w * 0.5, "90,240,220", k * 0.35);
    },
    end(e) { els.frame.style.opacity = (e.data && e.data.prevOpacity) || ""; }
  };

  FX.taiji = {
    title: "太極大漩渦", kicker: "奧義・其十", sub: "TAIJI VORTEX", tone: "violet", dur: 3400,
    begin(e, g) {
      cueSound("taiji");
      const board = e.opts.board || [];
      e.data.pieces = [];
      for (let i = 0; i < 9; i++) if (board[i]) {
        const [x, y, w] = g.cell(i);
        const r0 = Math.hypot(x - g.B.cx, y - g.B.cy), a0 = r0 < 2 ? i * 0.7 : Math.atan2(y - g.B.cy, x - g.B.cx);
        e.data.pieces.push({ i, v: board[i], r0, a0, w, k: e.data.pieces.length });
      }
      els.board.classList.add("grand-pieces-away");
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.08, 0.9, 1);
      vignette(g, env * 0.8, "10,4,24");
      const cx = g.B.cx, cy = g.B.cy;
      const TR = Math.max(g.W, g.H) * 0.62 * easeOut(seg(p, 0, 0.3));
      const rot = TAU * 1.2 * easeInOut(p);
      drawTaijiDisc(cx, cy, TR, rot, env * 0.5);
      drawBagua(cx, cy, TR * 1.08, -rot * 0.5, "255,214,120", env * 0.6);
      boardHole(g, 0.7);
      // 漩渦旋臂
      const na = Math.round(10 * Math.max(0.5, quality()));
      for (let k = 0; k < na; k++) {
        const pts = [];
        for (let j = 0; j < 30; j++) {
          const t = j / 29, a = rot * 1.5 + k / na * TAU + t * 3.2;
          pts.push([cx + Math.cos(a) * TR * 0.95 * t, cy + Math.sin(a) * TR * 0.95 * t * 0.85]);
        }
        polyline(pts, k % 2 ? "255,214,120" : "200,140,255", 1.6, env * 0.5, k % 2 ? "#fff3c6" : "#f2e6ff");
      }
      // 九枚棋子沿太極繞一圈再歸位
      const q = seg(p, 0.1, 0.86);
      e.data.pieces.forEach((pc) => {
        const Ro = g.B.w * (0.68 + (pc.k % 3) * 0.08);
        let r;
        if (q < 0.25) r = mix(pc.r0, Ro, easeInOut(q / 0.25));
        else if (q > 0.75) r = mix(Ro, pc.r0, easeInOut((q - 0.75) / 0.25));
        else r = Ro;
        const a = pc.a0 + TAU * 2 * easeInOut(q);
        const x = cx + Math.cos(a) * r, yy = cy + Math.sin(a) * r * mix(1, 0.82, Math.sin(q * Math.PI));
        const img = pc.v === 1 ? sprites.ren : sprites.tamamo;
        const z = pc.w * 0.86 * (1 + 0.35 * Math.sin(q * Math.PI));
        glow(x, yy, z * 0.9, pc.v === 1 ? "255,190,70" : "70,240,220", env * 0.7);
        if (img) ctx.drawImage(img, x - z / 2, yy - z / 2, z, z);
      });
      once(e, "home", 0.88, p, () => { els.board.classList.remove("grand-pieces-away"); AUDIO() && AUDIO().playFinaleSeal && AUDIO().playFinaleSeal(); });
      if (p > 0.86) glow(cx, cy, g.B.w * 1.2 * seg(p, 0.86, 1), "255,240,200", (1 - seg(p, 0.86, 1)) * 0.8);
    },
    end() { els.board.classList.remove("grand-pieces-away"); }
  };


  /* ============================================ v11 N11 棋盤大迴旋（平面旋轉） */
  FX.spin = {
    title: "棋盤大迴旋", kicker: "奧義・其十一", sub: "GRAND BOARD SPIN", tone: "gold", dur: 2500,
    begin(e) {
      const st = els.frame.style;
      e.data.prev = { transform: st.transform, transition: st.transition };
      e.data.B = geom().B;
      st.transition = "none";
      cueSound("spin");
    },
    draw(e, g, p) {
      g = Object.assign({}, g, { B: e.data.B || g.B });
      const q = easeInOut(seg(p, 0.06, 0.86));
      const ang = 720 * q, speed = Math.sin(Math.PI * q);
      const sc = 1 + 0.2 * speed;
      els.frame.style.transform = `rotate(${ang}deg) scale(${sc})`;
      const env = bell(p, 0, 0.08, 0.88, 1);
      vignette(g, env * 0.75, "24,12,0");
      const cx = g.B.cx, cy = g.B.cy, rad = ang * Math.PI / 180;
      drawBagua(cx, cy, g.B.w * 0.86 * sc, -rad * 0.6, "255,214,120", env * 0.75);
      // 旋風氣流：由棋盤邊緣一路甩到兩側角色區
      const arms = Math.round(14 * Math.max(0.6, quality()));
      for (let k = 0; k < arms; k++) {
        const r = g.B.w * (0.62 + (k % 5) * 0.16) * (1 + speed * 0.5);
        const a0 = rad * 1.25 + k * TAU / arms;
        ctx.strokeStyle = `rgba(255,${200 + (k % 3) * 20},${120 + (k % 2) * 80},${clamp(env * (0.25 + speed * 0.6))})`;
        ctx.lineWidth = 2 + (k % 4) * 2.5 * speed;
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.72, 0, a0, a0 + 0.7 + speed * 1.1); ctx.stroke();
      }
      // 被甩出去的火花
      const n = Math.round(110 * quality());
      for (let i = 0; i < n; i++) {
        const t = (p * 2.4 + rnd(i)) % 1;
        const a = rnd(i * 3.1) * TAU + rad * 0.8;
        const r = g.B.w * 0.5 + t * g.D * 0.45;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.75;
        ctx.fillStyle = `rgba(255,${210 + (i % 4) * 10},140,${clamp(env * speed * (1 - t))})`;
        ctx.fillRect(x, y, 3 + speed * 3, 3);
      }
      glow(cx, cy, g.B.w * 0.75, "255,190,70", env * 0.35 * speed);
      once(e, "stop", 0.86, p, () => { cueSound("spinStop"); shake(12, 420); });
    },
    end(e) {
      const st = els.frame.style, pv = e.data.prev || {};
      st.transform = pv.transform || ""; st.transition = pv.transition || "";
    }
  };

  /* ================================================ v11 N13 狐火焚盤 */
  let flameSprite = null;
  function getFlameSprite() {
    if (flameSprite) return flameSprite;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const f = c.getContext("2d");
    const gr = f.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(235,255,255,1)"); gr.addColorStop(0.25, "rgba(110,240,255,.9)");
    gr.addColorStop(0.6, "rgba(30,120,255,.35)"); gr.addColorStop(1, "rgba(10,40,160,0)");
    f.fillStyle = gr; f.fillRect(0, 0, 64, 64);
    return (flameSprite = c);
  }

  FX.foxfire = {
    title: "狐火焚盤", kicker: "奧義・其十三", sub: "FOXFIRE INFERNO", tone: "jade", dur: 2800,
    begin(e) {
      cueSound("foxfire");
      const n = Math.max(280, Math.round(760 * quality()));
      e.data.f = Array.from({ length: n }, (_, i) => ({ u: rnd(i * 1.7), ph: rnd(i * 2.3), sp: 0.7 + rnd(i * 3.9) * 0.8, sz: 34 + rnd(i * 5.3) * 60, w: rnd(i * 7.1) * TAU }));
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.06, 0.9, 1);
      veil(env * 0.55, "0,6,20");
      const B = g.B, S = getFlameSprite();
      const grow = easeOut(seg(p, 0.02, 0.32)) * (1 - easeIn(seg(p, 0.62, 0.8)));
      const t = (performance.now() - e.start) / 1000;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // 盤框一圈藍色火牆；左右兩側的火舌橫向噴進角色區
      e.data.f.forEach((f) => {
        const per = f.u * 4, side = Math.floor(per), s = per - side;
        let x, y, ox = 0, oy = -1;
        if (side === 0) { x = B.x + s * B.w; y = B.y; }
        else if (side === 1) { x = B.x + B.w; y = B.y + s * B.h; ox = 1; oy = -0.35; }
        else if (side === 2) { x = B.x + (1 - s) * B.w; y = B.y + B.h; }
        else { x = B.x; y = B.y + (1 - s) * B.h; ox = -1; oy = -0.35; }
        const life = (t * f.sp + f.ph) % 1;
        const reach = (side % 2 ? g.W * 0.26 : B.h * 0.55) * grow;
        const px = x + ox * life * reach + Math.sin(t * 6 + f.w) * 10;
        const py = y + oy * life * (side % 2 ? B.h * 0.4 : reach) * grow + (side % 2 ? 0 : 0);
        const z = f.sz * (1 - life * 0.75) * (0.4 + grow * 0.8);
        if (z < 2) return;
        ctx.globalAlpha = clamp(env * (1 - life) * 0.7);
        ctx.drawImage(S, px - z * 0.35, py - z * 0.75, z * 0.7, z * 1.5);   // 拉長成火舌
      });
      // 盤框底部的火焰光帶
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(80,220,255,${clamp(env * grow * 0.55)})`; ctx.lineWidth = 26 * grow + 2;
      ctx.strokeRect(B.x, B.y, B.w, B.h);
      ctx.strokeStyle = `rgba(230,255,255,${clamp(env * grow * 0.8)})`; ctx.lineWidth = 4;
      ctx.strokeRect(B.x, B.y, B.w, B.h);
      // 棋盤格線被點燃
      const lineA = env * bell(p, 0.12, 0.25, 0.6, 0.75);
      if (lineA > 0) {
        const S2 = g.S;
        for (let k = 1; k < 3; k++) {
          polyline([[S2.x + S2.w * k / 3, S2.y + 6], [S2.x + S2.w * k / 3, S2.y + S2.h - 6]], "70,220,255", 2.2, lineA, "#e8ffff");
          polyline([[S2.x + 6, S2.y + S2.h * k / 3], [S2.x + S2.w - 6, S2.y + S2.h * k / 3]], "70,220,255", 2.2, lineA, "#e8ffff");
        }
      }
      ctx.restore();
      // 火勢收攏成九團狐火，繞盤一圈後衝向中央
      if (p > 0.6) {
        const q = seg(p, 0.6, 0.94);
        once(e, "orbs", 0.6, p, () => cueSound("foxOrbs"));
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + q * TAU * 1.3;
          const r = B.w * 0.78 * (1 - easeIn(seg(q, 0.6, 1)));
          const x = B.cx + Math.cos(a) * r, y = B.cy + Math.sin(a) * r * 0.75;
          glow(x, y, 34 + 20 * Math.sin(t * 9 + i), "70,230,255", env);
          glow(x, y, 10, "240,255,255", env);
        }
        once(e, "boom", 0.93, p, () => { cueSound("foxBoom"); shake(16, 480); });
        if (p > 0.93) glow(B.cx, B.cy, g.D * 0.4 * seg(p, 0.93, 1), "120,240,255", (1 - seg(p, 0.93, 1)) * 0.9);
      }
    }
  };


  /* ======================================================================
     v12 新增 8 招：第 1、2 手專屬，以及 6 招「替補奧義」——
     同一局裡狐眼／水墨封／天雷若要第二次出現，就改播替補招，保證每一手的奧義都不一樣
     ====================================================================== */
  const tinted = {};
  function flameOf(rgbCore, rgbMid, rgbEdge) {
    const key = rgbCore + rgbMid + rgbEdge;
    if (tinted[key]) return tinted[key];
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const f = c.getContext("2d"), gr = f.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgbCore},1)`); gr.addColorStop(0.3, `rgba(${rgbMid},.85)`);
    gr.addColorStop(0.65, `rgba(${rgbEdge},.3)`); gr.addColorStop(1, `rgba(${rgbEdge},0)`);
    f.fillStyle = gr; f.fillRect(0, 0, 64, 64);
    return (tinted[key] = c);
  }
  const target = (e, g) => g.cell(e.opts.index == null ? 4 : e.opts.index);

  /* ---------------- N14 五芒天光陣（第 1 手） ---------------- */
  FX.pentagram = {
    title: "五芒天光陣", kicker: "奧義・其十四", sub: "PENTAGRAM OF HEAVEN", tone: "gold", dur: 2500,
    begin() { cueSound("pentagram"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.06, 0.88, 1);
      veil(env * 0.55, "16,8,0");
      const cx = g.B.cx, cy = g.B.cy, R = Math.min(g.H * 0.47, g.W * 0.36);
      const P = [0, 2, 4, 1, 3, 0].map((k) => [cx + Math.cos(-Math.PI / 2 + k * TAU / 5) * R, cy + Math.sin(-Math.PI / 2 + k * TAU / 5) * R]);
      const q = easeInOut(seg(p, 0.05, 0.42)) * 5;
      const pts = [P[0]];
      for (let i = 0; i < 5; i++) {
        if (q <= i) break;
        const t = Math.min(1, q - i);
        pts.push([mix(P[i][0], P[i + 1][0], t), mix(P[i][1], P[i + 1][1], t)]);
      }
      const fade = 1 - seg(p, 0.82, 0.96);
      polyline(pts, "255,200,80", 4, env * fade, "#fff6d0");
      ctx.strokeStyle = `rgba(255,214,120,${clamp(env * fade * 0.85)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, -Math.PI / 2, -Math.PI / 2 + TAU * seg(p, 0.05, 0.42)); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, Math.PI / 2, Math.PI / 2 - TAU * seg(p, 0.1, 0.46), true); ctx.stroke();
      // 九字真言沿外圈浮現
      const words = "臨兵鬥者皆陣列在前";
      ctx.fillStyle = `rgba(255,226,150,${clamp(env * fade * seg(p, 0.2, 0.4))})`;
      ctx.font = `900 ${Math.round(R * 0.11)}px "DFKai-SB","KaiTi","Noto Serif TC",serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + i * TAU / 9 + p * 0.6;
        ctx.save(); ctx.translate(cx + Math.cos(a) * R * 1.28, cy + Math.sin(a) * R * 1.28); ctx.rotate(a + Math.PI / 2);
        ctx.fillText(words[i], 0, 0); ctx.restore();
      }
      // 五道天光柱
      const pil = bell(p, 0.4, 0.5, 0.72, 0.84);
      for (let k = 0; k < 5; k++) {
        const [x, y] = P[k];
        once(e, "pillar" + k, 0.4 + k * 0.03, p, () => cueSound("pillar", k));
        const w = 46 * pil;
        const gr = ctx.createLinearGradient(x - w, 0, x + w, 0);
        gr.addColorStop(0, "rgba(255,210,100,0)"); gr.addColorStop(0.5, `rgba(255,250,220,${clamp(pil * env)})`); gr.addColorStop(1, "rgba(255,210,100,0)");
        ctx.fillStyle = gr; ctx.fillRect(x - w, 0, w * 2, y);
        glow(x, y, 70, "255,220,120", pil * env);
      }
      // 光柱匯聚到你剛下的那一格
      const [tx, ty, cw] = target(e, g);
      const cv = seg(p, 0.66, 0.8);
      if (cv > 0 && cv < 1) for (let k = 0; k < 5; k++) polyline([P[k], [mix(P[k][0], tx, cv), mix(P[k][1], ty, cv)]], "255,210,100", 3, env, "#fffbe8");
      once(e, "hit", 0.8, p, () => { cueSound("pentaHit"); shake(14, 460); });
      if (p > 0.8) glow(tx, ty, cw * (1 + seg(p, 0.8, 1) * 4), "255,230,150", (1 - seg(p, 0.8, 1)));
    }
  };

  /* ---------------- N15 九尾展屏（第 2 手） ---------------- */
  FX.ninetails = {
    title: "九尾展屏", kicker: "奧義・其十五", sub: "NINE-TAILED FAN", tone: "jade", dur: 2700,
    begin() { cueSound("ninetails"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.06, 0.9, 1);
      veil(env * 0.6, "0,8,16");
      const ox = g.B.cx, oy = g.B.y + g.B.h * 0.92;
      const open = easeOut(seg(p, 0.05, 0.38)) * (1 - easeInOut(seg(p, 0.72, 0.94)));
      const L = g.D * 0.48, t = (performance.now() - e.start) / 1000;
      for (let k = 0; k < 9; k++) {
        const base = -Math.PI / 2 + (k - 4) * 0.33 * open;
        const sway = Math.sin(t * 2.2 + k) * 0.08;
        const a = base + sway, perp = a + Math.PI / 2;
        const ex = ox + Math.cos(a) * L, ey = oy + Math.sin(a) * L;
        const c1 = [ox + Math.cos(a - 0.25) * L * 0.4, oy + Math.sin(a - 0.25) * L * 0.4];
        const c2 = [ox + Math.cos(a + 0.2) * L * 0.75, oy + Math.sin(a + 0.2) * L * 0.75];
        const W0 = L * 0.075;
        const gr = ctx.createLinearGradient(ox, oy, ex, ey);
        gr.addColorStop(0, "rgba(255,248,240,.95)"); gr.addColorStop(0.6, "rgba(210,240,255,.92)"); gr.addColorStop(0.9, "rgba(80,230,230,.9)"); gr.addColorStop(1, "rgba(40,200,220,.2)");
        ctx.globalAlpha = clamp(env);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(perp) * W0 * 0.4, oy + Math.sin(perp) * W0 * 0.4);
        ctx.bezierCurveTo(c1[0] + Math.cos(perp) * W0 * 1.4, c1[1] + Math.sin(perp) * W0 * 1.4, c2[0] + Math.cos(perp) * W0 * 1.6, c2[1] + Math.sin(perp) * W0 * 1.6, ex, ey);
        ctx.bezierCurveTo(c2[0] - Math.cos(perp) * W0 * 1.6, c2[1] - Math.sin(perp) * W0 * 1.6, c1[0] - Math.cos(perp) * W0 * 1.4, c1[1] - Math.sin(perp) * W0 * 1.4, ox - Math.cos(perp) * W0 * 0.4, oy - Math.sin(perp) * W0 * 0.4);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.2;
        for (let s = 0; s < 4; s++) { ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.quadraticCurveTo(c2[0] + (s - 1.5) * W0 * 0.6, c2[1], ex, ey); ctx.stroke(); }
        ctx.globalAlpha = 1;
        glow(ex, ey, 60 + 20 * Math.sin(t * 8 + k), "60,230,240", env * open);
      }
      boardHole(g, 0.72);
      once(e, "snap", 0.72, p, () => cueSound("tailSnap"));
      if (p > 0.9) glow(ox, oy, g.D * 0.3 * seg(p, 0.9, 1), "120,240,255", (1 - seg(p, 0.9, 1)) * 0.8);
    }
  };

  /* ---------------- N18 時空裂隙（替補 3） ---------------- */
  FX.rift = {
    title: "時空裂隙", kicker: "奧義・其十八", sub: "DIMENSION RIFT", tone: "violet", dur: 2500,
    begin(e, g) {
      cueSound("rift");
      const [tx] = target(e, g);
      e.data.crack = Array.from({ length: 15 }, (_, i) => [tx + (rnd(i * 4.7) - 0.5) * 90 * Math.sin(i / 14 * Math.PI), -20 + i / 14 * (g.H + 40)]);
      e.data.stars = Array.from({ length: 120 }, (_, i) => [rnd(i * 1.9), rnd(i * 3.7), rnd(i * 5.9)]);
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      veil(env * 0.45, "10,0,20");
      const open = easeOut(seg(p, 0.08, 0.38)) * (1 - easeIn(seg(p, 0.7, 0.84)));
      const w = open * g.W * 0.26;
      const C = e.data.crack, [tx, ty] = target(e, g);
      const L = C.map(([x, y], i) => [x - w / 2 * Math.sin(i / 14 * Math.PI + 0.15), y]);
      const Rr = C.map(([x, y], i) => [x + w / 2 * Math.sin(i / 14 * Math.PI + 0.15), y]);
      if (w > 1) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
        L.forEach(([x, y]) => ctx.lineTo(x, y));
        for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
        ctx.closePath(); ctx.clip();
        ctx.fillStyle = "#06010f"; ctx.fillRect(0, 0, g.W, g.H);
        glow(tx, ty, g.W * 0.3, "160,60,255", 0.8); glow(tx + 60, ty - 120, g.W * 0.2, "255,60,180", 0.5);
        const rot = p * 4;
        e.data.stars.forEach(([a, b, c], i) => {
          const ang = a * TAU + rot * (0.3 + c), r = b * g.H * 0.6;
          ctx.fillStyle = `rgba(255,255,255,${0.4 + c * 0.6})`;
          ctx.fillRect(tx + Math.cos(ang) * r, ty + Math.sin(ang) * r * 0.5, 1.5 + c * 2, 1.5 + c * 2);
        });
        // 漩渦星系
        for (let k = 0; k < 2; k++) {
          const pts = [];
          for (let j = 0; j < 40; j++) { const t = j / 39, a = rot * 2 + k * Math.PI + t * 5; pts.push([tx + Math.cos(a) * t * g.H * 0.3, ty + Math.sin(a) * t * g.H * 0.15]); }
          polyline(pts, "200,140,255", 2, 0.7, "#fff");
        }
        ctx.restore();
        polyline(L, "220,120,255", 3, env, "#ffffff");
        polyline(Rr, "220,120,255", 3, env, "#ffffff");
      }
      // 碎片被吸進裂縫
      const n = Math.round(60 * quality());
      for (let i = 0; i < n; i++) {
        const k = (p * 1.8 + rnd(i)) % 1, side = i % 2 ? 1 : -1;
        const x = tx + side * (1 - k) * g.W * 0.5 * rnd(i * 2.9 + 1), y = rnd(i * 4.1) * g.H;
        ctx.fillStyle = `rgba(230,200,255,${clamp(env * open * k)})`; ctx.fillRect(x, y, 3, 3);
      }
      once(e, "close", 0.82, p, () => { cueSound("riftClose"); shake(16, 500); });
      if (p > 0.82) { const q = seg(p, 0.82, 1); polyline(C, "255,220,255", 6, 1 - q, "#fff"); glow(tx, ty, g.D * 0.3 * q, "220,150,255", (1 - q) * 0.8); }
    }
  };

  /* ---------------- N19 鳳凰涅槃（替補 4） ---------------- */
  FX.phoenix = {
    title: "鳳凰涅槃", kicker: "奧義・其十九", sub: "PHOENIX REBIRTH", tone: "blood", dur: 2800,
    begin(e, g) {
      cueSound("phoenix");
      const [tx, ty] = target(e, g);
      const pts = [];
      for (let i = 0; i <= 80; i++) { const t = i / 80; pts.push([mix(-g.W * 0.15, g.W * 1.1, t), g.H * (0.55 - 0.42 * Math.sin(t * Math.PI))]); }
      for (let i = 1; i <= 40; i++) { const t = i / 40; pts.push([mix(g.W * 1.1, g.W * 0.85, t) + Math.sin(t * Math.PI) * 60, mix(g.H * 0.55, g.H * 0.08, t)]); }
      const last = pts[pts.length - 1];
      for (let i = 1; i <= 30; i++) { const t = i / 30; pts.push([mix(last[0], tx, t), mix(last[1], ty, easeIn(t))]); }
      e.data.path = samplePath(pts);
      e.data.fire = flameOf("255,250,220", "255,170,50", "255,60,20");
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      veil(env * 0.5, "24,4,0");
      const P = e.data.path, S = e.data.fire;
      const s = P.total * easeInOut(seg(p, 0.03, 0.76));
      const t = (performance.now() - e.start) / 1000;
      // 火焰尾跡
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const n = Math.round(70 * Math.max(0.5, quality()));
      for (let i = 0; i < n; i++) {
        const back = i * 9, [x, y] = at(P, s - back);
        if (s - back < 0) break;
        const z = 70 * (1 - i / n) + 10;
        ctx.globalAlpha = clamp(env * (1 - i / n));
        ctx.drawImage(S, x - z / 2 + Math.sin(t * 9 + i) * 6, y - z / 2, z, z);
      }
      ctx.restore();
      if (p < 0.78) {
        const [x, y, ang] = at(P, s);
        const span = Math.min(g.W * 0.32, 520), flap = Math.sin(t * 9) * 0.55;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        glow(0, 0, span * 0.6, "255,140,40", env * 0.6);
        for (const side of [-1, 1]) {
          ctx.save(); ctx.scale(1, side); ctx.rotate(-0.2 - flap * 0.6);
          const gr = ctx.createLinearGradient(0, 0, -span * 0.3, -span * 0.5);
          gr.addColorStop(0, "#fff3c0"); gr.addColorStop(0.4, "#ffb030"); gr.addColorStop(1, "rgba(230,40,10,.2)");
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.moveTo(10, 0);
          ctx.bezierCurveTo(-span * 0.1, -span * 0.35, -span * 0.25, -span * 0.55, -span * 0.55, -span * 0.5);
          for (let f = 0; f < 6; f++) ctx.quadraticCurveTo(-span * (0.5 - f * 0.06), -span * (0.38 - f * 0.06), -span * (0.45 - f * 0.07), -span * (0.3 - f * 0.05));
          ctx.quadraticCurveTo(-span * 0.15, -span * 0.05, -20, 0); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "#fff7d8"; ctx.beginPath(); ctx.ellipse(0, 0, 46, 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffcf50"; ctx.beginPath(); ctx.moveTo(48, -6); ctx.lineTo(74, 0); ctx.lineTo(48, 6); ctx.fill();
        ctx.strokeStyle = "#ff7a1a"; ctx.lineWidth = 5;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-40, 0); ctx.bezierCurveTo(-120, k * 30 + Math.sin(t * 6 + k) * 20, -200, k * 50, -280, k * 70 + Math.sin(t * 5 + k) * 30); ctx.stroke(); }
        ctx.restore();
      }
      const [tx, ty, cw] = target(e, g);
      once(e, "burst", 0.76, p, () => { cueSound("phoenixBurst"); shake(18, 560); });
      if (p > 0.76) {
        const q = seg(p, 0.76, 1);
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const nf = Math.round(90 * quality()) + 20;
        for (let i = 0; i < nf; i++) {
          const a = rnd(i * 1.7) * TAU, r = easeOut(q) * g.D * (0.15 + rnd(i * 3.3) * 0.35), z = 50 * (1 - q) + 8;
          ctx.globalAlpha = clamp(1 - q);
          ctx.drawImage(S, tx + Math.cos(a) * r - z / 2, ty + Math.sin(a) * r * 0.8 - z / 2 - q * 60, z, z);
        }
        ctx.restore();
        glow(tx, ty, cw * 3, "255,200,100", 1 - q);
      }
    }
  };

  /* ---------------- N20 萬符天幕（替補 5） ---------------- */
  let ofuda = null;
  function getOfuda() {
    if (ofuda) return ofuda;
    const c = document.createElement("canvas"); c.width = 40; c.height = 104;
    const f = c.getContext("2d");
    f.fillStyle = "#f4dc84"; f.fillRect(0, 0, 40, 104);
    f.strokeStyle = "#b8201a"; f.lineWidth = 2; f.strokeRect(3, 3, 34, 98);
    f.beginPath(); f.arc(20, 18, 8, 0, TAU); f.stroke();
    f.lineWidth = 3; f.lineCap = "round";
    [[20, 32, 20, 90], [10, 46, 30, 46], [12, 62, 28, 58], [10, 76, 30, 80]].forEach(([a, b, c2, d]) => { f.beginPath(); f.moveTo(a, b); f.lineTo(c2, d); f.stroke(); });
    return (ofuda = c);
  }
  FX.talisman = {
    title: "萬符天幕", kicker: "奧義・其二十", sub: "TEN THOUSAND TALISMANS", tone: "gold", dur: 2800,
    begin(e, g) {
      cueSound("talismanRain");
      const cols = Math.round(g.W / 46), rows = Math.round(g.H / 92);
      const all = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) all.push([c, r]);
      const keep = Math.max(0.35, quality());
      e.data.p = all.filter((_, i) => rnd(i * 7.7) < keep).map(([c, r], i) => ({
        x: (c + 0.5) * g.W / cols + (rnd(i * 2.1) - 0.5) * 18, y: (r + 0.5) * g.H / rows, rot: (rnd(i * 3.3) - 0.5) * 0.5,
        t0: rnd(i * 5.1) * 0.25, sw: rnd(i * 6.7) * TAU
      }));
      e.data.fire = flameOf("255,250,210", "255,160,40", "220,50,10");
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.04, 0.92, 1);
      veil(env * 0.35, "20,10,0");
      const O = getOfuda(), F = e.data.fire, [tx, ty] = target(e, g);
      once(e, "ignite", 0.5, p, () => cueSound("ignite"));
      e.data.p.forEach((o) => {
        const fall = easeOut(seg(p, o.t0, o.t0 + 0.25));
        if (fall <= 0) return;
        const y = mix(-120, o.y, fall), x = o.x + Math.sin(p * 10 + o.sw) * 14 * (1 - fall);
        const d = Math.hypot(o.x - tx, o.y - ty) / g.D;
        const burnAt = 0.5 + d * 0.38, b = seg(p, burnAt, burnAt + 0.1);
        if (b >= 1) return;
        ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot + Math.sin(p * 8 + o.sw) * 0.08 * (1 - fall));
        ctx.globalAlpha = clamp(env * (1 - b));
        ctx.drawImage(O, -20, -52 * (1 - b * 0.8), 40, 104 * (1 - b * 0.8));
        ctx.restore();
        if (b > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = clamp(1 - b); ctx.drawImage(F, x - 40, y - 60 + b * -30, 80, 100); ctx.restore(); }
      });
      if (p > 0.5) glow(tx, ty, g.D * 0.5 * seg(p, 0.5, 0.9), "255,170,60", env * 0.4 * (1 - seg(p, 0.8, 1)));
    }
  };

  /* ======================================================================
     v13 四招重磅替換：萬劍歸宗（替補）、鬼神巨口（替補）、
     八岐大蛇（第 7 手，取代九宮離散）、天照日輪（你第一次成線，取代金龍）
     ====================================================================== */

  /* ---------------- N16 萬劍歸宗 ---------------- */
  let swordSprite = null;
  function getSword() {
    if (swordSprite) return swordSprite;
    const c = document.createElement("canvas"); c.width = 44; c.height = 220;
    const f = c.getContext("2d");
    // 劍刃（劍尖朝下）
    const gr = f.createLinearGradient(12, 0, 32, 0);
    gr.addColorStop(0, "#7e93a8"); gr.addColorStop(0.45, "#ffffff"); gr.addColorStop(0.55, "#d8e6f2"); gr.addColorStop(1, "#6d7f92");
    f.fillStyle = gr;
    f.beginPath(); f.moveTo(14, 62); f.lineTo(30, 62); f.lineTo(30, 196); f.lineTo(22, 218); f.lineTo(14, 196); f.closePath(); f.fill();
    f.strokeStyle = "rgba(120,240,255,.9)"; f.lineWidth = 1.5; f.stroke();
    f.fillStyle = "rgba(255,255,255,.8)"; f.fillRect(21, 64, 2, 140);
    // 護手（金）與握柄
    f.fillStyle = "#e3b440"; f.beginPath(); f.ellipse(22, 56, 20, 7, 0, 0, TAU); f.fill();
    f.fillStyle = "#3a1a10"; f.fillRect(17, 4, 10, 48);
    f.strokeStyle = "#c9a24a"; f.lineWidth = 1.5;
    for (let y = 8; y < 50; y += 6) { f.beginPath(); f.moveTo(17, y); f.lineTo(27, y + 4); f.stroke(); }
    f.fillStyle = "#e3b440"; f.fillRect(15, 0, 14, 5);
    return (swordSprite = c);
  }

  FX.swords = {
    title: "萬劍歸宗", kicker: "奧義・其十六", sub: "TEN THOUSAND SWORDS", tone: "storm", dur: 3000,
    begin(e, g) {
      cueSound("swordRain");
      const [tx, ty] = target(e, g);
      const n = Math.max(90, Math.round(240 * quality()));
      e.data.s = Array.from({ length: n }, (_, i) => {
        const ring = 0.12 + rnd(i * 1.7) * 0.62, a = rnd(i * 2.9) * TAU;
        return { x: tx + Math.cos(a) * ring * g.W * 0.75, y: ty + Math.sin(a) * ring * g.H * 0.75, t0: rnd(i * 4.3) * 0.32, sc: 0.6 + rnd(i * 6.1) * 0.7, tilt: (rnd(i * 8.9) - 0.5) * 0.35 };
      });
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.04, 0.92, 1);
      veil(env * 0.6, "4,8,20");
      const Sw = getSword(), [tx, ty, cw] = target(e, g);
      const lift = easeInOut(seg(p, 0.5, 0.62)), fire = easeIn(seg(p, 0.68, 0.84));
      let stabbed = 0;
      e.data.s.forEach((s, i) => {
        const fall = seg(p, s.t0, s.t0 + 0.12);
        if (fall <= 0) return;
        if (fall >= 1) stabbed++;
        const fy = mix(-260, s.y, easeIn(fall));
        // 插地 → 浮起轉向目標 → 齊射
        const aim = Math.atan2(ty - s.y, tx - s.x) - Math.PI / 2;
        const ang = mix(s.tilt, aim, lift);
        const hx = mix(s.x, tx, fire), hy = mix(fy - lift * 40, ty, fire);
        if (fire >= 1) return;
        const h = 220 * s.sc, w = 44 * s.sc;
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
        ctx.globalAlpha = clamp(env);
        ctx.drawImage(Sw, -w / 2, -h * 0.98, w, h);
        ctx.restore();
        if (fall < 1) { ctx.strokeStyle = `rgba(180,230,255,${clamp(0.5 * env)})`; ctx.lineWidth = 2 * s.sc; ctx.beginPath(); ctx.moveTo(s.x, fy - h); ctx.lineTo(s.x, fy - h - 160 * s.sc); ctx.stroke(); }
        else if (lift < 0.05 && fall < 1.0001) glow(s.x, s.y, 16 * s.sc, "160,230,255", env * (1 - seg(p, s.t0 + 0.12, s.t0 + 0.2)));
        if (lift > 0) glow(hx, hy, 18 * s.sc, "150,230,255", env * lift * 0.6);
      });
      if (stabbed > (e.data.lastStab || 0) + 12) { e.data.lastStab = stabbed; cueSound("swordStab"); shake(5, 160); }
      once(e, "rise", 0.5, p, () => cueSound("swordRise"));
      once(e, "fire", 0.68, p, () => cueSound("swordFire"));
      once(e, "boom", 0.84, p, () => { cueSound("swordBoom"); shake(26, 700); });
      if (p > 0.84) {
        const q = seg(p, 0.84, 1);
        if (q < 0.15) veil((1 - q / 0.15) * 0.95, "235,248,255");
        ctx.save(); ctx.translate(tx, ty);
        for (let i = 0; i < 24; i++) {
          ctx.rotate(TAU / 24);
          ctx.fillStyle = `rgba(200,240,255,${clamp((1 - q) * 0.6)})`;
          ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(g.D * easeOut(q), 0); ctx.lineTo(0, 6); ctx.fill();
        }
        ctx.restore();
        for (let r = 0; r < 3; r++) {
          const rq = seg(q, r * 0.1, 0.8);
          ctx.strokeStyle = `rgba(190,235,255,${clamp(1 - rq)})`; ctx.lineWidth = 14 * (1 - rq) + 2;
          ctx.beginPath(); ctx.arc(tx, ty, easeOut(rq) * g.D * 0.6, 0, TAU); ctx.stroke();
        }
        glow(tx, ty, cw * 3, "230,250,255", 1 - q);
      }
    }
  };

  /* ---------------- N17 鬼神巨口 ---------------- */


  /* ---------------- N12 八岐大蛇（第 7 手） ---------------- */
  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  function serpentHead(x, y, ang, S, open, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = clamp(a);
    const jawA = 0.15 + open * 0.55;
    // 下顎
    ctx.save(); ctx.rotate(jawA);
    ctx.fillStyle = "#1c2a1a"; ctx.beginPath(); ctx.moveTo(-S * 0.2, 0); ctx.lineTo(S * 1.1, S * 0.05); ctx.lineTo(S * 0.9, S * 0.28); ctx.lineTo(-S * 0.2, S * 0.3); ctx.fill();
    ctx.fillStyle = "#fff6e0"; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(S * (0.25 + k * 0.2), S * 0.05); ctx.lineTo(S * (0.32 + k * 0.2), -S * 0.12); ctx.lineTo(S * (0.38 + k * 0.2), S * 0.05); ctx.fill(); }
    ctx.restore();
    // 口內紅光
    glow(S * 0.5, S * 0.12, S * 0.5 * open + 4, "255,40,20", open * a);
    // 上顎與頭骨
    ctx.save(); ctx.rotate(-jawA * 0.6);
    const hg = ctx.createLinearGradient(0, -S * 0.5, 0, S * 0.1);
    hg.addColorStop(0, "#0d160c"); hg.addColorStop(1, "#3c5a2c");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-S * 0.3, S * 0.05); ctx.quadraticCurveTo(-S * 0.1, -S * 0.55, S * 0.5, -S * 0.32); ctx.lineTo(S * 1.2, -S * 0.04); ctx.lineTo(S * 1.15, S * 0.06); ctx.lineTo(-S * 0.3, S * 0.12); ctx.fill();
    ctx.fillStyle = "#fff6e0";
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(S * (0.3 + k * 0.2), S * 0.06); ctx.lineTo(S * (0.37 + k * 0.2), S * (k === 0 ? 0.34 : 0.2)); ctx.lineTo(S * (0.43 + k * 0.2), S * 0.06); ctx.fill(); }
    // 角
    ctx.strokeStyle = "#c9b48a"; ctx.lineWidth = S * 0.07;
    ctx.beginPath(); ctx.moveTo(S * 0.05, -S * 0.32); ctx.quadraticCurveTo(-S * 0.3, -S * 0.7, -S * 0.6, -S * 0.62); ctx.stroke();
    ctx.restore();
    ctx.restore();
    glow(x + Math.cos(ang - 0.5) * S * 0.45, y + Math.sin(ang - 0.5) * S * 0.45, S * 0.16, "255,30,10", a);
    glow(x + Math.cos(ang - 0.5) * S * 0.45, y + Math.sin(ang - 0.5) * S * 0.45, S * 0.05, "255,240,200", a);
  }

  FX.orochi = {
    title: "八岐大蛇", kicker: "奧義・其十二", sub: "YAMATA NO OROCHI", tone: "blood", dur: 3200,
    begin(e, g) {
      cueSound("orochiRise");
      const bases = [[0.02, 1.08], [0.14, 1.12], [0.3, 1.12], [0.42, 1.14], [0.58, 1.14], [0.7, 1.12], [0.86, 1.12], [0.98, 1.08]];
      e.data.n = bases.map(([bx, by], i) => ({ bx: bx * g.W, by: by * g.H, side: bx < 0.5 ? -1 : 1, i }));
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      veil(env * 0.62, "6,10,4");
      vignette(g, env * 0.7, "40,0,0");
      const t = (performance.now() - e.start) / 1000;
      const rise = easeOut(seg(p, 0.04, 0.36));
      const lunge = easeInOut(seg(p, 0.55, 0.68)) * (1 - easeInOut(seg(p, 0.82, 0.96)));
      const sink = easeIn(seg(p, 0.86, 1));
      const cx = g.B.cx, cy = g.B.cy;
      once(e, "roar", 0.36, p, () => { cueSound("orochiRoar"); shake(14, 900); });
      once(e, "strike", 0.62, p, () => { cueSound("orochiStrike"); shake(26, 640); });
      const order = e.data.n.slice().sort((a, b) => Math.abs(b.bx - g.W / 2) - Math.abs(a.bx - g.W / 2));
      order.forEach((n) => {
        const k = n.i;
        // 頭的停留點：在棋盤上方圍成扇形，張口示威
        const fan = (k - 3.5) / 3.5;
        const hx0 = cx + fan * g.W * 0.42 + Math.sin(t * 1.6 + k) * 26;
        const hy0 = g.H * (0.18 + Math.abs(fan) * 0.22) + Math.cos(t * 2 + k) * 18;
        const strikeX = cx + fan * g.B.w * 0.55, strikeY = cy + (Math.abs(fan) - 0.3) * g.B.h * 0.3;
        let hx = mix(hx0, strikeX, lunge), hy = mix(hy0, strikeY, lunge);
        hx = mix(n.bx, hx, rise); hy = mix(n.by + 80, hy, rise) + sink * g.H;
        const c1 = [n.bx + n.side * -40, mix(n.by, g.H * 0.65, rise)];
        const c2 = [mix(n.bx, hx, 0.4) - n.side * 120 * Math.sin(t * 1.3 + k), mix(n.by, hy, 0.75)];
        const pts = bez([n.bx, n.by + 60], c1, c2, [hx, hy], 26);
        const W0 = Math.min(g.W, g.H) * 0.075;
        // 蛇頸：暗鱗外層 → 墨綠 → 腹側亮紋
        [[1, "#0b1208"], [0.78, "#2e4a24"], [0.32, "#8a9a5a"]].forEach(([f, col]) => {
          ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.globalAlpha = clamp(env);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineWidth = W0 * f * (1.3 - i / pts.length * 0.5);
            ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
          }
        });
        ctx.strokeStyle = "rgba(10,20,8,.6)"; ctx.lineWidth = 1.5;
        for (let i = 2; i < pts.length - 1; i += 2) { const a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], W0 * 0.45, a + 0.6, a + 2.5); ctx.stroke(); }
        ctx.globalAlpha = 1;
        const last = pts[pts.length - 1], prev = pts[pts.length - 3];
        const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        const open = 0.35 + 0.5 * Math.abs(Math.sin(t * 3 + k)) * (1 - lunge) + lunge * 0.9;
        serpentHead(last[0], last[1], ang, W0 * 2.1, open, env);
      });
      if (lunge > 0.9) glow(cx, cy, g.B.w * 0.8, "255,60,30", env * 0.5);
    }
  };

  /* ---------------- N7 天照日輪（你第一次成線） ---------------- */
  FX.sun = {
    title: "天照・日輪降臨", kicker: "奧義・其七", sub: "AMATERASU SOLAR DESCENT", tone: "gold", dur: 3200,
    begin(e) { cueSound("sunRise"); e.data.line = e.opts.line && e.opts.line.length === 3 ? e.opts.line : [0, 4, 8]; },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      const cx = g.B.cx, R = Math.min(g.W, g.H) * 0.3;
      const cy = mix(-R * 1.3, g.B.cy, easeOut(seg(p, 0.02, 0.32)));
      veil(env * 0.35, "40,20,0");
      // 日冕光芒：長三角光束掃過整個畫面
      ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = clamp(env);
      const nr = 28, rot = p * 1.4;
      for (let i = 0; i < nr; i++) {
        const a = i / nr * TAU + rot + (i % 2 ? 0.05 : 0);
        const len = g.D * (i % 2 ? 0.55 : 0.9) * (0.6 + 0.4 * easeOut(seg(p, 0.1, 0.4)));
        const gr = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        gr.addColorStop(0, "rgba(255,250,210,.9)"); gr.addColorStop(0.4, "rgba(255,200,80,.35)"); gr.addColorStop(1, "rgba(255,140,20,0)");
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - 0.04) * len, Math.sin(a - 0.04) * len); ctx.lineTo(Math.cos(a + 0.04) * len, Math.sin(a + 0.04) * len); ctx.fill();
      }
      ctx.restore();
      // 日輪本體＋日珥
      glow(cx, cy, R * 2.4, "255,170,40", env * 0.8);
      const sg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.5, "#fff1a8"); sg.addColorStop(0.85, "#ffb12e"); sg.addColorStop(1, "#ff7a10");
      ctx.globalAlpha = clamp(env); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU + p * 2, h = R * (0.25 + 0.15 * Math.sin(p * 20 + k));
        ctx.strokeStyle = `rgba(255,120,30,${clamp(env * 0.8)})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, h, a + Math.PI * 0.6, a + Math.PI * 1.4, true); ctx.stroke();
      }
      boardHole(g, 0.6 * seg(p, 0.3, 0.45));
      // 沿著你的連線射出貫穿全螢幕的日光
      const L = e.data.line.map((i) => g.cell(i));
      const beam = bell(p, 0.42, 0.5, 0.74, 0.84);
      if (beam > 0) {
        const [ax, ay] = L[0], [bx, by] = L[2], dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1;
        const ex = g.D / dl;
        const pts = [[ax - dx * ex, ay - dy * ex], [bx + dx * ex, by + dy * ex]];
        polyline(pts, "255,200,80", 14 * beam, beam * env, "#ffffff");
        L.forEach(([x, y, w]) => glow(x, y, w * 1.4, "255,240,180", beam * env));
      }
      once(e, "beam", 0.45, p, () => { cueSound("sunBeam"); shake(12, 520); });
      // 超新星爆發
      once(e, "nova", 0.8, p, () => { cueSound("sunNova"); shake(28, 760); });
      if (p > 0.8) {
        const q = seg(p, 0.8, 1);
        if (q < 0.2) veil((1 - q / 0.2), "255,252,235");
        for (let r = 0; r < 4; r++) {
          const rq = seg(q, r * 0.08, 0.7 + r * 0.08);
          ctx.strokeStyle = `rgba(255,${220 - r * 30},120,${clamp(1 - rq)})`; ctx.lineWidth = 20 * (1 - rq) + 2;
          ctx.beginPath(); ctx.arc(cx, cy, R + easeOut(rq) * g.D * 0.7, 0, TAU); ctx.stroke();
        }
      }
    }
  };


  /* ======================================================================
     v14 新增 7 招：紅蓮業火（第 6 手）、雷神太鼓（第 4 手）、
     替補池：餓者髑髏、虛空黑洞、梵鐘鎮魂、羅生門、冰封萬里
     ====================================================================== */
  const fireSprite = () => flameOf("255,250,220", "255,150,40", "220,40,10");

  /* ---------------- 紅蓮業火（第 6 手） ---------------- */
  function petal(cx, cy, ang, len, wid, a, hot) {
    const tx = cx + Math.cos(ang) * len, ty = cy + Math.sin(ang) * len;
    const px = Math.cos(ang + Math.PI / 2) * wid, py = Math.sin(ang + Math.PI / 2) * wid;
    const gr = ctx.createLinearGradient(cx, cy, tx, ty);
    gr.addColorStop(0, "rgba(110,0,10,.95)"); gr.addColorStop(0.55, "rgba(230,40,30,.95)"); gr.addColorStop(0.9, hot ? "rgba(255,210,120,1)" : "rgba(255,120,60,.95)"); gr.addColorStop(1, "rgba(255,240,200,1)");
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx + Math.cos(ang) * len * 0.35 + px, cy + Math.sin(ang) * len * 0.35 + py, tx + px * 0.6 - Math.cos(ang) * len * 0.15, ty + py * 0.6 - Math.sin(ang) * len * 0.15, tx, ty);
    ctx.bezierCurveTo(tx - px * 0.6 - Math.cos(ang) * len * 0.15, ty - py * 0.6 - Math.sin(ang) * len * 0.15, cx + Math.cos(ang) * len * 0.35 - px, cy + Math.sin(ang) * len * 0.35 - py, cx, cy);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,200,120,.6)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    return [tx, ty];
  }

  FX.lotus = {
    title: "紅蓮業火", kicker: "奧義・其九", sub: "CRIMSON LOTUS INFERNO", tone: "blood", dur: 3000,
    begin() { cueSound("lotus"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      veil(env * 0.62, "30,0,4");
      const cx = g.B.cx, cy = g.B.cy, R = Math.min(g.W * 0.52, g.H * 0.8);
      const bloom = easeOut(seg(p, 0.04, 0.42)), t = (performance.now() - e.start) / 1000;
      const ignite = seg(p, 0.66, 0.74);
      const F = fireSprite();
      const tips = [];
      [[12, 1.0, 0.13, 0], [10, 0.76, 0.15, 0.3], [8, 0.52, 0.17, 0.6]].forEach(([n, lf, wf, off], layer) => {
        for (let i = 0; i < n; i++) {
          const open = mix(0.12, 1, bloom);
          const base = -Math.PI / 2 + ((i + off) / n - 0.5) * TAU * open;
          const sway = Math.sin(t * 3 + i + layer) * 0.04;
          const tip = petal(cx, cy, base + sway, R * lf * (0.35 + 0.65 * bloom), R * wf * (0.5 + 0.5 * bloom), env, layer === 2 || ignite > 0);
          if (layer === 0) tips.push(tip);
        }
      });
      boardHole(g, 0.62);
      // 花瓣尖端燃燒
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      tips.forEach(([x, y], i) => {
        for (let k = 0; k < 3; k++) {
          const life = (t * 1.6 + k / 3 + i * 0.13) % 1, z = (60 + 40 * ignite) * (1 - life);
          ctx.globalAlpha = clamp(env * (1 - life) * 0.9);
          ctx.drawImage(F, x - z / 2, y - z * 0.9 - life * 80, z, z * 1.4);
        }
      });
      // 點燃：每片外瓣噴出火柱
      if (ignite > 0) {
        const fa = 1 - seg(p, 0.82, 0.96);
        tips.forEach(([x, y]) => {
          const h = g.H * 0.9 * easeOut(ignite);
          const gr = ctx.createLinearGradient(x, y, x, y - h);
          gr.addColorStop(0, `rgba(255,240,200,${clamp(fa)})`); gr.addColorStop(0.4, `rgba(255,120,30,${clamp(fa * 0.8)})`); gr.addColorStop(1, "rgba(200,20,0,0)");
          ctx.globalAlpha = 1; ctx.fillStyle = gr;
          const w = 34 + Math.sin(performance.now() / 60 + x) * 8;
          ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.5, x + Math.sin(performance.now() / 120 + x) * 30, y - h);
          ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.5, x + w, y); ctx.fill();
        });
      }
      ctx.restore();
      once(e, "ignite", 0.66, p, () => { cueSound("lotusIgnite"); shake(24, 700); });
      if (p > 0.66 && p < 0.76) veil((1 - seg(p, 0.66, 0.72)) * 0.7, "255,200,140");
      glow(cx, cy, R * 0.5, "255,120,40", env * (0.4 + ignite * 0.5));
    }
  };

  /* ---------------- 雷神太鼓（第 4 手） ---------------- */
  function tomoe(x, y, r, rot, col) {
    ctx.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      const a = rot + k * TAU / 3;
      const hx = x + Math.cos(a) * r * 0.42, hy = y + Math.sin(a) * r * 0.42;
      ctx.beginPath(); ctx.arc(hx, hy, r * 0.28, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(a + 1.2) * r * 0.28, hy + Math.sin(a + 1.2) * r * 0.28);
      ctx.quadraticCurveTo(x + Math.cos(a + 1.6) * r * 0.9, y + Math.sin(a + 1.6) * r * 0.9, x + Math.cos(a + 2.4) * r * 0.62, y + Math.sin(a + 2.4) * r * 0.62);
      ctx.quadraticCurveTo(x + Math.cos(a + 1.3) * r * 0.6, y + Math.sin(a + 1.3) * r * 0.6, hx + Math.cos(a - 0.6) * r * 0.2, hy + Math.sin(a - 0.6) * r * 0.2);
      ctx.fill();
    }
  }
  FX.raiko = {
    title: "雷神太鼓", kicker: "奧義・其四", sub: "RAIJIN'S THUNDER DRUMS", tone: "storm", dur: 3100,
    begin() { cueSound("raikoStart"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      veil(env * 0.66, "2,4,20");
      const cx = g.B.cx, cy = g.B.cy, RX = g.W * 0.43, RY = g.H * 0.4, rot = p * 0.8;
      const grow = easeOut(seg(p, 0, 0.18));
      const N = 8, dr = Math.min(g.W, g.H) * 0.085 * grow;
      const pos = Array.from({ length: N }, (_, i) => { const a = -Math.PI / 2 + i * TAU / N + rot; return [cx + Math.cos(a) * RX, cy + Math.sin(a) * RY]; });
      // 雷神的連鼓環
      ctx.strokeStyle = `rgba(230,180,60,${clamp(env * 0.9)})`; ctx.lineWidth = 10 * grow;
      ctx.beginPath(); ctx.ellipse(cx, cy, RX, RY, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,200,${clamp(env * 0.6)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, RX, RY, 0, 0, TAU); ctx.stroke();
      pos.forEach(([x, y], i) => {
        const hit = seg(p, 0.14 + i * 0.06, 0.2 + i * 0.06), flash = hit > 0 && hit < 1 ? 1 - hit : 0;
        once(e, "drum" + i, 0.14 + i * 0.06, p, () => { cueSound("drum", i); shake(8, 200); });
        // 鼓身＋鼓皮＋三巴紋
        ctx.globalAlpha = clamp(env);
        ctx.fillStyle = "#6a1a10"; ctx.beginPath(); ctx.arc(x, y, dr * 1.12, 0, TAU); ctx.fill();
        ctx.fillStyle = "#e9d6a8"; ctx.beginPath(); ctx.arc(x, y, dr, 0, TAU); ctx.fill();
        ctx.fillStyle = "#e3b440"; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * dr * 1.06, y + Math.sin(a) * dr * 1.06, dr * 0.06, 0, TAU); ctx.fill(); }
        tomoe(x, y, dr * 0.8, p * 4 + i, "#b41c1c");
        ctx.globalAlpha = 1;
        if (flash > 0) {
          glow(x, y, dr * 3, "200,225,255", flash);
          ctx.strokeStyle = `rgba(210,230,255,${clamp(flash)})`; ctx.lineWidth = 6 * flash + 1;
          ctx.beginPath(); ctx.arc(x, y, dr * (1.2 + (1 - flash) * 4), 0, TAU); ctx.stroke();
          const [nx, ny] = pos[(i + 1) % N];
          polyline(bolt(x, y, nx, ny, 10, 50, e.seed + i * 7 + Math.floor(p * 60)), "150,190,255", 3, flash, "#ffffff");
        }
      });
      // 八鼓齊鳴：八道雷一起劈向棋盤
      const all = bell(p, 0.64, 0.66, 0.78, 0.86);
      if (all > 0) pos.forEach(([x, y], i) => polyline(bolt(x, y, cx, cy, 14, 60, e.seed + i * 13 + Math.floor(p * 50)), "150,190,255", 5, all, "#ffffff"));
      once(e, "all", 0.64, p, () => { cueSound("raikoAll"); shake(30, 760); });
      if (p > 0.64) {
        const q = seg(p, 0.64, 1);
        if (q < 0.12) veil((1 - q / 0.12) * 0.9, "230,240,255");
        for (let r = 0; r < 3; r++) { const rq = seg(q, r * 0.1, 0.75); ctx.strokeStyle = `rgba(170,210,255,${clamp(1 - rq)})`; ctx.lineWidth = 18 * (1 - rq) + 2; ctx.beginPath(); ctx.arc(cx, cy, easeOut(rq) * g.D * 0.65, 0, TAU); ctx.stroke(); }
        glow(cx, cy, g.B.w, "200,225,255", (1 - q) * 0.9);
      }
    }
  };

  /* ---------------- 餓者髑髏 ---------------- */
  function bone(x1, y1, x2, y2, w) {
    ctx.lineCap = "round"; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x1, y1, w * 0.62, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x2, y2, w * 0.62, 0, TAU); ctx.fill();
  }
  function skelHand(x, y, S, side, curl) {
    ctx.strokeStyle = "#ddd3b6"; ctx.fillStyle = "#ddd3b6";
    bone(x, y + S * 1.6, x + side * S * 0.06, y + S * 0.25, S * 0.16);
    bone(x - side * S * 0.12, y + S * 1.6, x - side * S * 0.02, y + S * 0.25, S * 0.12);
    ctx.beginPath(); ctx.ellipse(x, y, S * 0.34, S * 0.26, 0, 0, TAU); ctx.fill();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.34 * side - (f === 0 ? 0 : 0);
      let px = x + Math.cos(a) * S * 0.28, py = y + Math.sin(a) * S * 0.24;
      let ang = a, len = S * (f === 2 ? 0.34 : 0.3);
      for (let s = 0; s < 3; s++) {
        const nx = px + Math.cos(ang) * len, ny = py + Math.sin(ang) * len;
        bone(px, py, nx, ny, S * 0.075);
        px = nx; py = ny; ang += curl * 0.45 * side; len *= 0.78;
      }
    }
  }
  FX.gashadokuro = {
    title: "餓者髑髏", kicker: "奧義・其二十二", sub: "GASHADOKURO", tone: "jade", dur: 3100,
    begin() { cueSound("skullRise"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.9, 1);
      veil(env * 0.66, "4,10,6");
      const t = (performance.now() - e.start) / 1000;
      const S = g.H * 0.62, cx = g.B.cx;
      const rise = easeOut(seg(p, 0.03, 0.34)), sink = easeIn(seg(p, 0.84, 1));
      const cy = mix(g.H * 1.4, g.H * 0.3, rise) + sink * g.H;
      ctx.globalAlpha = clamp(env);
      // 頭骨
      const bg = ctx.createRadialGradient(cx - S * 0.15, cy - S * 0.25, S * 0.1, cx, cy, S * 0.7);
      bg.addColorStop(0, "#f3ecd6"); bg.addColorStop(0.6, "#c9bf9e"); bg.addColorStop(1, "#6e664e");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(cx, cy - S * 0.08, S * 0.46, S * 0.44, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - S * 0.36, cy + S * 0.05); ctx.quadraticCurveTo(cx - S * 0.34, cy + S * 0.36, cx - S * 0.18, cy + S * 0.4);
      ctx.lineTo(cx + S * 0.18, cy + S * 0.4); ctx.quadraticCurveTo(cx + S * 0.34, cy + S * 0.36, cx + S * 0.36, cy + S * 0.05); ctx.fill();
      ctx.fillStyle = "#050302";
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * S * 0.17, cy + S * 0.02, S * 0.13, S * 0.11, s * 0.25, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(cx, cy + S * 0.12); ctx.lineTo(cx - S * 0.05, cy + S * 0.24); ctx.lineTo(cx + S * 0.05, cy + S * 0.24); ctx.fill();
      // 牙齒與會開合的下顎
      const chat = Math.abs(Math.sin(t * 9)) * S * 0.05 * (1 - seg(p, 0.55, 0.6));
      ctx.fillStyle = "#ece4cc";
      for (let k = -4; k <= 4; k++) ctx.fillRect(cx + k * S * 0.036 - S * 0.015, cy + S * 0.31, S * 0.03, S * 0.08);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(cx - S * 0.3, cy + S * 0.36 + chat); ctx.quadraticCurveTo(cx, cy + S * 0.66 + chat, cx + S * 0.3, cy + S * 0.36 + chat); ctx.lineTo(cx + S * 0.2, cy + S * 0.42 + chat); ctx.lineTo(cx - S * 0.2, cy + S * 0.42 + chat); ctx.fill();
      ctx.fillStyle = "#ece4cc";
      for (let k = -4; k <= 4; k++) ctx.fillRect(cx + k * S * 0.036 - S * 0.015, cy + S * 0.4 + chat, S * 0.03, S * 0.07);
      ctx.strokeStyle = "rgba(60,50,30,.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + S * 0.05, cy - S * 0.48); ctx.lineTo(cx + S * 0.12, cy - S * 0.3); ctx.lineTo(cx + S * 0.07, cy - S * 0.2); ctx.lineTo(cx + S * 0.16, cy - S * 0.1); ctx.stroke();
      ctx.globalAlpha = 1;
      for (const s of [-1, 1]) { glow(cx + s * S * 0.17, cy + S * 0.02, S * 0.1, "80,255,140", env); glow(cx + s * S * 0.17, cy + S * 0.02, S * 0.03, "230,255,230", env); }
      boardHole(g, 0.45 * rise);
      // 兩隻巨手從兩側伸出，重重拍在棋盤左右
      const reach = easeOut(seg(p, 0.22, 0.48)), slam = easeIn(seg(p, 0.52, 0.6));
      for (const side of [-1, 1]) {
        const hx = g.B.cx + side * (g.B.w * 0.5 + g.H * 0.18);
        const hy = mix(g.H * 1.5, g.H * 0.28, reach) + slam * g.H * 0.34 + sink * g.H;
        ctx.globalAlpha = clamp(env);
        skelHand(hx, hy, g.H * 0.26, side, 0.6 + slam * 0.4);
        ctx.globalAlpha = 1;
      }
      once(e, "slam", 0.6, p, () => { cueSound("skullSlam"); shake(28, 720); });
      if (p > 0.6) {
        const q = seg(p, 0.6, 0.95);
        for (const side of [-1, 1]) {
          const x = g.B.cx + side * (g.B.w * 0.5 + g.H * 0.18), y = g.H * 0.75;
          for (let i = 0; i < 26; i++) { const a = -Math.PI * rnd(i * 3.1), r = easeOut(q) * g.H * 0.3 * (0.4 + rnd(i)); ctx.fillStyle = `rgba(190,180,150,${clamp((1 - q) * 0.8)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 6 + rnd(i * 2) * 10, 0, TAU); ctx.fill(); }
        }
      }
    }
  };

  /* ---------------- 虛空黑洞 ---------------- */

  /* ---------------- 梵鐘鎮魂 ---------------- */
  function drawBell(cx, top, H, W, rot, glowK) {
    ctx.save(); ctx.translate(cx, top); ctx.rotate(rot);
    const gr = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
    gr.addColorStop(0, "#3a2614"); gr.addColorStop(0.35, "#b88a4c"); gr.addColorStop(0.5, "#e2bb76"); gr.addColorStop(0.7, "#9a6c36"); gr.addColorStop(1, "#2e1d0e");
    ctx.fillStyle = "#4a3018"; ctx.lineWidth = W * 0.05; ctx.strokeStyle = "#5a3c1e";
    ctx.beginPath(); ctx.ellipse(0, -H * 0.04, W * 0.12, H * 0.07, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(-W * 0.4, H * 0.06);
    ctx.quadraticCurveTo(-W * 0.44, 0, 0, 0); ctx.quadraticCurveTo(W * 0.44, 0, W * 0.4, H * 0.06);
    ctx.lineTo(W * 0.46, H * 0.92); ctx.quadraticCurveTo(W * 0.5, H, W * 0.44, H); ctx.lineTo(-W * 0.44, H); ctx.quadraticCurveTo(-W * 0.5, H, -W * 0.46, H * 0.92); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(40,24,10,.8)"; ctx.lineWidth = 4;
    [0.12, 0.45, 0.58, 0.9].forEach((y) => { ctx.beginPath(); ctx.moveTo(-W * (0.41 + y * 0.05), H * y); ctx.lineTo(W * (0.41 + y * 0.05), H * y); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(0, H * 0.12); ctx.lineTo(0, H * 0.45); ctx.stroke();
    ctx.fillStyle = "#c79a58";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * W * (0.1 + c * 0.075), H * (0.17 + r * 0.075), W * 0.022, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#3a2614"; ctx.beginPath(); ctx.arc(-W * 0.22, H * 0.72, W * 0.07, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,220,140,${clamp(0.4 + glowK * 0.6)})`;
    ctx.font = `900 ${Math.round(W * 0.24)}px "DFKai-SB","KaiTi","Noto Serif TC",serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("鎮", W * 0.12, H * 0.74);
    ctx.restore();
  }
  FX.bell = {
    title: "梵鐘鎮魂", kicker: "奧義・其二十四", sub: "TEMPLE BELL OF BINDING", tone: "gold", dur: 3000,
    begin() { cueSound("bellDrop"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.05, 0.92, 1);
      veil(env * 0.55, "14,8,0");
      const H = g.H * 0.72, W = H * 0.68, cx = g.B.cx;
      const drop = seg(p, 0.04, 0.24), lift = easeIn(seg(p, 0.8, 0.96));
      let top = mix(-H * 1.1, Math.max(g.H * 0.08, g.B.cy - H * 0.5), drop * drop);
      if (drop >= 1) top += Math.sin(seg(p, 0.24, 0.32) * Math.PI) * -26;
      top -= lift * g.H * 1.2;
      const ringK = bell(p, 0.32, 0.36, 0.7, 0.8);
      const wob = Math.sin(p * 90) * 0.035 * ringK;
      once(e, "land", 0.24, p, () => { cueSound("bellLand"); shake(30, 700); });
      // 鐘聲：一圈圈可見的音波
      for (let r = 0; r < 7; r++) {
        const st = 0.3 + r * 0.06, q = seg(p, st, st + 0.35);
        once(e, "dong" + r, st, p, () => { if (r % 2 === 0) cueSound("bellDong", r); });
        if (q <= 0 || q >= 1) continue;
        ctx.strokeStyle = `rgba(255,214,140,${clamp((1 - q) * env)})`; ctx.lineWidth = 12 * (1 - q) + 2;
        ctx.beginPath(); ctx.ellipse(cx, g.B.cy, W * 0.5 + easeOut(q) * g.D * 0.55, (W * 0.5 + easeOut(q) * g.D * 0.55) * 0.55, 0, 0, TAU); ctx.stroke();
      }
      glow(cx, g.B.cy, W, "255,200,100", env * ringK * 0.5);
      ctx.globalAlpha = clamp(env);
      drawBell(cx, top, H, W, wob, ringK);
      ctx.globalAlpha = 1;
      if (drop >= 1 && p < 0.4) { const q = seg(p, 0.24, 0.4); for (let i = 0; i < 30; i++) { const a = Math.PI + rnd(i) * Math.PI, r = easeOut(q) * W * (0.6 + rnd(i * 2)); ctx.fillStyle = `rgba(200,170,120,${clamp(1 - q)})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 1.4, top + H + Math.sin(a) * r * 0.3, 8 + rnd(i * 3) * 12, 0, TAU); ctx.fill(); } }
    }
  };

  /* ---------------- 羅生門 ---------------- */

  /* ---------------- 冰封萬里 ---------------- */
  FX.ice = {
    title: "冰封萬里", kicker: "奧義・其二十六", sub: "ABSOLUTE ZERO", tone: "storm", dur: 3000,
    begin(e, g) {
      cueSound("iceCreep");
      e.data.shards = Array.from({ length: Math.max(40, Math.round(90 * quality())) }, (_, i) => ({ a: rnd(i * 1.3) * TAU, d: 0.3 + rnd(i * 2.9) * 0.9, s: 18 + rnd(i * 4.4) * 46, r: rnd(i * 6.6) * TAU, sp: (rnd(i * 8.1) - 0.5) * 12 }));
      e.data.cracks = Array.from({ length: 16 }, (_, i) => { const side = i % 4, u = rnd(i * 3.7); return side === 0 ? [u * g.W, 0] : side === 1 ? [g.W, u * g.H] : side === 2 ? [u * g.W, g.H] : [0, u * g.H]; });
    },
    draw(e, g, p) {
      const env = bell(p, 0, 0.04, 0.92, 1);
      const freeze = easeOut(seg(p, 0.02, 0.45)), shatter = seg(p, 0.62, 0.95);
      const B = g.B;
      // 冰霜從畫面四邊往內蔓延
      const v = ctx.createRadialGradient(g.W / 2, g.H / 2, Math.min(g.W, g.H) * mix(0.9, 0.15, freeze), g.W / 2, g.H / 2, g.D * 0.6);
      v.addColorStop(0, "rgba(200,240,255,0)"); v.addColorStop(1, `rgba(200,240,255,${clamp(env * 0.75 * (1 - shatter))})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, g.W, g.H);
      veil(env * 0.25 * (1 - shatter), "10,30,60");
      e.data.cracks.forEach(([x0, y0], i) => {
        const pts = [[x0, y0]], tx = g.W / 2 + (rnd(i) - 0.5) * B.w, ty = g.H / 2 + (rnd(i * 2) - 0.5) * B.h;
        for (let s = 1; s <= 8; s++) { const k = s / 8 * freeze; pts.push([mix(x0, tx, k) + (rnd(i * 9 + s) - 0.5) * 60, mix(y0, ty, k) + (rnd(i * 5 + s) - 0.5) * 60]); }
        polyline(pts, "170,230,255", 2, env * (1 - shatter), "#ffffff");
        for (let s = 2; s < pts.length; s += 2) { const [x, y] = pts[s]; for (const d of [-1, 1]) polyline([[x, y], [x + d * 26, y - 30]], "170,230,255", 1.2, env * (1 - shatter) * 0.8, "#fff"); }
      });
      // 棋盤被冰塊封住
      const block = seg(p, 0.3, 0.5) * (1 - shatter);
      if (block > 0) {
        const pad = 24;
        const ig = ctx.createLinearGradient(B.x, B.y, B.x + B.w, B.y + B.h);
        ig.addColorStop(0, `rgba(230,250,255,${clamp(block * 0.55)})`); ig.addColorStop(0.5, `rgba(150,210,255,${clamp(block * 0.35)})`); ig.addColorStop(1, `rgba(220,245,255,${clamp(block * 0.55)})`);
        ctx.fillStyle = ig; ctx.fillRect(B.x - pad, B.y - pad, B.w + pad * 2, B.h + pad * 2);
        ctx.strokeStyle = `rgba(255,255,255,${clamp(block)})`; ctx.lineWidth = 4; ctx.strokeRect(B.x - pad, B.y - pad, B.w + pad * 2, B.h + pad * 2);
        ctx.fillStyle = `rgba(255,255,255,${clamp(block * 0.5)})`;
        ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.x + B.w * 0.4, B.y); ctx.lineTo(B.x, B.y + B.h * 0.4); ctx.fill();
      }
      once(e, "freeze", 0.45, p, () => cueSound("iceLock"));
      once(e, "shatter", 0.62, p, () => { cueSound("iceShatter"); shake(26, 700); });
      if (shatter > 0) {
        if (shatter < 0.12) veil((1 - shatter / 0.12) * 0.9, "235,250,255");
        e.data.shards.forEach((s) => {
          const r = easeOut(shatter) * g.D * 0.55 * s.d, x = B.cx + Math.cos(s.a) * r, y = B.cy + Math.sin(s.a) * r * 0.75 + shatter * shatter * 120;
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.r + s.sp * shatter);
          ctx.globalAlpha = clamp(1 - shatter);
          ctx.fillStyle = "rgba(210,240,255,.85)"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, -s.s); ctx.lineTo(s.s * 0.5, s.s * 0.6); ctx.lineTo(-s.s * 0.45, s.s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        });
      }
      // 雪花
      const ns = Math.round(70 * quality()) + 20;
      for (let i = 0; i < ns; i++) { const x = rnd(i * 3.3) * g.W + Math.sin(p * 8 + i) * 20, y = ((rnd(i * 5.5) + p * 0.6) % 1) * g.H; ctx.fillStyle = `rgba(255,255,255,${clamp(env * 0.8)})`; ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd(i) * 2.5, 0, TAU); ctx.fill(); }
    }
  };

  FX.flip = {
    title: "乾坤翻面", kicker: "奧義・其三", sub: "BOARD FLIP 360°", tone: "violet", dur: 2400,
    begin(e) {
      const st = els.frame.style;
      e.data.prev = { transform: st.transform, backface: st.backfaceVisibility, transition: st.transition };
      st.transition = "none";
      st.backfaceVisibility = "hidden";
      e.data.B = geom().B;
      cueSound("flip");
    },
    draw(e, g, p) {
      g = Object.assign({}, g, { B: e.data.B || g.B });
      const q = easeInOut(seg(p, 0.1, 0.8)), sq = Math.sin(Math.PI * q);
      const ang = q * 360, rad = ang * Math.PI / 180;
      const sc = 1 + 0.32 * sq, lift = -g.B.h * 0.14 * sq;
      els.frame.style.transform = `perspective(1100px) translateY(${lift}px) rotateX(${8 * sq}deg) rotateY(${ang}deg) scale(${sc})`;
      const env = bell(p, 0, 0.06, 0.88, 1);
      const cx = g.B.cx, cy = g.B.cy + lift, c = Math.cos(rad);
      const w = g.B.w * sc, h = g.B.h * sc;
      vignette(g, env * 0.8, "14,4,32");
      // 背後的放射神光
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p * 1.2);
      for (let i = 0; i < 18; i++) {
        ctx.rotate(TAU / 18);
        const L = g.D * 0.75, a2 = env * (0.25 + 0.5 * sq) * (i % 2 ? 0.6 : 1);
        const gr = ctx.createLinearGradient(0, 0, L, 0);
        gr.addColorStop(0, `rgba(240,220,255,${clamp(a2)})`); gr.addColorStop(1, "rgba(150,80,255,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, -L * 0.06); ctx.lineTo(L, L * 0.06); ctx.fill();
      }
      ctx.restore();
      // 殘影：前幾個角度的棋盤外框
      for (let k = 1; k <= 4; k++) {
        const ca = Math.abs(Math.cos(rad - k * 0.22 * sq));
        ctx.strokeStyle = `rgba(210,160,255,${clamp(env * sq * (0.5 - k * 0.1))})`; ctx.lineWidth = 3;
        ctx.strokeRect(cx - w / 2 * ca, cy - h / 2, w * ca, h);
      }
      boardHole(g, 0.0);
      // 背面：發光的陰陽鏡
      if (c < 0) {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(-c, 1);
        const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.7);
        bg.addColorStop(0, "#3a1a66"); bg.addColorStop(1, "#0c0618");
        ctx.fillStyle = bg; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = "#ffcf63"; ctx.lineWidth = 8; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
        ctx.strokeStyle = "rgba(255,230,160,.6)"; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32);
        glow(0, 0, w * 0.7, "190,120,255", 0.9);
        drawBagua(0, 0, Math.min(w, h) * 0.44, p * 5, "255,214,120", 1);
        const words = "乾坤坎離震巽艮兌";
        ctx.fillStyle = "#ffe7a6"; ctx.font = `900 ${Math.round(w * 0.06)}px "DFKai-SB","KaiTi","Noto Serif TC",serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - p * 3; ctx.fillText(words[i], Math.cos(a) * w * 0.33, Math.sin(a) * h * 0.33); }
        drawTaijiDisc(0, 0, Math.min(w, h) * 0.2, -p * 8, 1);
        ctx.restore();
      }
      // 翻轉亮邊＋邊緣噴出的火花
      const sgn = Math.sin(rad) > 0 ? 1 : -1;
      const ex = cx + (w / 2) * Math.abs(c) * sgn;
      polyline([[ex, cy - h / 2], [ex, cy + h / 2]], "230,190,255", 6, env * (1 - Math.abs(c)) * 1.3, "#fff");
      const ns = Math.round(120 * quality());
      for (let i = 0; i < ns; i++) {
        const t = (p * 3 + rnd(i)) % 1, y = cy + (rnd(i * 3.3) - 0.5) * h;
        const x = ex + sgn * t * g.W * 0.35 * (0.4 + rnd(i * 5.1));
        ctx.fillStyle = `rgba(${i % 3 ? "240,210,255" : "255,220,140"},${clamp(env * sq * (1 - t))})`;
        ctx.fillRect(x, y + t * t * 60, 3 + 6 * (1 - t), 2.5);
      }
      // 翻到背面正中央：白閃＋衝擊波
      once(e, "half", 0.45, p, () => { cueSound("pentaHit"); shake(12, 380); });
      if (p > 0.45 && p < 0.52) veil((1 - seg(p, 0.45, 0.52)) * 0.4, "240,225,255");
      for (let k = 0; k < 3; k++) {
        const rq = seg(p, 0.45 + k * 0.06, 0.85 + k * 0.04);
        if (rq <= 0 || rq >= 1) continue;
        ctx.strokeStyle = `rgba(210,150,255,${clamp(1 - rq)})`; ctx.lineWidth = 16 * (1 - rq) + 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.5 + easeOut(rq) * g.W * 0.5, h * 0.5 + easeOut(rq) * g.H * 0.35, 0, 0, TAU); ctx.stroke();
      }
      // 落地：金塵與重擊
      once(e, "land", 0.82, p, () => { cueSound("bellLand"); shake(20, 520); });
      if (p > 0.82) {
        const k = seg(p, 0.82, 1);
        for (let i = 0; i < 40; i++) {
          const a = Math.PI + rnd(i * 2.1) * Math.PI, r = easeOut(k) * g.B.w * (0.5 + rnd(i) * 0.6);
          ctx.fillStyle = `rgba(255,214,140,${clamp((1 - k) * 0.8)})`;
          ctx.beginPath(); ctx.arc(g.B.cx + Math.cos(a) * r * 1.3, g.B.y + g.B.h + Math.sin(a) * r * 0.25, 4 + rnd(i * 3) * 8, 0, TAU); ctx.fill();
        }
        glow(g.B.cx, g.B.cy, g.B.w, "200,150,255", (1 - k) * 0.6);
      }
    },
    end(e) {
      const st = els.frame.style, pv = e.data.prev || {};
      st.transform = pv.transform || ""; st.backfaceVisibility = pv.backface || ""; st.transition = pv.transition || "";
    }
  };

  /* ---------------- 鬼神巨口（v15 重繪） ---------------- */
  function jaw(g, edgeY, dir, open, t) {
    const W = g.W, base = dir > 0 ? edgeY - g.H * 0.6 : edgeY + g.H * 0.6;
    const wave = (x) => edgeY + Math.sin(x * 0.012 + t) * 5 * dir;
    // 外層臉皮（上顎帶鼻樑與皺紋）
    const skin = ctx.createLinearGradient(0, base, 0, edgeY);
    skin.addColorStop(0, "#0b0102"); skin.addColorStop(0.55, "#3c0508"); skin.addColorStop(1, "#5a0b10");
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.moveTo(-20, base); ctx.lineTo(W + 20, base);
    for (let x = W + 20; x >= -20; x -= 30) ctx.lineTo(x, wave(x) - dir * 40);
    ctx.closePath(); ctx.fill();
    if (dir > 0) {
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 3;
      for (let k = 0; k < 5; k++) { const y = edgeY - 70 - k * 26; ctx.beginPath(); ctx.moveTo(W * 0.38, y); ctx.quadraticCurveTo(W * 0.5, y - 18, W * 0.62, y); ctx.stroke(); }
      for (const s of [-1, 1]) { ctx.fillStyle = "#050000"; ctx.beginPath(); ctx.ellipse(W / 2 + s * 46, edgeY - 70, 26, 14, s * 0.4, 0, TAU); ctx.fill(); }
    }
    // 牙齦：有立體感的濕潤肉色
    const gum = ctx.createLinearGradient(0, edgeY - dir * 60, 0, edgeY + dir * 20);
    gum.addColorStop(0, "#6e0c14"); gum.addColorStop(0.6, "#b3263a"); gum.addColorStop(1, "#d4485a");
    ctx.fillStyle = gum;
    ctx.beginPath(); ctx.moveTo(-20, wave(-20) - dir * 60);
    for (let x = -20; x <= W + 20; x += 30) ctx.lineTo(x, wave(x) - dir * 60);
    for (let x = W + 20; x >= -20; x -= 30) ctx.lineTo(x, wave(x) + dir * 14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,190,200,.45)"; ctx.lineWidth = 3;
    ctx.beginPath(); for (let x = -20; x <= W + 20; x += 30) { const y = wave(x) - dir * 52; if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    // 牙齒：有陰影、高光、牙根泛黃
    const n = 15;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) / n * W, wTooth = W / n * 0.86;
      const fang = Math.abs(i - 3) < 0.5 || Math.abs(i - (n - 4)) < 0.5;
      const len = (fang ? g.H * 0.32 : g.H * (0.1 + 0.05 * rnd(i * 3.3))) * (0.6 + 0.4 * open);
      const y0 = wave(cx) + dir * 6, tipX = cx + (rnd(i * 7.1) - 0.5) * wTooth * 0.25;
      const tg = ctx.createLinearGradient(cx - wTooth / 2, 0, cx + wTooth / 2, 0);
      tg.addColorStop(0, "#8f7f62"); tg.addColorStop(0.35, "#f6eedb"); tg.addColorStop(0.55, "#fffdf6"); tg.addColorStop(1, "#a89878");
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(cx - wTooth / 2, y0 - dir * 10);
      ctx.bezierCurveTo(cx - wTooth * 0.45, y0 + len * 0.5 * dir, tipX - wTooth * 0.1, y0 + len * 0.9 * dir, tipX, y0 + len * dir);
      ctx.bezierCurveTo(tipX + wTooth * 0.1, y0 + len * 0.9 * dir, cx + wTooth * 0.45, y0 + len * 0.5 * dir, cx + wTooth / 2, y0 - dir * 10);
      ctx.fill();
      const root = ctx.createLinearGradient(0, y0 - dir * 10, 0, y0 + dir * len * 0.3);
      root.addColorStop(0, "rgba(150,110,40,.55)"); root.addColorStop(1, "rgba(150,110,40,0)");
      ctx.fillStyle = root; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - wTooth * 0.12, y0 + dir * len * 0.15); ctx.lineTo(tipX - wTooth * 0.04, y0 + dir * len * 0.75); ctx.stroke();
      ctx.strokeStyle = "rgba(40,10,5,.5)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - wTooth / 2, y0 - dir * 10); ctx.bezierCurveTo(cx - wTooth * 0.45, y0 + len * 0.5 * dir, tipX - wTooth * 0.1, y0 + len * 0.9 * dir, tipX, y0 + len * dir); ctx.stroke();
    }
  }

  FX.jaws = {
    title: "鬼神巨口", kicker: "奧義・其十七", sub: "MAW OF THE ONI GOD", tone: "blood", dur: 3000,
    begin() { cueSound("jawsRumble"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.04, 0.92, 1);
      const t = (performance.now() - e.start) / 1000;
      const cy = g.B.cy;
      const openK = easeOut(seg(p, 0.1, 0.32));
      const bite = easeIn(seg(p, 0.52, 0.6));
      const retreat = easeInOut(seg(p, 0.76, 0.95));
      const gap = mix(g.H * 0.34, 0, bite) * openK;
      const off = retreat * g.H * 0.75;
      const yU = mix(-g.H * 0.08, cy - gap, openK) - off;
      const yL = mix(g.H * 1.08, cy + gap, openK) + off;
      // 喉嚨深處：暗紅漸層＋地獄火光
      const th = ctx.createRadialGradient(g.W / 2, cy, 10, g.W / 2, cy, g.D * 0.5);
      th.addColorStop(0, `rgba(255,90,30,${clamp(env * 0.5 * (1 - bite))})`); th.addColorStop(0.4, `rgba(90,0,8,${clamp(env * 0.75)})`); th.addColorStop(1, `rgba(10,0,0,${clamp(env * 0.92)})`);
      ctx.fillStyle = th; ctx.fillRect(0, 0, g.W, g.H);
      if (bite < 1) boardHole(g, 0.6 * (1 - bite) * openK);
      // 口水絲
      if (openK > 0.6 && bite < 0.9) {
        for (let k = 0; k < 9; k++) {
          const x = g.W * (0.1 + k * 0.1) + Math.sin(k * 3) * 30, sag = (yL - yU) * (0.35 + 0.1 * Math.sin(t * 2 + k));
          ctx.strokeStyle = `rgba(255,230,230,${clamp(env * 0.35 * (1 - bite))})`; ctx.lineWidth = 2 + (k % 3);
          ctx.beginPath(); ctx.moveTo(x, yU + 20); ctx.quadraticCurveTo(x + 10, yU + sag, x - 6, yL - 20); ctx.stroke();
        }
      }
      ctx.globalAlpha = clamp(env);
      jaw(g, yU, 1, openK, t);
      jaw(g, yL, -1, openK, t + 1);
      ctx.globalAlpha = 1;
      // 一雙巨眼（在上顎的臉上）
      const eyeA = env * seg(p, 0.03, 0.12) * (1 - retreat);
      for (const side of [-1, 1]) {
        const ex = g.W / 2 + side * g.W * 0.26, ey = Math.max(g.H * 0.08, yU - g.H * 0.17), op = easeOut(seg(p, 0.03, 0.14));
        glow(ex, ey, 190, "255,40,10", eyeA * 0.8);
        const eg = ctx.createRadialGradient(ex, ey, 4, ex, ey, 130);
        eg.addColorStop(0, "#fff6a0"); eg.addColorStop(0.5, "#ffb020"); eg.addColorStop(1, "#b02a08");
        ctx.globalAlpha = clamp(eyeA); ctx.fillStyle = eg;
        ctx.beginPath(); ctx.ellipse(ex, ey, 130, 40 * op, side * -0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(150,0,0,.6)"; ctx.lineWidth = 1.5;
        for (let v = 0; v < 6; v++) { ctx.beginPath(); ctx.moveTo(ex - side * 120, ey + (v - 2.5) * 6); ctx.quadraticCurveTo(ex - side * 70, ey + (v - 2.5) * 10, ex - side * 40, ey + (v - 2.5) * 4); ctx.stroke(); }
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(ex + Math.sin(t * 2) * 8, ey, 11, 36 * op, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#1a0000"; ctx.beginPath(); ctx.moveTo(ex - 150, ey - 30); ctx.quadraticCurveTo(ex, ey - 70 - side * 0, ex + 150, ey - 30 + side * 20); ctx.lineTo(ex + 150, ey - 70); ctx.lineTo(ex - 150, ey - 70); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // 吐息白煙
      if (openK > 0.3 && bite < 1) for (let k = 0; k < 10; k++) { const x = g.W * (0.05 + rnd(k) * 0.9), y = cy + Math.sin(t + k) * 30, r = 40 + ((t * 0.6 + rnd(k * 2)) % 1) * 90; ctx.fillStyle = `rgba(220,200,200,${clamp(env * 0.08)})`; ctx.beginPath(); ctx.arc(x, y - ((t * 40 + k * 20) % 80), r, 0, TAU); ctx.fill(); }
      once(e, "eyes", 0.05, p, () => cueSound("jawsEyes"));
      once(e, "roar", 0.22, p, () => { cueSound("jawsRoar"); shake(12, 900); });
      once(e, "bite", 0.6, p, () => { cueSound("jawsBite"); shake(34, 800); });
      if (p > 0.56 && p < 0.6) { const k = seg(p, 0.56, 0.6); ctx.fillStyle = `rgba(255,255,255,${0.12 * k})`; for (let i = 0; i < 12; i++) ctx.fillRect(0, cy - 300 + i * 50, g.W, 3); }
      if (p > 0.6 && p < 0.7) veil((1 - seg(p, 0.6, 0.66)) * 0.35, "255,235,225");
      if (p > 0.6) {
        const k = easeOut(seg(p, 0.6, 0.7)), fa = 1 - seg(p, 0.86, 1);
        ctx.strokeStyle = `rgba(255,120,90,${clamp(fa * (1 - k))})`; ctx.lineWidth = 20 * (1 - k) + 2;
        ctx.beginPath(); ctx.ellipse(g.W / 2, cy, k * g.W * 0.7, k * g.H * 0.3, 0, 0, TAU); ctx.stroke();
        for (let c = 0; c < 12; c++) {
          const a = c / 12 * TAU + 0.2, pts = [[g.W / 2, cy]];
          for (let s = 1; s <= 7; s++) { const r = k * g.D * 0.55 * s / 7; pts.push([g.W / 2 + Math.cos(a + (rnd(c * 7 + s) - 0.5) * 0.4) * r, cy + Math.sin(a + (rnd(c * 3 + s) - 0.5) * 0.4) * r]); }
          polyline(pts, "255,60,40", 2.6, fa * env, "#ffe0d0");
        }
      }
    }
  };

  /* ---------------- 虛空黑洞（v15 重繪：重力透鏡＋都卜勒吸積盤） ---------------- */
  FX.blackhole = {
    title: "虛空黑洞", kicker: "奧義・其二十三", sub: "VOID SINGULARITY", tone: "violet", dur: 3200,
    begin(e) {
      cueSound("holeOpen");
      const n = Math.max(260, Math.round(900 * quality()));
      e.data.disk = Array.from({ length: n }, (_, i) => ({ r: Math.pow(rnd(i * 1.7), 0.7), a: rnd(i * 3.1) * TAU, w: 0.6 + rnd(i * 5.3) * 0.8 }));
      e.data.stars = Array.from({ length: 220 }, (_, i) => [rnd(i * 2.3), rnd(i * 4.7), rnd(i * 6.1)]);
    },
    draw(e, g, p) {
      const [tx, ty] = target(e, g);
      const env = bell(p, 0, 0.05, 0.9, 1);
      const dark = mix(0.5, 0.88, seg(p, 0, 0.5));
      veil(env * dark, "0,0,4");
      const grow = easeOut(seg(p, 0.03, 0.3)) * (1 - easeIn(seg(p, 0.72, 0.8)));
      const Rd = Math.min(g.W, g.H) * 0.55 * grow, Rh = Rd * 0.22, spin = p * 10;
      // 背景星空被重力透鏡扭曲（靠近黑洞的星星被推成一圈）
      const Re = Rh * 2.2;
      e.data.stars.forEach(([u, v, b]) => {
        const sx = u * g.W, sy = v * g.H, dx = sx - tx, dy = sy - ty, r = Math.hypot(dx, dy) || 1;
        const r2 = r + (Re * Re) / r;
        const x = tx + dx / r * r2, y = ty + dy / r * r2;
        ctx.fillStyle = `rgba(255,255,255,${clamp(env * (0.3 + b * 0.7))})`;
        const st = 1 + Math.min(6, (Re * Re) / (r * r) * 4);
        ctx.fillRect(x, y, 1.5 + b, 1.5 + b * st * 0.3);
      });
      // 被吸入的物質流
      const ns = Math.round(160 * quality()) + 60;
      for (let i = 0; i < ns; i++) {
        const k = (p * 1.3 + rnd(i)) % 1, r0 = g.D * 0.6 * (0.35 + rnd(i * 2.3) * 0.65);
        const r = mix(r0, Rh, easeIn(k)), a = rnd(i * 4.9) * TAU + k * 5;
        const x = tx + Math.cos(a) * r, y = ty + Math.sin(a) * r * 0.5;
        ctx.strokeStyle = `rgba(255,${180 + (i % 4) * 18},${120 + (i % 3) * 50},${clamp(env * k)})`; ctx.lineWidth = 1 + k * 2.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a + 1.2) * 26 * k, y - Math.sin(a + 1.2) * 13 * k); ctx.stroke();
      }
      if (Rd > 3) {
        const drawDisk = (front) => {
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          // 連續的發光盤面（左亮右暗＝都卜勒增亮）
          for (let k = 0; k < 22; k++) {
            const f = k / 21, r = mix(Rh * 1.35, Rd, f);
            const gr = ctx.createLinearGradient(tx - r, 0, tx + r, 0);
            const hot = Math.round(255 - f * 30), mid = Math.round(220 - f * 150), cold = Math.round(170 - f * 150);
            gr.addColorStop(0, `rgba(${hot},${mid},${cold},${clamp(env * (0.75 - f * 0.55))})`);
            gr.addColorStop(1, `rgba(${hot},${Math.round(mid * 0.6)},${Math.round(cold * 0.4)},${clamp(env * (0.25 - f * 0.18))})`);
            ctx.strokeStyle = gr; ctx.lineWidth = (Rd - Rh) / 22 * 1.5;
            ctx.beginPath(); ctx.ellipse(tx, ty, r, r * 0.2, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
          }
          e.data.disk.forEach((d) => {
            const r = mix(Rh * 1.35, Rd, d.r), om = spin * Math.pow(Rh / r, 1.5) * 6;
            const a = d.a + om, sa = Math.sin(a);
            if ((sa > 0) !== front) return;
            const x = tx + Math.cos(a) * r, y = ty + sa * r * 0.2;
            const dop = 1 + 0.75 * Math.cos(a + Math.PI);     // 左側朝向鏡頭較亮
            const heat = 1 - d.r;
            const col = `${255},${Math.round(150 + heat * 100)},${Math.round(60 + heat * 170)}`;
            ctx.fillStyle = `rgba(${col},${clamp(env * 0.5 * dop * (0.4 + heat))})`;
            ctx.fillRect(x, y, 2.5 * d.w + heat * 2, 1.8 * d.w);
          });
          ctx.restore();
        };
        // 透鏡化的盤背面：繞到黑洞上方的光弧
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 10; k++) {
          const r = Rh * (1.25 + k * 0.08);
          ctx.strokeStyle = `rgba(255,${210 - k * 8},${160 - k * 10},${clamp(env * (0.8 - k * 0.06))})`; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(tx, ty, r, r * 0.95, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(tx, ty, r * 0.92, r * 0.5, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.restore();
        drawDisk(false);
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(tx, ty, Rh, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,248,230,${clamp(env)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx, ty, Rh * 1.06, 0, TAU); ctx.stroke();
        glow(tx, ty, Rh * 1.3, "255,230,200", env * 0.15);
        drawDisk(true);
      }
      once(e, "collapse", 0.72, p, () => cueSound("holeCollapse"));
      once(e, "burst", 0.8, p, () => { cueSound("holeBurst"); shake(32, 800); });
      if (p > 0.8) {
        const q = seg(p, 0.8, 1);
        if (q < 0.15) veil((1 - q / 0.15) * 0.95, "255,250,240");
        const jw = 80 * (1 - q);
        for (const d of [-1, 1]) { const gr = ctx.createLinearGradient(tx, ty, tx, ty + d * g.H); gr.addColorStop(0, `rgba(235,210,255,${clamp(1 - q)})`); gr.addColorStop(1, "rgba(150,80,255,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(tx - jw / 2, ty); ctx.lineTo(tx - jw * 1.6, ty + d * g.H); ctx.lineTo(tx + jw * 1.6, ty + d * g.H); ctx.lineTo(tx + jw / 2, ty); ctx.fill(); }
        for (let r = 0; r < 4; r++) { const rq = seg(q, r * 0.08, 0.8); ctx.strokeStyle = `rgba(${r % 2 ? "255,200,150" : "210,170,255"},${clamp(1 - rq)})`; ctx.lineWidth = 18 * (1 - rq) + 2; ctx.beginPath(); ctx.ellipse(tx, ty, easeOut(rq) * g.D * 0.7, easeOut(rq) * g.D * 0.24, 0, 0, TAU); ctx.stroke(); }
      }
    }
  };

  /* ---------------- 羅生門（v15 重繪：漆門、鬼瓦、透視開門、百鬼魂靈） ---------------- */
  function studs(x, w, H, alpha) {
    for (const yy of [0.14, 0.5, 0.86]) for (let k = 0; k < 6; k++) {
      const sx = x + w * (k + 0.5) / 6, sy = H * yy;
      const gr = ctx.createRadialGradient(sx - 3, sy - 3, 1, sx, sy, Math.max(4, w * 0.022));
      gr.addColorStop(0, "#fff3c0"); gr.addColorStop(0.5, "#e3b440"); gr.addColorStop(1, "#6a4a10");
      ctx.globalAlpha = alpha; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, w * 0.022), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function oniFace(x, y, R, glowK) {
    const gr = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
    gr.addColorStop(0, "#e2c27a"); gr.addColorStop(0.6, "#8a6428"); gr.addColorStop(1, "#3a2408");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#2a1804"; ctx.lineWidth = R * 0.06; ctx.stroke();
    ctx.fillStyle = "#c9a24a";
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * R * 0.35, y - R * 0.55); ctx.lineTo(x + s * R * 0.7, y - R * 1.15); ctx.lineTo(x + s * R * 0.55, y - R * 0.45); ctx.fill(); }
    ctx.fillStyle = "#2a1804";
    ctx.beginPath(); ctx.moveTo(x - R * 0.55, y - R * 0.3); ctx.lineTo(x - R * 0.1, y - R * 0.12); ctx.lineTo(x + R * 0.1, y - R * 0.12); ctx.lineTo(x + R * 0.55, y - R * 0.3); ctx.lineTo(x + R * 0.5, y - R * 0.4); ctx.lineTo(x - R * 0.5, y - R * 0.4); ctx.fill();
    for (const s of [-1, 1]) glow(x + s * R * 0.3, y - R * 0.05, R * 0.3, "255,40,20", 0.5 + glowK * 0.5);
    ctx.fillStyle = "#200";
    ctx.beginPath(); ctx.ellipse(x, y + R * 0.42, R * 0.45, R * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff4dc";
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * R * 0.32, y + R * 0.28); ctx.lineTo(x + s * R * 0.24, y + R * 0.62); ctx.lineTo(x + s * R * 0.16, y + R * 0.3); ctx.fill(); }
  }
  function door(x, w, H, shade, side, quad) {
    if (w < 2) return;
    // quad：開門時的透視內縮量（門外緣上下縮）
    const inset = quad || 0, outer = side < 0 ? x : x + w, inner = side < 0 ? x + w : x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inner, 0); ctx.lineTo(outer, inset); ctx.lineTo(outer, H - inset); ctx.lineTo(inner, H); ctx.closePath();
    ctx.clip();
    const gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, side < 0 ? "#2a0604" : "#9a2416"); gr.addColorStop(0.5, "#7a1810"); gr.addColorStop(1, side < 0 ? "#9a2416" : "#2a0604");
    ctx.fillStyle = gr; ctx.fillRect(x, 0, w, H);
    // 木紋
    ctx.strokeStyle = "rgba(20,0,0,.35)"; ctx.lineWidth = 1.5;
    for (let k = 0; k < 18; k++) { const xx = x + w * k / 18; ctx.beginPath(); ctx.moveTo(xx, 0); for (let y = 0; y <= H; y += 40) ctx.lineTo(xx + Math.sin(y * 0.02 + k) * 4, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 3;
    for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + w * k / 6, 0); ctx.lineTo(x + w * k / 6, H); ctx.stroke(); }
    // 鐵帶
    for (const yy of [0.14, 0.5, 0.86]) {
      const bg = ctx.createLinearGradient(0, H * yy - 18, 0, H * yy + 18);
      bg.addColorStop(0, "#3a3430"); bg.addColorStop(0.5, "#1a1512"); bg.addColorStop(1, "#0a0806");
      ctx.fillStyle = bg; ctx.fillRect(x, H * yy - 18, w, 36);
    }
    studs(x, w, H, 1);
    if (!quad) oniFace(x + w * (side < 0 ? 0.62 : 0.38), H * 0.32, Math.min(w * 0.2, H * 0.12), 0);
    // 門板厚度：靠門縫一側的立體邊
    const edge = ctx.createLinearGradient(inner - side * 24, 0, inner, 0);
    edge.addColorStop(0, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(0,0,0,.6)");
    ctx.fillStyle = edge; ctx.fillRect(Math.min(inner, inner - side * 24), 0, 24, H);
    ctx.fillStyle = `rgba(0,0,0,${clamp(shade)})`; ctx.fillRect(x, 0, w, H);
    ctx.restore();
  }
  function gateFrame(g, a) {
    ctx.globalAlpha = clamp(a);
    const H = g.H;
    ctx.fillStyle = "#14080a"; ctx.fillRect(0, 0, g.W, H * 0.07);
    ctx.fillStyle = "#3a0a08"; ctx.fillRect(0, H * 0.07, g.W, H * 0.03);
    for (let x = 0; x < g.W; x += 28) { ctx.fillStyle = x % 56 ? "#1f1416" : "#2b1d20"; ctx.beginPath(); ctx.arc(x + 14, H * 0.07, 14, Math.PI, TAU); ctx.fill(); }
    ctx.fillStyle = "#0d0606"; ctx.fillRect(g.W / 2 - 110, H * 0.02, 220, 64);
    ctx.strokeStyle = "#e3b440"; ctx.lineWidth = 3; ctx.strokeRect(g.W / 2 - 104, H * 0.02 + 6, 208, 52);
    ctx.fillStyle = "#ffd36a"; ctx.font = `900 40px "DFKai-SB","KaiTi","Noto Serif TC",serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("羅 生 門", g.W / 2, H * 0.02 + 33);
    ctx.globalAlpha = 1;
  }
  function spirit(x, y, s, ang, a, tint) {
    const tx = x - Math.cos(ang) * s * 3, ty = y - Math.sin(ang) * s * 3;
    const gr = ctx.createLinearGradient(x, y, tx, ty);
    gr.addColorStop(0, `rgba(${tint},${clamp(a)})`); gr.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(ang + 1.57) * s, y + Math.sin(ang + 1.57) * s);
    ctx.quadraticCurveTo(tx + Math.sin(ang * 3) * s, ty, x + Math.cos(ang - 1.57) * s, y + Math.sin(ang - 1.57) * s); ctx.fill();
    glow(x, y, s * 1.6, tint, a * 0.8);
    ctx.fillStyle = `rgba(245,240,255,${clamp(a)})`; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(20,0,40,${clamp(a)})`;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + Math.cos(ang + d * 0.6) * s * 0.4, y + Math.sin(ang + d * 0.6) * s * 0.4, s * 0.16, s * 0.24, ang, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(x + Math.cos(ang) * s * 0.55, y + Math.sin(ang) * s * 0.55, s * 0.12, s * 0.22, ang, 0, TAU); ctx.fill();
  }
  FX.rashomon = {
    title: "羅生門・百鬼開門", kicker: "奧義・其二十五", sub: "RASHOMON GATE", tone: "violet", dur: 3400,
    begin() { cueSound("gateSlide"); },
    draw(e, g, p) {
      const env = bell(p, 0, 0.03, 0.94, 1);
      const W = g.W, H = g.H, half = W / 2;
      const close = easeIn(seg(p, 0.02, 0.2));
      const swing = easeOut(seg(p, 0.6, 0.8));
      const fadeAll = 1 - seg(p, 0.86, 1);
      once(e, "slam", 0.2, p, () => { cueSound("gateSlam"); shake(34, 800); });
      once(e, "open", 0.6, p, () => { cueSound("gateOpen"); shake(22, 640); });
      veil(env * 0.5, "6,0,10");
      ctx.globalAlpha = clamp(env * fadeAll);
      if (swing <= 0) {
        const lw = half * close;
        const bang = close >= 1 ? Math.abs(Math.sin(seg(p, 0.28, 0.58) * Math.PI * 3)) * seg(p, 0.28, 0.58) : 0;
        const jit = bang * 6 * Math.sin(p * 200);
        // 關門時的殘影
        if (close < 1) for (let k = 1; k <= 3; k++) { ctx.globalAlpha = 0.15; door(-half + lw - k * 40, half, H, 0, -1); door(W - lw + k * 40, half, H, 0, 1); }
        ctx.globalAlpha = clamp(env * fadeAll);
        door(-half + lw + jit, half, H, 0, -1);
        door(W - lw - jit, half, H, 0, 1);
        if (close >= 1) {
          ctx.globalAlpha = 1;
          glow(half, H / 2, H * (0.3 + bang * 0.35), "200,140,255", 0.75 * env);
          ctx.fillStyle = `rgba(245,230,255,${clamp(0.6 + bang * 0.4)})`; ctx.fillRect(half - 2 - bang * 5, 0, 4 + bang * 10, H);
          for (let k = 0; k < 6; k++) { const y = H * (0.15 + k * 0.14); polyline([[half, y], [half + (k % 2 ? 1 : -1) * (40 + bang * 120), y + 30]], "220,170,255", 2, bang, "#fff"); }
          if (bang > 0.8 && !e.data.bang) { e.data.bang = true; shake(14, 260); cueSound("drum", 2); }
          if (bang < 0.3) e.data.bang = false;
          ctx.save(); ctx.translate(half, H * 0.52); ctx.rotate(0.05 + jit * 0.01);
          ctx.fillStyle = "#f4dc84"; ctx.fillRect(-38, -120, 76, 240);
          ctx.strokeStyle = "#b8201a"; ctx.lineWidth = 3; ctx.strokeRect(-32, -114, 64, 228);
          ctx.fillStyle = "#b8201a"; ctx.font = `900 48px "DFKai-SB","KaiTi",serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("封", 0, -42); ctx.fillText("印", 0, 32);
          if (bang > 0.5) { const F = fireSprite(); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(F, -40, 60, 80, 90); ctx.globalCompositeOperation = "source-over"; }
          ctx.restore();
        }
        if (close >= 1 && p < 0.3) { const q = seg(p, 0.2, 0.3); for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(160,130,110,${clamp(1 - q)})`; ctx.beginPath(); ctx.arc(half + (rnd(i) - 0.5) * 300 * q * 3, H - 20 - rnd(i * 2) * 120 * q, 10 + rnd(i * 3) * 20, 0, TAU); ctx.fill(); } }
      } else {
        const w = half * Math.cos(swing * Math.PI * 0.44);
        const inset = H * 0.12 * Math.sin(swing * Math.PI * 0.5);
        ctx.globalAlpha = 1;
        const gate = ctx.createRadialGradient(half, H / 2, 10, half, H / 2, g.D * 0.6);
        gate.addColorStop(0, `rgba(255,245,255,${clamp(fadeAll)})`); gate.addColorStop(0.3, `rgba(170,90,255,${clamp(fadeAll * 0.75)})`); gate.addColorStop(1, `rgba(20,0,40,${clamp(fadeAll * 0.85)})`);
        ctx.fillStyle = gate; ctx.fillRect(w, 0, W - w * 2, H);
        // 門內射出的光束
        ctx.save(); ctx.translate(half, H / 2); ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + p; const L = g.D * 0.6; ctx.fillStyle = `rgba(220,180,255,${clamp(fadeAll * 0.25)})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.05) * L, Math.sin(a - 0.05) * L); ctx.lineTo(Math.cos(a + 0.05) * L, Math.sin(a + 0.05) * L); ctx.fill(); }
        ctx.restore();
        boardHole(g, 0.5 * swing);
        ctx.globalAlpha = clamp(fadeAll);
        door(0, w, H, swing * 0.55, -1, inset);
        door(W - w, w, H, swing * 0.55, 1, inset);
        ctx.globalAlpha = 1;
        // 百鬼魂靈朝鏡頭湧出
        const n = Math.round(70 * Math.max(0.5, quality()));
        for (let i = 0; i < n; i++) {
          const k = (seg(p, 0.6, 0.98) * 1.3 + rnd(i)) % 1, a = rnd(i * 2.7) * TAU;
          const r = easeIn(k) * g.D * 0.62, x = half + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * 0.7;
          spirit(x, y, 6 + k * 34, a, fadeAll * (1 - k * 0.5), i % 3 ? "190,140,255" : "130,230,255");
        }
      }
      gateFrame(g, env * fadeAll * (swing > 0 ? 1 - swing * 0.6 : close));
      ctx.globalAlpha = 1;
    }
  };

  /* ======================================================= 排程器與主迴圈 */
  function showName(def) {
    if (!nameCard) return;
    nameCard.querySelector(".gn-kicker").textContent = def.kicker;
    nameCard.querySelector(".gn-title").textContent = def.title;
    nameCard.querySelector(".gn-sub").textContent = def.sub;
    nameCard.dataset.tone = TONE[def.tone] ? TONE[def.tone].css : "gold";
    nameCard.classList.remove("show");
    void nameCard.offsetWidth;
    nameCard.classList.add("show");
  }

  function setBusy() {
    const busy = pending > 0;
    document.body.classList.toggle("grand-playing", busy);
    if (onChange) onChange(busy);
  }

  function frame(now) {
    raf = 0;
    const e = current;
    if (!e) return;
    const dprMax = tier === "high" ? 1.5 : 1;
    const dpr = Math.min(dprMax, devicePixelRatio || 1);
    const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    // 播放中自動護航：連續掉幀就減粒子
    if (e.lastT) {
      const dt = now - e.lastT;
      e.dts.push(dt); if (e.dts.length > 24) e.dts.shift();
      if (!e.lite && e.dts.length >= 18 && e.dts.reduce((a, b) => a + b, 0) / e.dts.length > 38) e.lite = true;
    }
    e.lastT = now;
    const p = clamp((now - e.start) / e.dur);
    const g = geom();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    try {
      if (e.reduced) drawReduced(e, g, p);
      else FX[e.id].draw(e, g, p);
    } catch (err) {
      e.failed = true;
      if (window.console) console.warn("[HW06 grand]", e.id, err);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (p >= 1 || e.failed) { finish(e); return; }
    raf = requestAnimationFrame(frame);
  }

  function drawReduced(e, g, p) {
    const tone = TONE[FX[e.id].tone] || TONE.gold;
    const a = Math.sin(Math.PI * p) * 0.7;
    veil(a * 0.4);
    glow(g.B.cx, g.B.cy, g.D * 0.4, tone.rgb, a);
    ctx.strokeStyle = `rgba(${tone.rgb},${clamp(a)})`; ctx.lineWidth = 4;
    ctx.strokeRect(g.B.x - 10, g.B.y - 10, g.B.w + 20, g.B.h + 20);
  }

  function finish(e) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(e.watchdog);
    try { if (!e.reduced && FX[e.id].end) FX[e.id].end(e); } catch (_) {}
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.effect = "";
    if (timeline.length) timeline[timeline.length - 1].t1 = Math.round(performance.now());
    current = null;
    const r = e.resolve; e.resolve = null;
    if (r) r();
  }

  /** 等舊特效（arena 大場面、關鍵分鏡）播完再開始，最多等 1.6 秒 */
  function waitQuiet() {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const arena = document.getElementById("arena-effects-canvas");
      const check = () => {
        const shot = document.getElementById("keyshot-canvas");
        const busy = (arena && arena.dataset.events) || (shot && shot.style.display === "block");
        if (!busy || performance.now() - t0 > 1600) resolve(); else setTimeout(check, 60);
      };
      check();
    });
  }

  function run(id, opts, tok) {
    return new Promise((resolve) => {
      const def = FX[id];
      if (!def || !ctx || tok !== token || !els.frame) { resolve(); return; }
      const reduced = motion.matches;
      const e = {
        id, opts: opts || {}, start: performance.now(), seed: Math.random() * 100,
        dur: reduced ? 900 : def.dur * SLOW * (tier === "compat" ? 0.9 : 1),
        cues: {}, data: {}, reduced, dts: [], lite: tier === "compat", resolve
      };
      history.push(id);
      timeline.push({ id, t0: Math.round(performance.now()), t1: 0 });
      canvas.dataset.effect = id;
      current = e;
      showName(def);
      cueSound("name");
      try { if (!reduced && def.begin) def.begin(e, geom()); } catch (err) { e.failed = true; }
      e.start = performance.now();
      raf = requestAnimationFrame(frame);
      // 分頁被切到背景時 rAF 會暫停：保險計時，確保遊戲不會卡住
      e.watchdog = setTimeout(() => { if (current === e) finish(e); }, e.dur + 2500);
    });
  }

  function play(id, opts) {
    const tok = token;
    pending++; setBusy();
    const p = chain
      .then(() => (tok === token ? waitQuiet() : null))
      .then(() => (tok === token ? run(id, opts, tok) : null))
      .catch(() => {})
      .then(() => { if (tok === token) { pending = Math.max(0, pending - 1); setBusy(); } });
    chain = p;
    return p;
  }

  function reset() {
    token++;
    if (current) finish(current);
    pending = 0;
    chain = Promise.resolve();
    if (nameCard) nameCard.classList.remove("show");
    if (els.board) els.board.classList.remove("grand-pieces-away");
    if (els.frame) { els.frame.style.opacity = ""; els.frame.style.transform = ""; els.frame.style.backfaceVisibility = ""; }
    if (els.board) { els.board.style.overflow = ""; }
    if (els.cells) els.cells.forEach((c) => { c.style.transform = ""; c.style.zIndex = ""; c.style.transition = ""; });
    setBusy();
  }

  function init(o) {
    els = o || {};
    els.shell = document.querySelector(".app-shell");
    canvas = document.getElementById("grand-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "grand-canvas"; canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext("2d");
    nameCard = document.getElementById("grand-namecard");
    buildSprites();
  }

  window.HW06_GRAND = {
    init, play, reset,
    idle: () => chain,
    isBusy: () => pending > 0,
    setPerformanceTier(t) { tier = t || "high"; },
    onBusyChange(fn) { onChange = fn; },
    history,
    timeline,
    /** 截圖驗證用：直接畫出某招在進度 p 的單一畫面 */
    preview(id, p, opts) {
      const def = FX[id]; if (!def || !ctx) return false;
      const e = { id, opts: opts || {}, start: performance.now(), seed: 7, dur: 1e9, cues: {}, data: {}, reduced: false, dts: [], lite: false };
      const dpr = Math.min(tier === "high" ? 1.5 : 1, devicePixelRatio || 1);
      canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (def.begin) def.begin(e, geom());
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      def.draw(e, geom(), p);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      return true;
    },
    /** v12：同一局裡已播過的招式不重播，改用替補奧義 */
    REPLACEMENTS: ["talisman", "jaws", "swords", "gashadokuro", "blackhole", "rashomon", "bell", "ice", "phoenix", "rift"],
    list: () => Object.keys(FX).map((id) => ({ id, title: FX[id].title }))
  };
})();
