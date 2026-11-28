/* ==========================================================================
   1142949 HW06 — 京都百鬼夜行：陰陽鎮魂錄
   File: js/spell-arsenal.js
   17-Technique Choreographed Anime Spell Arsenal, Sacred Geometry Circles,
   Projectile Flight Trajectories, Impact Frames & Zero-GC Offscreen Engine
   ========================================================================== */

(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI * 0.5;
  const DEG2RAD = Math.PI / 180;
  const DEFAULT_FLIGHT_MS = 220;
  const DEFAULT_AFTERMATH_MS = 650;
  const FINALE_AFTERMATH_MS = 720;
  const IMPACT_FRAME_MS = 45;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invLerp(a, b, v) {
    if (Math.abs(b - a) < 1e-6) return 0;
    return clamp((v - a) / (b - a), 0, 1);
  }

  function smoothstep(e0, e1, x) {
    const t = invLerp(e0, e1, x);
    return t * t * (3 - 2 * t);
  }

  function easeOutQuad(t) {
    const u = 1 - clamp(t, 0, 1);
    return 1 - u * u;
  }

  function easeOutCubic(t) {
    const u = 1 - clamp(t, 0, 1);
    return 1 - u * u * u;
  }

  function easeOutQuart(t) {
    const u = 1 - clamp(t, 0, 1);
    return 1 - u * u * u * u;
  }

  function easeOutQuint(t) {
    const u = 1 - clamp(t, 0, 1);
    return 1 - u * u * u * u * u;
  }

  function easeInCubic(t) {
    const c = clamp(t, 0, 1);
    return c * c * c;
  }

  function easeInQuad(t) {
    const c = clamp(t, 0, 1);
    return c * c;
  }

  function easeInOutCubic(t) {
    const c = clamp(t, 0, 1);
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) * 0.5;
  }

  function easeOutExpo(t) {
    const c = clamp(t, 0, 1);
    return c >= 1 ? 1 : 1 - Math.pow(2, -10 * c);
  }

  function easeOutBack(t, overshoot) {
    const c = clamp(t, 0, 1);
    const s = overshoot === undefined ? 1.55 : overshoot;
    const u = c - 1;
    return 1 + (s + 1) * u * u * u + s * u * u;
  }

  function bellCurve(t) {
    const c = clamp(t, 0, 1);
    return Math.sin(c * Math.PI);
  }

  function createSeededRng(seedInt) {
    let s = (seedInt >>> 0) || 0x9e3779b9;
    return function nextRand() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(a, b, c) {
    let h = 2166136261 >>> 0;
    h = Math.imul(h ^ (a | 0), 16777619) >>> 0;
    h = Math.imul(h ^ (b | 0), 16777619) >>> 0;
    h = Math.imul(h ^ (c | 0), 16777619) >>> 0;
    return h || 1337;
  }

  const _ptScratchA = { x: 0, y: 0 };
  const _ptScratchB = { x: 0, y: 0 };

  function evalQuadPoint(x0, y0, cx, cy, x1, y1, t, out) {
    const u = 1 - t;
    const uu = u * u;
    const ut2 = 2 * u * t;
    const tt = t * t;
    const target = out || _ptScratchA;
    target.x = uu * x0 + ut2 * cx + tt * x1;
    target.y = uu * y0 + ut2 * cy + tt * y1;
    return target;
  }

  function evalQuadAngle(x0, y0, cx, cy, x1, y1, t) {
    const u = 1 - t;
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    return Math.atan2(dy, dx);
  }

  function evalCubicPoint(x0, y0, c1x, c1y, c2x, c2y, x1, y1, t, out) {
    const u = 1 - t;
    const uu = u * u;
    const uuu = uu * u;
    const uut3 = 3 * uu * t;
    const utt3 = 3 * u * t * t;
    const ttt = t * t * t;
    const target = out || _ptScratchA;
    target.x = uuu * x0 + uut3 * c1x + utt3 * c2x + ttt * x1;
    target.y = uuu * y0 + uut3 * c1y + utt3 * c2y + ttt * y1;
    return target;
  }

  function evalCubicAngle(x0, y0, c1x, c1y, c2x, c2y, x1, y1, t) {
    const u = 1 - t;
    const uu3 = 3 * u * u;
    const ut6 = 6 * u * t;
    const tt3 = 3 * t * t;
    const dx = uu3 * (c1x - x0) + ut6 * (c2x - c1x) + tt3 * (x1 - c2x);
    const dy = uu3 * (c1y - y0) + ut6 * (c2y - c1y) + tt3 * (y1 - c2y);
    return Math.atan2(dy, dx);
  }

  function computeAxisBasis(fromX, fromY, toX, toY, out) {
    let dx = toX - fromX;
    let dy = toY - fromY;
    let dist = Math.hypot(dx, dy);
    if (dist < 1) {
      dx = 0;
      dy = -1;
      dist = 1;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    out.dx = dx;
    out.dy = dy;
    out.dist = dist;
    out.ux = ux;
    out.uy = uy;
    out.nx = -uy;
    out.ny = ux;
    out.angle = Math.atan2(dy, dx);
    return out;
  }

  function hexToRgba(hex, alpha) {
    const a = clamp(alpha, 0, 1);
    if (!hex || hex.charCodeAt(0) !== 35) return "rgba(255,255,255," + a.toFixed(3) + ")";
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
  }

  /* --------------------------------------------------------------------------
     Sacred Geometry, Calligraphy & Anime Vector Primitives (Zero shadowBlur!)
     -------------------------------------------------------------------------- */
  const BAGUA_BITS = [
    [1, 1, 1], // 乾
    [0, 1, 1], // 兌
    [1, 0, 1], // 離
    [0, 0, 1], // 震
    [1, 1, 0], // 巽
    [0, 1, 0], // 坎
    [1, 0, 0], // 艮
    [0, 0, 0]  // 坤
  ];

  const TWELVE_GENERALS_KANJI = [
    "騰", "雀", "合", "勾", "龍", "貴", "后", "陰", "玄", "常", "虎", "空"
  ];

  const EIGHT_GATES_KANJI = ["休", "生", "傷", "杜", "景", "死", "驚", "開"];
  const BIG_DIPPER_KANJI = ["樞", "璇", "璣", "權", "衡", "開", "搖"];

  function drawRegularPolygon(ctx, cx, cy, radius, sides, rotOffset) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rotOffset + (i * TAU) / sides;
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawStarPolygon(ctx, cx, cy, radius, points, step, rotOffset) {
    ctx.beginPath();
    let visited = 0;
    let startIdx = 0;
    while (visited < points) {
      let cur = startIdx;
      let first = true;
      do {
        const a = rotOffset + (cur * TAU) / points;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
        cur = (cur + step) % points;
        visited++;
      } while (cur !== startIdx && visited <= points);
      ctx.closePath();
      startIdx++;
    }
  }

  function drawDegreeTicks(ctx, cx, cy, innerR, outerR, count, rotOffset, majorEvery) {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = rotOffset + (i * TAU) / count;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const isMajor = majorEvery > 0 && i % majorEvery === 0;
      const r0 = isMajor ? innerR - (outerR - innerR) * 0.55 : innerR;
      ctx.moveTo(cx + ca * r0, cy + sa * r0);
      ctx.lineTo(cx + ca * outerR, cy + sa * outerR);
    }
    ctx.stroke();
  }

  function drawBaguaTrigrams(ctx, cx, cy, radius, barHalfW, rotOffset, strokeColor, lineW) {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = rotOffset + (i * TAU) / 8;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + HALF_PI);
      const bits = BAGUA_BITS[i];
      for (let row = 0; row < 3; row++) {
        const yy = (row - 1) * (lineW * 2.15);
        ctx.beginPath();
        if (bits[row] === 1) {
          ctx.moveTo(-barHalfW, yy);
          ctx.lineTo(barHalfW, yy);
        } else {
          const gap = barHalfW * 0.24;
          ctx.moveTo(-barHalfW, yy);
          ctx.lineTo(-gap, yy);
          ctx.moveTo(gap, yy);
          ctx.lineTo(barHalfW, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTaijiSymbol(ctx, cx, cy, radius, rot, yangFill, yinFill, borderStroke, lineW) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.fillStyle = yangFill;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = yinFill;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -HALF_PI, HALF_PI, false);
    ctx.arc(0, radius * 0.5, radius * 0.5, HALF_PI, -HALF_PI, false);
    ctx.arc(0, -radius * 0.5, radius * 0.5, HALF_PI, -HALF_PI, true);
    ctx.closePath();
    ctx.fill();

    const eyeR = Math.max(1.8, radius * 0.14);
    ctx.fillStyle = yinFill;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.5, eyeR, 0, TAU);
    ctx.fill();

    ctx.fillStyle = yangFill;
    ctx.beginPath();
    ctx.arc(0, radius * 0.5, eyeR, 0, TAU);
    ctx.fill();

    if (borderStroke) {
      ctx.strokeStyle = borderStroke;
      ctx.lineWidth = lineW || 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawKanjiRing(ctx, cx, cy, radius, glyphs, rotOffset, fontSize, fillStyle) {
    if (!glyphs || !glyphs.length) return;
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.font = "700 " + Math.round(fontSize) + 'px "Yuji Syuku", "Noto Serif TC", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const n = glyphs.length;
    for (let i = 0; i < n; i++) {
      const a = rotOffset + (i * TAU) / n;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + HALF_PI);
      ctx.fillText(glyphs[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawLotusPetalRing(ctx, cx, cy, innerR, outerR, petalW, count, rotOffset, fillStyle, strokeStyle, lineW) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotOffset);
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / count);
      ctx.beginPath();
      ctx.moveTo(0, -innerR);
      ctx.bezierCurveTo(
        petalW,
        -lerp(innerR, outerR, 0.36),
        petalW * 0.78,
        -lerp(innerR, outerR, 0.82),
        0,
        -outerR
      );
      ctx.bezierCurveTo(
        -petalW * 0.78,
        -lerp(innerR, outerR, 0.82),
        -petalW,
        -lerp(innerR, outerR, 0.36),
        0,
        -innerR
      );
      ctx.closePath();
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineW || 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCrescentBlade(ctx, cx, cy, radius, thickness, sweepSpan, angle, outerFill, coreFill) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const half = sweepSpan * 0.5;
    const xTipA = Math.cos(-half) * radius;
    const yTipA = Math.sin(-half) * radius;
    const xTipB = Math.cos(half) * radius;
    const yTipB = Math.sin(half) * radius;
    const ctrlOuter = radius * 1.18;
    const ctrlInner = Math.max(0, radius - thickness * 1.35);

    ctx.fillStyle = outerFill;
    ctx.beginPath();
    ctx.moveTo(xTipA, yTipA);
    ctx.quadraticCurveTo(ctrlOuter, 0, xTipB, yTipB);
    ctx.quadraticCurveTo(ctrlInner, 0, xTipA, yTipA);
    ctx.closePath();
    ctx.fill();

    if (coreFill) {
      const innerSpan = half * 0.82;
      const ixA = Math.cos(-innerSpan) * (radius - thickness * 0.14);
      const iyA = Math.sin(-innerSpan) * (radius - thickness * 0.14);
      const ixB = Math.cos(innerSpan) * (radius - thickness * 0.14);
      const iyB = Math.sin(innerSpan) * (radius - thickness * 0.14);
      ctx.fillStyle = coreFill;
      ctx.beginPath();
      ctx.moveTo(ixA, iyA);
      ctx.quadraticCurveTo(radius * 1.07, 0, ixB, iyB);
      ctx.quadraticCurveTo(radius - thickness * 0.75, 0, ixA, iyA);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDiamondSlashBeam(ctx, x1, y1, x2, y2, maxHalfW, outerColor, coreColor) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const mx = (x1 + x2) * 0.5;
    const my = (y1 + y2) * 0.5;
    const nx = -dy / len;
    const ny = dx / len;

    ctx.fillStyle = outerColor;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx + nx * maxHalfW, my + ny * maxHalfW, x2, y2);
    ctx.quadraticCurveTo(mx - nx * maxHalfW, my - ny * maxHalfW, x1, y1);
    ctx.closePath();
    ctx.fill();

    if (coreColor && maxHalfW > 1.5) {
      const cw = maxHalfW * 0.44;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx + nx * cw, my + ny * cw, x2, y2);
      ctx.quadraticCurveTo(mx - nx * cw, my - ny * cw, x1, y1);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawOfudaVector(ctx, x, y, w, h, rot, paperColor, borderColor, runeColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const hw = w * 0.5;
    const hh = h * 0.5;

    ctx.fillStyle = paperColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1.1, w * 0.11);
    ctx.beginPath();
    ctx.rect(-hw, -hh, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = runeColor;
    ctx.lineWidth = Math.max(1, w * 0.09);
    ctx.beginPath();
    ctx.arc(0, -hh * 0.52, hw * 0.34, 0, TAU);
    ctx.moveTo(0, -hh * 0.18);
    ctx.lineTo(-hw * 0.32, hh * 0.04);
    ctx.lineTo(hw * 0.32, hh * 0.24);
    ctx.lineTo(-hw * 0.25, hh * 0.48);
    ctx.lineTo(0, hh * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  function drawVajraSpearhead(ctx, x, y, angle, size, goldFill, highlightFill, outlineColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = goldFill;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.3;

    ctx.beginPath();
    ctx.moveTo(size * 1.35, 0);
    ctx.lineTo(size * 0.22, -size * 0.32);
    ctx.lineTo(-size * 0.45, -size * 0.16);
    ctx.lineTo(-size * 0.45, size * 0.16);
    ctx.lineTo(size * 0.22, size * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.85, -size * 0.18);
    ctx.quadraticCurveTo(size * 0.35, -size * 0.78, -size * 0.28, -size * 0.42);
    ctx.lineTo(-size * 0.1, -size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.85, size * 0.18);
    ctx.quadraticCurveTo(size * 0.35, size * 0.78, -size * 0.28, size * 0.42);
    ctx.lineTo(-size * 0.1, size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = highlightFill;
    ctx.beginPath();
    ctx.arc(-size * 0.25, 0, size * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawVajraChainLine(ctx, x1, y1, x2, y2, linkLen, linkHalfW, primaryGold, coreLight) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;
    const angle = Math.atan2(dy, dx);
    const steps = Math.max(2, Math.floor(dist / linkLen));

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    for (let i = 0; i < steps; i++) {
      const cx = (i + 0.5) * (dist / steps);
      if (i % 2 === 0) {
        ctx.strokeStyle = primaryGold;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(cx, 0, linkLen * 0.56, linkHalfW, 0, 0, TAU);
        ctx.stroke();
      } else {
        ctx.strokeStyle = coreLight;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx - linkLen * 0.46, 0);
        ctx.lineTo(cx + linkLen * 0.46, 0);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawToriiGate(ctx, cx, cy, scale, rot, vermilion, darkBase, goldTrim, alpha) {
    if (alpha <= 0.01 || scale <= 0.04) return;
    ctx.save();
    ctx.globalAlpha *= clamp(alpha, 0, 1);
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    const colX = 34;
    const topY = -44;
    const botY = 46;

    ctx.fillStyle = darkBase;
    ctx.fillRect(-colX - 6.5, botY - 9, 13, 10);
    ctx.fillRect(colX - 6.5, botY - 9, 13, 10);

    ctx.fillStyle = vermilion;
    ctx.fillRect(-colX - 4.5, topY + 6, 9, botY - topY - 12);
    ctx.fillRect(colX - 4.5, topY + 6, 9, botY - topY - 12);

    ctx.fillRect(-48, topY + 18, 96, 6.5);

    ctx.fillStyle = darkBase;
    ctx.beginPath();
    ctx.moveTo(-58, topY - 3);
    ctx.quadraticCurveTo(0, topY + 5, 58, topY - 3);
    ctx.lineTo(54, topY + 4);
    ctx.quadraticCurveTo(0, topY + 10, -54, topY + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = vermilion;
    ctx.fillRect(-52, topY + 3.5, 104, 6);

    ctx.fillStyle = goldTrim;
    ctx.strokeStyle = darkBase;
    ctx.lineWidth = 1.2;
    ctx.fillRect(-5.5, topY + 8, 11, 12);
    ctx.strokeRect(-5.5, topY + 8, 11, 12);

    ctx.restore();
  }

  function drawPhoenixVector(ctx, x, y, angle, scale, bodyColor, wingAccent, coreColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(8, -6, -6, -24);
    ctx.quadraticCurveTo(-2, -9, -18, -15);
    ctx.quadraticCurveTo(-8, -3, -30, 0);
    ctx.quadraticCurveTo(-8, 3, -18, 15);
    ctx.quadraticCurveTo(-2, 9, -6, 24);
    ctx.quadraticCurveTo(8, 6, 22, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = wingAccent;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(5, -4, -3, -15);
    ctx.quadraticCurveTo(-2, -4, -19, 0);
    ctx.quadraticCurveTo(-2, 4, -3, 15);
    ctx.quadraticCurveTo(5, 4, 16, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(10, -3.5);
    ctx.lineTo(4, 0);
    ctx.lineTo(10, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRavenFeatherShape(ctx, x, y, angle, len, wid, darkFill, edgeGold, shaftFill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const hl = len * 0.5;
    ctx.fillStyle = darkFill;
    ctx.strokeStyle = edgeGold;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(hl, 0);
    ctx.bezierCurveTo(hl * 0.38, -wid, -hl * 0.46, -wid * 0.82, -hl, 0);
    ctx.bezierCurveTo(-hl * 0.46, wid * 0.82, hl * 0.38, wid, hl, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = edgeGold;
    ctx.beginPath();
    ctx.moveTo(hl, 0);
    ctx.quadraticCurveTo(hl * 0.52, -wid * 0.48, hl * 0.16, 0);
    ctx.quadraticCurveTo(hl * 0.52, wid * 0.48, hl, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = shaftFill;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-hl * 1.08, 0);
    ctx.lineTo(hl * 0.88, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawSakuraPetalShape(ctx, x, y, rot, size, fillStyle, tipColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const r = size * 0.5;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(r * 0.95, r * 0.35, r * 0.92, -r * 0.65, r * 0.24, -r);
    ctx.lineTo(0, -r * 0.68);
    ctx.lineTo(-r * 0.24, -r);
    ctx.bezierCurveTo(-r * 0.92, -r * 0.65, -r * 0.95, r * 0.35, 0, r);
    ctx.closePath();
    ctx.fill();

    if (tipColor) {
      ctx.strokeStyle = tipColor;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMomijiLeafShape(ctx, x, y, rot, size, fillStyle, veinStyle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const s = size * 0.55;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.15);
    ctx.lineTo(s * 0.24, -s * 0.38);
    ctx.lineTo(s * 0.98, -s * 0.62);
    ctx.lineTo(s * 0.42, -s * 0.02);
    ctx.lineTo(s * 0.86, s * 0.52);
    ctx.lineTo(s * 0.16, s * 0.34);
    ctx.lineTo(0, s * 0.82);
    ctx.lineTo(-s * 0.16, s * 0.34);
    ctx.lineTo(-s * 0.86, s * 0.52);
    ctx.lineTo(-s * 0.42, -s * 0.02);
    ctx.lineTo(-s * 0.98, -s * 0.62);
    ctx.lineTo(-s * 0.24, -s * 0.38);
    ctx.closePath();
    ctx.fill();

    if (veinStyle) {
      ctx.strokeStyle = veinStyle;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------------------
     Shikigami Contract Palettes & Yokai Boss Palettes
     -------------------------------------------------------------------------- */
  const SHIKIGAMI_PALETTES = {
    suzaku: {
      id: "suzaku",
      primary: "#f2523d",
      deep: "#b82214",
      secondary: "#ff9b3d",
      accent: "#ffe08a",
      core: "#fff9eb",
      ink: "#260908",
      glowKey: "vermilion",
      accentGlowKey: "gold",
      flareKey: "gold",
      ofudaKey: "ofudaVermilion"
    },
    byakko: {
      id: "byakko",
      primary: "#f5a623",
      deep: "#b56a0e",
      secondary: "#ffd86b",
      accent: "#fff7db",
      core: "#ffffff",
      ink: "#241908",
      glowKey: "amber",
      accentGlowKey: "white",
      flareKey: "gold",
      ofudaKey: "ofudaGold"
    },
    seiryu: {
      id: "seiryu",
      primary: "#249ee0",
      deep: "#125b8a",
      secondary: "#5ce1e6",
      accent: "#c4f1ff",
      core: "#f2fcff",
      ink: "#071a29",
      glowKey: "azure",
      accentGlowKey: "cyan",
      flareKey: "cyan",
      ofudaKey: "ofudaAzure"
    },
    genbu: {
      id: "genbu",
      primary: "#cc922b",
      deep: "#785012",
      secondary: "#9b7ede",
      accent: "#ffeba6",
      core: "#fff9e8",
      ink: "#1a1409",
      glowKey: "gold",
      accentGlowKey: "violet",
      flareKey: "gold",
      ofudaKey: "ofudaGold"
    }
  };

  const BOSS_PALETTES = {
    tamamo: {
      id: "tamamo",
      primary: "#3df2e0",
      deep: "#117a70",
      secondary: "#e03a5e",
      tertiary: "#9d5cff",
      accent: "#d6fffb",
      core: "#f2fffe",
      ink: "#0b1420",
      glowKey: "cyan",
      accentGlowKey: "violet",
      flareKey: "cyan"
    },
    ibaraki: {
      id: "ibaraki",
      primary: "#f04c28",
      deep: "#8c180f",
      secondary: "#ffb636",
      tertiary: "#ff2a4b",
      accent: "#ffe699",
      core: "#fff8e3",
      ink: "#170909",
      glowKey: "crimson",
      accentGlowKey: "amber",
      flareKey: "crimson"
    },
    tengu: {
      id: "tengu",
      primary: "#2ee89e",
      deep: "#117850",
      secondary: "#f5c451",
      tertiary: "#e85838",
      accent: "#d4ffec",
      core: "#f2fff9",
      ink: "#0c1715",
      glowKey: "emerald",
      accentGlowKey: "gold",
      flareKey: "emerald"
    }
  };

  /* --------------------------------------------------------------------------
     Exact 17 Named Anime Spell Techniques Registry
     -------------------------------------------------------------------------- */
  const TECHNIQUE_CATALOG = {
    ren: [
      {
        slot: 0,
        id: "ren_01_kikyo_pentagram",
        name: "《式神招來・桔梗五芒初陣》",
        subtitle: "晴明桔梗印・雙重五芒星柱展開",
        element: "陰陽靈符",
        sealKanji: "急",
        ringGlyphs: ["臨", "兵", "闘", "者", "皆", "陣", "列", "在", "前"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 1,
        id: "ren_03_suzaku_twin_wings",
        name: "《火德秘術・朱雀雙炎翔翼》",
        subtitle: "雙生神鳥螺旋翔擊・八瓣紅蓮火華",
        element: "南朱神火",
        sealKanji: "炎",
        ringGlyphs: ["朱", "雀", "火", "德", "紅", "蓮", "焚", "邪"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 2,
        id: "ren_05_kongou_eight_gates",
        name: "《縛道結界・金剛八門鎖陣》",
        subtitle: "四方金剛神鎖貫穿・六角晶壁破封",
        element: "金剛結界",
        sealKanji: "縛",
        ringGlyphs: EIGHT_GATES_KANJI,
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 3,
        id: "ren_07_hokuto_seven_stars",
        name: "《天罡星宿・北斗七星天墜》",
        subtitle: "天樞搖光七星隕落・北辰星圖鎮宮",
        element: "天罡星辰",
        sealKanji: "星",
        ringGlyphs: BIG_DIPPER_KANJI,
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 4,
        id: "ren_09_seimei_taiji_grand_array",
        name: "《晴明真傳・太極萬象鎮魂大法陣》",
        subtitle: "萬象一閃・十二天將太極星盤終極鎮魂",
        element: "太極萬象",
        sealKanji: "鎮",
        ringGlyphs: TWELVE_GENERALS_KANJI,
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: FINALE_AFTERMATH_MS
      }
    ],
    tamamo: [
      {
        slot: 0,
        id: "tamamo_02_kitsunebi_barrage",
        name: "《狐火連彈・幽藍百鬼燈》",
        subtitle: "五道幽藍妖狐鬼火・百鬼漩渦噬印",
        element: "幽藍狐火",
        sealKanji: "狐",
        ringGlyphs: ["狐", "火", "幽", "燈", "百", "鬼", "夜", "行"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 1,
        id: "tamamo_04_senbon_yozakura",
        name: "《傾城幻術・千本夜櫻迷陣》",
        subtitle: "伏見幻影鳥居連貫・緋蒼夜櫻狂嵐",
        element: "幻術夜櫻",
        sealKanji: "幻",
        ringGlyphs: ["千", "本", "夜", "櫻", "傾", "城", "迷", "夢"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 2,
        id: "tamamo_06_sesshoseki_thunder",
        name: "《殺生石碎・蒼紫妖雷天罰》",
        subtitle: "黑曜殺生毒晶爆裂・蒼紫妖雷囚籠",
        element: "殺生妖雷",
        sealKanji: "祟",
        ringGlyphs: ["殺", "生", "毒", "晶", "蒼", "雷", "天", "罰"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 3,
        id: "tamamo_08_kyuubi_cannon",
        name: "《九尾全開・天狐滅界蒼炎炮》",
        subtitle: "九尾靈力極限收束・螺旋蒼炎貫星炮",
        element: "滅界蒼炎",
        sealKanji: "滅",
        ringGlyphs: ["白", "面", "金", "毛", "九", "尾", "天", "狐", "滅"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      }
    ],
    ibaraki: [
      {
        slot: 0,
        id: "ibaraki_02_rashomon_claw",
        name: "《羅生鬼爪・碎岩裂地擊》",
        subtitle: "四爪紅蓮魔腕撕裂・熔岩地脈崩裂",
        element: "碎岩鬼爪",
        sealKanji: "爪",
        ringGlyphs: ["羅", "生", "鬼", "腕", "碎", "岩", "裂", "地"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 1,
        id: "ibaraki_04_kokurai_iai",
        name: "《黑雷拔刀・居合一文字斬》",
        subtitle: "極速拔刀一閃橫斷・遲發黑雷爆裂",
        element: "黑雷居合",
        sealKanji: "斬",
        ringGlyphs: ["黑", "雷", "拔", "刀", "一", "文", "字", "閃"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 2,
        id: "ibaraki_06_oeyama_hellfire_pillar",
        name: "《大江山業火・紅蓮獄炎柱》",
        subtitle: "大江山鬼道煉獄印・衝天熔岩火龍捲",
        element: "紅蓮業火",
        sealKanji: "獄",
        ringGlyphs: ["大", "江", "山", "業", "火", "紅", "蓮", "獄"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 3,
        id: "ibaraki_08_oni_king_cross_slash",
        name: "《鬼王奧義・十方萬雷斷嶽斬》",
        subtitle: "雙刃十字斷嶽狂斬・十方紅蓮萬雷爆",
        element: "萬雷鬼王",
        sealKanji: "鬼",
        ringGlyphs: ["鬼", "王", "十", "方", "萬", "雷", "斷", "嶽"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      }
    ],
    tengu: [
      {
        slot: 0,
        id: "tengu_02_raven_shuriken",
        name: "《疾風暗器・鴉羽八方手裏劍》",
        subtitle: "八方黑金鴉羽齊射・疾風真空輪迴",
        element: "疾風鴉羽",
        sealKanji: "羽",
        ringGlyphs: ["疾", "風", "鴉", "羽", "八", "方", "破", "空"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 1,
        id: "tengu_04_garuda_crescent",
        name: "《迦樓羅劍・三日月真空裂刃》",
        subtitle: "三道翠嵐新月風刃・百二十度裂空斬",
        element: "真空裂刃",
        sealKanji: "刃",
        ringGlyphs: ["迦", "樓", "羅", "三", "日", "月", "裂", "空"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 2,
        id: "tengu_06_kurama_cyclone",
        name: "《鞍馬神通・天狗龍捲暴風陣》",
        subtitle: "鞍馬翠嵐龍捲風眼・金楓紅葉狂舞",
        element: "鞍馬暴風",
        sealKanji: "嵐",
        ringGlyphs: ["鞍", "馬", "神", "通", "龍", "捲", "暴", "風"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      },
      {
        slot: 3,
        id: "tengu_08_kamikaze_mandala",
        name: "《萬羽奧義・天道裂空神風曼荼羅》",
        subtitle: "黑翼天狗展翅一閃・十六刃神風曼荼羅",
        element: "神風曼荼羅",
        sealKanji: "天",
        ringGlyphs: ["萬", "羽", "天", "道", "裂", "空", "神", "風"],
        flightMs: DEFAULT_FLIGHT_MS,
        aftermathMs: DEFAULT_AFTERMATH_MS
      }
    ]
  };

  function resolveCasterKey(isHuman, bossId) {
    if (isHuman) return "ren";
    if (bossId === "ibaraki" || bossId === "tengu" || bossId === "tamamo") {
      return bossId;
    }
    return "tamamo";
  }

  function resolveSlotIndex(isHuman, moveNumber) {
    const mv = typeof moveNumber === "number" && isFinite(moveNumber) ? Math.round(moveNumber) : (isHuman ? 1 : 2);
    if (isHuman) {
      if (mv >= 9) return 4;
      return clamp(Math.floor((mv - 1) / 2), 0, 4);
    }
    return clamp(Math.floor((mv - 2) / 2), 0, 3);
  }

  function lookupTechniqueDef(isHuman, bossId, moveNumber) {
    const casterKey = resolveCasterKey(isHuman, bossId);
    const list = TECHNIQUE_CATALOG[casterKey];
    const slot = resolveSlotIndex(isHuman, moveNumber);
    return list[slot] || list[0];
  }

  function resolvePalette(isHuman, bossId, shikigamiId) {
    if (isHuman) {
      return SHIKIGAMI_PALETTES[shikigamiId] || SHIKIGAMI_PALETTES.suzaku;
    }
    const key = resolveCasterKey(false, bossId);
    return BOSS_PALETTES[key] || BOSS_PALETTES.tamamo;
  }

  /* --------------------------------------------------------------------------
     Offscreen Sprite Bakery (Pre-Rendered ONCE — ZERO shadowBlur in RAF!)
     -------------------------------------------------------------------------- */
  class OffscreenSpriteBakery {
    constructor() {
      this.ready = false;
      this.glows = {};
      this.flares = {};
      this.tokens = {};
    }

    bakeAll() {
      if (this.ready) return;
      if (typeof document === "undefined" || !document.createElement) return;

      const makeSurface = (size, drawFn) => {
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        let g = null;
        try {
          g = c.getContext("2d");
        } catch (_) {
          g = null;
        }
        if (g) drawFn(g, size, size * 0.5);
        return c;
      };

      const bakeRadialGlow = (coreHex, midHex, outerRgb) =>
        makeSurface(64, (g, sz, half) => {
          const gr = g.createRadialGradient(half, half, 1.5, half, half, half - 1);
          gr.addColorStop(0, coreHex);
          gr.addColorStop(0.28, midHex);
          gr.addColorStop(0.64, "rgba(" + outerRgb + ",0.34)");
          gr.addColorStop(1, "rgba(" + outerRgb + ",0)");
          g.fillStyle = gr;
          g.beginPath();
          g.arc(half, half, half - 1, 0, TAU);
          g.fill();
        });

      const bakeStarFlare = (coreHex, midHex, outerRgb, spikes) =>
        makeSurface(80, (g, sz, half) => {
          const gr = g.createRadialGradient(half, half, 1, half, half, half * 0.56);
          gr.addColorStop(0, coreHex);
          gr.addColorStop(0.4, midHex);
          gr.addColorStop(1, "rgba(" + outerRgb + ",0)");
          g.fillStyle = gr;
          g.beginPath();
          g.arc(half, half, half * 0.56, 0, TAU);
          g.fill();

          g.translate(half, half);
          for (let i = 0; i < spikes; i++) {
            const isPrimary = i % 2 === 0 || spikes <= 4;
            const spikeLen = isPrimary ? half * 0.96 : half * 0.62;
            const spikeW = isPrimary ? 3.8 : 2.2;
            g.save();
            g.rotate((i * Math.PI) / (spikes * 0.5));
            const lg = g.createLinearGradient(-spikeLen, 0, spikeLen, 0);
            lg.addColorStop(0, "rgba(" + outerRgb + ",0)");
            lg.addColorStop(0.35, midHex);
            lg.addColorStop(0.5, coreHex);
            lg.addColorStop(0.65, midHex);
            lg.addColorStop(1, "rgba(" + outerRgb + ",0)");
            g.fillStyle = lg;
            g.beginPath();
            g.moveTo(-spikeLen, 0);
            g.quadraticCurveTo(0, -spikeW, spikeLen, 0);
            g.quadraticCurveTo(0, spikeW, -spikeLen, 0);
            g.closePath();
            g.fill();
            g.restore();
          }
        });

      this.glows.vermilion = bakeRadialGlow("#fff8ee", "#f2523d", "214,56,38");
      this.glows.gold = bakeRadialGlow("#ffffff", "#ffd966", "224,168,46");
      this.glows.amber = bakeRadialGlow("#ffffff", "#ffae2b", "217,130,24");
      this.glows.azure = bakeRadialGlow("#f2fcff", "#29a8eb", "24,126,189");
      this.glows.cyan = bakeRadialGlow("#f0fffe", "#42f5e3", "20,168,154");
      this.glows.violet = bakeRadialGlow("#fbf2ff", "#a96bff", "126,58,219");
      this.glows.crimson = bakeRadialGlow("#fff3e6", "#f03c24", "196,30,18");
      this.glows.emerald = bakeRadialGlow("#f0fff8", "#3bf0a8", "24,168,112");
      this.glows.white = bakeRadialGlow("#ffffff", "#fff7e0", "255,235,190");

      this.flares.gold = bakeStarFlare("#ffffff", "#ffe082", "235,175,52", 4);
      this.flares.cyan = bakeStarFlare("#ffffff", "#5ef7e8", "26,184,168", 4);
      this.flares.crimson = bakeStarFlare("#fff8eb", "#ff6842", "214,48,28", 4);
      this.flares.emerald = bakeStarFlare("#ffffff", "#69f7be", "28,184,124", 4);
      this.flares.astral8 = bakeStarFlare("#ffffff", "#ffe999", "240,190,75", 8);

      this.tokens.ofudaVermilion = makeSurface(40, (g, sz, half) => {
        drawOfudaVector(g, half, half, 15, 29, 0, "#fff5e0", "#c92b1b", "#d63826");
      });
      this.tokens.ofudaGold = makeSurface(40, (g, sz, half) => {
        drawOfudaVector(g, half, half, 15, 29, 0, "#fffbeb", "#b87a14", "#d98a1e");
      });
      this.tokens.ofudaAzure = makeSurface(40, (g, sz, half) => {
        drawOfudaVector(g, half, half, 15, 29, 0, "#eefaff", "#166ca1", "#1d82b8");
      });
      this.tokens.sakuraCrimson = makeSurface(32, (g, sz, half) => {
        drawSakuraPetalShape(g, half, half, 0, 22, "#e33b63", "#ff9db5");
      });
      this.tokens.sakuraCyan = makeSurface(32, (g, sz, half) => {
        drawSakuraPetalShape(g, half, half, 0, 22, "#49f2e1", "#e6fffc");
      });
      this.tokens.ravenFeather = makeSurface(44, (g, sz, half) => {
        drawRavenFeatherShape(g, half, half, 0, 36, 6.2, "#141a21", "#f5c85c", "#72f7c4");
      });
      this.tokens.momijiGold = makeSurface(34, (g, sz, half) => {
        drawMomijiLeafShape(g, half, half, 0, 24, "#f5bc42", "#fff0b8");
      });
      this.tokens.momijiCrimson = makeSurface(34, (g, sz, half) => {
        drawMomijiLeafShape(g, half, half, 0, 24, "#e84c30", "#ffc285");
      });
      this.tokens.crystalShard = makeSurface(34, (g, sz, half) => {
        g.translate(half, half);
        g.fillStyle = "rgba(255,244,204,0.88)";
        g.strokeStyle = "#e6a832";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, -13);
        g.lineTo(8.5, -2);
        g.lineTo(4.5, 12);
        g.lineTo(-6.5, 9);
        g.lineTo(-9, -4);
        g.closePath();
        g.fill();
        g.stroke();
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -13);
        g.lineTo(-1.5, 10);
        g.stroke();
      });

      this.ready = true;
    }

    stampGlow(ctx, key, x, y, radius, alpha, tier) {
      if (alpha <= 0.01 || radius <= 0.5) return;
      if (tier === "compat" || !this.ready) {
        ctx.save();
        ctx.globalAlpha *= clamp(alpha * 0.42, 0, 1);
        ctx.fillStyle =
          key === "cyan" ? "#42f5e3" :
          key === "emerald" ? "#3bf0a8" :
          key === "azure" ? "#29a8eb" :
          key === "violet" ? "#a96bff" :
          key === "gold" || key === "amber" ? "#ffd966" : "#f2523d";
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.52, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }
      const sp = this.glows[key] || this.glows.vermilion;
      if (!sp) return;
      const d = radius * 2;
      ctx.save();
      ctx.globalAlpha *= clamp(alpha, 0, 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(sp, x - radius, y - radius, d, d);
      ctx.restore();
    }

    stampFlare(ctx, key, x, y, radius, rot, alpha, tier) {
      if (alpha <= 0.01 || radius <= 1) return;
      if (tier === "compat" || !this.ready) {
        ctx.save();
        ctx.globalAlpha *= clamp(alpha, 0, 1);
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.strokeStyle = "#fff8dc";
        ctx.lineWidth = 1.8;
        const r = radius * 0.68;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
        ctx.restore();
        return;
      }
      const sp = this.flares[key] || this.flares.gold;
      if (!sp) return;
      ctx.save();
      ctx.globalAlpha *= clamp(alpha, 0, 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(sp, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    stampToken(ctx, key, x, y, size, rot, alpha) {
      if (alpha <= 0.01 || size <= 1 || !this.ready) return false;
      const sp = this.tokens[key];
      if (!sp) return false;
      const half = size * 0.5;
      ctx.save();
      ctx.globalAlpha *= clamp(alpha, 0, 1);
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(sp, -half, -half, size, size);
      ctx.restore();
      return true;
    }
  }

  /* --------------------------------------------------------------------------
     Zero-GC Object Pools (Particles, Shockwaves, Jagged Lightning, Glyphs)
     -------------------------------------------------------------------------- */
  const PARTICLE_CAPACITY = 460;
  const SHOCKWAVE_CAPACITY = 56;
  const LIGHTNING_CAPACITY = 44;
  const SEAL_GLYPH_CAPACITY = 36;

  class ZeroGcParticlePool {
    constructor() {
      this.cursor = 0;
      this.activeCount = 0;
      this.items = Array.from({ length: PARTICLE_CAPACITY }, () => ({
        active: false,
        kind: "orb",
        spriteKey: "",
        colorA: "#ffffff",
        colorB: "#ffd966",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        drag: 0.96,
        size: 12,
        endSize: 2,
        rot: 0,
        vRot: 0,
        ageMs: 0,
        lifeMs: 420,
        alpha: 1,
        additive: false,
        vortexCx: 0,
        vortexCy: 0,
        vortexSpin: 0,
        vortexPull: 0
      }));
    }

    acquire() {
      for (let n = 0; n < PARTICLE_CAPACITY; n++) {
        const idx = (this.cursor + n) % PARTICLE_CAPACITY;
        const p = this.items[idx];
        if (!p.active) {
          this.cursor = (idx + 1) % PARTICLE_CAPACITY;
          p.active = true;
          p.ageMs = 0;
          p.ax = 0;
          p.ay = 0;
          p.vortexSpin = 0;
          p.vortexPull = 0;
          p.additive = false;
          p.spriteKey = "";
          this.activeCount++;
          return p;
        }
      }
      const fallback = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % PARTICLE_CAPACITY;
      fallback.ageMs = 0;
      fallback.ax = 0;
      fallback.ay = 0;
      fallback.vortexSpin = 0;
      fallback.vortexPull = 0;
      return fallback;
    }

    spawn(cfg) {
      const p = this.acquire();
      p.kind = cfg.kind || "orb";
      p.spriteKey = cfg.spriteKey || "";
      p.colorA = cfg.colorA || "#ffffff";
      p.colorB = cfg.colorB || "#ffd966";
      p.x = cfg.x || 0;
      p.y = cfg.y || 0;
      p.vx = cfg.vx || 0;
      p.vy = cfg.vy || 0;
      p.ax = cfg.ax || 0;
      p.ay = cfg.ay || 0;
      p.drag = cfg.drag !== undefined ? cfg.drag : 0.95;
      p.size = cfg.size !== undefined ? cfg.size : 12;
      p.endSize = cfg.endSize !== undefined ? cfg.endSize : p.size * 0.25;
      p.rot = cfg.rot || 0;
      p.vRot = cfg.vRot || 0;
      p.lifeMs = Math.max(60, cfg.lifeMs || 420);
      p.alpha = cfg.alpha !== undefined ? cfg.alpha : 1;
      p.additive = Boolean(cfg.additive);
      p.vortexCx = cfg.vortexCx || 0;
      p.vortexCy = cfg.vortexCy || 0;
      p.vortexSpin = cfg.vortexSpin || 0;
      p.vortexPull = cfg.vortexPull || 0;
      return p;
    }

    emitRadialBurst(cx, cy, count, rng, opts, tier) {
      const mult = tier === "high" ? 1 : tier === "medium" ? 0.58 : 0.28;
      const n = Math.max(2, Math.round(count * mult));
      const minSpd = opts.minSpeed !== undefined ? opts.minSpeed : 90;
      const maxSpd = opts.maxSpeed !== undefined ? opts.maxSpeed : 320;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (rng() - 0.5) * (TAU / n) * 0.85;
        const spd = lerp(minSpd, maxSpd, rng());
        const p = this.acquire();
        p.kind = opts.kind || "spark";
        p.spriteKey = opts.spriteKey || "";
        p.colorA = opts.colorA || "#ffffff";
        p.colorB = opts.colorB || "#ffd966";
        p.x = cx + Math.cos(a) * (opts.spawnRadius || 4);
        p.y = cy + Math.sin(a) * (opts.spawnRadius || 4);
        p.vx = Math.cos(a) * spd;
        p.vy = Math.sin(a) * spd;
        p.ax = 0;
        p.ay = opts.gravity || 0;
        p.drag = opts.drag !== undefined ? opts.drag : 0.93;
        p.size = lerp(opts.minSize || 8, opts.maxSize || 18, rng());
        p.endSize = p.size * (opts.shrinkRatio !== undefined ? opts.shrinkRatio : 0.2);
        p.rot = a + (opts.rotOffset || 0);
        p.vRot = (rng() - 0.5) * (opts.spinRange !== undefined ? opts.spinRange : 7);
        p.lifeMs = lerp(opts.minLife || 300, opts.maxLife || 560, rng());
        p.alpha = opts.alpha !== undefined ? opts.alpha : 0.95;
        p.additive = Boolean(opts.additive);
      }
    }

    emitVortexSwirl(cx, cy, count, rng, opts, tier) {
      const mult = tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.3;
      const n = Math.max(3, Math.round(count * mult));
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const dist = lerp(opts.minRadius || 16, opts.maxRadius || 95, rng());
        const tang = a + HALF_PI * (opts.ccw ? -1 : 1);
        const spd = lerp(opts.minSpeed || 60, opts.maxSpeed || 170, rng());
        const p = this.acquire();
        p.kind = opts.kind || "orb";
        p.spriteKey = opts.spriteKey || "";
        p.colorA = opts.colorA || "#ffffff";
        p.colorB = opts.colorB || "#42f5e3";
        p.x = cx + Math.cos(a) * dist;
        p.y = cy + Math.sin(a) * dist;
        p.vx = Math.cos(tang) * spd;
        p.vy = Math.sin(tang) * spd + (opts.updraft || 0);
        p.ax = 0;
        p.ay = opts.gravity || 0;
        p.drag = opts.drag !== undefined ? opts.drag : 0.965;
        p.size = lerp(opts.minSize || 10, opts.maxSize || 22, rng());
        p.endSize = p.size * 0.35;
        p.rot = rng() * TAU;
        p.vRot = (rng() - 0.5) * 9;
        p.lifeMs = lerp(opts.minLife || 380, opts.maxLife || 640, rng());
        p.alpha = opts.alpha !== undefined ? opts.alpha : 0.92;
        p.additive = Boolean(opts.additive);
        p.vortexCx = cx;
        p.vortexCy = cy;
        p.vortexSpin = opts.vortexSpin !== undefined ? opts.vortexSpin : 240;
        p.vortexPull = opts.vortexPull !== undefined ? opts.vortexPull : 95;
      }
    }

    clear() {
      for (let i = 0; i < PARTICLE_CAPACITY; i++) {
        this.items[i].active = false;
      }
      this.activeCount = 0;
      this.cursor = 0;
    }

    updateAndRender(ctx, dtSec, dtMs, bakery, tier) {
      let alive = 0;
      const dragPow = Math.min(2.5, dtSec * 60);

      for (let i = 0; i < PARTICLE_CAPACITY; i++) {
        const p = this.items[i];
        if (!p.active) continue;

        p.ageMs += dtMs;
        if (p.ageMs >= p.lifeMs) {
          p.active = false;
          continue;
        }
        alive++;

        if (p.vortexSpin !== 0 || p.vortexPull !== 0) {
          const dx = p.vortexCx - p.x;
          const dy = p.vortexCy - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const ux = dx / d;
          const uy = dy / d;
          p.vx += (ux * p.vortexPull - uy * p.vortexSpin) * dtSec;
          p.vy += (uy * p.vortexPull + ux * p.vortexSpin) * dtSec;
        }

        p.vx = (p.vx + p.ax * dtSec) * Math.pow(p.drag, dragPow);
        p.vy = (p.vy + p.ay * dtSec) * Math.pow(p.drag, dragPow);
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.rot += p.vRot * dtSec;

        const prog = p.ageMs / p.lifeMs;
        const fade = p.alpha * (1 - easeInQuad(prog));
        if (fade <= 0.015) continue;

        const curSize = lerp(p.size, p.endSize, prog);

        if (p.kind === "spark") {
          const spd = Math.hypot(p.vx, p.vy);
          const ang = spd > 4 ? Math.atan2(p.vy, p.vx) : p.rot;
          const tailLen = Math.max(curSize * 1.4, Math.min(34, spd * 0.055 + curSize));
          ctx.save();
          ctx.globalAlpha = fade;
          if (p.additive && tier !== "compat") ctx.globalCompositeOperation = "lighter";
          ctx.translate(p.x, p.y);
          ctx.rotate(ang);
          ctx.fillStyle = p.colorB;
          ctx.beginPath();
          ctx.moveTo(tailLen * 0.55, 0);
          ctx.lineTo(0, -curSize * 0.24);
          ctx.lineTo(-tailLen * 0.85, 0);
          ctx.lineTo(0, curSize * 0.24);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = p.colorA;
          ctx.beginPath();
          ctx.arc(tailLen * 0.15, 0, Math.max(1.1, curSize * 0.16), 0, TAU);
          ctx.fill();
          ctx.restore();
        } else if (p.spriteKey && tier !== "compat" && bakery.stampToken(ctx, p.spriteKey, p.x, p.y, curSize, p.rot, fade)) {
          continue;
        } else if (p.kind === "orb") {
          bakery.stampGlow(ctx, p.spriteKey || "gold", p.x, p.y, curSize, fade, tier);
        } else if (p.kind === "petal") {
          ctx.save();
          ctx.globalAlpha = fade;
          drawSakuraPetalShape(ctx, p.x, p.y, p.rot, curSize, p.colorB, p.colorA);
          ctx.restore();
        } else if (p.kind === "feather") {
          ctx.save();
          ctx.globalAlpha = fade;
          drawRavenFeatherShape(ctx, p.x, p.y, p.rot, curSize * 1.4, curSize * 0.26, "#151b22", p.colorB, p.colorA);
          ctx.restore();
        } else if (p.kind === "leaf") {
          ctx.save();
          ctx.globalAlpha = fade;
          drawMomijiLeafShape(ctx, p.x, p.y, p.rot, curSize, p.colorB, p.colorA);
          ctx.restore();
        } else if (p.kind === "ofuda") {
          ctx.save();
          ctx.globalAlpha = fade;
          drawOfudaVector(ctx, p.x, p.y, curSize * 0.54, curSize, p.rot, "#fff7e6", p.colorB, p.colorA);
          ctx.restore();
        } else if (p.kind === "shard" || p.kind === "lava") {
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.colorB;
          ctx.strokeStyle = p.colorA;
          ctx.lineWidth = 1.2;
          const r = curSize * 0.5;
          ctx.beginPath();
          ctx.moveTo(0, -r * 1.15);
          ctx.lineTo(r * 0.85, -r * 0.15);
          ctx.lineTo(r * 0.35, r);
          ctx.lineTo(-r * 0.75, r * 0.65);
          ctx.lineTo(-r * 0.85, -r * 0.45);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.strokeStyle = p.colorB;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.5, curSize * 0.5), 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }

      this.activeCount = alive;
      return alive;
    }
  }

  class ZeroGcShockwavePool {
    constructor() {
      this.cursor = 0;
      this.activeCount = 0;
      this.items = Array.from({ length: SHOCKWAVE_CAPACITY }, () => ({
        active: false,
        shape: "circle",
        x: 0,
        y: 0,
        r0: 8,
        r1: 110,
        scaleY: 1,
        rot: 0,
        vRot: 0,
        lineW: 3.5,
        color: "#ffd966",
        innerColor: "",
        dashed: false,
        ageMs: 0,
        delayMs: 0,
        lifeMs: 420,
        alpha: 0.95
      }));
    }

    spawn(cfg) {
      let slot = null;
      for (let n = 0; n < SHOCKWAVE_CAPACITY; n++) {
        const idx = (this.cursor + n) % SHOCKWAVE_CAPACITY;
        if (!this.items[idx].active) {
          slot = this.items[idx];
          this.cursor = (idx + 1) % SHOCKWAVE_CAPACITY;
          break;
        }
      }
      if (!slot) {
        slot = this.items[this.cursor];
        this.cursor = (this.cursor + 1) % SHOCKWAVE_CAPACITY;
      }
      slot.active = true;
      slot.shape = cfg.shape || "circle";
      slot.x = cfg.x || 0;
      slot.y = cfg.y || 0;
      slot.r0 = cfg.r0 !== undefined ? cfg.r0 : 10;
      slot.r1 = cfg.r1 !== undefined ? cfg.r1 : 120;
      slot.scaleY = cfg.scaleY !== undefined ? cfg.scaleY : 1;
      slot.rot = cfg.rot || 0;
      slot.vRot = cfg.vRot || 0;
      slot.lineW = cfg.lineW !== undefined ? cfg.lineW : 3.5;
      slot.color = cfg.color || "#ffd966";
      slot.innerColor = cfg.innerColor || "";
      slot.dashed = Boolean(cfg.dashed);
      slot.ageMs = 0;
      slot.delayMs = cfg.delayMs || 0;
      slot.lifeMs = Math.max(80, cfg.lifeMs || 420);
      slot.alpha = cfg.alpha !== undefined ? cfg.alpha : 0.95;
      this.activeCount++;
      return slot;
    }

    clear() {
      for (let i = 0; i < SHOCKWAVE_CAPACITY; i++) {
        this.items[i].active = false;
      }
      this.activeCount = 0;
      this.cursor = 0;
    }

    updateAndRender(ctx, dtSec, dtMs) {
      let alive = 0;
      for (let i = 0; i < SHOCKWAVE_CAPACITY; i++) {
        const sw = this.items[i];
        if (!sw.active) continue;

        sw.ageMs += dtMs;
        if (sw.ageMs < sw.delayMs) {
          alive++;
          continue;
        }
        const localMs = sw.ageMs - sw.delayMs;
        if (localMs >= sw.lifeMs) {
          sw.active = false;
          continue;
        }
        alive++;

        sw.rot += sw.vRot * dtSec;
        const p = localMs / sw.lifeMs;
        const r = lerp(sw.r0, sw.r1, easeOutQuart(p));
        const fade = sw.alpha * (1 - easeInCubic(p));
        const lw = Math.max(0.8, sw.lineW * (1 - p * 0.72));

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(sw.x, sw.y);
        if (sw.scaleY !== 1) {
          ctx.rotate(sw.rot);
          ctx.scale(1, sw.scaleY);
        }
        if (sw.dashed) {
          ctx.setLineDash([9, 6]);
        }

        const traceShape = (rad) => {
          if (sw.shape === "hex") {
            drawRegularPolygon(ctx, 0, 0, rad, 6, sw.scaleY === 1 ? sw.rot : 0);
          } else if (sw.shape === "oct") {
            drawRegularPolygon(ctx, 0, 0, rad, 8, sw.scaleY === 1 ? sw.rot : 0);
          } else if (sw.shape === "pentagram") {
            drawStarPolygon(ctx, 0, 0, rad, 5, 2, sw.scaleY === 1 ? sw.rot : -HALF_PI);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, rad, 0, TAU);
          }
        };

        ctx.strokeStyle = sw.color;
        ctx.lineWidth = lw;
        traceShape(r);
        ctx.stroke();

        if (sw.innerColor && lw > 1.3) {
          ctx.strokeStyle = sw.innerColor;
          ctx.lineWidth = lw * 0.42;
          traceShape(r * 0.97);
          ctx.stroke();
        }
        ctx.restore();
      }
      this.activeCount = alive;
      return alive;
    }
  }

  class ZeroGcLightningPool {
    constructor() {
      this.cursor = 0;
      this.activeCount = 0;
      this.items = Array.from({ length: LIGHTNING_CAPACITY }, () => ({
        active: false,
        segCount: 10,
        ptsX: new Float32Array(20),
        ptsY: new Float32Array(20),
        hasBranch: false,
        branchCount: 5,
        brX: new Float32Array(8),
        brY: new Float32Array(8),
        outerColor: "#42f5e3",
        coreColor: "#ffffff",
        width: 4.2,
        ageMs: 0,
        delayMs: 0,
        lifeMs: 260,
        alpha: 1
      }));
    }

    spawnBolt(x1, y1, x2, y2, rng, cfg) {
      let b = null;
      for (let n = 0; n < LIGHTNING_CAPACITY; n++) {
        const idx = (this.cursor + n) % LIGHTNING_CAPACITY;
        if (!this.items[idx].active) {
          b = this.items[idx];
          this.cursor = (idx + 1) % LIGHTNING_CAPACITY;
          break;
        }
      }
      if (!b) {
        b = this.items[this.cursor];
        this.cursor = (this.cursor + 1) % LIGHTNING_CAPACITY;
      }

      const segs = clamp(cfg.segments || 11, 4, 18);
      b.active = true;
      b.segCount = segs;
      b.outerColor = cfg.outerColor || "#42f5e3";
      b.coreColor = cfg.coreColor || "#ffffff";
      b.width = cfg.width !== undefined ? cfg.width : 4.2;
      b.ageMs = 0;
      b.delayMs = cfg.delayMs || 0;
      b.lifeMs = Math.max(70, cfg.lifeMs || 250);
      b.alpha = cfg.alpha !== undefined ? cfg.alpha : 1;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const jitter = cfg.jitter !== undefined ? cfg.jitter : Math.min(34, len * 0.18);

      b.ptsX[0] = x1;
      b.ptsY[0] = y1;
      b.ptsX[segs] = x2;
      b.ptsY[segs] = y2;

      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const env = Math.sin(t * Math.PI);
        const off = (rng() - 0.5) * 2 * jitter * env;
        b.ptsX[i] = x1 + dx * t + nx * off;
        b.ptsY[i] = y1 + dy * t + ny * off;
      }

      b.hasBranch = Boolean(cfg.branch !== false && len > 42);
      if (b.hasBranch) {
        const pivotIdx = Math.max(2, Math.min(segs - 2, Math.floor(segs * (0.35 + rng() * 0.3))));
        const sx = b.ptsX[pivotIdx];
        const sy = b.ptsY[pivotIdx];
        const baseAng = Math.atan2(dy, dx) + (rng() > 0.5 ? 1 : -1) * (0.45 + rng() * 0.45);
        const brLen = len * (0.28 + rng() * 0.18);
        const bSegs = 5;
        b.branchCount = bSegs;
        b.brX[0] = sx;
        b.brY[0] = sy;
        for (let k = 1; k <= bSegs; k++) {
          const bt = k / bSegs;
          const boff = (rng() - 0.5) * jitter * 0.65;
          b.brX[k] = sx + Math.cos(baseAng) * brLen * bt - Math.sin(baseAng) * boff;
          b.brY[k] = sy + Math.sin(baseAng) * brLen * bt + Math.cos(baseAng) * boff;
        }
      }

      this.activeCount++;
      return b;
    }

    clear() {
      for (let i = 0; i < LIGHTNING_CAPACITY; i++) {
        this.items[i].active = false;
      }
      this.activeCount = 0;
      this.cursor = 0;
    }

    updateAndRender(ctx, dtMs, tier) {
      let alive = 0;
      for (let i = 0; i < LIGHTNING_CAPACITY; i++) {
        const b = this.items[i];
        if (!b.active) continue;

        b.ageMs += dtMs;
        if (b.ageMs < b.delayMs) {
          alive++;
          continue;
        }
        const localMs = b.ageMs - b.delayMs;
        if (localMs >= b.lifeMs) {
          b.active = false;
          continue;
        }
        alive++;

        const p = localMs / b.lifeMs;
        const flicker = p < 0.55 ? (Math.floor(localMs / 28) % 2 === 0 ? 1 : 0.72) : 1;
        const fade = b.alpha * (1 - easeInQuad(p)) * flicker;
        if (fade <= 0.02) continue;

        ctx.save();
        ctx.globalAlpha = fade;
        if (tier !== "compat") {
          ctx.globalCompositeOperation = "lighter";
        }
        ctx.lineCap = "round";
        ctx.lineJoin = "bevel";

        const strokeChain = (xs, ys, count, stroke, lw) => {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(xs[0], ys[0]);
          for (let s = 1; s <= count; s++) {
            ctx.lineTo(xs[s], ys[s]);
          }
          ctx.stroke();
        };

        const wScale = 1 - p * 0.5;
        strokeChain(b.ptsX, b.ptsY, b.segCount, b.outerColor, Math.max(1.6, b.width * 1.9 * wScale));
        strokeChain(b.ptsX, b.ptsY, b.segCount, b.coreColor, Math.max(0.9, b.width * 0.65 * wScale));

        if (b.hasBranch) {
          strokeChain(b.brX, b.brY, b.branchCount, b.outerColor, Math.max(1.1, b.width * 1.05 * wScale));
          strokeChain(b.brX, b.brY, b.branchCount, b.coreColor, Math.max(0.7, b.width * 0.4 * wScale));
        }

        ctx.restore();
      }
      this.activeCount = alive;
      return alive;
    }
  }

  class ZeroGcFloatingSealPool {
    constructor() {
      this.cursor = 0;
      this.activeCount = 0;
      this.items = Array.from({ length: SEAL_GLYPH_CAPACITY }, () => ({
        active: false,
        glyph: "封",
        x: 0,
        y: 0,
        vy: -28,
        size: 26,
        color: "#fff8e6",
        borderColor: "#f2523d",
        ageMs: 0,
        lifeMs: 520,
        alpha: 1
      }));
    }

    spawn(glyph, x, y, color, borderColor, size, lifeMs) {
      const slot = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % SEAL_GLYPH_CAPACITY;
      slot.active = true;
      slot.glyph = glyph || "封";
      slot.x = x;
      slot.y = y;
      slot.vy = -34;
      slot.size = size || 26;
      slot.color = color || "#fff9eb";
      slot.borderColor = borderColor || "#f2523d";
      slot.ageMs = 0;
      slot.lifeMs = lifeMs || 520;
      slot.alpha = 1;
      this.activeCount++;
      return slot;
    }

    clear() {
      for (let i = 0; i < SEAL_GLYPH_CAPACITY; i++) {
        this.items[i].active = false;
      }
      this.activeCount = 0;
      this.cursor = 0;
    }

    updateAndRender(ctx, dtSec, dtMs) {
      let alive = 0;
      for (let i = 0; i < SEAL_GLYPH_CAPACITY; i++) {
        const g = this.items[i];
        if (!g.active) continue;
        g.ageMs += dtMs;
        if (g.ageMs >= g.lifeMs) {
          g.active = false;
          continue;
        }
        alive++;
        g.y += g.vy * dtSec;
        g.vy *= 0.95;

        const p = g.ageMs / g.lifeMs;
        const pop = p < 0.22 ? easeOutBack(p / 0.22, 1.8) : 1 - (p - 0.22) * 0.12;
        const fade = g.alpha * (1 - easeInCubic(p));

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(g.x, g.y);
        ctx.scale(pop, pop);

        const r = g.size * 0.68;
        ctx.fillStyle = "rgba(12, 15, 24, 0.76)";
        ctx.strokeStyle = g.borderColor;
        ctx.lineWidth = 2;
        drawRegularPolygon(ctx, 0, 0, r, 8, Math.PI / 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = "800 " + Math.round(g.size) + 'px "Yuji Syuku", "Shippori Mincho", "Noto Serif TC", serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = g.borderColor;
        ctx.lineWidth = 3.2;
        ctx.strokeText(g.glyph, 0, 1);
        ctx.fillStyle = g.color;
        ctx.fillText(g.glyph, 0, 1);
        ctx.restore();
      }
      this.activeCount = alive;
      return alive;
    }
  }

  /* --------------------------------------------------------------------------
     Dedicated Bonus Counter-Parry Clash Overlay (`isCounter === true`)
     -------------------------------------------------------------------------- */
  const CounterParryDirector = {
    triggerImpactBurst(inst, engine) {
      const tx = inst.toX;
      const ty = inst.toY;
      const pal = inst.palette;

      engine.shockwaves.spawn({
        shape: "hex",
        x: tx,
        y: ty,
        r0: 14,
        r1: 142,
        rot: 0,
        vRot: 2.2,
        lineW: 4.6,
        color: "#ffe680",
        innerColor: "#ffffff",
        lifeMs: 430,
        alpha: 0.98
      });

      engine.shockwaves.spawn({
        shape: "hex",
        x: tx,
        y: ty,
        r0: 20,
        r1: 182,
        rot: Math.PI / 6,
        vRot: -1.8,
        lineW: 2.8,
        color: pal.primary,
        dashed: true,
        delayMs: 45,
        lifeMs: 460,
        alpha: 0.88
      });

      engine.particles.emitRadialBurst(
        tx,
        ty,
        22,
        inst.rng,
        {
          kind: "spark",
          colorA: "#ffffff",
          colorB: "#ffe478",
          minSpeed: 180,
          maxSpeed: 460,
          minSize: 10,
          maxSize: 22,
          minLife: 260,
          maxLife: 480,
          drag: 0.91,
          additive: true
        },
        engine.tier
      );

      for (let k = 0; k < 4; k++) {
        const ang = (k * HALF_PI) + Math.PI * 0.25;
        engine.lightning.spawnBolt(
          tx + Math.cos(ang) * 14,
          ty + Math.sin(ang) * 14,
          tx + Math.cos(ang) * 96,
          ty + Math.sin(ang) * 96,
          inst.rng,
          {
            segments: 7,
            outerColor: "#ffdf6b",
            coreColor: "#ffffff",
            width: 3.4,
            lifeMs: 240,
            jitter: 14,
            branch: false
          }
        );
      }

      engine.seals.spawn("破", tx, ty - 44, "#fffbe8", "#ffcf4d", 28, 560);
    },

    renderOverlay(ctx, inst, engine, isFlight, pFlight, pAfter) {
      const tx = inst.toX;
      const ty = inst.toY;
      const tier = engine.tier;

      if (isFlight) {
        if (pFlight < 0.72) return;
        const pre = invLerp(0.72, 1, pFlight);
        const r = lerp(68, 26, easeOutCubic(pre));
        ctx.save();
        ctx.globalAlpha = pre * 0.85;
        ctx.strokeStyle = "#ffe680";
        ctx.lineWidth = 2.4;
        drawRegularPolygon(ctx, tx, ty, r, 6, pre * 1.1);
        ctx.stroke();
        engine.bakery.stampFlare(ctx, "gold", tx, ty, 36 * pre, pre * 0.8, pre * 0.9, tier);
        ctx.restore();
        return;
      }

      if (pAfter > 0.78) return;
      const cp = invLerp(0, 0.78, pAfter);
      const fade = 1 - easeInQuad(cp);
      const slashLen = lerp(38, 128, easeOutExpo(Math.min(1, cp * 2.4)));
      const slashW = lerp(12, 1.4, easeOutCubic(cp));

      ctx.save();
      ctx.globalAlpha = fade;
      if (tier !== "compat") {
        ctx.globalCompositeOperation = "lighter";
      }

      const a1 = -0.58;
      const a2 = 0.58;
      drawDiamondSlashBeam(
        ctx,
        tx - Math.cos(a1) * slashLen,
        ty - Math.sin(a1) * slashLen,
        tx + Math.cos(a1) * slashLen,
        ty + Math.sin(a1) * slashLen,
        slashW,
        "#ffbe3b",
        "#ffffff"
      );
      drawDiamondSlashBeam(
        ctx,
        tx - Math.cos(a2) * slashLen * 0.92,
        ty - Math.sin(a2) * slashLen * 0.92,
        tx + Math.cos(a2) * slashLen * 0.92,
        ty + Math.sin(a2) * slashLen * 0.92,
        slashW * 0.88,
        inst.palette.primary,
        "#fffef0"
      );

      const bracketR = lerp(32, 76, easeOutQuart(cp));
      ctx.strokeStyle = "#ffe680";
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(i * HALF_PI + cp * 0.45);
        ctx.beginPath();
        ctx.moveTo(bracketR - 10, -12);
        ctx.lineTo(bracketR, -12);
        ctx.lineTo(bracketR, 12);
        ctx.lineTo(bracketR - 10, 12);
        ctx.stroke();
        ctx.restore();
      }

      if (cp < 0.35) {
        engine.bakery.stampFlare(ctx, "astral8", tx, ty, lerp(68, 28, cp / 0.35), cp * 1.6, 1 - cp / 0.35, tier);
      }
      ctx.restore();
    }
  };

  /* =================================================================----------
     A. HERO 'ren' — 5 Custom Anime Onmyo Spell Renderers (Moves 1, 3, 5, 7, 9)
        Adapts dynamically to shikigamiId ('suzaku'|'byakko'|'seiryu'|'genbu')
     =========================================================================== */
  const BIG_DIPPER_OFFSETS = [
    { x: -64, y: -36 }, // 天樞 Dubhe
    { x: -46, y: -6 },  // 天璇 Merak
    { x: -16, y: 2 },   // 天璣 Phecda
    { x: -6, y: -24 },  // 天權 Megrez
    { x: 20, y: -18 },  // 玉衡 Alioth
    { x: 46, y: -6 },   // 開陽 Mizar
    { x: 70, y: 18 }    // 搖光 Alkaid
  ];

  const REN_RENDERERS = [
    /* 0 (Move 1): 《式神招來・桔梗五芒初陣》 */
    {
      onImpact(inst, engine) {
        const { toX: tx, toY: ty, palette: pal, rng } = inst;
        engine.shockwaves.spawn({
          shape: "pentagram",
          x: tx,
          y: ty,
          r0: 16,
          r1: 126,
          rot: -HALF_PI,
          vRot: 1.4,
          lineW: 4,
          color: pal.primary,
          innerColor: pal.accent,
          lifeMs: 480
        });
        engine.shockwaves.spawn({
          shape: "circle",
          x: tx,
          y: ty,
          r0: 12,
          r1: 146,
          lineW: 3,
          color: pal.accent,
          dashed: true,
          delayMs: 40,
          lifeMs: 460
        });
        engine.particles.emitRadialBurst(
          tx,
          ty,
          24,
          rng,
          {
            kind: "ofuda",
            spriteKey: pal.ofudaKey,
            colorA: pal.primary,
            colorB: pal.accent,
            minSpeed: 85,
            maxSpeed: 260,
            minSize: 15,
            maxSize: 25,
            minLife: 340,
            maxLife: 580
          },
          engine.tier
        );
        engine.seals.spawn("急", tx, ty - 34, pal.core, pal.primary, 25, 520);
      },

      render(ctx, inst, engine, isFlight, pFlight, pAfter) {
        const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal, basis } = inst;
        const tier = engine.tier;

        if (isFlight) {
          const headT = easeInOutCubic(pFlight);
          const hx = lerp(fx, tx, headT);
          const hy = lerp(fy, ty, headT);

          ctx.save();
          ctx.globalAlpha = 0.72 * (1 - pFlight * 0.35);
          ctx.strokeStyle = pal.primary;
          ctx.lineWidth = 2.2;
          drawStarPolygon(ctx, fx, fy, 26 * (1 - pFlight * 0.4), 5, 2, pFlight * 4);
          ctx.stroke();
          ctx.restore();

          for (let i = 0; i < 5; i++) {
            const lag = i * 0.045;
            const t = clamp((pFlight - lag) / (1 - lag), 0, 1);
            if (t <= 0) continue;
            const et = easeOutQuad(t);
            const env = Math.sin(et * Math.PI);
            const spinA = et * 10.5 + (i * TAU) / 5;
            const rad = 36 * env;
            const bx = lerp(fx, tx, et) + basis.nx * Math.cos(spinA) * rad;
            const by = lerp(fy, ty, et) + basis.ny * Math.cos(spinA) * rad + Math.sin(spinA) * rad * 0.38;

            const prevT = Math.max(0, et - 0.09);
            const prevEnv = Math.sin(prevT * Math.PI);
            const prevA = prevT * 10.5 + (i * TAU) / 5;
            const px = lerp(fx, tx, prevT) + basis.nx * Math.cos(prevA) * (36 * prevEnv);
            const py = lerp(fy, ty, prevT) + basis.ny * Math.cos(prevA) * (36 * prevEnv) + Math.sin(prevA) * 13 * prevEnv;

            drawDiamondSlashBeam(ctx, px, py, bx, by, 4.2, pal.primary, pal.accent);
            engine.bakery.stampGlow(ctx, pal.glowKey, bx, by, 18, 0.55, tier);
            if (!engine.bakery.stampToken(ctx, pal.ofudaKey, bx, by, 26, basis.angle + HALF_PI + Math.sin(spinA) * 0.4, 0.95)) {
              drawOfudaVector(ctx, bx, by, 11, 21, basis.angle + HALF_PI, "#fff7e6", pal.primary, pal.deep);
            }
          }

          engine.bakery.stampFlare(ctx, pal.flareKey, hx, hy, 26, pFlight * 5, 0.9, tier);
          return;
        }

        const unfold = easeOutBack(Math.min(1, pAfter * 2.5), 1.35);
        const fade = 1 - easeInCubic(pAfter);
        const outerR = 96 * unfold;
        const innerR = 64 * unfold;
        const rotA = -HALF_PI + pAfter * 1.65;
        const rotB = -HALF_PI - pAfter * 2.1;

        ctx.save();
        ctx.globalAlpha = fade;

        engine.bakery.stampGlow(ctx, pal.glowKey, tx, ty, outerR * 1.18, 0.45 * fade, tier);

        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(tx, ty, outerR, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tx, ty, outerR * 0.88, 0, TAU);
        ctx.stroke();

        drawBaguaTrigrams(ctx, tx, ty, outerR * 0.77, 6.5, -rotA * 0.6, pal.accent, 1.5);
        if (tier !== "compat") {
          drawKanjiRing(ctx, tx, ty, innerR * 1.07, inst.def.ringGlyphs, rotA * 0.5, 11.5, pal.core);
        }

        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = 3.4;
        drawStarPolygon(ctx, tx, ty, innerR, 5, 2, rotA);
        ctx.stroke();

        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.6;
        drawStarPolygon(ctx, tx, ty, innerR * 0.62, 5, 2, rotB);
        ctx.stroke();

        const pillarEnv = pAfter < 0.22 ? easeOutQuart(pAfter / 0.22) : 1 - invLerp(0.22, 1, pAfter);
        const pillarH = 128 * pillarEnv;
        for (let v = 0; v < 5; v++) {
          const va = rotA + (v * TAU) / 5;
          const vx = tx + Math.cos(va) * innerR;
          const vy = ty + Math.sin(va) * innerR;

          if (pillarH > 3) {
            drawDiamondSlashBeam(ctx, vx, vy + 4, vx, vy - pillarH, 7.5 * pillarEnv, pal.primary, pal.core);
            drawDiamondSlashBeam(ctx, vx, vy, vx, vy - pillarH * 0.78, 3.6 * pillarEnv, pal.accent, "#ffffff");
          }
          engine.bakery.stampFlare(ctx, pal.flareKey, vx, vy, 20 * pillarEnv + 6, va, 0.9 * fade, tier);
        }

        ctx.restore();
      }
    },

    /* 1 (Move 3): 《火德秘術・朱雀雙炎翔翼》 */
    {
      onImpact(inst, engine) {
        const { toX: tx, toY: ty, palette: pal, rng } = inst;
        engine.shockwaves.spawn({
          shape: "circle",
          x: tx,
          y: ty,
          r0: 14,
          r1: 148,
          lineW: 4.5,
          color: pal.primary,
          innerColor: pal.accent,
          lifeMs: 470
        });
        engine.shockwaves.spawn({
          shape: "oct",
          x: tx,
          y: ty,
          r0: 20,
          r1: 118,
          rot: Math.PI / 8,
          vRot: -1.6,
          lineW: 2.8,
          color: pal.secondary,
          delayMs: 55,
          lifeMs: 440
        });
        engine.particles.emitRadialBurst(
          tx,
          ty,
          30,
          rng,
          {
            kind: "spark",
            colorA: pal.core,
            colorB: pal.primary,
            minSpeed: 110,
            maxSpeed: 340,
            minSize: 9,
            maxSize: 20,
            minLife: 320,
            maxLife: 580,
            gravity: -55,
            additive: true
          },
          engine.tier
        );
        engine.seals.spawn("炎", tx, ty - 36, pal.core, pal.primary, 26, 530);
      },

      render(ctx, inst, engine, isFlight, pFlight, pAfter) {
        const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal, basis } = inst;
        const tier = engine.tier;

        if (isFlight) {
          const steps = tier === "compat" ? 10 : 18;
          const curP = easeInOutCubic(pFlight);
          const helixTurns = 2.5 * TAU;
          const maxAmp = Math.min(48, Math.max(24, basis.dist * 0.14));

          for (let strand = 0; strand < 2; strand++) {
            const phaseShift = strand * Math.PI;
            const strandMain = strand === 0 ? pal.primary : pal.secondary;
            const strandCore = strand === 0 ? pal.accent : pal.core;

            ctx.save();
            if (tier !== "compat") ctx.globalCompositeOperation = "lighter";
            for (let s = 1; s <= steps; s++) {
              const t0 = Math.max(0, curP - (s / steps) * 0.42);
              const t1 = Math.max(0, curP - ((s - 1) / steps) * 0.42);
              if (t1 <= 0) continue;
              const amp0 = Math.sin(t0 * Math.PI) * maxAmp;
              const amp1 = Math.sin(t1 * Math.PI) * maxAmp;
              const w0 = Math.sin(t0 * helixTurns + phaseShift) * amp0;
              const w1 = Math.sin(t1 * helixTurns + phaseShift) * amp1;

              const x0 = lerp(fx, tx, t0) + basis.nx * w0;
              const y0 = lerp(fy, ty, t0) + basis.ny * w0;
              const x1 = lerp(fx, tx, t1) + basis.nx * w1;
              const y1 = lerp(fy, ty, t1) + basis.ny * w1;

              const segAlpha = (1 - s / (steps + 1)) * 0.9;
              ctx.globalAlpha = segAlpha;
              drawDiamondSlashBeam(ctx, x0, y0, x1, y1, (1 - s / (steps + 2)) * 6.5, strandMain, strandCore);
            }
            ctx.restore();

            const curAmp = Math.sin(curP * Math.PI) * maxAmp;
            const lat = Math.sin(curP * helixTurns + phaseShift) * curAmp;
            const latVel = Math.cos(curP * helixTurns + phaseShift) * helixTurns * curAmp;
            const bx = lerp(fx, tx, curP) + basis.nx * lat;
            const by = lerp(fy, ty, curP) + basis.ny * lat;
            const headAngle = Math.atan2(
              basis.dy + basis.ny * latVel * 0.25,
              basis.dx + basis.nx * latVel * 0.25
            );
            const depthScale = 0.88 + 0.22 * Math.cos(curP * helixTurns + phaseShift);

            engine.bakery.stampGlow(ctx, strand === 0 ? pal.glowKey : pal.accentGlowKey, bx, by, 30 * depthScale, 0.72, tier);
            drawPhoenixVector(ctx, bx, by, headAngle, 1.08 * depthScale, strandMain, pal.accent, pal.core);
          }

          const rungCount = 6;
          ctx.save();
          ctx.strokeStyle = hexToRgba(pal.accent, 0.55);
          ctx.lineWidth = 1.6;
          for (let r = 1; r <= rungCount; r++) {
            const rt = curP * (r / (rungCount + 1));
            const rAmp = Math.sin(rt * Math.PI) * maxAmp;
            const wA = Math.sin(rt * helixTurns) * rAmp;
            const wB = -wA;
            const rx = lerp(fx, tx, rt);
            const ry = lerp(fy, ty, rt);
            ctx.beginPath();
            ctx.moveTo(rx + basis.nx * wA, ry + basis.ny * wA);
            ctx.lineTo(rx + basis.nx * wB, ry + basis.ny * wB);
            ctx.stroke();
          }
          ctx.restore();
          return;
        }

        const bloom = easeOutQuart(Math.min(1, pAfter * 2.1));
        const fade = 1 - easeInCubic(pAfter);
        const outerLotusR = 104 * bloom;
        const innerLotusR = 66 * bloom;

        ctx.save();
        ctx.globalAlpha = fade;
        engine.bakery.stampGlow(ctx, pal.glowKey, tx, ty, outerLotusR * 1.22, 0.58 * fade, tier);

        drawLotusPetalRing(
          ctx,
          tx,
          ty,
          16 * bloom,
          outerLotusR,
          24 * bloom,
          8,
          pAfter * 0.95,
          hexToRgba(pal.primary, 0.34),
          pal.accent,
          2.1
        );

        drawLotusPetalRing(
          ctx,
          tx,
          ty,
          12 * bloom,
          innerLotusR,
          16 * bloom,
          8,
          Math.PI / 8 - pAfter * 1.25,
          hexToRgba(pal.secondary, 0.44),
          pal.core,
          1.7
        );

        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, outerLotusR * 0.92, 0, TAU);
        ctx.stroke();

        for (let k = 0; k < 8; k++) {
          const ka = pAfter * 0.95 + (k * TAU) / 8 - HALF_PI;
          const tipX = tx + Math.cos(ka) * outerLotusR;
          const tipY = ty + Math.sin(ka) * outerLotusR;
          engine.bakery.stampFlare(ctx, pal.flareKey, tipX, tipY, 16 * fade + 4, ka, 0.78 * fade, tier);
        }

        engine.bakery.stampFlare(ctx, "astral8", tx, ty, 44 * (1 - pAfter * 0.5), pAfter * 2, 0.85 * fade, tier);
        ctx.restore();
      }
    },

    /* 2 (Move 5): 《縛道結界・金剛八門鎖陣》 */
    {
      onImpact(inst, engine) {
        const { toX: tx, toY: ty, palette: pal } = inst;
        inst.shattered = false;
        engine.shockwaves.spawn({
          shape: "oct",
          x: tx,
          y: ty,
          r0: 18,
          r1: 132,
          rot: Math.PI / 8,
          vRot: 0.9,
          lineW: 4.2,
          color: pal.accent,
          innerColor: pal.core,
          lifeMs: 460
        });
        engine.seals.spawn("縛", tx, ty - 36, pal.core, pal.primary, 26, 540);
      },

      render(ctx, inst, engine, isFlight, pFlight, pAfter) {
        const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal } = inst;
        const tier = engine.tier;
        const portalDist = 148;

        if (isFlight) {
          const leadT = easeOutCubic(pFlight);
          const lx = lerp(fx, tx, leadT);
          const ly = lerp(fy, ty, leadT);
          drawDiamondSlashBeam(ctx, fx, fy, lx, ly, 4.5 * (1 - pFlight * 0.3), pal.primary, pal.accent);
          engine.bakery.stampFlare(ctx, pal.flareKey, lx, ly, 24, pFlight * 4, 0.9, tier);

          for (let c = 0; c < 4; c++) {
            const ca = Math.PI * 0.25 + c * HALF_PI;
            const ax = tx + Math.cos(ca) * portalDist;
            const ay = ty + Math.sin(ca) * portalDist;
            const shootT = easeOutQuart(clamp((pFlight - c * 0.06) / 0.82, 0, 1));
            const hx = lerp(ax, tx, shootT);
            const hy = lerp(ay, ty, shootT);

            ctx.save();
            ctx.strokeStyle = pal.accent;
            ctx.lineWidth = 2;
            drawRegularPolygon(ctx, ax, ay, 16, 6, pFlight * 5);
            ctx.stroke();
            ctx.restore();

            drawVajraChainLine(ctx, ax, ay, hx, hy, 13, 4.2, pal.primary, pal.accent);
            drawVajraSpearhead(ctx, hx, hy, ca + Math.PI, 13, pal.accent, pal.core, pal.deep);
          }
          return;
        }

        if (pAfter >= 0.36 && !inst.shattered) {
          inst.shattered = true;
          engine.shockwaves.spawn({
            shape: "hex",
            x: tx,
            y: ty,
            r0: 54,
            r1: 158,
            rot: 0,
            vRot: 1.8,
            lineW: 4,
            color: pal.core,
            innerColor: pal.accent,
            lifeMs: 360
          });
          engine.particles.emitRadialBurst(
            tx,
            ty,
            24,
            inst.rng,
            {
              kind: "shard",
              spriteKey: "crystalShard",
              colorA: pal.core,
              colorB: pal.accent,
              spawnRadius: 36,
              minSpeed: 130,
              maxSpeed: 340,
              minSize: 14,
              maxSize: 26,
              minLife: 280,
              maxLife: 460
            },
            tier
          );
        }

        const fade = 1 - easeInCubic(pAfter);
        ctx.save();
        ctx.globalAlpha = fade;

        const octR = 88 * easeOutCubic(Math.min(1, pAfter * 3));
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = 2.6;
        drawRegularPolygon(ctx, tx, ty, octR, 8, Math.PI / 8 + pAfter * 0.45);
        ctx.stroke();

        if (tier !== "compat") {
          drawKanjiRing(ctx, tx, ty, octR * 0.84, EIGHT_GATES_KANJI, pAfter * 0.45, 12, pal.accent);
        }

        for (let c = 0; c < 4; c++) {
          const ca = Math.PI * 0.25 + c * HALF_PI;
          const chainOuter = lerp(portalDist, 64, easeOutQuad(pAfter));
          const ax = tx + Math.cos(ca) * chainOuter;
          const ay = ty + Math.sin(ca) * chainOuter;
          const ix = tx + Math.cos(ca + Math.PI) * 20;
          const iy = ty + Math.sin(ca + Math.PI) * 20;
          drawVajraChainLine(ctx, ax, ay, ix, iy, 13, 3.8, pal.primary, pal.accent);
        }

        if (pAfter < 0.42) {
          const barrierP = pAfter / 0.42;
          const hexR = 62 * easeOutBack(Math.min(1, barrierP * 2.2), 1.3);
          ctx.fillStyle = hexToRgba(pal.accent, 0.22);
          ctx.strokeStyle = pal.core;
          ctx.lineWidth = 3.2;
          drawRegularPolygon(ctx, tx, ty, hexR, 6, 0);
          ctx.fill();
          ctx.stroke();

          if (barrierP > 0.35) {
            const crackP = invLerp(0.35, 1, barrierP);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let f = 0; f < 6; f++) {
              const fa = (f * TAU) / 6 + 0.22;
              ctx.moveTo(tx, ty);
              ctx.lineTo(tx + Math.cos(fa) * hexR * 0.55 * crackP, ty + Math.sin(fa + 0.18) * hexR * 0.55 * crackP);
              ctx.lineTo(tx + Math.cos(fa - 0.12) * hexR * crackP, ty + Math.sin(fa - 0.12) * hexR * crackP);
            }
            ctx.stroke();
          }
        } else {
          const burstP = invLerp(0.42, 1, pAfter);
          for (let s = 0; s < 6; s++) {
            const sa = (s * TAU) / 6 + burstP * 0.6;
            const dist = 56 + burstP * 68;
            const sx = tx + Math.cos(sa) * dist;
            const sy = ty + Math.sin(sa) * dist;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sa + burstP * 3.8);
            ctx.fillStyle = hexToRgba(pal.accent, 0.68 * (1 - burstP));
            ctx.strokeStyle = pal.core;
            ctx.lineWidth = 1.5;
            const sr = 15 * (1 - burstP * 0.5);
            ctx.beginPath();
            ctx.moveTo(0, -sr);
            ctx.lineTo(sr * 0.8, 0);
            ctx.lineTo(0, sr * 1.15);
            ctx.lineTo(-sr * 0.7, sr * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.restore();
      }
    },

    /* 3 (Move 7): 《天罡星宿・北斗七星天墜》 */
    {
      onImpact(inst, engine) {
        const { toX: tx, toY: ty, palette: pal, rng } = inst;
        engine.shockwaves.spawn({
          shape: "circle",
          x: tx,
          y: ty,
          r0: 22,
          r1: 156,
          lineW: 3.8,
          color: pal.accent,
          innerColor: pal.core,
          lifeMs: 500
        });
        engine.particles.emitRadialBurst(
          tx,
          ty,
          28,
          rng,
          {
            kind: "spark",
            colorA: "#ffffff",
            colorB: pal.accent,
            minSpeed: 95,
            maxSpeed: 310,
            minSize: 8,
            maxSize: 18,
            minLife: 340,
            maxLife: 600,
            additive: true
          },
          engine.tier
        );
        engine.seals.spawn("星", tx, ty - 38, pal.core, pal.primary, 26, 540);
      },

      render(ctx, inst, engine, isFlight, pFlight, pAfter) {
        const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal } = inst;
        const tier = engine.tier;

        if (isFlight) {
          const upT = easeOutCubic(Math.min(1, pFlight * 1.8));
          drawDiamondSlashBeam(ctx, fx, fy, lerp(fx, tx, upT), lerp(fy, ty - 140, upT), 3.6 * (1 - pFlight * 0.5), pal.primary, pal.accent);

          for (let i = 0; i < 7; i++) {
            const delay = i * 0.075;
            const st = clamp((pFlight - delay) / (1 - delay), 0, 1);
            if (st <= 0) continue;
            const ep = easeInQuad(st);
            const destX = tx + BIG_DIPPER_OFFSETS[i].x;
            const destY = ty + BIG_DIPPER_OFFSETS[i].y;
            const skyX = destX - 68;
            const skyY = Math.min(-36, destY - 320);

            const mx = lerp(skyX, destX, ep);
            const my = lerp(skyY, destY, ep);
            const tailT = Math.max(0, ep - 0.34);
            const tailX = lerp(skyX, destX, tailT);
            const tailY = lerp(skyY, destY, tailT);

            drawDiamondSlashBeam(ctx, tailX, tailY, mx, my, 6.4, pal.primary, "#ffffff");
            engine.bakery.stampGlow(ctx, pal.accentGlowKey, mx, my, 24, 0.8, tier);
            engine.bakery.stampFlare(ctx, "astral8", mx, my, 22, st * 4, 0.95, tier);
          }
          return;
        }

        const fade = 1 - easeInCubic(pAfter);
        const dialR = 102 * easeOutQuart(Math.min(1, pAfter * 2.4));

        ctx.save();
        ctx.globalAlpha = fade;

        engine.bakery.stampGlow(ctx, pal.glowKey, tx, ty, dialR * 1.15, 0.42 * fade, tier);

        ctx.strokeStyle = hexToRgba(pal.primary, 0.78);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, dialR, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(pal.accent, 0.72);
        ctx.lineWidth = 1.4;
        drawDegreeTicks(ctx, tx, ty, dialR * 0.91, dialR, 28, pAfter * 0.55, 4);

        const lineSnap = clamp(pAfter * 3.2, 0, 1);
        const activeLinks = lineSnap * 6;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? pal.primary : "#ffffff";
          ctx.lineWidth = pass === 0 ? 5.2 : 2.1;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const segP = clamp(activeLinks - i, 0, 1);
            if (segP <= 0) break;
            const ax = tx + BIG_DIPPER_OFFSETS[i].x;
            const ay = ty + BIG_DIPPER_OFFSETS[i].y;
            const bx = tx + BIG_DIPPER_OFFSETS[i + 1].x;
            const by = ty + BIG_DIPPER_OFFSETS[i + 1].y;
            if (i === 0) ctx.moveTo(ax, ay);
            ctx.lineTo(lerp(ax, bx, segP), lerp(ay, by, segP));
          }
          ctx.stroke();
        }

        if (lineSnap > 0.65) {
          const closeP = invLerp(0.65, 1, lineSnap);
          ctx.strokeStyle = hexToRgba(pal.accent, 0.65);
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(tx + BIG_DIPPER_OFFSETS[3].x, ty + BIG_DIPPER_OFFSETS[3].y);
          ctx.lineTo(
            lerp(tx + BIG_DIPPER_OFFSETS[3].x, tx + BIG_DIPPER_OFFSETS[0].x, closeP),
            lerp(ty + BIG_DIPPER_OFFSETS[3].y, ty + BIG_DIPPER_OFFSETS[0].y, closeP)
          );
          ctx.stroke();
          ctx.setLineDash([]);
        }

        for (let i = 0; i < 7; i++) {
          const sx = tx + BIG_DIPPER_OFFSETS[i].x;
          const sy = ty + BIG_DIPPER_OFFSETS[i].y;
          const pulse = 1 + 0.24 * Math.sin(pAfter * 18 + i);
          engine.bakery.stampFlare(ctx, "astral8", sx, sy, 22 * pulse, pAfter * 2 + i * 0.4, 0.95 * fade, tier);
          if (tier !== "compat") {
            ctx.fillStyle = pal.accent;
            ctx.font = '700 11px "Noto Serif TC", serif';
            ctx.textAlign = "center";
            ctx.fillText(BIG_DIPPER_KANJI[i], sx, sy - 14);
          }
        }

        ctx.restore();
      }
    },

    /* 4 (Move 9 — Final 9th Piece!): 《晴明真傳・太極萬象鎮魂大法陣》 */
    {
      onImpact(inst, engine) {
        const { toX: tx, toY: ty, palette: pal, rng } = inst;
        engine.shockwaves.spawn({
          shape: "circle",
          x: tx,
          y: ty,
          r0: 24,
          r1: 280,
          delayMs: IMPACT_FRAME_MS,
          lineW: 5.5,
          color: pal.accent,
          innerColor: "#ffffff",
          lifeMs: 580
        });
        engine.shockwaves.spawn({
          shape: "pentagram",
          x: tx,
          y: ty,
          r0: 28,
          r1: 220,
          rot: -HALF_PI,
          vRot: 1.3,
          delayMs: IMPACT_FRAME_MS + 35,
          lineW: 4.2,
          color: pal.primary,
          innerColor: pal.accent,
          lifeMs: 560
        });
        engine.particles.emitRadialBurst(
          tx,
          ty,
          44,
          rng,
          {
            kind: "spark",
            colorA: "#ffffff",
            colorB: pal.accent,
            minSpeed: 150,
            maxSpeed: 520,
            minSize: 12,
            maxSize: 26,
            minLife: 380,
            maxLife: 680,
            additive: true
          },
          engine.tier
        );
        engine.seals.spawn("鎮", tx, ty - 44, "#ffffff", pal.primary, 32, 660);
      },

      render(ctx, inst, engine, isFlight, pFlight, pAfter, afterMs) {
        const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal } = inst;
        const tier = engine.tier;
        const vw = engine.width || 1280;
        const vh = engine.height || 720;

        if (isFlight) {
          const ep = easeInOutCubic(pFlight);
          const lx = lerp(fx, tx, ep);
          const ly = lerp(fy, ty, ep);

          drawDiamondSlashBeam(ctx, fx, fy, lx, ly, 11 * (0.5 + 0.5 * ep), pal.primary, "#ffffff");
          engine.bakery.stampGlow(ctx, pal.accentGlowKey, lx, ly, 42, 0.85, tier);

          const gatherR = lerp(240, 22, easeInCubic(pFlight));
          for (let g = 0; g < 12; g++) {
            const ga = pFlight * 5.2 + (g * TAU) / 12;
            const gx = tx + Math.cos(ga) * gatherR;
            const gy = ty + Math.sin(ga) * gatherR;
            drawDiamondSlashBeam(
              ctx,
              tx + Math.cos(ga - 0.25) * (gatherR + 36),
              ty + Math.sin(ga - 0.25) * (gatherR + 36),
              gx,
              gy,
              3.8,
              pal.accent,
              "#ffffff"
            );
            engine.bakery.stampGlow(ctx, g % 2 === 0 ? pal.glowKey : pal.accentGlowKey, gx, gy, 16, 0.72, tier);
          }

          ctx.save();
          ctx.globalAlpha = 0.55 * pFlight;
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tx, ty, lerp(180, 68, ep), 0, TAU);
          ctx.stroke();
          ctx.restore();
          return;
        }

        /* 45ms Ufotable-Style Stark Black / White / Gold Impact Frame! */
        if (afterMs <= IMPACT_FRAME_MS) {
          const ip = afterMs / IMPACT_FRAME_MS;
          const invertSwap = ip < 0.52;

          ctx.save();
          ctx.fillStyle = invertSwap ? "rgba(7, 8, 13, 0.86)" : "rgba(255, 250, 232, 0.78)";
          ctx.fillRect(0, 0, vw, vh);

          const maxDiag = Math.hypot(vw, vh);
          const spokeCount = tier === "compat" ? 16 : 28;
          for (let s = 0; s < spokeCount; s++) {
            const sa = (s * TAU) / spokeCount + (s % 2 === 0 ? 0.03 : -0.02);
            const innerGap = (s % 3 === 0 ? 34 : 74) * (0.7 + ip * 0.5);
            const halfAng = s % 4 === 0 ? 0.038 : 0.018;
            ctx.fillStyle = invertSwap ? (s % 3 === 0 ? "#ffd866" : "#ffffff") : (s % 3 === 0 ? pal.primary : "#0b0d14");
            ctx.beginPath();
            ctx.moveTo(tx + Math.cos(sa) * innerGap, ty + Math.sin(sa) * innerGap);
            ctx.lineTo(tx + Math.cos(sa - halfAng) * maxDiag, ty + Math.sin(sa - halfAng) * maxDiag);
            ctx.lineTo(tx + Math.cos(sa + halfAng) * maxDiag, ty + Math.sin(sa + halfAng) * maxDiag);
            ctx.closePath();
            ctx.fill();
          }

          drawDiamondSlashBeam(ctx, 0, ty, vw, ty, 18, "#ffd866", invertSwap ? "#ffffff" : "#0b0d14");
          drawDiamondSlashBeam(ctx, tx, 0, tx, vh, 14, pal.primary, invertSwap ? "#ffffff" : "#0b0d14");

          ctx.strokeStyle = invertSwap ? "#ffffff" : "#0b0d14";
          ctx.lineWidth = 6;
          drawStarPolygon(ctx, tx, ty, 118, 5, 2, -HALF_PI);
          ctx.stroke();
          ctx.restore();
          return;
        }

        /* Screen-Spanning 12-Division Onmyo Astrolabe & Yin-Yang Sacred Array */
        const arrayP = invLerp(IMPACT_FRAME_MS, inst.aftermathMs, afterMs);
        const expand = easeOutExpo(Math.min(1, arrayP * 2.2));
        const fade = 1 - easeInCubic(arrayP);
        const maxSpanR = Math.min(340, Math.max(210, Math.min(vw, vh) * 0.42)) * expand;
        const midR = maxSpanR * 0.72;
        const taijiR = maxSpanR * 0.27;
        const spin = arrayP * 0.95;

        ctx.save();
        ctx.globalAlpha = fade;

        engine.bakery.stampGlow(ctx, pal.glowKey, tx, ty, maxSpanR * 1.05, 0.42 * fade, tier);
        engine.bakery.stampGlow(ctx, "gold", tx, ty, midR * 0.85, 0.48 * fade, tier);

        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(tx, ty, maxSpanR, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(tx, ty, maxSpanR * 0.86, 0, TAU);
        ctx.arc(tx, ty, midR, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = hexToRgba(pal.accent, 0.75);
        ctx.lineWidth = 1.4;
        drawDegreeTicks(ctx, tx, ty, maxSpanR * 0.92, maxSpanR, tier === "compat" ? 24 : 72, spin * 0.4, 6);

        ctx.strokeStyle = hexToRgba(pal.accent, 0.65);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let d = 0; d < 12; d++) {
          const da = spin + (d * TAU) / 12;
          ctx.moveTo(tx + Math.cos(da) * midR, ty + Math.sin(da) * midR);
          ctx.lineTo(tx + Math.cos(da) * maxSpanR * 0.86, ty + Math.sin(da) * maxSpanR * 0.86);
        }
        ctx.stroke();

        drawKanjiRing(
          ctx,
          tx,
          ty,
          lerp(midR, maxSpanR * 0.86, 0.5),
          TWELVE_GENERALS_KANJI,
          spin + TAU / 24,
          Math.max(13, maxSpanR * 0.056),
          pal.core
        );

        drawBaguaTrigrams(ctx, tx, ty, midR * 0.84, 8, -spin * 1.1, pal.accent, 1.8);

        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = 3.6;
        drawStarPolygon(ctx, tx, ty, midR * 0.72, 5, 2, -HALF_PI - spin * 1.3);
        ctx.stroke();

        drawTaijiSymbol(
          ctx,
          tx,
          ty,
          taijiR,
          spin * 2.6,
          pal.core,
          pal.ink,
          pal.accent,
          2.6
        );

        const convergeT = invLerp(0.12, 0.88, arrayP);
        for (let b = 0; b < 12; b++) {
          const ba = spin + (b * TAU) / 12;
          const beamOuter = lerp(maxSpanR * 0.95, taijiR * 1.05, easeInOutCubic(convergeT));
          const beamInner = Math.max(12, beamOuter - 58 * (1 - arrayP * 0.5));
          drawDiamondSlashBeam(
            ctx,
            tx + Math.cos(ba) * beamOuter,
            ty + Math.sin(ba) * beamOuter,
            tx + Math.cos(ba) * beamInner,
            ty + Math.sin(ba) * beamInner,
            4.2 * (1 - arrayP * 0.4),
            b % 2 === 0 ? pal.accent : pal.primary,
            "#ffffff"
          );
        }

        engine.bakery.stampFlare(ctx, "astral8", tx, ty, 64 * (1 - arrayP * 0.45), -spin * 2, 0.92 * fade, tier);
        ctx.restore();
      }
    }
  ];


  /* ==========================================================================
     Boss Spell Renderers (Tamamo, Ibaraki, Daitengu — 12 Distinct Yokai Arts)
     ========================================================================== */
  const BOSS_RENDERERS = {
    tamamo: [
      /* 0 (Move 2): 《狐火連彈・幽藍百鬼燈》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.shockwaves.spawn({
            shape: "circle",
            x: tx,
            y: ty,
            r0: 14,
            r1: 132,
            lineW: 4,
            color: pal.primary,
            innerColor: pal.accent,
            lifeMs: 480
          });
          engine.particles.emitVortexSwirl(
            tx,
            ty,
            28,
            rng,
            {
              spriteKey: pal.glowKey,
              colorA: pal.primary,
              colorB: pal.accent,
              radius: 72,
              tangentialSpeed: 210,
              minSize: 14,
              maxSize: 26,
              lifeMs: 520
            },
            engine.tier
          );
          engine.seals.spawn("狐", tx, ty - 34, pal.core, pal.primary, 24, 520);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal, basis } = inst;
          if (isFlight) {
            for (let k = 0; k < 5; k++) {
              const offsetSide = (k - 2) * 34;
              const cx = (fx + tx) * 0.5 + basis.nx * offsetSide;
              const cy = (fy + ty) * 0.5 + basis.ny * offsetSide - 26;
              const t = clamp(pFlight * 1.12 - k * 0.03, 0, 1);
              evalQuadPoint(fx, fy, cx, cy, tx, ty, easeInOutCubic(t), _ptScratchA);
              engine.bakery.stampGlow(ctx, pal.glowKey, _ptScratchA.x, _ptScratchA.y, 24, 0.9, engine.tier);
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(_ptScratchA.x, _ptScratchA.y, 5.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            const fade = 1 - easeInCubic(pAfter);
            const r = lerp(24, 96, easeOutQuart(pAfter));
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = pal.primary;
            ctx.lineWidth = 3;
            drawStarPolygon(ctx, tx, ty, r, 6, 2, pAfter * 2.5);
            ctx.stroke();
            ctx.restore();
          }
        }
      },

      /* 1 (Move 4): 《傾城幻術・千本夜櫻迷陣》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.shockwaves.spawn({
            shape: "polygon",
            sides: 6,
            x: tx,
            y: ty,
            r0: 18,
            r1: 140,
            rot: 0.3,
            vRot: -1.5,
            lineW: 3.5,
            color: pal.secondary,
            innerColor: pal.primary,
            lifeMs: 520
          });
          engine.particles.emitRadialBurst(
            tx,
            ty,
            30,
            rng,
            {
              kind: "sakura",
              spriteKey: "sakura",
              colorA: pal.secondary,
              colorB: pal.primary,
              minSpeed: 70,
              maxSpeed: 240,
              minSize: 13,
              maxSize: 22,
              minLife: 420,
              maxLife: 680
            },
            engine.tier
          );
          engine.seals.spawn("幻", tx, ty - 34, pal.core, pal.secondary, 25, 540);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal } = inst;
          if (isFlight) {
            for (let g = 0; g < 4; g++) {
              const gt = clamp((pFlight - g * 0.14) / 0.58, 0, 1);
              if (gt <= 0) continue;
              const gx = lerp(fx, tx, (g + 1) / 4);
              const gy = lerp(fy, ty, (g + 1) / 4);
              drawToriiGate(ctx, gx, gy, 0.55 + gt * 0.35, 0, "#d93829", "#1a1420", "#f0c254", (1 - gt * 0.3) * 0.85);
            }
          } else {
            const fade = 1 - easeInQuad(pAfter);
            drawToriiGate(ctx, tx, ty - pAfter * 18, 0.95 + pAfter * 0.35, 0, "#e03a5e", "#14101c", "#ffd875", fade * 0.82);
          }
        }
      },

      /* 2 (Move 6): 《殺生石碎・蒼紫妖雷天罰》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          for (let b = 0; b < 4; b++) {
            const bx = tx + (b - 1.5) * 44;
            engine.lightning.spawnBolt(bx, ty - 260, tx, ty, rng, {
              color: pal.primary,
              coreColor: "#ffffff",
              width: 4.2,
              lifeMs: 360
            });
          }
          engine.shockwaves.spawn({
            shape: "octagon",
            sides: 8,
            x: tx,
            y: ty,
            r0: 14,
            r1: 145,
            lineW: 4.2,
            color: pal.primary,
            lifeMs: 480
          });
          engine.seals.spawn("殺", tx, ty - 38, "#ffffff", pal.primary, 26, 560);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          if (isFlight) {
            const dropY = lerp(ty - 180, ty, easeInCubic(pFlight));
            ctx.save();
            ctx.translate(tx, dropY);
            ctx.rotate(pFlight * 5);
            ctx.fillStyle = "#191326";
            ctx.strokeStyle = pal.primary;
            ctx.lineWidth = 2.6;
            drawRegularPolygon(ctx, 0, 0, 22, 6, 0);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else {
            const fade = 1 - easeInCubic(pAfter);
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = pal.primary;
            ctx.lineWidth = 2.8;
            drawRegularPolygon(ctx, tx, ty, lerp(28, 118, easeOutExpo(pAfter)), 8, pAfter);
            ctx.stroke();
            ctx.restore();
          }
        }
      },

      /* 3 (Move 8): 《九尾全開・天狐滅界蒼炎炮》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.shockwaves.spawn({
            shape: "star",
            x: tx,
            y: ty,
            r0: 20,
            r1: 175,
            lineW: 5,
            color: pal.primary,
            innerColor: "#ffffff",
            lifeMs: 560
          });
          engine.particles.emitRadialBurst(
            tx,
            ty,
            42,
            rng,
            {
              spriteKey: pal.glowKey,
              colorA: pal.primary,
              colorB: "#ffffff",
              minSpeed: 120,
              maxSpeed: 380,
              minSize: 16,
              maxSize: 30,
              minLife: 380,
              maxLife: 650
            },
            engine.tier
          );
          engine.seals.spawn("滅", tx, ty - 40, "#ffffff", pal.primary, 28, 600);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal } = inst;
          const beamEndT = isFlight ? easeOutQuad(pFlight) : 1;
          const bx = lerp(fx, tx, beamEndT);
          const by = lerp(fy, ty, beamEndT);
          const fade = isFlight ? 1 : 1 - easeInCubic(pAfter);
          const halfW = (isFlight ? 22 : 30 * (1 - pAfter * 0.7));
          ctx.save();
          ctx.globalAlpha = fade;
          drawDiamondSlashBeam(ctx, fx, fy, bx, by, halfW, pal.primary, "#ffffff");
          engine.bakery.stampFlare(ctx, pal.flareKey, bx, by, 54 * fade, pAfter * 4, 0.95 * fade, engine.tier);
          ctx.restore();
        }
      }
    ],

    ibaraki: [
      /* 0 (Move 2): 《羅生鬼爪・碎岩裂地擊》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.shockwaves.spawn({
            shape: "circle",
            x: tx,
            y: ty,
            r0: 18,
            r1: 138,
            lineW: 4.5,
            color: pal.primary,
            innerColor: pal.secondary,
            lifeMs: 460
          });
          engine.particles.emitRadialBurst(
            tx,
            ty,
            30,
            rng,
            {
              spriteKey: pal.glowKey,
              colorA: pal.primary,
              colorB: pal.secondary,
              minSpeed: 110,
              maxSpeed: 320,
              minSize: 14,
              maxSize: 25,
              minLife: 340,
              maxLife: 560
            },
            engine.tier
          );
          engine.seals.spawn("碎", tx, ty - 36, pal.core, pal.primary, 26, 520);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          const prog = isFlight ? pFlight : 1;
          const fade = isFlight ? 1 : 1 - easeInQuad(pAfter);
          ctx.save();
          ctx.globalAlpha = fade;
          for (let c = -1.5; c <= 1.5; c += 1) {
            const off = c * 18;
            const x1 = tx - 68 + off * 0.5;
            const y1 = ty - 68 - off * 0.5;
            const x2 = lerp(x1, tx + 68 + off * 0.5, prog);
            const y2 = lerp(y1, ty + 68 - off * 0.5, prog);
            drawDiamondSlashBeam(ctx, x1, y1, x2, y2, 7.5, pal.primary, pal.secondary);
          }
          ctx.restore();
        }
      },

      /* 1 (Move 4): 《黑雷拔刀・居合一文字斬》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.lightning.spawnBolt(tx - 160, ty, tx + 160, ty, rng, {
            color: pal.secondary,
            coreColor: "#ffffff",
            width: 4.5,
            lifeMs: 360
          });
          engine.seals.spawn("斬", tx, ty - 38, "#ffffff", pal.primary, 27, 540);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          const vw = engine.width || 1280;
          const fade = isFlight ? 1 : 1 - easeInCubic(pAfter);
          const xEnd = isFlight ? lerp(0, vw, easeOutExpo(pFlight)) : vw;
          ctx.save();
          ctx.globalAlpha = fade;
          drawDiamondSlashBeam(ctx, 0, ty, xEnd, ty, isFlight ? 14 : 18 * fade, pal.primary, "#ffffff");
          engine.bakery.stampFlare(ctx, pal.flareKey, tx, ty, 52 * fade, 0.4, fade, engine.tier);
          ctx.restore();
        }
      },

      /* 2 (Move 6): 《大江山業火・紅蓮獄炎柱》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.particles.emitVortexSwirl(
            tx,
            ty,
            34,
            rng,
            {
              spriteKey: pal.accentGlowKey,
              colorA: pal.primary,
              colorB: pal.secondary,
              radius: 82,
              tangentialSpeed: 260,
              minSize: 16,
              maxSize: 28,
              lifeMs: 560
            },
            engine.tier
          );
          engine.seals.spawn("業", tx, ty - 38, pal.core, pal.primary, 26, 550);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          if (isFlight) {
            ctx.save();
            ctx.strokeStyle = pal.secondary;
            ctx.lineWidth = 3;
            drawRegularPolygon(ctx, tx, ty, 58 * easeOutBack(pFlight, 1.4), 8, pFlight * 3);
            ctx.stroke();
            ctx.restore();
          } else {
            const fade = 1 - easeInCubic(pAfter);
            const h = lerp(40, 240, easeOutExpo(pAfter));
            ctx.save();
            ctx.globalAlpha = fade;
            drawDiamondSlashBeam(ctx, tx, ty + 35, tx, ty - h, 34 * fade, pal.primary, pal.secondary);
            ctx.restore();
          }
        }
      },

      /* 3 (Move 8): 《鬼王奧義・十方萬雷斷嶽斬》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) * 0.5 + Math.PI * 0.25;
            engine.lightning.spawnBolt(tx, ty, tx + Math.cos(a) * 155, ty + Math.sin(a) * 155, rng, {
              color: pal.secondary,
              coreColor: "#ffffff",
              width: 4.4,
              lifeMs: 420
            });
          }
          engine.shockwaves.spawn({
            shape: "octagon",
            sides: 8,
            x: tx,
            y: ty,
            r0: 22,
            r1: 176,
            lineW: 5,
            color: pal.primary,
            innerColor: pal.secondary,
            lifeMs: 560
          });
          engine.seals.spawn("斷", tx, ty - 40, "#ffffff", pal.primary, 28, 600);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          const span = isFlight ? lerp(20, 145, easeOutExpo(pFlight)) : 155;
          const fade = isFlight ? 1 : 1 - easeInCubic(pAfter);
          ctx.save();
          ctx.globalAlpha = fade;
          drawDiamondSlashBeam(ctx, tx - span, ty - span, tx + span, ty + span, 15 * fade, pal.primary, "#ffffff");
          drawDiamondSlashBeam(ctx, tx + span, ty - span, tx - span, ty + span, 15 * fade, pal.secondary, "#ffffff");
          ctx.restore();
        }
      }
    ],

    tengu: [
      /* 0 (Move 2): 《疾風暗器・鴉羽八方手裏劍》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          engine.shockwaves.spawn({
            shape: "circle",
            x: tx,
            y: ty,
            r0: 14,
            r1: 132,
            lineW: 3.8,
            color: pal.primary,
            innerColor: pal.secondary,
            lifeMs: 460
          });
          engine.seals.spawn("疾", tx, ty - 34, pal.core, pal.primary, 25, 520);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          if (isFlight) {
            for (let i = 0; i < 8; i++) {
              const ang = (i * TAU) / 8 + pFlight * 1.4;
              const dist = lerp(155, 8, easeInCubic(pFlight));
              const fx = tx + Math.cos(ang) * dist;
              const fy = ty + Math.sin(ang) * dist;
              drawRavenFeatherShape(ctx, fx, fy, ang + Math.PI, 28, 8, "#16202a", pal.secondary, pal.primary);
            }
          } else {
            const fade = 1 - easeInQuad(pAfter);
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.strokeStyle = pal.primary;
            ctx.lineWidth = 2.6;
            drawStarPolygon(ctx, tx, ty, lerp(24, 112, easeOutQuart(pAfter)), 8, 3, pAfter * 3);
            ctx.stroke();
            ctx.restore();
          }
        }
      },

      /* 1 (Move 4): 《迦樓羅劍・三日月真空裂刃》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.particles.emitRadialBurst(
            tx,
            ty,
            26,
            rng,
            {
              spriteKey: pal.glowKey,
              colorA: pal.primary,
              colorB: pal.secondary,
              minSpeed: 95,
              maxSpeed: 280,
              minSize: 13,
              maxSize: 23,
              minLife: 340,
              maxLife: 540
            },
            engine.tier
          );
          engine.seals.spawn("裂", tx, ty - 36, pal.core, pal.primary, 26, 520);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { fromX: fx, fromY: fy, toX: tx, toY: ty, palette: pal } = inst;
          const cx = isFlight ? lerp(fx, tx, easeOutCubic(pFlight)) : tx;
          const cy = isFlight ? lerp(fy, ty, easeOutCubic(pFlight)) : ty;
          const r = isFlight ? 42 : lerp(42, 108, easeOutQuart(pAfter));
          const fade = isFlight ? 1 : 1 - easeInQuad(pAfter);
          ctx.save();
          ctx.globalAlpha = fade;
          for (let b = 0; b < 3; b++) {
            const a = (b * TAU) / 3 + (isFlight ? pFlight * 6 : pAfter * 4);
            drawCrescentBlade(ctx, cx, cy, r, 12 * fade, 1.8, a, pal.primary, "#ffffff");
          }
          ctx.restore();
        }
      },

      /* 2 (Move 6): 《鞍馬神通・天狗龍捲暴風陣》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.particles.emitVortexSwirl(
            tx,
            ty,
            36,
            rng,
            {
              spriteKey: pal.glowKey,
              colorA: pal.primary,
              colorB: pal.secondary,
              radius: 88,
              tangentialSpeed: 290,
              minSize: 14,
              maxSize: 25,
              lifeMs: 580
            },
            engine.tier
          );
          engine.seals.spawn("嵐", tx, ty - 38, pal.core, pal.primary, 27, 560);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          const prog = isFlight ? pFlight : 1 - pAfter * 0.4;
          const fade = isFlight ? pFlight : 1 - easeInCubic(pAfter);
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.strokeStyle = pal.primary;
          ctx.lineWidth = 3;
          for (let ring = 0; ring < 5; ring++) {
            const ry = ty + 32 - ring * 26 * prog;
            const rx = (22 + ring * 14) * prog;
            ctx.beginPath();
            ctx.ellipse(tx, ry, rx, rx * 0.36, (isFlight ? pFlight : pAfter) * 8 + ring, 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
        }
      },

      /* 3 (Move 8): 《萬羽奧義・天道裂空神風曼荼羅》 */
      {
        onImpact(inst, engine) {
          const { toX: tx, toY: ty, palette: pal, rng } = inst;
          engine.shockwaves.spawn({
            shape: "octagon",
            sides: 8,
            x: tx,
            y: ty,
            r0: 24,
            r1: 182,
            lineW: 4.8,
            color: pal.primary,
            innerColor: pal.secondary,
            lifeMs: 580
          });
          engine.particles.emitRadialBurst(
            tx,
            ty,
            40,
            rng,
            {
              spriteKey: pal.glowKey,
              colorA: pal.primary,
              colorB: pal.secondary,
              minSpeed: 120,
              maxSpeed: 360,
              minSize: 15,
              maxSize: 28,
              minLife: 380,
              maxLife: 620
            },
            engine.tier
          );
          engine.seals.spawn("天", tx, ty - 42, "#ffffff", pal.primary, 28, 620);
        },
        render(ctx, inst, engine, isFlight, pFlight, pAfter) {
          const { toX: tx, toY: ty, palette: pal } = inst;
          const r = isFlight ? lerp(20, 128, easeOutCubic(pFlight)) : lerp(128, 178, easeOutQuart(pAfter));
          const fade = isFlight ? 1 : 1 - easeInCubic(pAfter);
          const spin = (isFlight ? pFlight : 1 + pAfter) * 3.2;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.strokeStyle = pal.primary;
          ctx.lineWidth = 3.2;
          drawStarPolygon(ctx, tx, ty, r, 12, 5, spin);
          ctx.stroke();
          ctx.strokeStyle = pal.secondary;
          ctx.lineWidth = 2.2;
          drawStarPolygon(ctx, tx, ty, r * 0.68, 8, 3, -spin * 1.4);
          ctx.stroke();
          ctx.restore();
        }
      }
    ]
  };

  /* ==========================================================================
     Public BoardSpellArsenal Controller (`window.HW06_SPELLS`)
     ========================================================================== */
  class BoardSpellArsenal {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.tier = "high";

      this.bakery = new OffscreenSpriteBakery();
      this.particles = new ZeroGcParticlePool();
      this.shockwaves = new ZeroGcShockwavePool();
      this.lightning = new ZeroGcLightningPool();
      this.seals = new ZeroGcFloatingSealPool();

      this.activeInstances = [];
      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
    }

    init(canvasEl) {
      this.canvas = canvasEl || null;
      if (!this.canvas) return;
      try {
        this.ctx = this.canvas.getContext("2d", { alpha: true });
      } catch (_) {
        this.ctx = null;
      }
      if (!this.ctx) return;

      this.bakery.bakeAll();
      this.resize();
      window.addEventListener("resize", () => this.resize(), { passive: true });
      this.startLoop();
    }

    resize() {
      if (!this.canvas || !this.ctx) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, this.tier === "high" ? 1.65 : 1);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    setPerformanceTier(tier) {
      if (tier === "high" || tier === "medium" || tier === "compat") {
        this.tier = tier;
        this.resize();
      }
    }

    getTechniqueInfo(isHuman, bossId, moveNumber) {
      const def = lookupTechniqueDef(isHuman, bossId, moveNumber);
      return {
        id: def.id,
        name: def.name,
        subtitle: def.subtitle,
        element: def.element
      };
    }

    castMoveTechnique(opts) {
      const o = opts || {};
      const isHuman = Boolean(o.isHuman);
      const bossId = o.bossId || "tamamo";
      const moveNumber = Number(o.moveNumber) || 1;
      const def = lookupTechniqueDef(isHuman, bossId, moveNumber);
      const pal = resolvePalette(isHuman, bossId, o.shikigamiId);
      const slot = resolveSlotIndex(isHuman, moveNumber);

      const renderer = isHuman
        ? REN_RENDERERS[slot] || REN_RENDERERS[0]
        : (BOSS_RENDERERS[bossId] || BOSS_RENDERERS.tamamo)[slot] || BOSS_RENDERERS.tamamo[0];

      const basis = { dx: 1, dy: 0, nx: 0, ny: 1, dist: 200, angle: 0 };
      computeAxisBasis(o.fromX || 200, o.fromY || 300, o.toX || 600, o.toY || 400, basis);

      const inst = {
        def: def,
        renderer: renderer,
        palette: pal,
        isHuman: isHuman,
        bossId: bossId,
        moveNumber: moveNumber,
        cellIndex: o.cellIndex || 0,
        fromX: o.fromX || 200,
        fromY: o.fromY || 300,
        toX: o.toX || 600,
        toY: o.toY || 400,
        isCounter: Boolean(o.isCounter),
        basis: basis,
        rng: createSeededRng(hashSeed(moveNumber, o.cellIndex || 0, Math.floor(performance.now()))),
        flightMs: def.flightMs || 220,
        aftermathMs: def.aftermathMs || 640,
        bornMs: performance.now(),
        impactTriggered: false,
        onImpact: o.onImpact || null
      };

      this.activeInstances.push(inst);
      if (!this.running && this.ctx) {
        this.startLoop();
      }

      return {
        id: def.id,
        name: def.name,
        subtitle: def.subtitle,
        element: def.element
      };
    }

    clearAll() {
      this.activeInstances.length = 0;
      this.particles.clear();
      this.shockwaves.clear();
      this.lightning.clear();
      this.seals.clear();
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    startLoop() {
      if (this.running) return;
      this.running = true;
      this.lastTs = performance.now();
      const step = (now) => {
        if (!this.running) return;
        this.tick(now);
        this.rafId = window.requestAnimationFrame(step);
      };
      this.rafId = window.requestAnimationFrame(step);
    }

    tick(now) {
      const dtMs = clamp(now - this.lastTs, 1, 64);
      const dtSec = dtMs * 0.001;
      this.lastTs = now;

      if (!this.ctx) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      for (let i = this.activeInstances.length - 1; i >= 0; i--) {
        const inst = this.activeInstances[i];
        const ageMs = now - inst.bornMs;

        if (ageMs < inst.flightMs) {
          const pFlight = clamp(ageMs / inst.flightMs, 0, 1);
          inst.renderer.render(ctx, inst, this, true, pFlight, 0);
          if (inst.isCounter) {
            CounterParryDirector.renderOverlay(ctx, inst, this, true, pFlight, 0);
          }
        } else {
          if (!inst.impactTriggered) {
            inst.impactTriggered = true;
            inst.renderer.onImpact(inst, this);
            if (inst.isCounter) {
              CounterParryDirector.triggerImpactBurst(inst, this);
            }
            if (inst.onImpact) {
              inst.onImpact({
                id: inst.def.id,
                name: inst.def.name,
                subtitle: inst.def.subtitle,
                element: inst.def.element
              });
            }
          }

          const afterAge = ageMs - inst.flightMs;
          if (afterAge >= inst.aftermathMs) {
            this.activeInstances.splice(i, 1);
            continue;
          }

          const pAfter = clamp(afterAge / inst.aftermathMs, 0, 1);
          inst.renderer.render(ctx, inst, this, false, 1, pAfter);
          if (inst.isCounter) {
            CounterParryDirector.renderOverlay(ctx, inst, this, false, 1, pAfter);
          }
        }
      }

      this.shockwaves.updateAndRender(ctx, dtSec, dtMs);
      this.lightning.updateAndRender(ctx, dtMs, this.tier);
      this.particles.updateAndRender(ctx, dtSec, dtMs, this.bakery, this.tier);
      this.seals.updateAndRender(ctx, dtSec, dtMs);
    }
  }

  window.HW06_SPELLS = new BoardSpellArsenal();
})();
