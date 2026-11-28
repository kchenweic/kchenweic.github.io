/* ==========================================================================
   1142949 HW06 — 關鍵手短分鏡（取代單張立繪橫幅 cut-in）
   反制／貫通靈脈／第 9 手：
     ① 眼部特寫（0.42 秒）→ ② 手部特寫：掌心狐火聚集／符咒點燃（0.44 秒）
     → ③ 帶狀畫面收合，回到棋盤，由遊戲本身的彈道打進格子
   一般落子不進分鏡，只有角色卡上的短動作與彈道。
   大動作不另畫新姿勢圖（無法產生同畫風原畫），改以原立繪局部特寫＋光效呈現。
   ========================================================================== */
(function () {
  "use strict";

  const A_MS = 420, B_MS = 440, C_MS = 300;
  let canvas = null, ctx = null, busy = Promise.resolve(), tier = "ultra";

  function ensure() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "keyshot-canvas";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "85", pointerEvents: "none", display: "none" });
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return [w, h, dpr];
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function glow(x, y, r, rgb, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.3, `rgba(${rgb},${a * 0.8})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  /**
   * kind: "counter" | "vein" | "final"
   * who: "ren" | "tamamo"
   * opts: { title, sub, cellEl }
   * 回傳 Promise：手部特寫結束、開始收回棋盤時 resolve（遊戲接著發射彈道）
   */
  function play(kind, who, opts) {
    const run = () => new Promise((resolveCast) => {
      const ACT = window.HW06_ACTORS;
      if (!ACT || !ACT.CAST[who]) { resolveCast(); return; }
      ensure();
      canvas.style.display = "block";
      const def = ACT.CAST[who];
      const isBoss = who !== "ren";
      const rgb = isBoss ? "73,242,225" : "255,196,92";
      const edge = isBoss ? "#49f2e1" : "#ffcf6b";
      const short = kind === "vein";
      const total = short ? A_MS + C_MS : A_MS + B_MS + C_MS;
      const t0 = performance.now();
      let released = false;
      const lite = tier === "compat";

      const frame = (ms) => {
        const el = ms - t0;
        const [W, H] = fit();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const tt = ms / 1000;

        // 階段
        const inA = el < A_MS, inB = !short && el >= A_MS && el < A_MS + B_MS;
        const cStart = short ? A_MS : A_MS + B_MS;
        const cK = clamp01((el - cStart) / C_MS);
        if (!released && el >= cStart) { released = true; resolveCast(); }

        // 背景輕壓暗（棋盤仍隱約可見）
        ctx.fillStyle = `rgba(4,6,12,${0.42 * (1 - cK)})`;
        ctx.fillRect(0, 0, W, H);

        // 帶狀畫面（斜切）
        const bandH = H * 0.34 * (1 - easeOut(cK));
        const cy = H * 0.44;
        const slideK = easeOut(clamp01(el / 140));
        const dir = isBoss ? 1 : -1;
        const offX = (1 - slideK) * W * 0.6 * dir;
        const skew = H * 0.06;
        if (bandH > 2) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(offX - 20, cy - bandH / 2 + skew); ctx.lineTo(offX + W + 20, cy - bandH / 2 - skew);
          ctx.lineTo(offX + W + 20, cy + bandH / 2 - skew); ctx.lineTo(offX - 20, cy + bandH / 2 + skew);
          ctx.closePath();
          ctx.save(); ctx.clip();
          const bg = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
          bg.addColorStop(0, isBoss ? "#031c1d" : "#250805"); bg.addColorStop(0.5, isBoss ? "#0a3b3b" : "#4a120c"); bg.addColorStop(1, "#05070c");
          ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
          // 速度線
          if (!lite) {
            ctx.strokeStyle = `rgba(${rgb},0.22)`;
            for (let i = 0; i < 26; i++) {
              const y = cy - bandH / 2 + ((i * 97 + el * 0.9) % bandH);
              const x = ((i * 233 + el * 3.2 * dir) % (W * 1.4)) - W * 0.2;
              ctx.lineWidth = 1 + (i % 3);
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + W * 0.25 * -dir, y); ctx.stroke();
            }
          }
          if (inA || short || el < A_MS) {
            // ① 眼部特寫
            const [fx, fy, fw, fh] = def.faceCrop;
            const k = clamp01(el / A_MS);
            const s = (W * 0.62 / fw) * (1.0 + 0.06 * k);
            const ex = (fx + fw / 2), ey = (fy + fh / 2);
            ACT.drawActor(ctx, who, offX + W * 0.5 - ex * s, cy - ey * s, s, { noWarp: true, fx: false, mouth: 0 });
            ctx.globalCompositeOperation = "lighter";
            def.eyes.forEach(([x, y]) => glow(offX + W * 0.5 + (x - ex) * s, cy + (y - ey) * s, 46 * (H / 900) * (1 + k), rgb, 0.35 + 0.35 * k));
            ctx.globalCompositeOperation = "source-over";
          } else {
            // ② 手部特寫：狐火聚集／符咒點燃
            const [hx0, hy0, hw, hh] = def.handCrop;
            const k = clamp01((el - A_MS) / B_MS);
            const s = (bandH * 1.25 / hh) * (1.0 + 0.08 * k);
            const [hx, hy] = def.hand;
            const px = W * 0.5, py = cy;
            ACT.drawActor(ctx, who, px - hx * s, py - hy * s, s, { noWarp: true, fx: false, mouth: 0 });
            ctx.globalCompositeOperation = "lighter";
            const R = bandH * (0.12 + 0.28 * easeOut(k));
            glow(px, py, R * 2.2, rgb, 0.65);
            for (let i = 0; i < (lite ? 8 : 18); i++) {
              const a = i * 2.39 + tt * 3;
              const d = R * (2.6 - 2.0 * ((k * 1.6 + i * 0.07) % 1));
              glow(px + Math.cos(a) * d, py + Math.sin(a) * d * 0.7, R * 0.28, rgb, 0.6);
            }
            if (!isBoss) {
              ctx.strokeStyle = `rgba(255,220,140,${0.9})`; ctx.lineWidth = 3;
              ctx.save(); ctx.translate(px, py); ctx.rotate(tt * 2);
              ctx.beginPath(); ctx.arc(0, 0, R * 1.5, 0, Math.PI * 2); ctx.stroke();
              ctx.beginPath();
              for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); i ? ctx.lineTo(Math.cos(a) * R * 1.4, Math.sin(a) * R * 1.4) : ctx.moveTo(Math.cos(a) * R * 1.4, Math.sin(a) * R * 1.4); }
              ctx.stroke(); ctx.restore();
            }
            ctx.globalCompositeOperation = "source-over";
            // 切鏡白閃
            if (k < 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k / 0.12)})`; ctx.fillRect(0, 0, W, H); }
          }
          ctx.restore();
          // 邊框
          ctx.strokeStyle = edge; ctx.lineWidth = Math.max(2, H * 0.004);
          ctx.stroke();
          ctx.restore();

          // 招式名
          if (opts && opts.title) {
            const fs = Math.round(H * 0.042);
            ctx.save();
            ctx.globalAlpha = clamp01(el / 160) * (1 - cK);
            ctx.font = `900 ${fs}px "Noto Serif TC","Noto Serif CJK TC",serif`;
            ctx.textAlign = isBoss ? "left" : "right";
            const tx = isBoss ? W * 0.06 : W * 0.94;
            const ty = cy + bandH / 2 - fs * 0.55;
            ctx.lineWidth = fs * 0.16; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(opts.title, tx, ty);
            ctx.fillStyle = "#fff7e6"; ctx.fillText(opts.title, tx, ty);
            if (opts.sub) {
              ctx.font = `700 ${Math.round(fs * 0.42)}px "Noto Sans TC",sans-serif`;
              ctx.fillStyle = edge; ctx.fillText(opts.sub, tx, cy - bandH / 2 + fs * 0.9);
            }
            ctx.restore();
          }
        }

        if (el < total) requestAnimationFrame(frame);
        else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); canvas.style.display = "none"; if (!released) resolveCast(); doneAll(); }
      };
      let doneAll;
      const finished = new Promise((r) => (doneAll = r));
      run.finished = finished;
      requestAnimationFrame(frame);
    });

    // 依序播放，避免兩段分鏡重疊
    const castReady = busy.then(run);
    busy = castReady.then(() => new Promise((r) => setTimeout(r, C_MS + 20)));
    return castReady;
  }

  window.HW06_SHOTS = { play, setPerformanceTier: (t) => { tier = t || "ultra"; }, isBusy: () => canvas && canvas.style.display === "block" };
})();
