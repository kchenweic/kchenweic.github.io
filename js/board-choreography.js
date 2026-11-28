/* Board-local choreography. All overlays follow the board when it tilts or resizes. */
(function () {
  "use strict";

  const { HUMAN, AI, EMPTY } = window.HW06_AI;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sound = window.HW06_AUDIO;
  const paperImpactMs = 735;
  const paperDurationMs = 1320;
  let frame, board, cells, layer, boardTilt;
  const timers = new Set();
  const animations = new Set();
  let camera, generation = 0;

  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  }

  function done(animation) {
    return animation.finished.catch(() => {});
  }

  function later(callback, ms) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, ms);
    timers.add(timer);
  }

  function marker(classes, i) {
    const node = document.createElement("div");
    node.className = classes;
    if (i != null) {
      node.style.left = ((i % 3 + 0.5) / 3) * 100 + "%";
      node.style.top = ((Math.floor(i / 3) + 0.5) / 3) * 100 + "%";
    }
    layer.appendChild(node);
    return node;
  }

  function assemble() {
    if (motion.matches) return Promise.resolve();
    const current = generation;
    board.classList.add("duel-assembling");
    const order = [4, 0, 8, 2, 6, 1, 7, 3, 5];
    return Promise.all(order.map((i, n) => {
      const col = i % 3 - 1;
      const row = Math.floor(i / 3) - 1;
      const turn = (n % 2 ? 1 : -1) * (35 + n * 4);
      const delay = 55 * n;
      later(() => sound.playTileLock(n), delay + 560);
      return done(animate(cells[i], [
        { transform: `perspective(440px) translate3d(${col * 56}%, ${-48 + row * 45}%, -45px) rotateX(59deg) rotateZ(${turn}deg) scale(.56)`, opacity: 0 },
        { transform: `perspective(510px) translate3d(${col * 44}%, ${-14 + row * 31}%, 46px) rotateX(-14deg) rotateZ(${turn * .48}deg) scale(.83)`, opacity: 1, offset: .64 },
        { transform: "translateY(3px) scale(.97)", opacity: 1, offset: .92 },
        { transform: "none", opacity: 1 }
      ], { duration: 650, delay, fill: "backwards", easing: "cubic-bezier(.22,.62,.3,1)" }));
    })).then(() => {
      if (current === generation) board.classList.remove("duel-assembling");
    });
  }

  function stamp(i) {
    const paper = marker("duel-talisman", i);
    const ink = document.createElement("div");
    ink.className = "duel-paper-ink";
    ink.innerHTML = `<span class="duel-paper-title">伏見鎮魂</span>
      <span class="duel-paper-script">奉</span><span class="duel-paper-orbit">⟡</span>
      <span class="duel-paper-column left">金星鎮九宮</span>
      <span class="duel-paper-column main">九宮結界</span>
      <span class="duel-paper-column right">青焰守伏見</span>
      <span class="duel-paper-signature">陰陽御印</span>
      <span class="duel-paper-foot">急急如律令</span>`;
    paper.appendChild(ink);
    for (let corner = 0; corner < 4; corner++) {
      const flame = document.createElement("i");
      flame.className = "duel-paper-flame";
      flame.style.setProperty("--flame-delay", (corner * 36) + "ms");
      paper.appendChild(flame);
    }
    sound.playTalismanRush();
    later(() => {
      sound.playTalismanImpact();
      const spark = marker("duel-talisman-impact", i);
      const mark = document.createElement("span");
      mark.className = "duel-seal-imprint";
      mark.textContent = "鎮";
      cells[i].appendChild(mark);
      for (let n = 0; n < 4; n++) {
        const ember = marker("duel-talisman-ember", i);
        ember.style.setProperty("--ember-angle", (n * 90 + 18) + "deg");
        ember.style.setProperty("--ember-distance", (44 + 10 * (n % 2)) + "px");
        later(() => ember.remove(), 680);
      }
      later(() => spark.remove(), 490);
      later(() => mark.remove(), 1550);
    }, motion.matches ? 0 : paperImpactMs);
    later(() => paper.remove(), paperDurationMs);
  }

  function closeTails(i) {
    const trap = marker("duel-tail-trap", i);
    for (let n = 0; n < 9; n++) {
      const sector = document.createElement("span");
      sector.className = "duel-tail-sector";
      sector.style.rotate = (n * 40) + "deg";
      sector.style.setProperty("--tail-delay", (n % 3) * 25 + "ms");
      sector.appendChild(document.createElement("i"));
      trap.appendChild(sector);
    }
    const ink = document.createElement("b");
    ink.textContent = "斷";
    trap.appendChild(ink);
    sound.playTailClamp();
    later(() => trap.remove(), 900);
  }

  function clash(i, who, position) {
    const r = Math.floor(i / 3), c = i % 3;
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dr, dc]) => {
      const row = r + dr, col = c + dc;
      if (row < 0 || row > 2 || col < 0 || col > 2) return;
      const enemy = row * 3 + col;
      if (position[enemy] !== -who) return;
      const collision = marker("duel-border-clash", i);
      collision.style.left = ((c + 0.5 + dc / 2) / 3) * 100 + "%";
      collision.style.top = ((r + 0.5 + dr / 2) / 3) * 100 + "%";
      collision.style.setProperty("--clash-angle", Math.atan2(dr, dc) + "rad");
      collision.dataset.source = who === HUMAN ? "human" : "ai";
      collision.append(document.createElement("i"), document.createElement("i"), document.createElement("b"));
      if (!motion.matches) {
        [i, enemy].forEach((cellIndex, n) => {
          const sign = n === 0 ? -1 : 1;
          animate(cells[cellIndex].querySelector(".piece-mount"), [
            { translate: "0 0" },
            { translate: `${sign * dc * 7}px ${sign * dr * 7}px`, offset: .35 },
            { translate: "0 0" }
          ], { duration: 360, easing: "ease-out" });
        });
      }
      later(() => collision.remove(), 590);
    });
    if (layer.querySelector(".duel-border-clash")) sound.playSealClash();
  }

  function centerPressure() {
    if (motion.matches) return Promise.resolve();
    const positions = [4, 0, 2, 8, 6];
    return Promise.all(positions.map((i, n) => {
      const center = i === 4;
      if (!center) later(() => sound.playTileLock(n + 2), 185 + n * 68);
      return done(animate(cells[i], [
        { transform: "none" },
        { transform: center ? "translateY(22px) scale(.85)" : "translateY(-33px) rotateX(20deg) scale(1.09)", offset: .36 },
        { transform: "translateY(3px)", offset: .77 },
        { transform: "none" }
      ], { duration: center ? 420 : 340, delay: n ? 32 + n * 63 : 0, easing: "cubic-bezier(.21,.67,.32,1)" }));
    }));
  }

  const LOW_ANGLE = "perspective(650px) rotateX(53deg) rotateZ(-7deg) scale(1.07)";
  function enterLastShot() {
    if (motion.matches) return Promise.resolve();
    frame.classList.add("duel-low-angle");
    camera?.cancel();
    camera = animate(frame, [
      { transform: "none" },
      { transform: LOW_ANGLE }
    ], { duration: 460, fill: "forwards", easing: "cubic-bezier(.25,.77,.32,1)" });
    return done(camera);
  }

  function leaveLastShot() {
    if (!camera) return Promise.resolve();
    const current = generation;
    camera.cancel();
    camera = null;
    return done(animate(frame, [
      { transform: LOW_ANGLE },
      { transform: "none" }
    ], { duration: 445, easing: "cubic-bezier(.22,.73,.31,1)" })).then(() => {
      if (current === generation) frame.classList.remove("duel-low-angle");
    });
  }

  async function liftWinner(line, slash, draw) {
    if (motion.matches) {
      draw();
      return;
    }
    const current = generation;
    const distance = Math.round(board.clientWidth * .064);
    const mounts = line.map((i) => cells[i].querySelector(".piece-mount"));
    const raised = `translateY(-${distance}px)`;
    const rises = mounts.map((mount, n) => {
      later(() => sound.playSettleTick(n, true), 118 * n);
      return animate(mount, [
        { transform: "none" },
        { transform: raised }
      ], { duration: 265, delay: 118 * n, fill: "forwards", easing: "cubic-bezier(.19,.87,.29,1)" });
    });
    await Promise.all(rises.map(done));
    if (current !== generation) return;
    const svg = slash.ownerSVGElement;
    svg.style.transform = raised;
    draw();
    await Promise.all(slash.getAnimations({ subtree: true }).map(done));
    if (current !== generation) return;
    const descent = [svg, ...mounts].map((element) => animate(element, [
      { transform: raised },
      { transform: "none" }
    ], { duration: 290, fill: "both", easing: "cubic-bezier(.38,.08,.44,1)" }));
    rises.forEach((animation) => animation.cancel());
    sound.playFinaleSeal();
    await Promise.all(descent.map(done));
    if (current !== generation) return;
    svg.style.removeProperty("transform");
    descent.forEach((animation) => animation.cancel());
  }

  function pulseCells(index, who) {
    const originRow = Math.floor(index / 3);
    const originCol = index % 3;
    cells.forEach((cell, i) => {
      const distance = Math.abs(Math.floor(i / 3) - originRow) + Math.abs(i % 3 - originCol);
      const ring = document.createElement("span");
      ring.className = "duel-cell-ripple " + (who === HUMAN ? "human" : "ai");
      ring.style.animationDelay = distance * 40 + "ms";
      cell.appendChild(ring);
      later(() => ring.remove(), 560);
    });
  }

  function tilt(i, who) {
    if (motion.matches) return Promise.resolve();
    boardTilt?.cancel();
    const corner = i % 2 === 0 && i !== 4;
    const direction = who === HUMAN ? -1 : 1;
    const roll = corner ? (i % 3 === 0 ? -1 : 1) * 9 : direction * 4;
    const pitch = i === 4 ? 12 : corner && i > 4 ? -13 : 8;
    boardTilt = animate(board, [
      { transform: "none" },
      { transform: `perspective(680px) rotateX(${pitch}deg) rotateY(${direction * 7}deg) rotateZ(${roll}deg) scale(.965)`, offset: .42 },
      { transform: "none" }
    ], { duration: corner ? 410 : 320, easing: "ease-in-out" });
    return boardTilt.finished.catch(() => {});
  }

  function onLanded(i, who, info, position, { decided, callTalisman }) {
    frame.dataset.turnGlow = who === HUMAN ? "ai" : "human";
    pulseCells(i, who);
    if (i === 4 && !decided) {
      [0, 2, 8, 6].forEach((corner, n) => {
        const flare = marker("duel-corner-flare", corner);
        flare.style.animationDelay = n * 65 + "ms";
        later(() => flare.remove(), 760);
      });
    }
    if (callTalisman) stamp(i);
    if (info.blocked && who === AI && !decided) closeTails(i);
    clash(i, who, position);
    const landing = cells[i];
    const wasLifted = landing.classList.contains("duel-endgame-slot");
    if (wasLifted) landing.classList.remove("duel-endgame-slot");
    const lower = wasLifted && !motion.matches ? done(animate(landing, [
      { transform: "translateY(-17px) scale(1.035)" },
      { transform: "translateY(3px) scale(.98)", offset: .74 },
      { transform: "none" }
    ], { duration: 275, easing: "ease-in" })) : Promise.resolve();
    if (decided) return lower;
    info.forkTargets.forEach((target, n) => {
      const ring = marker("duel-fork-target " + (who === HUMAN ? "human" : "ai"), target);
      ring.textContent = n === 0 ? "一" : "二";
      ring.style.animationDelay = n * 95 + "ms";
      later(() => ring.remove(), 1180);
    });
    if (info.forkTargets.length) sound.playThreat(who === HUMAN);

    frame.classList.toggle("duel-dual-threat", info.dualThreat);
    const twoSlotsLeft = position.filter((piece) => piece === EMPTY).length === 2;
    cells.forEach((cell, k) => {
      cell.classList.toggle("duel-endgame-slot", position[k] === EMPTY && (twoSlotsLeft || cell.classList.contains("duel-endgame-slot")));
    });

    if (i === 4) return centerPressure();
    // Keep the talisman on the landing tile until the corners burn away.
    if (wasLifted || twoSlotsLeft || info.blocked || callTalisman) return lower;
    return tilt(i, who);
  }

  function finish(winner, lastCell) {
    frame.classList.remove("duel-dual-threat", "duel-thinking");
    frame.dataset.turnGlow = winner === AI ? "ai" : winner === HUMAN ? "human" : "draw";
    document.body.dataset.duelResult = frame.dataset.turnGlow;
    cells.forEach((cell, i) => {
      cell.classList.remove("duel-endgame-slot");
      cell.classList.toggle("duel-last", i === lastCell);
      if (!winner) {
        cell.style.setProperty("--scan-delay", i * 65 + "ms");
        cell.classList.add("duel-draw-scan");
      }
    });
  }

  window.HW06_CHOREOGRAPHY = {
    init(boardFrame, boardSurface, boardCells) {
      frame = boardFrame;
      board = boardSurface;
      cells = boardCells;
      layer = document.createElement("div");
      layer.className = "duel-overlay";
      layer.setAttribute("aria-hidden", "true");
      frame.appendChild(layer);
    },

    reset() {
      generation++;
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      camera?.cancel();
      camera = null;
      timers.forEach(clearTimeout);
      timers.clear();
      boardTilt?.cancel();
      delete document.body.dataset.duelResult;
      frame.dataset.turnGlow = "human";
      frame.classList.remove("duel-dual-threat", "duel-thinking", "duel-low-angle");
      board.classList.remove("duel-assembling");
      board.querySelector(".board-vfx-svg").style.removeProperty("transform");
      layer.replaceChildren();
      cells.forEach((cell) => {
        cell.classList.remove("duel-last", "duel-endgame-slot", "duel-draw-scan", "duel-invalid");
        cell.querySelectorAll(".duel-cell-ripple, .duel-seal-imprint").forEach((node) => node.remove());
      });
    },

    reject(i) {
      const cell = cells[i];
      cell.classList.remove("duel-invalid");
      void cell.offsetWidth;
      cell.classList.add("duel-invalid");
      sound.playInvalidCell();
    },

    setThinking(on) {
      frame.classList.toggle("duel-thinking", on);
    },

    assemble,
    talismanSettleMs: paperDurationMs,
    enterLastShot,
    leaveLastShot,
    liftWinner,
    onLanded,
    finish
  };
})();
