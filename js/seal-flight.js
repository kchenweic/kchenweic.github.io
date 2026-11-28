/* 1142949 HW06 · The flying star and nine-tailed fox become the board pieces. */
(function () {
  "use strict";

  const audio = window.HW06_AUDIO;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (p) => 1 - (1 - p) * (1 - p);
  const outline = Array.from({ length: 10 }, (_, i) => {
    const a = i * TAU / 10 - Math.PI / 2;
    const r = i % 2 ? 13 : 30;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const vertices = [0, 4, 8, 2, 6, 0].map((i) => outline[i]);
  const foxBody = new Path2D("M-43 0 Q-36-18-12-13 Q0-23 19-14 L26-9 Q23 7 18 12 Q5 21-12 14 Q-24 12-42 8Z");
  const foxRuff = new Path2D("M8-13 Q17-33 29-24 L40-2 L36 5 L28 18 L28 10 L17 18 L18 9 L10 13 L10 4 L4 6Z");
  const foxHead = new Path2D("M18-15 Q20-27 27-29 L26-48 Q27-51 30-48 L43-33 L46-34 L49-51 Q50-54 52-49 L56-29 L55-24 Q59-19 66-16 L76-14 L72-7 L61-3 Q50 5 41 3 Q21-1 18-15Z");
  const foxMask = new Path2D("M-26-8 L-31-38 L-10-25 Q0-31 10-25 L31-38 L26-8 Q29 9 12 22 L0 34 L-12 22 Q-29 9-26-8Z");
  const innerMask = new Path2D("M-18-5 L-22-26 L-6-16 Q0-22 6-16 L22-26 L18-5 Q22 8 0 25 Q-22 8-18-5Z");
  const tails = Array.from({ length: 9 }, (_, index) => {
    const n = index - 4;
    return { angle: n * .28 + .1, length: 83 + (4 - Math.abs(n)) * 6, hue: n % 2 ? "#138d92" : "#0f6a83" };
  });

  function cubic(start, a, b, end, t) {
    const u = 1 - t;
    return start.map((n, i) => u ** 3 * n + 3 * u * u * t * a[i] + 3 * u * t * t * b[i] + t ** 3 * end[i]);
  }

  function drawPath(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }

  function pentagram(ctx, progress) {
    const length = progress * 5;
    ctx.beginPath();
    ctx.moveTo(...vertices[0]);
    for (let i = 0; i < 5 && i < length; i++) {
      const q = clamp(length - i);
      ctx.lineTo(mix(vertices[i][0], vertices[i + 1][0], q), mix(vertices[i][1], vertices[i + 1][1], q));
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffad32";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#fff5cc";
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }

  function drawStar(ctx, x, y, size, t, forge, split, finish, lite) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.rotate(Math.sin(t * Math.PI) * .58);
    ctx.scale(1, 1 - .62 * Math.sin(Math.PI * t) ** 8);
    ctx.shadowColor = "#ff9e2b";
    ctx.shadowBlur = lite ? 0 : 15;

    if (split > .015) {
      // Each of the five forged points breaks away, orbits, and snaps back into its own socket.
      for (let i = 0; i < 5; i++) {
        const angle = i * TAU / 5 - Math.PI / 2;
        const orbit = angle + split * .37;
        ctx.save();
        ctx.translate(Math.cos(orbit) * 45 * split, Math.sin(orbit) * 45 * split);
        ctx.rotate(split * .5);
        drawPath(ctx, [[0, 0], outline[(i * 2 + 9) % 10], outline[i * 2], outline[i * 2 + 1]]);
        ctx.fillStyle = i % 2 ? "#ffcf51" : "#ffeaa0";
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "#fff8cd";
        ctx.stroke();
        ctx.restore();
      }
    } else {
      if (forge >= .99) {
        drawPath(ctx, outline.map(([px, py]) => [px, py + 4]));
        ctx.fillStyle = "#761c17";
        ctx.fill();
        const metal = ctx.createLinearGradient(-25, -24, 21, 29);
        metal.addColorStop(0, "#fff8c9");
        metal.addColorStop(.23, "#ffcc55");
        metal.addColorStop(.54, "#e47119");
        metal.addColorStop(.72, "#ffed91");
        metal.addColorStop(1, "#a7351e");
        drawPath(ctx, outline);
        ctx.fillStyle = metal;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff2ac";
        ctx.stroke();
      }
      ctx.globalAlpha = 1 - finish * .35;
      pentagram(ctx, forge);
    }
    ctx.restore();
  }

  function drawLeg(ctx, x, y, swing, far) {
    const foot = Math.sin(swing) * 20;
    const lift = Math.max(0, Math.cos(swing) * 14);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 12 + foot * .4, y + 17 - lift * .6, x + foot, y + 31 - lift);
    ctx.lineTo(x + foot + 7, y + 30 - lift);
    ctx.lineWidth = far ? 6 : 8;
    ctx.strokeStyle = far ? "#1e717d" : "#72d8d4";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "#c7ffed";
    ctx.stroke();
  }

  function drawFox(ctx, x, y, size, age, turn, emerge, fold, lite) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.17 + turn * .16);
    // Narrow the side silhouette as the fox twists toward the camera before the dive.
    ctx.scale(-size * (1 - .48 * Math.sin(turn * Math.PI)), size);
    ctx.translate(-8, 0);
    ctx.globalAlpha = emerge * (1 - fold * .84);
    ctx.shadowColor = "#57ffd7";
    ctx.shadowBlur = lite ? 0 : 8;
    tails.forEach(({ angle, length, hue }, n) => {
      ctx.save();
      ctx.translate(-34, -2);
      ctx.rotate(angle * (1 - fold * .78) + Math.sin(age / 100 + n * .57) * .11);
      const end = length * (1 - fold * .78) * (.55 + emerge * .45);
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.bezierCurveTo(-end * .4, -5, -end * .62, -35, -end, -19 - n * .9);
      ctx.bezierCurveTo(-end * .68, -5, -end * .67, 18, 2, 7);
      const colour = ctx.createLinearGradient(0, 0, -end, -25);
      colour.addColorStop(0, "#124b65");
      colour.addColorStop(.58, hue);
      colour.addColorStop(.86, "#58f4cf");
      colour.addColorStop(1, "#e4fff2");
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.strokeStyle = "#a4ffec";
      ctx.lineWidth = .8;
      ctx.stroke();
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    const run = age / 40 * (1 - fold * .7);
    drawLeg(ctx, -29, 5, run, true);
    drawLeg(ctx, 9, 5, run + Math.PI * .8, true);
    drawLeg(ctx, -25, 7, run + Math.PI, false);
    drawLeg(ctx, 16, 6, run - Math.PI * .2, false);
    const fur = ctx.createLinearGradient(0, -48, 0, 38);
    fur.addColorStop(0, "#e8fff1");
    fur.addColorStop(.45, "#83e8db");
    fur.addColorStop(1, "#1d5f76");
    ctx.fillStyle = fur;
    ctx.strokeStyle = "#16324b";
    ctx.lineWidth = 1.65;
    [foxBody, foxRuff, foxHead].forEach((shape) => { ctx.fill(shape); ctx.stroke(shape); });
    ctx.fillStyle = "#054554";
    ctx.beginPath();
    ctx.moveTo(29, -43); ctx.lineTo(36, -32); ctx.lineTo(29, -29);
    ctx.moveTo(51, -44); ctx.lineTo(54, -32); ctx.lineTo(48, -34);
    ctx.fill();
    ctx.strokeStyle = "#a7233f";
    ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(34, -21); ctx.quadraticCurveTo(39, -12, 46, -11); ctx.stroke();
    ctx.fillStyle = "#0a253b";
    ctx.beginPath(); ctx.ellipse(48, -19, 5, 1.8, .21, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff7b1";
    ctx.beginPath(); ctx.ellipse(49, -19, 1.4, 1.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#132b3b";
    ctx.beginPath(); ctx.ellipse(73, -13, 3.2, 2.4, -.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawMask(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.shadowColor = "#3ddcc8";
    ctx.shadowBlur = 9;
    ctx.fillStyle = "#09272f";
    ctx.fill(foxMask);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#57efd3";
    ctx.stroke(foxMask);
    const porcelain = ctx.createLinearGradient(-20, -28, 12, 30);
    porcelain.addColorStop(0, "#e7fff6");
    porcelain.addColorStop(1, "#53aaac");
    ctx.fillStyle = porcelain;
    ctx.fill(innerMask);
    ctx.strokeStyle = "#9c2843";
    ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 4); ctx.moveTo(14, 0); ctx.lineTo(4, 4); ctx.stroke();
    ctx.fillStyle = "#073e52";
    ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(4, 16); ctx.lineTo(0, 20); ctx.fill();
    ctx.restore();
  }

  function pawRing(ctx, x, y, r, p) {
    if (p < 0 || p >= 1) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, .48);
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = 2.8 - p * 1.5;
    ctx.strokeStyle = "#94ffe5";
    ctx.beginPath(); ctx.arc(0, 0, r * (.4 + p * .9), 0, TAU); ctx.stroke();
    ctx.setLineDash([6, 7]);
    ctx.beginPath(); ctx.arc(0, 0, r * (.84 + p * .62), 0, TAU); ctx.stroke();
    ctx.restore();
  }

  let canvas, ctx, cells, frame, active = null;
  let tier = "high", painted = false;

  function target(i) {
    const r = cells[i].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function humanPosition(f, t, hover) {
    const lift = f.close ? 52 : f.corner ? 112 : f.middle ? 96 : 70;
    return cubic(f.from, [f.from[0] + 52, f.from[1] - lift],
      [hover[0] - (f.corner ? 75 : 38), hover[1] - lift], hover, t);
  }

  function foxPosition(f, t, hover) {
    const width = f.cell * .74;
    const step1 = [clamp(mix(f.from[0], hover[0], .32), 58, innerWidth - 54), hover[1] - width * .35];
    const step2 = [clamp(hover[0] + width, 58, innerWidth - 54), hover[1] - 20];
    const points = [f.from, step1, step2, hover];
    const progress = t * 3;
    const n = Math.min(2, Math.floor(progress));
    const q = clamp(progress - n);
    return [
      mix(points[n][0], points[n + 1][0], q),
      mix(points[n][1], points[n + 1][1], q) - Math.sin(q * Math.PI) * (n === 1 ? 69 : 42)
    ];
  }

  function trail(ctx, f, pos, ms) {
    f.trace = f.trace.filter((point) => ms - point.time < 210);
    f.trace.push({ pos, time: ms });
    while (f.trace.length > 15) f.trace.shift();
    ctx.save();
    ctx.lineCap = "round";
    f.trace.forEach((point, i) => {
      if (i === 0) return;
      const alpha = (1 - (ms - point.time) / 210) * .69;
      ctx.strokeStyle = f.human ? `rgba(255,185,55,${alpha})` : `rgba(108,255,218,${alpha})`;
      ctx.lineWidth = 1 + 5 * alpha;
      ctx.beginPath(); ctx.moveTo(...f.trace[i - 1].pos); ctx.lineTo(...point.pos); ctx.stroke();
    });
    ctx.restore();
  }

  function render(f, ms) {
    const age = ms - f.start;
    if (age >= f.fly + f.drop) {
      active = null;
      f.resolve();
      return;
    }
    const to = target(f.index);
    const hover = [to[0], Math.max(53, to[1] - f.cell * (f.close ? .47 : .6))];
    const descend = clamp((age - f.fly) / f.drop);
    const t = clamp(age / f.fly);
    const landed = age >= f.fly;
    const pos = landed ? [mix(hover[0], to[0], descend), mix(hover[1], to[1], descend ** 1.7)]
      : f.human ? humanPosition(f, easeOut(t), hover) : foxPosition(f, t, hover);
    const size = Math.max(.78, f.cell / (f.human ? 78 : 109));

    trail(ctx, f, pos, ms);
    if (landed) {
      ctx.save();
      ctx.globalAlpha = descend * .38;
      ctx.fillStyle = "#28140e";
      ctx.beginPath(); ctx.ellipse(to[0], to[1] + 7, f.cell * .24, f.cell * .09, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (f.human) {
      const split = f.split ? Math.sin(Math.PI * clamp((t - .26) / .61)) ** 2 : 0;
      const swell = f.close ? 1 + 1.27 * Math.sin(Math.PI * descend) : 1;
      drawStar(ctx, ...pos, size * swell * (1 + descend * .25), landed ? 0 : t,
        clamp(t / .29), split, descend, f.lite);
      return;
    }

    [1 / 3, 2 / 3].forEach((threshold, step) => {
      if (t < threshold) return;
      const foot = foxPosition(f, threshold, hover);
      if (!f.steps[step]) { f.steps[step] = true; audio.playFoxStep(); }
      pawRing(ctx, foot[0], foot[1] + 17, Math.max(19, f.cell * .26), (age - threshold * f.fly) / 390);
    });
    if (descend < .98) drawFox(ctx, ...pos, size * mix(1, .52, descend),
      age, clamp((t - .55) / .45), clamp(t * 5), descend, f.lite);
    if (descend > .24) drawMask(ctx, ...pos, size * mix(.5, 1.1, descend), clamp((descend - .24) * 1.8));
  }

  function frameLoop(ms) {
    requestAnimationFrame(frameLoop);
    if (!active && !painted) return;
    const dpr = Math.min(tier === "compat" ? 1 : 1.5, window.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    painted = Boolean(active);
    if (active) render(active, ms);
  }

  window.HW06_FLIGHT = {
    init({ cells: boardCells, frameEl }) {
      cells = boardCells;
      frame = frameEl;
      canvas = document.createElement("canvas");
      canvas.id = "seal-flight-canvas";
      canvas.setAttribute("aria-hidden", "true");
      Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "81" });
      document.body.appendChild(canvas);
      ctx = canvas.getContext("2d");
      requestAnimationFrame(frameLoop);
    },
    setPerformanceTier(value) { tier = value; },
    clear() {
      if (active) { active.resolve(); active = null; }
      frame?.removeAttribute("data-flight");
    },
    fly(o) {
      if (!ctx || motion.matches) return Promise.resolve();
      const human = o.who === "ren";
      const index = o.cellIdx;
      const to = target(index);
      const corner = index % 2 === 0 && index !== 4;
      const type = human ? (o.split ? "star-split" : "star") : "fox";
      frame.dataset.flight = type;
      audio.playTransformation(human);
      audio.playFlightWhoosh(human);
      return new Promise((resolve) => {
        active = {
          index, human, corner, middle: index === 4, close: o.decisive, split: o.split,
          start: performance.now(), cell: o.cellW, trace: [], steps: [], lite: tier === "compat",
          from: [clamp(o.fromX, Math.max(45, to[0] - innerWidth * .45), Math.min(innerWidth - 45, to[0] + innerWidth * .45)),
            clamp(o.fromY, Math.max(36, to[1] - 230), Math.min(innerHeight - 34, Math.max(40, to[1] + 110)))],
          fly: o.decisive ? 815 : human ? (o.split ? 655 : 475) : 690,
          drop: o.decisive ? 590 : 238,
          resolve() { delete frame.dataset.flight; resolve(); }
        };
      });
    }
  };
})();
