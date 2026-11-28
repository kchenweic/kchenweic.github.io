/* ==========================================================================
   1142949 HW06 — 京都百鬼夜行：陰陽鎮魂錄
   File: js/vfx-engine.js
   Zero-GC Offscreen-Sprite Anime Particle Engine + Cut-In Director + SVG VFX
   + 3-Tier Automatic FPS Performance Governor (Rule 4 Compliance)
   ========================================================================== */

(function () {
  "use strict";

  const CELL_CENTERS_SVG = [
    { x: 50, y: 50 },   { x: 150, y: 50 },  { x: 250, y: 50 },
    { x: 50, y: 150 },  { x: 150, y: 150 }, { x: 250, y: 150 },
    { x: 50, y: 250 },  { x: 150, y: 250 }, { x: 250, y: 250 }
  ];

  const LINE_ENDPOINTS_SVG = [
    { x1: 18, y1: 50, x2: 282, y2: 50 },
    { x1: 18, y1: 150, x2: 282, y2: 150 },
    { x1: 18, y1: 250, x2: 282, y2: 250 },
    { x1: 50, y1: 18, x2: 50, y2: 282 },
    { x1: 150, y1: 18, x2: 150, y2: 282 },
    { x1: 250, y1: 18, x2: 250, y2: 282 },
    { x1: 22, y1: 22, x2: 278, y2: 278 },
    { x1: 278, y1: 22, x2: 22, y2: 278 }
  ];

  class AnimeVfxStage {
    constructor(canvas, onTierUpdate) {
      this.canvas = canvas;
      this.onTierUpdate = onTierUpdate;
      this.ctx = null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;

      this.stageTheme = "fushimi"; // 'fushimi' | 'rashomon' | 'kurama'
      this.userPref = "auto";      // 'auto' | 'high' | 'medium' | 'compat'
      this.activeTier = "high";    // 'high' | 'medium' | 'compat'

      this.running = false;
      this.rafId = 0;
      this.lastTs = 0;
      this.fpsWindow = [];
      this.slowStreak = 0;
      this.measuredFps = 60;

      // 260-slot Pre-Allocated Zero-GC Particle Object Pool
      this.poolSize = 260;
      this.pool = Array.from({ length: this.poolSize }, () => ({
        active: false,
        ambient: false,
        sprite: null,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0.96,
        size: 14,
        alpha: 1,
        decay: 0.02,
        rot: 0,
        vRot: 0
      }));

      this.sprites = {};
      this.cutinTimer = 0;
      this.init();
    }

    init() {
      const reducedMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      try {
        this.ctx = this.canvas.getContext("2d", { alpha: true });
      } catch (_) {
        this.ctx = null;
      }

      if (!this.ctx) {
        this.applyTier("compat", true);
        return;
      }

      this.bakeOffscreenSprites();
      this.resize();
      window.addEventListener("resize", () => this.resize(), { passive: true });

      this.applyTier(reducedMotion ? "medium" : "high", true);
      this.seedStageWeather();
      this.startLoop();
    }

    // Pre-bake 7 luminous anime particle sprites ONCE (Zero shadowBlur during gameplay!)
    bakeOffscreenSprites() {
      const create = (sz, fn) => {
        const c = document.createElement("canvas");
        c.width = sz;
        c.height = sz;
        const g = c.getContext("2d");
        if (g) fn(g, sz);
        return c;
      };

      this.sprites.vermilionOrb = create(34, (g) => {
        const gr = g.createRadialGradient(17, 17, 2, 17, 17, 15);
        gr.addColorStop(0, "#fff0e6");
        gr.addColorStop(0.45, "#f2523d");
        gr.addColorStop(1, "rgba(214,56,38,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(17, 17, 15, 0, Math.PI * 2);
        g.fill();
      });

      this.sprites.goldOfuda = create(28, (g) => {
        g.translate(14, 14);
        g.rotate(Math.PI / 7);
        g.fillStyle = "#ffe08a";
        g.strokeStyle = "#b87914";
        g.lineWidth = 1.4;
        g.fillRect(-4.5, -8.5, 9, 17);
        g.strokeRect(-4.5, -8.5, 9, 17);
      });

      this.sprites.cyanFoxfire = create(36, (g) => {
        const gr = g.createRadialGradient(18, 18, 2, 18, 18, 16);
        gr.addColorStop(0, "#ebfffc");
        gr.addColorStop(0.42, "#49f2e1");
        gr.addColorStop(1, "rgba(22,168,154,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(18, 18, 16, 0, Math.PI * 2);
        g.fill();
      });

      this.sprites.oniEmber = create(34, (g) => {
        const gr = g.createRadialGradient(17, 17, 2, 17, 17, 15);
        gr.addColorStop(0, "#fff8d6");
        gr.addColorStop(0.42, "#ffaa33");
        gr.addColorStop(1, "rgba(217,65,38,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(17, 17, 15, 0, Math.PI * 2);
        g.fill();
      });

      this.sprites.tenguWind = create(34, (g) => {
        const gr = g.createRadialGradient(17, 17, 2, 17, 17, 15);
        gr.addColorStop(0, "#ebfff5");
        gr.addColorStop(0.45, "#6ef7c2");
        gr.addColorStop(1, "rgba(25,168,115,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(17, 17, 15, 0, Math.PI * 2);
        g.fill();
      });

      this.sprites.sakuraPetal = create(28, (g) => {
        g.fillStyle = "#ffc4d0";
        g.beginPath();
        g.moveTo(14, 3);
        g.bezierCurveTo(23, 8, 24, 20, 14, 25);
        g.bezierCurveTo(4, 20, 5, 8, 14, 3);
        g.fill();
      });

      this.sprites.goldLeaf = create(26, (g) => {
        g.fillStyle = "#f5c85c";
        g.beginPath();
        g.moveTo(13, 3);
        g.lineTo(21, 13);
        g.lineTo(13, 23);
        g.lineTo(5, 13);
        g.closePath();
        g.fill();
      });
    }

    resize() {
      if (!this.ctx) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, this.activeTier === "high" ? 1.65 : 1);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    setStageWeather(stageKey) {
      this.stageTheme = stageKey || "fushimi";
      for (let i = 0; i < this.poolSize; i++) {
        if (this.pool[i].ambient) this.pool[i].active = false;
      }
      this.seedStageWeather();
    }

    applyTier(tier, isAuto) {
      this.activeTier = tier;
      document.body.classList.remove("perf-high", "perf-medium", "perf-compat");
      document.body.classList.add(`perf-${tier}`);

      if (tier === "compat") {
        this.stopLoop();
      } else {
        this.resize();
        if (tier === "medium") {
          for (let i = 0; i < this.poolSize; i++) {
            if (this.pool[i].ambient) this.pool[i].active = false;
          }
        } else {
          this.seedStageWeather();
        }
        if (!this.running && this.ctx) {
          this.startLoop();
        }
      }

      if (this.onTierUpdate) {
        this.onTierUpdate(tier, this.userPref, isAuto);
      }
    }

    cycleQualityMode() {
      const modes = ["auto", "high", "medium", "compat"];
      const next = modes[(modes.indexOf(this.userPref) + 1) % modes.length];
      this.userPref = next;
      this.fpsWindow.length = 0;
      this.slowStreak = 0;

      if (next === "auto") {
        this.applyTier(this.ctx ? "high" : "compat", true);
      } else {
        this.applyTier(next, false);
      }
    }

    allocSlot() {
      for (let i = 0; i < this.poolSize; i++) {
        if (!this.pool[i].active) return this.pool[i];
      }
      return null;
    }

    seedStageWeather() {
      if (this.activeTier !== "high" || !this.ctx) return;
      let count = 0;
      for (let i = 0; i < this.poolSize; i++) {
        if (this.pool[i].active && this.pool[i].ambient) count++;
      }
      const target = 20;
      for (let k = count; k < target; k++) {
        const p = this.allocSlot();
        if (!p) break;
        p.active = true;
        p.ambient = true;

        if (this.stageTheme === "rashomon") {
          p.sprite = k % 2 === 0 ? this.sprites.oniEmber : this.sprites.cyanFoxfire;
          p.vx = -0.55 - Math.random() * 0.7;
          p.vy = -0.5 - Math.random() * 0.9; // Rising embers in storm
        } else if (this.stageTheme === "kurama") {
          p.sprite = k % 2 === 0 ? this.sprites.goldLeaf : this.sprites.tenguWind;
          p.vx = 0.65 + Math.random() * 0.9;
          p.vy = 0.35 + Math.random() * 0.5;
        } else {
          p.sprite = k % 3 === 0 ? this.sprites.cyanFoxfire : this.sprites.sakuraPetal;
          p.vx = -0.35 - Math.random() * 0.5;
          p.vy = 0.45 + Math.random() * 0.65;
        }

        p.x = Math.random() * (this.width || 1200);
        p.y = Math.random() * (this.height || 800);
        p.gravity = 0;
        p.drag = 1;
        p.size = 11 + Math.random() * 9;
        p.alpha = 0.26 + Math.random() * 0.42;
        p.decay = 0;
        p.rot = Math.random() * Math.PI * 2;
        p.vRot = (Math.random() - 0.5) * 0.035;
      }
    }

    getBossSprite(bossId) {
      if (bossId === "ibaraki") return this.sprites.oniEmber;
      if (bossId === "tengu") return this.sprites.tenguWind;
      return this.sprites.cyanFoxfire;
    }

    burstSealSlam(clientX, clientY, isHuman, bossId, isHeavy) {
      if (this.activeTier === "compat" || !this.ctx) return;
      const total = (this.activeTier === "high" ? 40 : 18) + (isHeavy ? 18 : 0);
      const mainSp = isHuman ? this.sprites.vermilionOrb : this.getBossSprite(bossId);
      const subSp = isHuman ? this.sprites.goldOfuda : this.sprites.goldLeaf;

      for (let i = 0; i < total; i++) {
        const p = this.allocSlot();
        if (!p) break;
        const ang = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.36;
        const spd = 2.5 + Math.random() * (isHeavy ? 10.2 : 7.6);
        p.active = true;
        p.ambient = false;
        p.sprite = i % 3 === 0 ? subSp : mainSp;
        p.x = clientX;
        p.y = clientY;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd - 1.3;
        p.gravity = 0.16;
        p.drag = 0.94;
        p.size = 12 + Math.random() * 15;
        p.alpha = 0.98;
        p.decay = 0.019 + Math.random() * 0.015;
        p.rot = Math.random() * Math.PI * 2;
        p.vRot = (Math.random() - 0.5) * 0.18;
      }
    }

    burstGrandFinale(rect, winner, bossId) {
      if (this.activeTier === "compat" || !this.ctx) return;
      const total = this.activeTier === "high" ? 80 : 30;
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const bossSp = this.getBossSprite(bossId);

      for (let i = 0; i < total; i++) {
        const p = this.allocSlot();
        if (!p) break;
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.2 + Math.random() * 10.0;
        p.active = true;
        p.ambient = false;
        if (winner === -1) {
          p.sprite = i % 3 === 0 ? this.sprites.goldLeaf : bossSp;
        } else {
          p.sprite = i % 2 === 0 ? this.sprites.goldOfuda : this.sprites.sakuraPetal;
        }
        p.x = cx + (Math.random() - 0.5) * rect.width * 0.7;
        p.y = cy + (Math.random() - 0.5) * rect.height * 0.7;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd - 2.4;
        p.gravity = 0.11;
        p.drag = 0.955;
        p.size = 13 + Math.random() * 16;
        p.alpha = 1;
        p.decay = 0.012 + Math.random() * 0.012;
        p.rot = Math.random() * Math.PI * 2;
        p.vRot = (Math.random() - 0.5) * 0.14;
      }
    }

    /* ------------------------------------------------------------------------
       Diagonal Anime Cut-In Director & Board SVG Impact Effects
       ------------------------------------------------------------------------ */
    triggerCutIn(portraitUrl, subTitle, skillTitle, isBoss) {
      const cutinEl = document.getElementById("anime-cutin");
      const imgEl = document.getElementById("cutin-img");
      const subEl = document.getElementById("cutin-sub");
      const titleEl = document.getElementById("cutin-title");
      if (!cutinEl) return;

      if (this.cutinTimer) {
        window.clearTimeout(this.cutinTimer);
      }
      cutinEl.classList.remove("active", "boss-cutin");
      // Force quick reflow on single overlay element to restart keyframe cleanly
      void cutinEl.offsetWidth;

      imgEl.src = portraitUrl;
      subEl.textContent = subTitle;
      titleEl.textContent = skillTitle;
      if (isBoss) cutinEl.classList.add("boss-cutin");
      cutinEl.classList.add("active");

      this.cutinTimer = window.setTimeout(() => {
        cutinEl.classList.remove("active");
      }, 1100);
    }

    shakeBoardFrame(frameEl, cellIdx, strength) {
      if (!frameEl || typeof frameEl.animate !== "function") return;
      const col = (cellIdx % 3) - 1;
      const row = Math.floor(cellIdx / 3) - 1;
      const dx = (col === 0 ? 0.6 : col) * 4.8 * strength;
      const dy = (row === 0 ? 0.8 : row) * 4.8 * strength;
      const rot = col * 0.6 * strength;

      frameEl.animate(
        [
          { transform: "translate3d(0,0,0) rotate(0deg)" },
          { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)` },
          { transform: `translate3d(${-dx * 0.65}px, ${-dy * 0.65}px, 0) rotate(${-rot * 0.5}deg)` },
          { transform: `translate3d(${dx * 0.28}px, ${dy * 0.28}px, 0) rotate(0deg)` },
          { transform: "translate3d(0,0,0) rotate(0deg)" }
        ],
        { duration: 265, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }

    spawnShockwaves(svgGroup, cellIdx, isHuman, bossColor, isHeavy) {
      if (!svgGroup) return;
      const pt = CELL_CENTERS_SVG[cellIdx];
      const ns = "http://www.w3.org/2000/svg";
      const outerStroke = isHuman ? "#e84835" : bossColor || "#22cfc0";
      const innerStroke = isHuman ? "#ffe08a" : "#d8fff8";

      const c1 = document.createElementNS(ns, "circle");
      c1.setAttribute("cx", String(pt.x));
      c1.setAttribute("cy", String(pt.y));
      c1.setAttribute("r", isHeavy ? "46" : "38");
      c1.setAttribute("fill", "none");
      c1.setAttribute("stroke", outerStroke);
      c1.setAttribute("class", "svg-shockwave");

      const c2 = document.createElementNS(ns, "circle");
      c2.setAttribute("cx", String(pt.x));
      c2.setAttribute("cy", String(pt.y));
      c2.setAttribute("r", "25");
      c2.setAttribute("fill", "none");
      c2.setAttribute("stroke", innerStroke);
      c2.setAttribute("class", "svg-shockwave inner");

      svgGroup.appendChild(c1);
      svgGroup.appendChild(c2);

      window.setTimeout(() => {
        c1.remove();
        c2.remove();
      }, 620);
    }

    spawnLightningStrike(svgGroup, cellIdx, strokeColor) {
      if (!svgGroup) return;
      const pt = CELL_CENTERS_SVG[cellIdx];
      const ns = "http://www.w3.org/2000/svg";

      const bolt = document.createElementNS(ns, "path");
      const d = [
        `M ${pt.x - 16} -10`,
        `L ${pt.x + 14} ${pt.y * 0.34}`,
        `L ${pt.x - 10} ${pt.y * 0.52}`,
        `L ${pt.x + 16} ${pt.y * 0.78}`,
        `L ${pt.x} ${pt.y}`
      ].join(" ");

      bolt.setAttribute("d", d);
      bolt.setAttribute("fill", "none");
      bolt.setAttribute("stroke", strokeColor || "#7afcf0");
      bolt.setAttribute("stroke-width", "5");
      bolt.setAttribute("stroke-linecap", "round");
      bolt.setAttribute("stroke-linejoin", "round");
      bolt.setAttribute("class", "svg-lightning-bolt");
      svgGroup.appendChild(bolt);

      window.setTimeout(() => bolt.remove(), 580);
    }

    spawnCalloutText(layerEl, cellIdx, text, cssClass) {
      if (!layerEl) return;
      const pt = CELL_CENTERS_SVG[cellIdx];
      const div = document.createElement("div");
      div.className = `impact-callout ${cssClass}`;
      div.style.left = `${(pt.x / 300) * 100}%`;
      div.style.top = `${(pt.y / 300) * 100}%`;
      div.textContent = text;
      layerEl.appendChild(div);
      window.setTimeout(() => div.remove(), 980);
    }

    drawMidGameVeinBeam(svgGroup, lineIdx, isHuman, bossColor, isBoosted) {
      if (!svgGroup) return;
      const ep = LINE_ENDPOINTS_SVG[lineIdx];
      const ns = "http://www.w3.org/2000/svg";

      const glow = document.createElementNS(ns, "line");
      glow.setAttribute("x1", String(ep.x1));
      glow.setAttribute("y1", String(ep.y1));
      glow.setAttribute("x2", String(ep.x2));
      glow.setAttribute("y2", String(ep.y2));
      glow.setAttribute("stroke", isHuman ? "rgba(224,173,70,0.55)" : "rgba(73,242,225,0.45)");
      glow.setAttribute("stroke-width", isBoosted ? "17" : "13");
      glow.setAttribute("stroke-linecap", "round");
      glow.setAttribute("class", "vein-lock-beam");

      const core = document.createElementNS(ns, "line");
      core.setAttribute("x1", String(ep.x1));
      core.setAttribute("y1", String(ep.y1));
      core.setAttribute("x2", String(ep.x2));
      core.setAttribute("y2", String(ep.y2));
      core.setAttribute("stroke", isHuman ? "#d63826" : bossColor || "#16a89a");
      core.setAttribute("stroke-width", "5.2");
      core.setAttribute("stroke-linecap", "round");
      core.setAttribute("class", "vein-lock-beam");

      svgGroup.appendChild(glow);
      svgGroup.appendChild(core);
    }

    drawDuelLine(group, lineIdx, isHuman) {
      if (!group) return;
      const ep = LINE_ENDPOINTS_SVG[lineIdx];
      const ns = "http://www.w3.org/2000/svg";
      const dPath = `M ${ep.x1} ${ep.y1} L ${ep.x2} ${ep.y2}`;

      const blade = document.createElementNS(ns, "path");
      blade.setAttribute("d", dPath);
      blade.setAttribute("fill", "none");
      blade.setAttribute("stroke", isHuman ? "#ffe594" : "#b8fff8");
      blade.setAttribute("stroke-width", "7.8");
      blade.setAttribute("stroke-linecap", "round");
      blade.setAttribute("class", "finale-slash-stroke");

      blade.style.filter = "drop-shadow(0 0 5px " + (isHuman ? "#e68b32" : "#08a995") + ")";
      group.replaceChildren(blade);

    }

    drawFinaleGrandSlash(group, svgTransientGroup, lineIdx, isHuman, bossColor, winLines) {
      this.drawDuelLine(group, lineIdx, isHuman);
      if (winLines && winLines[lineIdx]) {
        winLines[lineIdx].forEach((cIdx) => {
          this.spawnShockwaves(svgTransientGroup, cIdx, isHuman, bossColor, true);
        });
      }
    }

    drawTaijiHarmonySeal(svgSlashesGroup) {
      if (!svgSlashesGroup) return;
      const ns = "http://www.w3.org/2000/svg";
      const outer = document.createElementNS(ns, "circle");
      outer.setAttribute("cx", "150");
      outer.setAttribute("cy", "150");
      outer.setAttribute("r", "82");
      outer.setAttribute("fill", "none");
      outer.setAttribute("stroke", "#e0ad46");
      outer.setAttribute("stroke-width", "5.5");
      outer.setAttribute("class", "finale-slash-stroke");
      svgSlashesGroup.appendChild(outer);
    }

    /* ------------------------------------------------------------------------
       Main Canvas Animation Loop & Auto FPS Downgrade Monitor
       ------------------------------------------------------------------------ */
    startLoop() {
      if (this.running) return;
      this.running = true;
      this.lastTs = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        this.tick(now);
        this.rafId = window.requestAnimationFrame(loop);
      };
      this.rafId = window.requestAnimationFrame(loop);
    }

    stopLoop() {
      this.running = false;
      if (this.rafId) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    tick(now) {
      const dt = now - this.lastTs;
      this.lastTs = now;

      // Auto Performance Guard (Rule 4): measure real frame intervals
      if (dt > 0 && dt < 250) {
        this.fpsWindow.push(1000 / dt);
        if (this.fpsWindow.length > 36) this.fpsWindow.shift();

        if (this.fpsWindow.length >= 24 && this.userPref === "auto") {
          const avg = this.fpsWindow.reduce((a, b) => a + b, 0) / this.fpsWindow.length;
          this.measuredFps = Math.round(avg);

          if (this.activeTier === "high" && avg < 42) {
            this.slowStreak++;
            if (this.slowStreak >= 18) {
              this.slowStreak = 0;
              this.fpsWindow.length = 0;
              this.applyTier("medium", true);
              return;
            }
          } else if (this.activeTier === "medium" && avg < 25) {
            this.slowStreak++;
            if (this.slowStreak >= 18) {
              this.slowStreak = 0;
              this.fpsWindow.length = 0;
              this.applyTier("compat", true);
              return;
            }
          } else {
            this.slowStreak = Math.max(0, this.slowStreak - 1);
          }
        }
      }

      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, this.width, this.height);

      const stepScale = Math.min(2.2, Math.max(0.5, dt / 16.67));

      for (let i = 0; i < this.poolSize; i++) {
        const p = this.pool[i];
        if (!p.active) continue;

        if (p.ambient) {
          p.x += p.vx * stepScale + Math.sin(now * 0.0014 + i) * 0.22;
          p.y += p.vy * stepScale;
          p.rot += p.vRot * stepScale;

          if (p.y > this.height + 26) {
            p.y = -22;
            p.x = Math.random() * this.width;
          } else if (p.y < -26) {
            p.y = this.height + 22;
            p.x = Math.random() * this.width;
          }
          if (p.x > this.width + 26) p.x = -22;
          if (p.x < -26) p.x = this.width + 22;
        } else {
          p.vx *= Math.pow(p.drag, stepScale);
          p.vy = p.vy * Math.pow(p.drag, stepScale) + p.gravity * stepScale;
          p.x += p.vx * stepScale;
          p.y += p.vy * stepScale;
          p.rot += p.vRot * stepScale;
          p.alpha -= p.decay * stepScale;
          if (p.alpha <= 0.02) {
            p.active = false;
            continue;
          }
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const h = p.size * 0.5;
        ctx.drawImage(p.sprite, -h, -h, p.size, p.size);
        ctx.restore();
      }
    }
  }

  window.HW06_VFX = {
    CELL_CENTERS_SVG,
    LINE_ENDPOINTS_SVG,
    AnimeVfxStage
  };
})();
