/* ==========================================================================
   1142949 HW06 — 棋局場面演出（20 條提議中的第 7–13、15–19 條）
   前景層（棋盤框內外）：
     7  符紙陣列環繞：蓮每下一手，棋盤外圍多一張漂浮符紙；蓮貫通靈脈時整圈燃起金光
     8  九字護身印：蓮堵住玉藻前的連線時，「臨兵鬥者皆陣列在前」九字光格依序閃過，最後一字落在被堵的格子
     9  符咒爆散成蝶：落定後墨點化成紙蝶（玉藻前是狐火蛾）飛出棋盤框，飛回自己的角色卡
     10 燃符反擊：玉藻前反制時，蓮外圍的一張符紙被狐火燒穿、化灰飄走
     11 九尾分工：玉藻前施法時尾巴光影從角色卡越過棋盤框掃向落點；得分時尾巴綻放
     12 狐火燈籠陣：棋盤四周的狐火數量＝玉藻前棋數；她快連線時狐火往那個空格聚集
     13 妖瞳鎖格：你「必須堵」的格子上方浮現青色狐眼，盯著眨一下
     15 震波波及場景：落子震波擴散出棋盤框，掃過兩側角色卡，卡片依距離延遲晃動
     17 力量拔河線：棋盤上緣一條橫貫雙方角色的能量線，依局勢往一邊推；同分在中央撞出火花
     19 反制時棋盤破裂：被截斷的那條線像玻璃裂開、碎片飛出框外；下一手開始慢慢癒合
   背景層（在介面後面、原畫前面）：
     16 得分方吞噬背景：領先方那一側的背景染上自己的顏色，反超時兩色在中央推擠
     18 戰況改變天候：前 3 手花瓣、4–6 手起風、最後 3 手遠雷與血色花瓣；第九手前全部靜止
   ========================================================================== */
