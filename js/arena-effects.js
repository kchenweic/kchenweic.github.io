/* Arena-scale choreography. Board-local marks and game rules stay in their own modules. */
(function () {
  "use strict";

  const TAU = 2 * Math.PI;
  const audio = window.HW06_AUDIO;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gold = { hot: "#fff3b7", light: "#ffbc49", dark: "#aa342d", rgb: "255,155,48" };
  const jade = { hot: "#d0ffff", light: "#54f6e0", dark: "#26499d", rgb: "59,225,215" };
  const violet = { hot: "#fff1dd", light: "#cb88ff", dark: "#49225a", rgb: "170,101,255" };
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const out = (p) => 1 - (1 - p) ** 3;
  const fade = (p, start = .65) => 1 - clamp((p - start) / (1 - start));
  const rgba = (tone, a) => `rgba(${tone.rgb},${clamp(a)})`;
  const sounds = { stellar: "stellar", fox: "fox", gate: "gate", blessing: "paper", fracture: "fracture", alignment: "alignment", endgame: "lift", gravity: "gravity", crown: "crown" };
  const durations = {
    gate: 1250, stellar: 1260, fox: 2100, blessing: 1450, fracture: 960,
    alignment: 1510, endgame: 1350, gravity: 3560, crown: 1920
  };
  const tileOrder = [4, 0, 8, 2, 6, 1, 7, 3, 5];

  let board, cells, stage, canvas, ctx, raf = 0, tier = "high";
  const active = [];

  function geometry() {
    const panel = board.getBoundingClientRect();
    const arena = stage.getBoundingClientRect();
    const width = Math.min(2040, innerWidth * .86);
    const center = innerWidth * .51;
    const top = Math.max(innerHeight * .09, Math.min(arena.top, panel.top) - 10);
    const bottom = Math.min(innerHeight * .98, Math.max(panel.bottom + 156, arena.top + innerHeight * .68));
    const height = Math.max(120, bottom - top);
    const point = (i) => {
      const r = cells[i].getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    return { width, height, left: center - width / 2, center, top, bottom, middle: (top + bottom) / 2, point };
  }

  function line(points, tone, size, alpha) {
    if (points.length < 2 || alpha <= 0) return;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.strokeStyle = rgba(tone, alpha * .75);
    ctx.lineWidth = size * 3.3;
    ctx.stroke();
    ctx.strokeStyle = tone.hot;
    ctx.lineWidth = size;
    const old = ctx.globalAlpha;
    ctx.globalAlpha *= alpha;
    ctx.stroke();
    ctx.globalAlpha = old;
  }

  function glow(x, y, radius, tone, a) {
    if (radius < 1 || a <= 0) return;
    const g = ctx.createRadialGradient(x, y, radius * .12, x, y, radius);
    g.addColorStop(0, rgba(tone, a));
    g.addColorStop(.55, rgba(tone, a * .44));
    g.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function ellipse(x, y, rx, ry, tone, alpha, width, angle = 0, end = TAU, start = 0) {
    if (rx < 1 || ry < 1 || end <= start || alpha <= 0) return;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, start, end);
    ctx.strokeStyle = rgba(tone, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function star(x, y, r, angle, tone, alpha) {
    if (r < 1 || alpha <= 0) return;
    const pts = Array.from({ length: 11 }, (_, i) => {
      const t = i * TAU / 10 + angle;
      const radius = i % 2 ? .44 : 1;
      return [x + Math.cos(t) * r * radius, y + Math.sin(t) * r * radius];
    });
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, tone.hot); g.addColorStop(.51, tone.light); g.addColorStop(1, tone.dark);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach((pt) => ctx.lineTo(...pt));
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    line(pts, tone, Math.max(1, r * .034), alpha * .86);
  }

  function ring(g, x, y, p, tone, strength = 1) {
    const radius = g.width * .53 * out(p);
    const stretch = g.height / g.width;
    const a = Math.sin(clamp(p * 2.5) * Math.PI / 2) * fade(p, .42) * strength;
    ellipse(x, y, radius, radius * stretch * .72, tone, .34 * a, 20 * (1 - p) + 4, -.10);
    ellipse(x, y, radius, radius * stretch * .72, tone, .97 * a, 5 * (1 - p) + 1.8, -.10);
    ellipse(x, y, radius * .86, radius * stretch * .59, tone, .65 * a, 2.5, -.11);
  }

  function sparks(g, e, x, y, p, count = 46) {
    const n = tier === "compat" ? Math.ceil(count * .58) : count;
    ctx.fillStyle = e.tone.hot;
    for (let i = 0; i < n; i++) {
      const t = i * 2.399963 + e.seed;
      const q = clamp(p * 1.3 - (i % 7) * .025);
      const scale = (.23 + (i % 9) * .023) * out(q);
      const dx = Math.cos(t) * g.width * scale;
      const dy = Math.sin(t) * g.height * scale * 1.42 + q ** 2 * 28;
      const a = fade(q, .42) * Math.min(1, p * 10);
      if (!a) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(x + dx, y + dy, 2 + (i % 5) * 1.15, 2 + i % 4);
      if (!(i % 6)) line([[x + dx * .91, y + dy * .91], [x + dx, y + dy]], e.tone, 1.4, a * .7);
    }
    ctx.globalAlpha = 1;
  }

  function gate(g, e, p) {
    const alpha = fade(p, .65) * Math.min(1, p * 6);
    const cx = g.center, cy = g.middle + g.height * .08;
    const spread = g.width * (.22 + .26 * out(p));
    glow(cx, cy, g.width * .24, e.tone, alpha * .34);
    for (let j = 0; j < 3; j++) {
      ellipse(cx, cy, spread * (1 - j * .11), Math.min(g.height * .36, spread * .58) * (1 - j * .15),
        e.tone, alpha * (.76 - j * .16), 3 + (j === 0 ? 2 : 0), -.06);
    }
    tileOrder.forEach((tile, n) => {
      const t = clamp((p - n * .038) / .57);
      if (t <= 0 || t >= 1) return;
      const a = TAU * n / 9 + .12;
      const sx = cx + Math.cos(a) * g.width * .473;
      const sy = cy + Math.sin(a) * g.height * .385;
      const [ex, ey] = g.point(tile);
      const x = mix(sx, ex, out(t)), y = mix(sy, ey, out(t)) - Math.sin(t * Math.PI) * 44;
      const size = Math.min(63, g.width * .060) * (1 - t * .48);
      const rot = a + t * Math.PI;
      const points = Array.from({ length: 5 }, (_, i) => {
        const a = i * Math.PI / 2 + rot;
        return [x + Math.cos(a) * size, y + Math.sin(a) * size * .49];
      });
      line([[sx, sy], [x, y]], e.tone, 2.1, alpha * .36 * (1 - t));
      glow(x, y, size * 1.95, e.tone, .34 * alpha);
      line(points, e.tone, 2.15, alpha);
    });
    sparks(g, e, cx, cy, p, 69);
  }

  function stellar(g, e, p) {
    const [x, y] = g.point(e.index);
    const cy = Math.min(y, g.top + g.height * .50);
    const sx = g.left + g.width * .17;
    const a = Math.min(1, p * 8) * fade(p, .5);
    const r = Math.min(g.width * .083, g.height * .2) * (.55 + out(p) * .45);
    const core = ctx.createRadialGradient(sx - r * .23, cy - r * .25, r * .03, sx, cy, r);
    core.addColorStop(0, "#fffdf1"); core.addColorStop(.44, "#ffe49e"); core.addColorStop(.85, "#f59138"); core.addColorStop(1, "#e45228");
    glow(sx, cy, r * 2.1, e.tone, a * .80);
    ctx.globalAlpha = a;
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(sx, cy, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    const points = [-.04, .2, .51, .78, 1, 1.21].map((q, n) => [
      g.left + g.width * q, mix(cy, y, q) + Math.sin(q * Math.PI + p * 6) * (36 + n * 3)
    ]);
    line(points, e.tone, 4.8, a * .68);
    for (let i = 0; i < 5; i++) {
      const q = clamp(out(p) - i * .08);
      star(mix(sx, g.left + g.width * .96, q), mix(cy, y, q) + Math.sin(q * 5 + i) * g.height * .22,
        Math.max(10, r * (.55 - i * .06)), -1.55 + q * 6 + i, e.tone, a * (1 - i * .075));
    }
    ring(g, g.center, y, p, e.tone, .83);
    sparks(g, e, x, y, p);
  }

  function planet(g, x, y, r, p, a) {
    glow(x, y, r * 1.86, jade, a * .58);
    ellipse(x, y, r * 1.72, r * .44, jade, a * .65, 7, -.32, Math.PI);
    const field = ctx.createRadialGradient(x - r * .37, y - r * .31, r * .08, x + r * .12, y + r * .13, r * 1.1);
    field.addColorStop(0, "#f1ffea"); field.addColorStop(.32, "#89e3df"); field.addColorStop(.7, "#397da8"); field.addColorStop(1, "#15223e");
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = field; ctx.fill(); ctx.clip();
    for (let stripe = -3; stripe <= 3; stripe++) {
      ellipse(x, y + stripe * r * .13, r * 1.05, r * .2, jade, .31, r * .08, -.19);
    }
    ctx.restore();
    ellipse(x, y, r * 1.72, r * .44, jade, a * .88, 6, -.32, TAU, Math.PI);
    ellipse(x, y, r * 1.84, r * .53, jade, a * .7, 1.8, -.32);
    for (let n = 0; n < 2; n++) {
      const phase = TAU * p + n * 2.5;
      const mx = x + Math.cos(phase) * r * (1.6 + n * .54), my = y + Math.sin(phase) * r * .66;
      glow(mx, my, r * .38, jade, a * .85);
      ctx.globalAlpha = a;
      ctx.fillStyle = jade.hot; ctx.beginPath(); ctx.arc(mx, my, r * .095, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* v15：用火焰粒子組成的九尾妖狐靈體（取代平面剪影），從右側角色區撲進落子格 */
  const spriteCache = {};
  function flameSprite(core, mid, edge) {
    const key = core + mid + edge;
    if (spriteCache[key]) return spriteCache[key];
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const f = c.getContext("2d"), gr = f.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${core},1)`); gr.addColorStop(.3, `rgba(${mid},.85)`); gr.addColorStop(.65, `rgba(${edge},.3)`); gr.addColorStop(1, `rgba(${edge},0)`);
    f.fillStyle = gr; f.fillRect(0, 0, 64, 64);
    return (spriteCache[key] = c);
  }
  // 狐狸輪廓（面向 +x，單位長度約 2）
  const FOX_OUTLINE = [[1.3, -.12], [1.05, -.3], [.92, -.46], [.86, -1.0], [.66, -.52], [.5, -.92], [.38, -.4], [.1, -.32], [-.3, -.3], [-.7, -.26], [-.98, -.12],
    [-.9, .08], [-.62, .16], [-.2, .2], [.3, .2], [.62, .14], [.95, .05], [1.22, -.02]];
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const FOX_FILL = (() => {
    const pts = [];
    for (let x = -1; x <= 1.3; x += .11) for (let y = -1; y <= .25; y += .1) if (inside([x, y], FOX_OUTLINE)) pts.push([x, y]);
    return pts;
  })();

  function fox(g, e, p) {
    const [x, y] = g.point(e.index);
    const run = out(clamp(p / .6));
    const sx = g.left + g.width * 1.04, sy = g.top + g.height * .3;
    const hx = mix(sx, x, run), hy = mix(sy, y, run) - Math.sin(run * Math.PI) * g.height * .18;
    const a = Math.min(1, p * 8) * fade(p, .84);
    const S = Math.min(g.width * .15, g.height * .42) * (1.2 - run * .3);
    if (p < .64) glow(hx, hy, S * 2.2, jade, a * .45);
    const ang = Math.atan2(y - sy, x - sx);
    const F = flameSprite("235,255,255", "90,240,230", "20,120,220");
    const t = performance.now() / 1000;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (p < .64) {
      const flip = Math.cos(ang) < 0 ? -1 : 1;   // 往左跑時讓狐狸頭朝左
      const toScreen = (u, v) => {
        const c = Math.cos(ang), s2 = Math.sin(ang);
        const vy = v * flip;
        return [hx + (u * c - vy * s2) * S, hy + (u * s2 + vy * c) * S];
      };
      // 九條火尾：一串串火焰粒子，往後甩出並擺動
      for (let i = 0; i < 9; i++) {
        const spread = (i - 4) * .16;
        for (let k = 0; k < 18; k++) {
          const u = -.95 - k * .2, v = -.1 + spread * k * .5 + Math.sin(t * 9 + i + k * .35) * .12 * k * .2;
          const [px, py] = toScreen(u, v);
          const z = S * (.62 - k * .025) * (1 + .15 * Math.sin(t * 20 + k + i));
          ctx.globalAlpha = clamp(a * (1 - k / 20) * .55);
          ctx.drawImage(F, px - z / 2, py - z / 2, z, z);
        }
      }
      // 身體：輪廓內部塞滿閃爍的狐火
      FOX_FILL.forEach(([u, v], i) => {
        const [px, py] = toScreen(u + Math.sin(t * 14 + i) * .02, v + Math.cos(t * 12 + i) * .02);
        const z = S * (.42 + .12 * Math.sin(t * 18 + i * 1.7));
        ctx.globalAlpha = clamp(a * .55);
        ctx.drawImage(F, px - z / 2, py - z / 2, z, z);
      });
      // 輪廓描邊：更亮、更細
      FOX_OUTLINE.forEach(([u, v]) => { const [px, py] = toScreen(u, v); const z = S * .3; ctx.globalAlpha = clamp(a * .9); ctx.drawImage(F, px - z / 2, py - z / 2, z, z); });
      // 奔跑的四肢
      const step = Math.sin(t * 22);
      [[.5, 1], [.3, -1], [-.55, 1], [-.75, -1]].forEach(([u, s]) => {
        for (let k = 0; k < 4; k++) { const [px, py] = toScreen(u + s * step * .12 * k / 3, .2 + k * .16); const z = S * .26; ctx.globalAlpha = clamp(a * .7); ctx.drawImage(F, px - z / 2, py - z / 2, z, z); }
      });
      ctx.globalCompositeOperation = "source-over";
      // 發亮的眼睛與吻部紅紋
      const [ex, ey] = toScreen(.86, -.28);
      ctx.globalAlpha = clamp(a);
      glow(ex, ey, S * .22, { rgb: "255,60,90" }, a);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, ey, S * .07, S * .035, ang, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      // 殘影
      for (let k = 1; k <= 6; k++) {
        const q = clamp(run - k * .05);
        const gx = mix(sx, x, q), gy = mix(sy, y, q) - Math.sin(q * Math.PI) * g.height * .18;
        ctx.globalAlpha = clamp(a * (.35 - k * .05)); const z = S * 2.4; ctx.drawImage(F, gx - z / 2, gy - z / 2, z, z);
      }
    }
    // 撲進落子格：狐火爆發、九團狐火繞圈後四散
    if (p >= .58) {
      const q = clamp((p - .58) / .42);
      ctx.globalCompositeOperation = "source-over";
      for (let r = 0; r < 3; r++) {
        const rq = clamp((q - r * .08) / .7);
        ellipse(x, y, out(rq) * g.width * .55, out(rq) * g.height * .42, jade, (1 - rq) * a, 14 * (1 - rq) + 2);
      }
      ctx.globalCompositeOperation = "lighter";
      const z0 = S * 3 * (1 - q * .6);
      ctx.globalAlpha = clamp(a * (1 - q)); ctx.drawImage(F, x - z0 / 2, y - z0 / 2, z0, z0);
      for (let i = 0; i < 9; i++) {
        const t2 = i / 9 * TAU + q * 6, rr = mix(S * .5, g.width * .45, out(q));
        const z = S * (.9 - q * .4);
        ctx.globalAlpha = clamp(a);
        ctx.drawImage(F, x + Math.cos(t2) * rr - z / 2, y + Math.sin(t2) * rr * .7 - z / 2, z, z);
      }
    }
    ctx.restore();
    sparks(g, e, x, y, p, 90);
  }

  /* v15：最後一手「九星天命陣」——取代舊版暗色球體 */
  function gravity(g, e, p) {
    const [tx, ty] = g.point(e.index);
    const a = Math.min(1, p * 6) * fade(p, .86);
    const cx = g.center, cy = g.middle;
    ctx.fillStyle = `rgba(2,2,12,${clamp(a * .45)})`; ctx.fillRect(0, 0, innerWidth, innerHeight);
    const RX = g.width * .44, RY = g.height * .2, rot = p * 2.4;
    const F1 = flameSprite("255,255,230", "255,200,90", "220,120,20"), F2 = flameSprite("235,255,255", "90,240,230", "20,120,220");
    // 天命金環：兩層傾斜的光環＋刻度
    for (const [k, col, w] of [[1, gold, 6], [.86, violet, 3]]) {
      ellipse(cx, cy, RX * k, RY * k, col, a * .9, w, -.08);
      ctx.save(); ctx.strokeStyle = rgba(col, a * .8); ctx.lineWidth = 2;
      for (let i = 0; i < 48; i++) {
        const t2 = i / 48 * TAU + rot * (k === 1 ? 1 : -1.4);
        const ox = Math.cos(t2), oy = Math.sin(t2);
        ctx.beginPath(); ctx.moveTo(cx + ox * RX * k, cy + oy * RY * k); ctx.lineTo(cx + ox * RX * k * .94, cy + oy * RY * k * .94); ctx.stroke();
      }
      ctx.restore();
    }
    // 金環上的光柱
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 9; i++) {
      const t2 = i / 9 * TAU + rot;
      const px = cx + Math.cos(t2) * RX, py = cy + Math.sin(t2) * RY;
      const h = g.height * (.5 + .2 * Math.sin(p * 9 + i)) * Math.min(1, p * 4);
      const gr = ctx.createLinearGradient(px, py, px, py - h);
      gr.addColorStop(0, rgba(gold, a * .7)); gr.addColorStop(1, rgba(gold, 0));
      ctx.fillStyle = gr; ctx.fillRect(px - 10, py - h, 20, h);
    }
    // 九顆天星：先在高空排成弧形，再沿金環盤旋，最後一顆顆墜入落子格
    for (let i = 0; i < 9; i++) {
      const F = i % 2 ? F2 : F1;
      const sx0 = g.left + g.width * (.1 + i * .1), sy0 = g.top + g.height * (.12 + Math.sin(i / 8 * Math.PI) * -.06 + .06);
      const orbit = clamp((p - .25) / .35), dive = clamp((p - .62 - i * .025) / .14);
      const t2 = i / 9 * TAU + rot * 1.6;
      let px = mix(sx0, cx + Math.cos(t2) * RX * .95, out(orbit)), py = mix(sy0, cy + Math.sin(t2) * RY * .95 - g.height * .1, out(orbit));
      if (dive > 0) {
        const nx = mix(px, tx, dive * dive), ny = mix(py, ty, dive * dive);
        ctx.globalCompositeOperation = "source-over";
        line([[px, py], [nx, ny]], i % 2 ? jade : gold, 3, a * (1 - dive * .5));
        ctx.globalCompositeOperation = "lighter";
        px = nx; py = ny;
      }
      if (dive >= 1) continue;
      const z = Math.min(g.width, g.height) * (.18 + .04 * Math.sin(p * 20 + i));
      ctx.globalAlpha = clamp(a); ctx.drawImage(F, px - z / 2, py - z / 2, z, z);
    }
    // 天光直落落子格
    const beam = clamp((p - .7) / .1) * fade(p, .9);
    if (beam > 0) {
      const gr = ctx.createLinearGradient(tx - 40, 0, tx + 40, 0);
      gr.addColorStop(0, rgba(gold, 0)); gr.addColorStop(.5, rgba(gold, beam)); gr.addColorStop(1, rgba(gold, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(tx - 40, 0, 80, ty);
      const z = g.height * .5 * beam; ctx.drawImage(F1, tx - z / 2, ty - z / 2, z, z);
    }
    ctx.restore();
  }

  function blessing(g, e, p) {
    const [x, y] = g.point(e.index);
    const a = Math.min(1, p * 7) * fade(p, .67);
    const n = tier === "compat" ? 10 : 16;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const q = clamp((p - i * .016) / .79);
      if (q <= 0 || q >= 1) continue;
      const sx = g.center + side * g.width * .47, sy = g.top + g.height * (.19 + (i % 6) * .105);
      const dx = mix(sx, x, out(q)), dy = mix(sy, y, q) - Math.sin(q * Math.PI) * (85 + i * 2.6);
      const w = Math.min(25, g.width * .034) * (1.1 - q * .57);
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(dx, dy); ctx.rotate(side * (q * 4 + i * .27));
      ctx.fillStyle = "#ffd947"; ctx.fillRect(-w / 2, -w * 1.06, w, w * 2.12);
      ctx.strokeStyle = "#f9efbb"; ctx.lineWidth = 1.4; ctx.strokeRect(-w / 2, -w * 1.06, w, w * 2.12);
      ctx.fillStyle = "#922f22"; ctx.font = `bold ${Math.max(9, w * .71)}px serif`; ctx.textAlign = "center";
      ctx.fillText(i % 3 === 0 ? "鎮" : i % 3 === 1 ? "封" : "印", 0, w * .21);
      ctx.restore();
    }
    const cx = g.center, cy = g.middle;
    ellipse(cx, cy, g.width * .47 * out(p), g.height * .37 * out(p), e.tone, a * .65, 4, -.13);
  }

  function fracture(g, e, p) {
    const [x, y] = g.point(e.index);
    const a = Math.min(1, p * 10) * fade(p, .35);
    const span = out(p);
    for (let branch = 0; branch < 7; branch++) {
      const direction = branch % 2 ? 1 : -1;
      const ex = g.center + direction * g.width * (.42 + branch % 3 * .022);
      const ey = g.top + g.height * (.18 + branch * .105);
      const coords = Array.from({ length: 8 }, (_, n) => {
        const q = n * span / 7;
        return [mix(x, ex, q) + (n % 2 ? 10 : -5) * q, mix(y, ey, q) + Math.sin(n * 3 + branch) * 31 * q];
      });
      line(coords, e.tone, 2.8 - branch * .18, a);
      if (span > .41) {
        const root = coords[3];
        line([root, [root[0] + direction * g.width * .076 * span, root[1] - 12],
          [root[0] + direction * g.width * .14 * span, root[1] - 39]], e.tone, 1.25, a * .77);
      }
    }
    sparks(g, e, x, y, p, 68);
  }

  function endgame(g, e, p) {
    const a = Math.min(1, p * 8) * fade(p, .63);
    e.slots.forEach((i, n) => {
      const [x, y] = g.point(i);
      const sx = g.center + (n ? 1 : -1) * g.width * .485;
      const sy = g.top + g.height * (n ? .74 : .23);
      const q = out(p);
      line([[sx, sy], [mix(sx, x, q * .78), mix(sy, y, q * .8) - 24], [mix(sx, x, q), mix(sy, y, q)]], violet, 5, .78 * a);
      glow(x, y, Math.min(80, g.width * .083) * q, violet, .73 * a);
      ellipse(x, y + 8, 48 * q, 24 * q, violet, a, 3);
    });
  }

  function alignment(g, e, p) {
    ring(g, g.center, g.middle, p, e.tone, 1.2);
    if (p > .19) ring(g, g.center, g.middle, (p - .19) / .81, e.tone, .73);
    const a = Math.min(1, p * 8) * fade(p, .46);
    const y = g.middle;
    const r = g.width * .405 * out(p);
    for (const sign of [-1, 1]) {
      const x = g.center + sign * r;
      glow(x, y, g.width * .082, e.tone, .54 * a);
      ellipse(x, y, 48, 18, e.tone, a, 3.1, sign * .36);
    }
    sparks(g, e, g.center, g.middle, p, 80);
  }

  function crown(g, e, p) {
    alignment(g, e, p);
    const a = Math.min(1, p * 9) * fade(p, .68);
    const reach = g.width * .47 * out(p);
    const half = g.height * .38 * out(p);
    for (let i = 0; i < 11; i++) {
      const angle = TAU * i / 11 - Math.PI / 2;
      const x = g.center + Math.cos(angle) * reach;
      const y = g.middle + Math.sin(angle) * half;
      if (i % 2) star(x, y, Math.min(39, g.width * .03), angle + p * TAU, e.tone, a);
      else glow(x, y, 39, e.tone, .92 * a);
    }
    ellipse(g.center, g.middle, reach, half, e.tone, a * .9, 5.1, -.13);
  }

  const draw = { gate, stellar, fox, blessing, fracture, alignment, endgame, gravity, crown };

  function play(kind, { index = 4, human = true, slots = [] } = {}) {
    if (!ctx) return;
    const tone = { gate: gold, endgame: violet, gravity: violet }[kind] || (human ? gold : jade);
    const effect = { kind, index, slots, tone, start: performance.now(), seed: (index + 1) * 1.658 };
    const cue = sounds[kind];
    if (cue) audio.playArenaCue(cue, human);
    active.push(effect);
    // Expensive sequences use a soft, short version with reduced motion enabled.
    if (!raf) raf = requestAnimationFrame(frame);
    updateEvents();
  }

  function updateEvents() {
    const events = active.map(({ kind }) => kind).join(" ");
    if (canvas.dataset.events !== events) canvas.dataset.events = events;
  }

  function frame(now) {
    const dpr = Math.min(tier === "compat" ? 1 : 1.5, devicePixelRatio || 1);
    const width = Math.round(innerWidth * dpr), height = Math.round(innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const g = geometry();
    ctx.save();
    ctx.beginPath(); ctx.rect(g.left - 1, g.top, g.width + 2, g.height); ctx.clip();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      const p = (now - e.start) / (motion.matches ? 640 : durations[e.kind]);
      if (p >= 1) { active.splice(i, 1); continue; }
      if (motion.matches) {
        const [x, y] = g.point(e.index);
        const a = Math.sin(clamp(p) * Math.PI) * .62;
        glow(x, y, g.width * .32, e.tone, a);
        ellipse(g.center, g.middle, g.width * .42, g.height * .32, e.tone, a, 3.5);
      } else {
        draw[e.kind](g, e, clamp(p));
      }
    }
    ctx.restore();
    updateEvents();
    raf = active.length ? requestAnimationFrame(frame) : 0;
  }

  window.HW06_ARENA = {
    init(surface, boardCells) {
      board = surface;
      cells = boardCells;
      stage = board.closest(".single-stage-arena");
      canvas = document.getElementById("arena-effects-canvas");
      ctx = canvas.getContext("2d");
    },
    setPerformanceTier(value) { tier = value; },
    reset() {
      active.length = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (canvas) delete canvas.dataset.events;
    },
    play
  };
})();
