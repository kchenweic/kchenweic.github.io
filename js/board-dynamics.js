/* ==========================================================================
   1142949 HW06 — 下棋的動態與變化（棋勢驅動的演出）
   依「這一步的意義」選一個主要演出，其他只補小回饋：
     普通落子：輕巧；堵線（阻斷封印）：結界＋截斷對方能量線；
     得分（貫通靈脈）：重擊；一子雙脈／雙線布局：分岔光流；
   持續狀態：雙印共鳴線、棋子呼吸、末三印升溫；
   終局：第九印靜場、九印逐枚清算。
   ========================================================================== */
(function () {
  "use strict";

  const LINES = window.HW06_AI.WIN_LINES;
  const COL = { 1: [255, 176, 84], "-1": [73, 242, 225] };   // 1＝蓮（玩家）、-1＝玉藻前
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const now = () => performance.now();

  const BD = {
    canvas: null, ctx: null, cells: [], boardEl: null, frameEl: null,
    board: new Array(9).fill(0), tier: "ultra",
    hover: null, effects: [], raf: 0, lastT: 0, ended: false, timers: new Set(),

    init(opts) {
      this.cells = opts.cells; this.boardEl = opts.boardEl; this.frameEl = opts.frameEl;
      this.canvas = document.createElement("canvas");
      this.canvas.id = "board-fx-canvas";
      this.canvas.setAttribute("aria-hidden", "true");
      Object.assign(this.canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "80" });
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      const loop = (t) => { this.raf = requestAnimationFrame(loop); this.frame(t); };
      this.raf = requestAnimationFrame(loop);
    },
    setPerformanceTier(t) { this.tier = t || "ultra"; },

    later(action, ms) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        action();
      }, ms);
      this.timers.add(timer);
    },

    endRound() {
      this.ended = true;
      this.hover = null;
      this.effects = [];
      this.frameEl.classList.remove("final-three");
    },

    /* ---------- 盤面分析 ---------- */
    threatsOf(b, who) {
      const s = new Set();
      LINES.forEach((L) => {
        const v = L.map((i) => b[i]);
        if (v.filter((x) => x === who).length === 2 && v.includes(0)) s.add(L[v.indexOf(0)]);
      });
      return s;
    },
    /** 這一步的意義：score（貫通）/ double（一子雙脈）/ block（阻斷）/ fork（雙線布局）/ normal */
    classify(before, cell, who) {
      const after = before.slice(); after[cell] = who;
      let lines = 0;
      LINES.forEach((L) => { if (L.includes(cell) && L.every((i) => after[i] === who)) lines++; });
      const blocked = this.threatsOf(before, -who).has(cell);
      const prior = this.threatsOf(before, who);
      const own = this.threatsOf(after, who);
      const opponent = this.threatsOf(after, -who);
      const madeThreat = [...own].some((i) => !prior.has(i));
      return {
        kind: lines > 1 ? "double" : lines ? "score" : blocked ? "block" : own.size >= 2 && madeThreat ? "fork" : "normal",
        blocked, madeThreat, dualThreat: own.size > 0 && opponent.size > 0,
        forkTargets: own.size >= 2 && madeThreat ? [...own] : []
      };
    },

    center(i) {
      const r = this.cells[i].getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2, r.width];
    },

    /* ---------- 事件 ---------- */
    reset() {
      this.timers.forEach(clearTimeout);
      this.timers.clear();
      this.ended = false;
      this.hover = null;
      this.cells.forEach((c) => {
        delete c.dataset.force;
        delete c.dataset.owner;
      });
      this.board = new Array(9).fill(0);
      this.effects = [];
      this.cells.forEach((c) => c.classList.remove("piece-fresh", "piece-breathe", "piece-awaken", "relay-glow", "settle-lit", "settle-dim"));
      if (this.frameEl) this.frameEl.classList.remove("final-three", "rune-awake", "ninth-hush", "score-tie", "score-human-lead", "score-ai-lead");
      document.body.classList.remove("ninth-hush");
    },

    setHover(i, canCast) {
      this.hover = canCast && i != null ? { i, t0: now() } : null;
    },

    /** 棋子落地（命中瞬間）呼叫 */
    onLanded(i, who, info, moveNum) {
      this.board[i] = who;
      const cell = this.cells[i];
      // 棋子：強烈亮起 → 呼吸
      cell.classList.remove("piece-breathe");
      cell.classList.add("piece-fresh");
      this.later(() => { cell.classList.remove("piece-fresh"); cell.classList.add("piece-breathe"); }, 900);
      cell.dataset.owner = String(who);
      // 落子力度：回彈樣式
      cell.dataset.force = info.kind;
      this.later(() => { if (cell.dataset.force === info.kind) delete cell.dataset.force; }, 700);

      // 餘波接力：己方棋子依距離逐一亮起
      const [cx, cy] = this.center(i);
      const own = [];
      for (let k = 0; k < 9; k++) if (k !== i && this.board[k] === who) {
        const [x, y] = this.center(k); own.push([Math.hypot(x - cx, y - cy), k]);
      }
      own.sort((a, b) => a[0] - b[0]).slice(0, 4).forEach(([d, k], n) => {
        this.later(() => {
          const c = this.cells[k]; c.classList.remove("relay-glow"); void c.offsetWidth; c.classList.add("relay-glow");
          window.HW06_AUDIO?.playRelayTick?.(n, who === 1);
        }, 120 + n * 110);
      });

      // 主要演出（一次只選一個）
      if (this.ended) return;
      if (info.blocked) {
        this.effects.push({ type: "barrier", i, who, t0: now(), dur: 900 });
        // 截斷對方那條能量線
        LINES.forEach((L) => {
          if (!L.includes(i)) return;
          const opp = L.filter((k) => this.board[k] === -who);
          if (opp.length === 2) this.effects.push({ type: "cut", a: opp[0], b: opp[1], who: -who, t0: now(), dur: 750 });
        });
        window.HW06_AUDIO?.playBarrier?.(who === 1);
        this.callout(i, who === 1 ? "封！" : "斷！", "block");
        if (info.madeThreat && !info.forkTargets.length) this.banner("封路反擊", who === 1 ? "human" : "ai");
      }
      if (info.forkTargets.length) {
        info.forkTargets.forEach((target) => {
          this.effects.push({ type: "branch", from: i, to: target, who, t0: now(), dur: 1100 });
        });
        this.callout(i, "雙線布局", "fork");
      }
      this.updateTension(moveNum);
    },

    /** 靈脈棋子甦醒 */
    awakenLine(L) {
      L.forEach((k, n) => this.later(() => {
        const c = this.cells[k]; c.classList.remove("piece-awaken"); void c.offsetWidth; c.classList.add("piece-awaken");
      }, n * 90));
    },

    /** 末三印升溫 */
    updateTension(moveNum) {
      if (!this.frameEl) return;
      this.frameEl.classList.toggle("final-three", moveNum >= 6 && moveNum < 9);
    },

    /** 第九印前的靜場：背景放慢、壓低音樂、視線集中落點 */
    finalFocus(i, ms) {
      document.body.classList.add("ninth-hush");
      this.effects.push({ type: "focus", i, t0: now(), dur: ms || 900 });
      this.later(() => document.body.classList.remove("ninth-hush"), ms);
    },

    callout(i, text, kind) {
      const r = this.cells[i].getBoundingClientRect();
      const d = document.createElement("div");
      d.className = "bd-callout bd-" + kind;
      d.textContent = text;
      d.style.left = (r.left + r.width / 2) + "px"; d.style.top = (r.top + r.height * 0.18) + "px";
      document.body.appendChild(d);
      this.later(() => d.remove(), 1100);
    },
    banner(text, kind) {
      if (!this.boardEl) return;
      const r = this.boardEl.getBoundingClientRect();
      const d = document.createElement("div");
      d.className = "bd-banner bd-" + kind;
      d.textContent = text;
      d.style.left = (r.left + r.width / 2) + "px"; d.style.top = (r.top + r.height / 2) + "px";
      document.body.appendChild(d);
      this.later(() => d.remove(), 1500);
    },

    /* ---------- 每格畫面 ---------- */
    frame(t) {
      const lite = this.tier === "compat";
      if (t - this.lastT < (lite ? 66 : 30)) return;
      this.lastT = t;
      const c = this.canvas, ctx = this.ctx;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      if (!this.cells.length || document.querySelector("#cinema-overlay.open")) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const T = t / 1000;

      // 1) 雙印共鳴：同一直線兩枚己方棋子＋一空格 → 兩子之間的能量線，並向空格延伸一段漸隱的光尾
      if (!this.ended && document.body.classList.contains("show-hints")) LINES.forEach((L) => {
        const v = L.map((k) => this.board[k]);
        [1, -1].forEach((who) => {
          if (v.filter((x) => x === who).length !== 2 || !v.includes(0)) return;
          const own = L.filter((k) => this.board[k] === who);
          const empty = L[v.indexOf(0)];
          const pA = this.center(own[0]), pB = this.center(own[1]), pE = this.center(empty);
          const a = 0.75 + 0.25 * Math.sin(T * 3 + L[0]);
          const deep = who === 1 ? [214, 92, 24] : [0, 168, 160];
          ctx.save();
          ctx.lineCap = "round";
          // 底層深色描邊，讓光線在和紙上也看得清楚
          ctx.strokeStyle = "rgba(30,16,8,0.35)"; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]); ctx.stroke();
          if (!lite) { ctx.shadowColor = rgba(COL[who], 0.9); ctx.shadowBlur = 12; }
          ctx.strokeStyle = rgba(deep, a); ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]); ctx.stroke();
          ctx.strokeStyle = rgba(COL[who], a); ctx.lineWidth = 2.4;
          ctx.setLineDash([14, 8]); ctx.lineDashOffset = -T * 46 * (who === 1 ? 1 : -1);
          ctx.beginPath(); ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]); ctx.stroke();
          // 光尾：從較近的那枚棋子指向空格
          const near = Math.hypot(pA[0] - pE[0], pA[1] - pE[1]) < Math.hypot(pB[0] - pE[0], pB[1] - pE[1]) ? pA : pB;
          const g = ctx.createLinearGradient(near[0], near[1], pE[0], pE[1]);
          g.addColorStop(0, rgba(deep, a * 0.9)); g.addColorStop(1, rgba(deep, 0));
          ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.setLineDash([6, 8]);
          ctx.beginPath(); ctx.moveTo(near[0], near[1]); ctx.lineTo(pE[0], pE[1]); ctx.stroke();
          ctx.restore();
        });
      });

      // 2) 指尖聚靈：滑鼠停在可下的格子上 → 蓮的指尖聚光，細小光流連到該格
      if (this.hover && window.HW06_RIGS?.handScreen) {
        const k = Math.min(1, (t - this.hover.t0) / 260);
        const hand = window.HW06_RIGS.pointScreen ? window.HW06_RIGS.pointScreen("ren", "finger") : window.HW06_RIGS.handScreen("ren");
        if (hand && k > 0) {
          const [x1, y1] = this.center(this.hover.i);
          const x0 = hand.handScreenX, y0 = hand.handScreenY;
          const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 60;
          const R0 = 22 + 6 * Math.sin(T * 6);
          const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, R0);
          g.addColorStop(0, `rgba(255,250,225,${0.95 * k})`); g.addColorStop(0.35, `rgba(255,200,110,${0.6 * k})`); g.addColorStop(1, "rgba(255,180,80,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0, y0, R0, 0, Math.PI * 2); ctx.fill();
          const g2 = ctx.createRadialGradient(x1, y1, 0, x1, y1, 40);
          g2.addColorStop(0, `rgba(255,220,150,${0.35 * k})`); g2.addColorStop(1, "rgba(255,180,80,0)");
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x1, y1, 40, 0, Math.PI * 2); ctx.fill();
          ctx.save();
          ctx.lineCap = "round";
          ctx.strokeStyle = `rgba(40,18,6,${0.3 * k})`; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
          if (!lite) { ctx.shadowColor = "rgba(255,200,110,0.9)"; ctx.shadowBlur = 8; }
          ctx.strokeStyle = `rgba(238,120,40,${0.95 * k})`; ctx.lineWidth = 3;
          ctx.setLineDash([5, 9]); ctx.lineDashOffset = -T * 60;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
          ctx.restore();
          // 沿路徑流動的光點
          for (let n = 0; n < (lite ? 2 : 5); n++) {
            const u = ((T * 0.9 + n / 5) % 1);
            const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1;
            const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1;
            ctx.fillStyle = `rgba(255,244,210,${0.95 * k * Math.sin(u * Math.PI)})`;
            ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // 3) 一次性演出
      this.effects = this.effects.filter((e) => {
        const p = (now() - e.t0) / e.dur;
        if (p >= 1) return false;
        if (e.type === "barrier") {
          const [x, y, w] = this.center(e.i);
          const r = w * (0.35 + 0.35 * Math.min(1, p * 3));
          ctx.save();
          ctx.strokeStyle = rgba(COL[e.who], 0.9 * (1 - p)); ctx.lineWidth = 3;
          ctx.fillStyle = rgba(COL[e.who], 0.16 * (1 - p));
          ctx.beginPath();
          for (let s = 0; s <= 6; s++) { const a = s * Math.PI / 3 + T; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.fill(); ctx.stroke(); ctx.restore();
        } else if (e.type === "cut") {
          const [ax, ay] = this.center(e.a), [bx, by] = this.center(e.b);
          const mx = (ax + bx) / 2, my = (ay + by) / 2, sp = 18 * p;
          ctx.save(); ctx.strokeStyle = rgba(COL[e.who], 0.8 * (1 - p)); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mx - (bx - ax) * 0.04 - sp, my - (by - ay) * 0.04); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx + (bx - ax) * 0.04 + sp, my + (by - ay) * 0.04); ctx.stroke();
          // 斷口火花
          for (let n = 0; n < 6; n++) { const a = n * 1.05; ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.fillRect(mx + Math.cos(a) * 30 * p, my + Math.sin(a) * 30 * p, 3, 3); }
          ctx.restore();
        } else if (e.type === "branch") {
          const [ax, ay] = this.center(e.from), [bx, by] = this.center(e.to);
          const u = Math.min(1, p * 1.6);
          ctx.save(); ctx.strokeStyle = rgba(COL[e.who], 0.85 * (1 - p * 0.6)); ctx.lineWidth = 4;
          if (!lite) { ctx.shadowColor = rgba(COL[e.who], 1); ctx.shadowBlur = 14; }
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * u, ay + (by - ay) * u); ctx.stroke(); ctx.restore();
        } else if (e.type === "focus") {
          const [x, y, w] = this.center(e.i);
          const a = Math.sin(p * Math.PI);
          const g = ctx.createRadialGradient(x, y, w * 0.4, x, y, Math.max(innerWidth, innerHeight));
          g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.25, `rgba(0,0,0,${0.45 * a})`); g.addColorStop(1, `rgba(0,0,0,${0.65 * a})`);
          ctx.fillStyle = g; ctx.fillRect(0, 0, innerWidth, innerHeight);
        }
        return true;
      });
    }
  };

  window.HW06_BOARD = BD;
})();