(function () {
  "use strict";

  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const KUJI = ["臨", "兵", "鬥", "者", "皆", "陣", "列", "在", "前"];
  const GOLD = "255,176,84", CYAN = "73,242,225";
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const now = () => performance.now();

  const S = {
    fg: null, fctx: null, bg: null, bctx: null, tier: "ultra",
    cells: [], frameEl: null, heroCard: null, bossCard: null,
    board: new Array(9).fill(0), fx: [], moveNum: 0,
    ring: [], burnt: 0, lanterns: [], eye: null, cracks: [],
    tug: 0, tugTarget: 0, dom: 0, domTarget: 0, frozen: false,
    petals: [], bolts: [], nextBolt: 0, lastT: 0,

    init(o) {
      this.cells = o.cells; this.frameEl = o.frameEl; this.heroCard = o.heroCard; this.bossCard = o.bossCard;
      const mk = (id, z) => {
        const c = document.createElement("canvas"); c.id = id; c.setAttribute("aria-hidden", "true");
        Object.assign(c.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: String(z) });
        document.body.appendChild(c); return c;
      };
      this.bg = mk("weather-canvas", 2); this.bctx = this.bg.getContext("2d");
      this.fg = mk("spectacle-canvas", 79); this.fctx = this.fg.getContext("2d");
      for (let i = 0; i < 60; i++) this.petals.push(this.newPetal(true));
      const loop = (t) => { requestAnimationFrame(loop); this.frame(t); };
      requestAnimationFrame(loop);
    },
    setPerformanceTier(t) { this.tier = t || "ultra"; },

    endRound() {
      this.ended = true;
      this.cracks = [];
      this.eye = null;
    },

    reset() {
      this.ended = false;
      this.board = new Array(9).fill(0); this.fx = []; this.moveNum = 0;
      this.ring = []; this.burnt = 0; this.lanterns = []; this.eye = null; this.cracks = [];
      this.tugTarget = 0; this.domTarget = 0; this.frozen = false;
    },

    rect(el) { return el ? el.getBoundingClientRect() : null; },
    center(i) { const r = this.cells[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; },
    threats(b, who) {
      const s = new Set();
      if (this.ended) return s;
      LINES.forEach((L) => { const v = L.map((i) => b[i]); if (v.filter((x) => x === who).length === 2 && v.includes(0)) s.add(L[v.indexOf(0)]); });
      return s;
    },

    /* ---------- 事件 ---------- */
    /** 玉藻前開始施法：尾巴光影掃向落點（11） */
    tailSweep(cellIdx) {
      this.fx.push({ type: "tails", i: cellIdx, t0: now(), dur: 900, bloom: false });
    },

    /** 棋子落地 */
    onLanded(i, who, info, moveNum, isCounter, score) {
      this.board[i] = who; this.moveNum = moveNum;
      const isRen = who === 1;
      // 裂痕在下一手開始癒合（19）
      this.cracks.forEach((c) => { if (!c.healT) c.healT = now(); });

      // 7 / 12：符紙環與狐火燈籠的數量
      if (isRen) this.ring.push({ a: Math.random() * Math.PI * 2, born: now(), burnt: false });
      else this.lanterns.push({ a: Math.random() * Math.PI * 2, born: now(), ph: Math.random() * 6 });

      // ── 主要演出：一手只選一個 ──
      if (isCounter) {
        this.crackLine(i, -who);                 // 19 棋盤破裂
        this.burnTalisman();                     // 10 燃符反擊
      } else if (info.kind === "block" && isRen) {
        this.fx.push({ type: "kuji", i, t0: now(), dur: 1500 });      // 8 九字護身印
      } else if ((info.kind === "score" || info.kind === "double") && !isRen) {
        this.fx.push({ type: "tails", i, t0: now(), dur: 1100, bloom: true });   // 11 九尾綻放
      } else if ((info.kind === "score" || info.kind === "double") && isRen) {
        this.fx.push({ type: "ringFlare", t0: now(), dur: 1300 });               // 7 符陣燃起
      } else if (info.kind === "block" && !isRen) {
        this.fx.push({ type: "tailShield", i, t0: now(), dur: 1100 });           // 11 尾巴盾
      }
      // 小回饋：化蝶（9）＋震波（15）
      this.fx.push({ type: "butterflies", i, who, t0: now(), dur: 1500, seeds: Array.from({ length: this.tier === "compat" ? 3 : 6 }, () => Math.random()) });
      const strength = info.kind === "double" ? 1.6 : info.kind === "score" ? 1.3 : info.kind === "block" ? 1.0 : 0.7;
      this.shockwave(i, who, strength);

      // 13 妖瞳：玉藻前下完後，若你必須堵某格 → 在那格浮現狐眼
      this.eye = null;
      if (!isRen && !this.ended) {
        const must = [...this.threats(this.board, -1)];
        if (must.length) this.eye = { i: must[0], t0: now() + 650 };
      }
      // 17 拔河線 ＆ 16 背景染色
      this.updateBalance(score);
      // 18 天候在第九手前靜止
      this.frozen = false;
    },

    updateBalance(score) {
      const h = score ? score.h : 0, a = score ? score.a : 0;
      const ht = this.threats(this.board, 1).size, at = this.threats(this.board, -1).size;
      const prev = this.tugTarget;
      this.tugTarget = Math.max(-0.8, Math.min(0.8, (h - a) * 0.38 + (ht - at) * 0.12));
      this.domTarget = h > a ? Math.min(1, 0.4 + (h - a) * 0.3) : a > h ? -Math.min(1, 0.4 + (a - h) * 0.3) : 0;
      if (Math.sign(prev) !== Math.sign(this.tugTarget) && this.tugTarget !== 0 && prev !== 0) this.fx.push({ type: "push", t0: now(), dur: 900 });
    },

    ninthFreeze() { this.frozen = true; },

    burnTalisman() {
      const t = this.ring.find((r) => !r.burnt);
      if (t) { t.burnt = true; t.burnT = now(); }
    },

    crackLine(i, victim) {
      // 被截斷的是對手（victim）那條快完成的線
      const L = LINES.find((L) => L.includes(i) && L.filter((k) => this.board[k] === victim).length === 2);
      const line = L || [i, i, i];
      const pts = line.map((k) => this.center(k));
      const segs = [];
      const n = 14;
      for (let s = 0; s <= n; s++) {
        const u = s / n;
        const x = lerp(pts[0][0], pts[2][0], u), y = lerp(pts[0][1], pts[2][1], u);
        segs.push([x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18]);
      }
      const branches = [];
      for (let b = 0; b < 7; b++) {
        const p = segs[1 + Math.floor(Math.random() * (n - 1))];
        const ang = Math.random() * Math.PI * 2, len = 25 + Math.random() * 45;
        branches.push([p, [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len], [p[0] + Math.cos(ang + 0.4) * len * 1.5, p[1] + Math.sin(ang + 0.4) * len * 1.5]]);
      }
      const shards = Array.from({ length: this.tier === "compat" ? 6 : 16 }, () => {
        const p = segs[Math.floor(Math.random() * segs.length)];
        const ang = Math.random() * Math.PI * 2, v = 260 + Math.random() * 420;
        return { x: p[0], y: p[1], vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 120, r: Math.random() * 6, s: 6 + Math.random() * 12 };
      });
      this.cracks.push({ segs, branches, shards, t0: now(), healT: 0 });
      if (this.frameEl) { this.frameEl.classList.remove("board-shatter"); void this.frameEl.offsetWidth; this.frameEl.classList.add("board-shatter"); }
      window.HW06_AUDIO?.playShatter?.();
    },

    shockwave(i, who, strength) {
      const [x, y] = this.center(i);
      this.fx.push({ type: "wave", x, y, who, t0: now(), dur: 900, strength });
      // 卡片依距離延遲晃動
      [[this.heroCard, -1], [this.bossCard, 1]].forEach(([card, side]) => {
        if (!card) return;
        const r = card.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        const delay = d / 1.1;            // 波速約 1.1 px/ms
        const amp = 7 * strength;
        setTimeout(() => {
          if (typeof card.animate !== "function") return;
          card.animate([
            { transform: "translate(0,0) rotate(0deg)" },
            { transform: `translate(${side * amp}px, ${-amp * 0.3}px) rotate(${side * 0.8 * strength}deg)` },
            { transform: `translate(${-side * amp * 0.4}px, 0) rotate(${-side * 0.3}deg)` },
            { transform: "translate(0,0) rotate(0deg)" }
          ], { duration: 420, easing: "ease-out" });
        }, delay);
      });
    },

    newPetal(anywhere) {
      return { x: anywhere ? Math.random() * innerWidth : innerWidth + Math.random() * 100, y: anywhere ? Math.random() * innerHeight : Math.random() * innerHeight * 0.8 - 40,
               d: Math.random(), ph: Math.random() * 6, rot: Math.random() * 6 };
    },

    /* ---------- 繪製 ---------- */
    frame(t) {
      const lite = this.tier === "compat";
      if (t - this.lastT < (lite ? 50 : 16)) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000); this.lastT = t;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      [this.bg, this.fg].forEach((c) => {
        const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      });
      const playing = document.querySelector("#cinema-overlay.open") || !document.querySelector("#title-gate.hidden");
      this.bctx.setTransform(1, 0, 0, 1, 0, 0); this.bctx.clearRect(0, 0, this.bg.width, this.bg.height);
      this.fctx.setTransform(1, 0, 0, 1, 0, 0); this.fctx.clearRect(0, 0, this.fg.width, this.fg.height);
      if (playing || !this.cells.length) return;
      this.bctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const T = t / 1000;
      this.tug += (this.tugTarget - this.tug) * Math.min(1, dt * 3);
      this.dom += (this.domTarget - this.dom) * Math.min(1, dt * 1.5);
      this.drawBackground(this.bctx, T, dt, lite);
      this.drawForeground(this.fctx, T, dt, lite);
    },

    glow(ctx, x, y, r, rgb, a) {
      if (a <= 0.003 || r <= 0) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.3, `rgba(${rgb},${a * 0.8})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    },

    drawBackground(ctx, T, dt, lite) {
      const W = innerWidth, H = innerHeight;
      // 16 得分方吞噬背景
      if (Math.abs(this.dom) > 0.02) {
        const lead = this.dom > 0;
        const k = Math.abs(this.dom);
        const g = ctx.createLinearGradient(lead ? 0 : W, 0, lead ? W : 0, 0);
        g.addColorStop(0, `rgba(${lead ? "255,120,40" : "20,190,180"},${0.32 * k})`);
        g.addColorStop(clamp01(0.25 + 0.35 * k), `rgba(${lead ? "255,120,40" : "20,190,180"},${0.12 * k})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      const push = this.fx.find((f) => f.type === "push");
      if (push) {
        const p = (now() - push.t0) / push.dur;
        const x = W / 2 + Math.sin(p * Math.PI * 3) * 40 * (1 - p);
        this.glow(ctx, x, H * 0.45, 260 * (1 - p * 0.5), "255,240,210", 0.35 * (1 - p));
      }
      // 18 天候
      const stage = this.moveNum <= 3 ? 0 : this.moveNum <= 6 ? 1 : 2;
      const wind = this.frozen ? 0 : [1, 2.6, 3.4][stage];
      const count = lite ? 18 : [26, 44, 60][stage];
      for (let n = 0; n < count && n < this.petals.length; n++) {
        const p = this.petals[n];
        if (!this.frozen) {
          p.x -= (30 + p.d * 60) * wind * dt; p.y += (20 + p.d * 30) * dt * (this.frozen ? 0 : 1) + Math.sin(T * 2 + p.ph) * 0.3;
          p.rot += dt * 2 * wind;
          if (p.x < -30 || p.y > H + 30) this.petals[n] = this.newPetal(false);
        }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.55);
        ctx.fillStyle = stage === 2 ? `rgba(200,30,40,${0.5 + p.d * 0.4})` : `rgba(255,190,210,${0.45 + p.d * 0.4})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 3 + p.d * 6, 2 + p.d * 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      // 風線
      if (stage >= 1 && !this.frozen && !lite) {
        ctx.strokeStyle = "rgba(220,230,255,0.08)"; ctx.lineWidth = 1.2;
        for (let n = 0; n < 8; n++) {
          const y = (n * 97 + T * 40) % H, x = W - ((T * 700 * (0.6 + n * 0.07) + n * 300) % (W + 400));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 120, y - 10, x + 260, y + 4); ctx.stroke();
        }
      }
      // 遠雷
      if (stage === 2 && !this.frozen) {
        if (now() > this.nextBolt) { this.bolts.push({ x: W * (0.15 + Math.random() * 0.7), t0: now() }); this.nextBolt = now() + 3500 + Math.random() * 3500; }
      }
      this.bolts = this.bolts.filter((b) => {
        const p = (now() - b.t0) / 450; if (p >= 1) return false;
        const a = p < 0.15 ? 1 : p < 0.3 ? 0.3 : p < 0.45 ? 0.8 : 1 - p;
        ctx.fillStyle = `rgba(200,220,255,${0.12 * a})`; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(230,240,255,${0.7 * a})`; ctx.lineWidth = 2;
        ctx.beginPath(); let x = b.x, y = 0; ctx.moveTo(x, y);
        for (let s = 0; s < 7; s++) { x += (Math.sin(b.x + s * 3.1) * 30); y += H * 0.045; ctx.lineTo(x, y); }
        ctx.stroke();
        return true;
      });
    },

    drawForeground(ctx, T, dt, lite) {
      const fr = this.frameEl.getBoundingClientRect();
      const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
      const Rx = fr.width * 0.5 + 34, Ry = fr.height * 0.5 + 30;
      const flare = this.fx.find((f) => f.type === "ringFlare");
      const flareK = flare ? Math.sin(clamp01((now() - flare.t0) / flare.dur) * Math.PI) : 0;

      // 7 符紙陣列環繞（含 10 燃燒中的符紙）
      this.ring = this.ring.filter((r) => !(r.burnt && now() - r.burnT > 1400));
      const alive = this.ring.length;
      this.ring.forEach((r, n) => {
        const ang = T * 0.25 + (n / Math.max(alive, 1)) * Math.PI * 2;
        const x = cx + Math.cos(ang) * Rx, y = cy + Math.sin(ang) * Ry;
        const born = clamp01((now() - r.born) / 500);
        let burn = r.burnt ? clamp01((now() - r.burnT) / 1200) : 0;
        ctx.save(); ctx.globalAlpha = born * (1 - burn * 0.9);
        ctx.translate(x, y + Math.sin(T * 2 + n) * 4); ctx.rotate(Math.sin(T + n) * 0.25);
        const w = 16, h = 36;
        ctx.beginPath(); ctx.rect(-w / 2, -h / 2 + h * burn, w, h * (1 - burn)); ctx.clip();
        ctx.fillStyle = "#f1e0b5"; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = "#c22a1a"; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
        ctx.fillStyle = "#b3180c"; ctx.font = "900 11px 'Noto Serif TC',serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(KUJI[n % 9], 0, -4);
        ctx.restore();
        if (flareK > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; this.glow(ctx, x, y, 34, GOLD, 0.8 * flareK); ctx.restore(); }
        if (burn > 0 && burn < 1) {
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          this.glow(ctx, x, y - 18 + 36 * burn, 18, CYAN, 0.9 * (1 - burn));
          ctx.restore();
          // 灰燼飄散
          for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(60,60,60,${0.6 * (1 - burn)})`; ctx.fillRect(x + Math.sin(k * 9) * 20 * burn, y - 50 * burn - k * 6, 2, 2); }
        }
      });
      if (flareK > 0 && alive > 1) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(${GOLD},${0.6 * flareK})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, Rx, Ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }

      // 12 狐火燈籠陣：平時繞外圈，玉藻前有將成之線時往該空格聚集
      const aiThreats = [...this.threats(this.board, -1)];
      const gather = aiThreats.length ? this.center(aiThreats[0]) : null;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      this.lanterns.forEach((l, n) => {
        const ang = -T * 0.3 + l.a + n * 0.7;
        let x = cx + Math.cos(ang) * (Rx + 22), y = cy + Math.sin(ang) * (Ry + 22);
        if (gather) {
          const k = 0.55 + 0.1 * Math.sin(T * 2 + n);
          const gx = gather[0] + Math.cos(T * 2 + n * 1.3) * gather[2] * 0.45, gy = gather[1] + Math.sin(T * 2 + n * 1.3) * gather[2] * 0.45;
          x = lerp(x, gx, k); y = lerp(y, gy, k);
        }
        const born = clamp01((now() - l.born) / 600);
        this.glow(ctx, x, y + Math.sin(T * 3 + l.ph) * 5, 16, CYAN, 0.65 * born);
        this.glow(ctx, x, y - 6 + Math.sin(T * 3 + l.ph) * 5, 7, "200,255,250", 0.7 * born);
      });
      ctx.restore();

      // 17 力量拔河線（棋盤上緣，連到兩側角色卡）
      const hr = this.heroCard && this.heroCard.getBoundingClientRect(), br = this.bossCard && this.bossCard.getBoundingClientRect();
      if (hr && br) {
        const y = fr.top - 3, x0 = hr.right - 6, x1 = br.left + 6;
        const knot = lerp(x0, x1, 0.5 + this.tug * 0.5);
        ctx.save(); ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(20,10,6,0.5)"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        const gl = ctx.createLinearGradient(x0, 0, knot, 0); gl.addColorStop(0, `rgba(${GOLD},0.35)`); gl.addColorStop(1, `rgba(${GOLD},0.95)`);
        ctx.strokeStyle = gl; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(knot, y); ctx.stroke();
        const gr = ctx.createLinearGradient(knot, 0, x1, 0); gr.addColorStop(0, `rgba(${CYAN},0.95)`); gr.addColorStop(1, `rgba(${CYAN},0.35)`);
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(knot, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        const tie = Math.abs(this.tug) < 0.05 && this.moveNum > 0;
        this.glow(ctx, knot, y, tie ? 26 + 8 * Math.sin(T * 12) : 18, tie ? "255,245,220" : this.tug > 0 ? GOLD : CYAN, 0.9);
        if (tie && !lite) for (let k = 0; k < 6; k++) { const a = T * 9 + k; ctx.fillStyle = "rgba(255,250,230,0.9)"; ctx.fillRect(knot + Math.cos(a) * 18, y + Math.sin(a) * 10, 2, 2); }
        ctx.restore();
      }

      // 13 妖瞳鎖格
      if (this.eye && this.board[this.eye.i] === 0) {
        const el = now() - this.eye.t0;
        if (el > 0) {
          const [x, y, w] = this.center(this.eye.i);
          const a = clamp01(el / 300) * (el > 2600 ? clamp01(1 - (el - 2600) / 500) : 1);
          const blink = el > 900 && el < 1050 ? 0.1 : 1;
          ctx.save(); ctx.translate(x, y - w * 0.05); ctx.globalAlpha = a;
          ctx.globalCompositeOperation = "lighter"; this.glow(ctx, 0, 0, w * 0.45, CYAN, 0.35);
          ctx.globalCompositeOperation = "source-over";
          ctx.scale(1, blink);
          ctx.fillStyle = "rgba(10,40,45,0.75)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.3, w * 0.13, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#7ff5ea"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "#49f2e1"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.035, w * 0.11, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          if (el > 3200) this.eye = null;
        }
      }

      // 19 裂痕（下一手開始後慢慢癒合）
      this.cracks = this.cracks.filter((c) => {
        const age = now() - c.t0;
        const heal = c.healT ? clamp01((now() - c.healT) / 1200) : 0;
        if (heal >= 1) return false;
        const grow = clamp01(age / 180);
        ctx.save(); ctx.lineJoin = "round";
        const path = (pts, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); };
        const n = Math.max(2, Math.round(c.segs.length * grow));
        path(c.segs.slice(0, n), 5, `rgba(20,10,6,${0.75 * (1 - heal)})`);
        path(c.segs.slice(0, n), 1.6, `rgba(190,255,250,${0.9 * (1 - heal)})`);
        if (grow >= 1) c.branches.forEach((b) => { path(b, 3, `rgba(20,10,6,${0.6 * (1 - heal)})`); path(b, 1, `rgba(190,255,250,${0.7 * (1 - heal)})`); });
        ctx.restore();
        // 碎片飛出棋盤框
        const ts = age / 1000;
        if (ts < 1.4) c.shards.forEach((s) => {
          const x = s.x + s.vx * ts, y = s.y + s.vy * ts + 600 * ts * ts;
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.r + ts * 8); ctx.globalAlpha = clamp01(1 - ts / 1.4);
          ctx.fillStyle = "rgba(240,225,190,0.95)"; ctx.strokeStyle = "rgba(120,255,240,0.9)";
          ctx.beginPath(); ctx.moveTo(-s.s / 2, -s.s / 3); ctx.lineTo(s.s / 2, -s.s / 4); ctx.lineTo(0, s.s / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        });
        return true;
      });

      // 一次性演出
      this.fx = this.fx.filter((f) => {
        const p = (now() - f.t0) / f.dur;
        if (p >= 1) return false;
        if (p < 0) return true;
        if (f.type === "wave") this.drawWave(ctx, f, p);
        else if (f.type === "kuji") this.drawKuji(ctx, f, p, T);
        else if (f.type === "butterflies") this.drawButterflies(ctx, f, p, T);
        else if (f.type === "tails") this.drawTails(ctx, f, p, T, br);
        else if (f.type === "tailShield") this.drawTailShield(ctx, f, p, T);
        return true;
      });
    },

    drawWave(ctx, f, p) {
      const R = Math.hypot(innerWidth, innerHeight) * 0.55 * easeOut(p);
      const rgb = f.who === 1 ? GOLD : CYAN;
      ctx.save();
      [0, 0.12].forEach((lag, k) => {
        const r = R * (1 - lag * 2);
        if (r <= 0) return;
        ctx.strokeStyle = `rgba(${rgb},${(k ? 0.25 : 0.5) * (1 - p) * f.strength})`; ctx.lineWidth = (k ? 2 : 4) * (1 - p) + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.restore();
    },

    drawKuji(ctx, f, p, T) {
      const fr = this.frameEl.getBoundingClientRect();
      const [tx, ty, w] = this.center(f.i);
      const gx = fr.left + fr.width / 2, gy = fr.top - 60;   // 九字光格出現在棋盤上方、溢出框外
      const cell = 34;
      ctx.save();
      for (let k = 0; k < 9; k++) {
        const appear = clamp01((p * 1.6 - k * 0.07) / 0.15);
        if (appear <= 0) continue;
        const last = k === 8;
        let x = gx + ((k % 3) - 1) * cell * 1.15, y = gy + (Math.floor(k / 3) - 1) * cell * 1.15;
        let size = cell;
        if (last) {   // 最後一字落在被堵的格子
          const fall = clamp01((p - 0.62) / 0.25);
          x = lerp(x, tx, easeOut(fall)); y = lerp(y, ty, easeOut(fall)); size = lerp(cell, w * 0.7, fall);
        }
        const fade = last ? 1 - clamp01((p - 0.9) / 0.1) : 1 - clamp01((p - 0.7) / 0.2);
        ctx.globalAlpha = appear * fade;
        ctx.fillStyle = "rgba(30,10,4,0.7)"; ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.strokeStyle = "#ffcf6b"; ctx.lineWidth = 2; ctx.strokeRect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = "#ffe3a0"; ctx.font = `900 ${Math.round(size * 0.66)}px 'Noto Serif TC',serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(KUJI[k], x, y + 1);
      }
      // 九字線（四縱五橫）
      ctx.globalAlpha = clamp01(p * 3) * (1 - clamp01((p - 0.6) / 0.3));
      ctx.strokeStyle = "rgba(255,210,120,0.8)"; ctx.lineWidth = 2;
      for (let v = 0; v < 4; v++) { const x = gx - cell * 2 + v * cell * 1.33; ctx.beginPath(); ctx.moveTo(x, gy - cell * 1.9); ctx.lineTo(x, gy + cell * 1.9); ctx.stroke(); }
      for (let h = 0; h < 5; h++) { const y = gy - cell * 1.9 + h * cell * 0.95; ctx.beginPath(); ctx.moveTo(gx - cell * 2.1, y); ctx.lineTo(gx + cell * 2.1, y); ctx.stroke(); }
      ctx.restore();
    },

    drawButterflies(ctx, f, p, T) {
      const [x0, y0] = this.center(f.i);
      const card = f.who === 1 ? this.heroCard : this.bossCard;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x1 = r.left + r.width * 0.5, y1 = r.top + r.height * 0.3;
      const ren = f.who === 1;
      f.seeds.forEach((s, k) => {
        const u = clamp01(p * 1.25 - s * 0.25);
        if (u <= 0 || u >= 1) return;
        const mx = (x0 + x1) / 2 + (s - 0.5) * 220, my = Math.min(y0, y1) - 120 - s * 80;
        const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1 + Math.sin(T * 6 + k) * 8;
        const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1;
        const flap = Math.abs(Math.sin(T * 18 + k * 2));
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha = Math.sin(u * Math.PI);
        if (ren) {
          ctx.fillStyle = "rgba(245,232,200,0.95)"; ctx.strokeStyle = "rgba(160,30,20,0.9)"; ctx.lineWidth = 1;
          [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * 10 * flap, -8); ctx.lineTo(sd * 8 * flap, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); });
        } else {
          ctx.globalCompositeOperation = "lighter";
          this.glow(ctx, 0, 0, 12, CYAN, 0.8);
          ctx.fillStyle = "rgba(170,255,248,0.8)";
          [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.ellipse(sd * 6 * flap, -2, 6 * flap + 1, 4, sd * 0.5, 0, Math.PI * 2); ctx.fill(); });
        }
        ctx.restore();
      });
    },

    drawTails(ctx, f, p, T, br) {
      if (!br) return;
      const [tx, ty, w] = this.center(f.i);
      const ox = br.left + br.width * 0.5, oy = br.top + br.height * 0.55;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      const n = f.bloom ? 9 : 5;
      for (let k = 0; k < n; k++) {
        const s = (k / (n - 1)) - 0.5;
        if (f.bloom) {
          // 得分：九尾從落點向外綻放
          const ang = s * Math.PI * 1.6 - Math.PI / 2;
          const len = w * (0.6 + 1.4 * easeOut(clamp01(p * 1.4)));
          const ex = tx + Math.cos(ang) * len, ey = ty + Math.sin(ang) * len;
          ctx.strokeStyle = `rgba(${CYAN},${0.7 * (1 - p)})`; ctx.lineWidth = 10 * (1 - p) + 2;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(ang + 0.6) * len * 0.6, ty + Math.sin(ang + 0.6) * len * 0.6, ex, ey); ctx.stroke();
        } else {
          // 施法：尾巴光影從角色卡越過棋盤框掃向落點
          const head = easeOut(clamp01(p * 1.5));
          const tail = clamp01(p * 1.5 - 0.35);
          const cxp = (ox + tx) / 2 + s * 160, cyp = Math.min(oy, ty) - 140 + Math.abs(s) * 120;
          const pt = (u) => [(1 - u) * (1 - u) * ox + 2 * (1 - u) * u * cxp + u * u * tx, (1 - u) * (1 - u) * oy + 2 * (1 - u) * u * cyp + u * u * ty];
          ctx.strokeStyle = `rgba(${CYAN},${0.45 * (1 - p)})`; ctx.lineWidth = 9 - Math.abs(s) * 6;
          ctx.beginPath();
          for (let u = tail; u <= head; u += 0.05) { const q = pt(u); u === tail ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); }
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    drawTailShield(ctx, f, p, T) {
      const [x, y, w] = this.center(f.i);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(${CYAN},${0.8 * (1 - p)})`; ctx.lineWidth = 6;
      for (let k = 0; k < 4; k++) {
        const r = w * (0.62 + k * 0.08) * easeOut(clamp01(p * 2));
        ctx.beginPath(); ctx.arc(x, y, r, Math.PI * (0.8 + k * 0.05) + T, Math.PI * (2.2 - k * 0.05) + T); ctx.stroke();
      }
      ctx.restore();
    }
  };

  window.HW06_SPECTACLE = S;
})();
