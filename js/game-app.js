/* ==========================================================================
   1142949 HW06 — 京都百鬼夜行：陰陽鎮魂對弈
   File: js/game-app.js
   Focused Single-Stage Master Orchestrator (神樂坂 蓮 vs 九尾妖狐・玉藻前):
   - Left & Right Full-Size Live 2D Skeletal Anime Rigs (Breathing, Gaze, Lip-Sync, Cast Poses)
   - Distinct Male Hero & Female Kitsune Character Voices + Battle Chants
   - 9 Board Move Spell Projectiles + 4 Elemental Styles
   - Voice-driven Widescreen Opening & Ending Cutscenes
   - Nine-Piece Full-Board Rules + 100% Unbeatable Minimax AI + 3-Tier Auto Perf Guard
   ========================================================================== */

(function () {
  "use strict";

  const DATA = window.HW06_DATA;
  const AUDIO = window.HW06_AUDIO;
  const AI_MOD = window.HW06_AI;
  const VFX_MOD = window.HW06_VFX;

  const { HUMAN, AI, EMPTY, PALACE_NAMES, WIN_LINES, winningLines, SafeStorage } = AI_MOD;

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  const ELEMENT_STYLES = {
    suzaku: { primary: "#d63826", accent: "#ffe08a" },
    byakko: { primary: "#d98a1e", accent: "#fff6d6" },
    seiryu: { primary: "#1d82b8", accent: "#b8ecff" },
    genbu: { primary: "#8f651e", accent: "#ffe89e" }
  };

  const HERO_RIG_ACTIONS = [
    "attack_1",
    "attack_2",
    "attack_3",
    "attack_4",
    "attack_ultimate"
  ];

  const BOSS_RIG_ACTIONS = ["attack_1", "attack_2", "attack_3", "attack_4"];

  /* --------------------------------------------------------------------------
     DOM References
     -------------------------------------------------------------------------- */
  const el = {
    titleGate: document.getElementById("title-gate"),
    shell: document.querySelector(".app-shell"),
    btnStartStory: document.getElementById("btn-start-story"),

    btnReplayOpening: document.getElementById("btn-replay-opening"),
    btnOpenRules: document.getElementById("btn-open-rules"),
    rulesModal: document.getElementById("rules-modal"),
    btnCloseRules: document.getElementById("btn-close-rules"),

    // Audio, Voice & Auto-Performance Guard Bar
    btnBgmToggle: document.getElementById("btn-bgm-toggle"),
    bgmToggleLabel: document.getElementById("bgm-toggle-label"),
    eqBars: Array.from(document.querySelectorAll("#bgm-eq-bars .eq-bar")),
    bgmTrackSelect: document.getElementById("bgm-track-select"),
    bgmVolume: document.getElementById("bgm-volume"),
    btnSfxToggle: document.getElementById("btn-sfx-toggle"),
    sfxToggleLabel: document.getElementById("sfx-toggle-label"),
    btnVoiceToggle: document.getElementById("btn-voice-toggle"),
    voiceToggleLabel: document.getElementById("voice-toggle-label"),
    btnHintToggle: document.getElementById("btn-hint-toggle"),
    btnPerfMode: document.getElementById("btn-perf-mode"),
    perfLabel: document.getElementById("perf-label"),

    // Left & Right Animated Fighter Wings
    heroCard: document.getElementById("hero-fighter-card"),
    heroRigCanvas: document.getElementById("hero-rig-canvas"),
    heroSpellItems: Array.from(document.querySelectorAll("[data-hero-slot]")),
    elemBtns: Array.from(document.querySelectorAll("[data-elem]")),

    bossCard: document.getElementById("boss-fighter-card"),
    bossRigCanvas: document.getElementById("boss-rig-canvas"),
    bossSpellItems: Array.from(document.querySelectorAll("[data-boss-slot]")),

    banterSpeaker: document.getElementById("banter-speaker-name"),
    banterMood: document.getElementById("banter-mood-tag"),
    banterText: document.getElementById("banter-line-text"),

    humanScore: document.getElementById("human-vein-score"),
    aiScore: document.getElementById("ai-vein-score"),
    firstVeinBadge: document.getElementById("first-vein-badge"),
    moveProgressText: document.getElementById("move-progress-text"),
    sealBeads: Array.from(document.querySelectorAll("#seal-beads .seal-step-bead")),

    statHumanWins: document.getElementById("stat-human-wins"),
    statDraws: document.getElementById("stat-draws"),
    statAiWins: document.getElementById("stat-ai-wins"),

    // Center 3x3 Shrine Board
    spellTechRibbon: document.getElementById("spell-tech-ribbon"),
    turnBanner: document.getElementById("turn-banner"),
    turnStatusText: document.getElementById("turn-status-text"),
    aiTelemetry: document.getElementById("ai-telemetry"),
    boardFrame: document.getElementById("board-scroll-frame"),
    washiBoard: document.getElementById("washi-board"),
    cells: Array.from(document.querySelectorAll(".palace-cell")),
    svgVeins: document.getElementById("svg-veins-group"),
    svgSlashes: document.getElementById("svg-slashes-group"),
    svgTransient: document.getElementById("svg-transient-group"),
    calloutLayer: document.getElementById("callout-layer"),
    cinematicDim: document.getElementById("cinematic-dim"),

    finaleBanner: document.getElementById("finale-banner"),
    finaleTitle: document.getElementById("finale-title"),
    finaleDetail: document.getElementById("finale-detail"),

    btnRestart: document.getElementById("btn-restart"),
    btnResetStats: document.getElementById("btn-reset-stats"),

    // Self-Playing Widescreen 2D Anime Cinema Cutscene Elements
    cinemaOverlay: document.getElementById("cinema-overlay"),
    cinemaCanvas: document.getElementById("cinema-canvas"),
    cinemaTitleBadge: document.getElementById("cinema-title-badge"),
    cinemaSpeaker: document.getElementById("cinema-speaker"),
    cinemaSubtitle: document.getElementById("cinema-subtitle"),
    cinemaProgressFill: document.getElementById("cinema-progress-fill"),

    fxCanvas: document.getElementById("fx-canvas"),
    spellCanvas: document.getElementById("spell-canvas")
  };

  /* --------------------------------------------------------------------------
     Sub-Engines & Single-Stage State
     -------------------------------------------------------------------------- */
  const aiEngine = new AI_MOD.UnbeatableOnmyoAI();
  const bossMeta = DATA.CHARACTERS.tamamo;

  const vfx = new VFX_MOD.AnimeVfxStage(el.fxCanvas, (tier, pref) => {
    const names = {
      high: "極致動畫",
      medium: "流暢簡化",
      compat: "無GPU相容"
    };
    const prefix = pref === "auto" ? "自動護航" : "手動鎖定";
    el.perfLabel.textContent = `${prefix}：${names[tier]}`;

    if (window.HW06_RIGS && typeof window.HW06_RIGS.setPerformanceTier === "function") {
      window.HW06_RIGS.setPerformanceTier(tier);
    }
    if (window.HW06_SPELLS && typeof window.HW06_SPELLS.setPerformanceTier === "function") {
      window.HW06_SPELLS.setPerformanceTier(tier);
    }
    if (window.HW06_SHOTS) window.HW06_SHOTS.setPerformanceTier(tier);
    if (window.HW06_BOARD) window.HW06_BOARD.setPerformanceTier(tier);
    if (window.HW06_FLIGHT) window.HW06_FLIGHT.setPerformanceTier(tier);
    if (window.HW06_SPECTACLE) window.HW06_SPECTACLE.setPerformanceTier(tier);
    if (window.HW06_GRAND) window.HW06_GRAND.setPerformanceTier(tier);
    window.HW06_ARENA.setPerformanceTier(tier);
    if (window.HW06_CINEMA && typeof window.HW06_CINEMA.setPerformanceTier === "function") {
      window.HW06_CINEMA.setPerformanceTier(tier);
    }
  });

  const savedStats = SafeStorage.read("hw06_1142949_single_stats", {
    humanWins: 0,
    draws: 0,
    aiWins: 0
  });

  const state = {
    elementId: "suzaku",    // 'suzaku' | 'byakko' | 'seiryu' | 'genbu'
    board: new Int8Array(9),
    moveCount: 0,
    turn: HUMAN,
    aiBusy: false,
    spellInFlight: false,
    roundEnded: false,
    lastWinner: 0,
    firstVein: EMPTY,
    completedLines: [],
    starSplitUsed: false,
    showHints: false,
    timers: [],
    ribbonTimer: 0,
    roundToken: 0,
    boardAnimation: null,
    entering: false,
    humanLined: false,      // v10：玩家第一次成線 → 金龍繞盤
    aiLined: false,         // v10：電腦第一次成線 → 血月月蝕
    pendingLineFx: null,    // 第 9 手才成線時，留到終局演出
    grandUsed: new Set(),   // v12：本局已播過的奧義（保證每手都不同）
    eyeThisMove: false      // v14：這一手落子前是否已播過狐眼
  };
  const BOARD = window.HW06_BOARD || null;
  const FLIGHT = window.HW06_FLIGHT || null;
  const SPEC = window.HW06_SPECTACLE || null;
  const GRAND = window.HW06_GRAND || null;

  /** v10 十大奧義：依序排隊播放，回傳最後一招播完的 Promise */
  function playGrandList(list) {
    if (!GRAND || !list.length) return Promise.resolve();
    let last = Promise.resolve();
    list.forEach(([id, opts]) => {
      const pick = uniqueGrand(id);
      if (pick) last = GRAND.play(pick, opts || {});
    });
    return last;
  }

  /** v12：同一局每一招只播一次；狐眼／水墨封／天雷要重複時，改播還沒出現過的替補奧義 */
  function uniqueGrand(id) {
    const used = state.grandUsed;
    if (id !== "__pool" && !used.has(id)) { used.add(id); return id; }
    const next = (GRAND.REPLACEMENTS || []).find((x) => !used.has(x));
    if (next) used.add(next);
    return next || null;
  }

  function addTimer(fn, delay) {
    const id = window.setTimeout(fn, delay);
    state.timers.push(id);
    return id;
  }

  function clearGameTimers() {
    while (state.timers.length) {
      window.clearTimeout(state.timers.pop());
    }
  }

  function renderStats() {
    el.statHumanWins.textContent = String(savedStats.humanWins);
    el.statDraws.textContent = String(savedStats.draws);
    el.statAiWins.textContent = String(savedStats.aiWins);
  }

  function launchAnimeCutscene(cutsceneId, onDone) {
    if (window.HW06_CINEMA && typeof window.HW06_CINEMA.playCutscene === "function") {
      window.HW06_CINEMA.playCutscene(cutsceneId, () => {
        AUDIO.requestAutoTrack("shrine_duel");
        if (onDone) onDone();
      });
    } else if (onDone) {
      onDone();
    }
  }

  function showTechniqueRibbon(techTitle, isBoss) {
    if (!el.spellTechRibbon) return;
    window.clearTimeout(state.ribbonTimer);
    el.spellTechRibbon.textContent = techTitle;
    el.spellTechRibbon.classList.toggle("boss-tech", Boolean(isBoss));
    el.spellTechRibbon.classList.add("visible");
    state.ribbonTimer = window.setTimeout(() => {
      el.spellTechRibbon.classList.remove("visible");
    }, 1200);
  }

  function updateSpellProgressionLadders() {
    const heroMovesDone = Math.ceil(state.moveCount / 2);
    const bossMovesDone = Math.floor(state.moveCount / 2);

    el.heroSpellItems.forEach((item, idx) => {
      item.classList.toggle("cast-done", idx < heroMovesDone);
      item.classList.toggle("next-up", !state.roundEnded && idx === heroMovesDone);
    });

    el.bossSpellItems.forEach((item, idx) => {
      item.classList.toggle("cast-done", idx < bossMovesDone);
      item.classList.toggle("next-up", !state.roundEnded && idx === bossMovesDone);
    });
  }

  function playKeyShot(kind, who, title, sub) {
    if (window.HW06_SHOTS && typeof window.HW06_SHOTS.play === "function") {
      return window.HW06_SHOTS.play(kind, who, { title, sub });
    }
    vfx.triggerCutIn(who === "ren" ? DATA.CHARACTERS.ren.portrait : bossMeta.portrait, sub || "", title || "", who !== "ren");
    return Promise.resolve();
  }

  function setBanterAndSpeak(charId, speakerLabel, moodTag, lineText, speakVoice) {
    el.banterSpeaker.textContent = speakerLabel;
    el.banterMood.textContent = moodTag;
    el.banterText.textContent = lineText;

    if (speakVoice && !window.HW06_CINEMA?.isPlaying() && window.HW06_VOICE) {
      return window.HW06_VOICE.speakLine(charId, lineText, moodTag, { interrupt: false, priority: true });
    }
    return Promise.resolve();
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SHOW = window.HW06_CHOREOGRAPHY;
  const ARENA = window.HW06_ARENA;

  function updateBoardInput() {
    el.shell.inert = Boolean(window.HW06_CINEMA?.isPlaying() || !el.titleGate.classList.contains("hidden"));
    const locked = el.shell.inert || state.roundEnded || state.entering || state.spellInFlight || state.turn !== HUMAN ||
      Boolean(GRAND && GRAND.isBusy());
    el.washiBoard.classList.toggle("board-locked", Boolean(locked));
    el.cells.forEach((cell, i) => {
      cell.setAttribute("aria-disabled", String(Boolean(locked || state.board[i] !== EMPTY)));
    });
  }

  function revealBoard() {
    const token = state.roundToken;
    state.entering = true;
    updateBoardInput();
    // N1 千本鳥居穿越：最後一座鳥居落定成棋盤外框，接著棋盤升起
    if (GRAND) {
      GRAND.play("torii").then(() => { if (token === state.roundToken) revealBoardAfterTorii(token); });
      return;
    }
    revealBoardAfterTorii(token);
  }

  function revealBoardAfterTorii(token) {
    state.boardAnimation?.cancel();
    const poses = reducedMotion.matches
      ? [{ opacity: 0.5 }, { opacity: 1 }]
      : [
          { transform: "perspective(700px) rotateX(68deg) rotateZ(-42deg) scale(.73)", opacity: .3 },
          { transform: "perspective(700px) rotateX(-9deg) rotateZ(9deg) scale(1.05)", opacity: 1, offset: .72 },
          { transform: "none", opacity: 1 }
        ];
    state.boardAnimation = el.boardFrame.animate(poses, {
      duration: reducedMotion.matches ? 180 : 820, easing: "cubic-bezier(.2,.78,.21,1)"
    });
    ARENA.play("gate");
    Promise.all([state.boardAnimation.finished.catch(() => {}), SHOW.assemble()]).then(() => {
      if (token !== state.roundToken) return;
      state.entering = false;
      updateBoardInput();
      if (document.activeElement === document.body) el.cells[0].focus({ preventScroll: true });
    });
  }

  /* v13 勝負畫面：brief=true 時只顯示 3 秒（劇情動畫前），false 時常駐並提供按鈕 */
  function showResultScreen(r, brief) {
    const scr = document.getElementById("result-screen");
    if (!scr) return;
    const $ = (id) => document.getElementById(id);
    scr.classList.remove("win", "lose", "draw");
    scr.classList.add(r.winner === AI ? "lose" : r.winner === HUMAN ? "win" : "draw");
    scr.classList.toggle("brief", Boolean(brief));
    $("result-kicker").textContent = brief ? "勝負揭曉" : `第 ${r.round} 回合 · 對局結果`;
    $("result-stamp").textContent = r.winner === AI ? "敗" : r.winner === HUMAN ? "勝" : "和";
    $("result-verdict").textContent = r.winner === AI ? "玉藻前 獲勝" : r.winner === HUMAN ? "你 獲勝！" : "和局";
    $("result-you").textContent = r.winner === AI ? "你輸了這一局" : r.winner === HUMAN ? "你贏了這一局！" : "雙方平手，沒有人輸";
    $("result-ren-lines").textContent = `${r.human} 條連線`;
    $("result-tamamo-lines").textContent = `${r.ai} 條連線`;
    const side = (id, me) => {
      const n = $(id); n.classList.remove("winner", "loser", "even");
      n.classList.add(r.winner === 0 ? "even" : r.winner === me ? "winner" : "loser");
      n.querySelector(".rs-tag").textContent = r.winner === 0 ? "和" : r.winner === me ? "勝" : "敗";
    };
    side("result-side-ren", HUMAN); side("result-side-tamamo", AI);
    const who = r.winner === AI ? "玉藻前" : "你";
    $("result-reason").textContent = r.winner === 0
      ? "九格全部下滿，雙方都沒有連成三子一線，這局平手。"
      : r.human === r.ai
        ? `雙方都是 ${r.ai} 條連線，線數相同時看誰先連成線——${who}先連成，所以${who}獲勝。`
        : `${who}的連線比較多（${Math.max(r.human, r.ai)} 比 ${Math.min(r.human, r.ai)}），所以${who}獲勝。`;
    $("result-record").textContent = `目前戰績：你 ${savedStats.humanWins} 勝 · 和局 ${savedStats.draws} · 玉藻前 ${savedStats.aiWins} 勝`;
    scr.hidden = false;
    if (!brief) window.setTimeout(() => $("result-rematch").focus(), 400);
  }

  function hideResultScreen() {
    const scr = document.getElementById("result-screen");
    if (scr) scr.hidden = true;
  }

  function returnToTitle() {
    el.titleGate.classList.remove("hidden");
    startNewBattleRound();
    el.btnStartStory.focus();
  }

  function startNewBattleRound() {
    clearGameTimers();
    hideResultScreen();
    state.boardAnimation?.cancel();
    state.entering = false;
    document.body.classList.remove("ninth-hush");
    AUDIO.setDecisionFocus(false);
    SHOW.reset();
    ARENA.reset();
    GRAND?.reset();
    if (!window.HW06_CINEMA?.isPlaying()) window.HW06_VOICE?.stopAll();
    if (window.HW06_SPELLS && typeof window.HW06_SPELLS.clearAll === "function") {
      window.HW06_SPELLS.clearAll();
    }

    state.board.fill(EMPTY);
    state.moveCount = 0;
    state.turn = HUMAN;
    state.aiBusy = false;
    state.spellInFlight = false;
    state.roundEnded = false;
    state.lastWinner = EMPTY;
    state.firstVein = EMPTY;
    state.completedLines = [];
    state.starSplitUsed = false;
    state.humanLined = false;
    state.aiLined = false;
    state.pendingLineFx = null;
    state.grandUsed = new Set(["torii"]);
    state.eyeThisMove = false;
    state.roundToken++;
    delete el.svgSlashes.dataset.winner;
    if (BOARD) BOARD.reset();
    if (FLIGHT) FLIGHT.clear();
    if (SPEC) SPEC.reset();


    const cinemaActive =
      window.HW06_CINEMA &&
      typeof window.HW06_CINEMA.isPlaying === "function" &&
      window.HW06_CINEMA.isPlaying();
    if (!cinemaActive) {
      AUDIO.requestAutoTrack("shrine_duel");
    }

    el.svgVeins.replaceChildren();
    delete el.svgVeins.dataset.owner;
    el.svgSlashes.innerHTML = "";
    el.svgTransient.innerHTML = "";
    el.calloutLayer.innerHTML = "";
    el.cinematicDim.classList.remove("active");
    el.boardFrame.classList.remove("blood-moon-climax", "board-shatter");
    el.finaleBanner.classList.remove("visible", "boss-victory", "epilogue-done");
    el.btnRestart.disabled = false;
    el.btnReplayOpening.disabled = false;
    el.turnBanner.classList.remove("vein-locked-alert");
    el.spellTechRibbon.classList.remove("visible");

    el.humanScore.textContent = "0";
    el.aiScore.textContent = "0";
    el.moveProgressText.textContent = "0 / 9 印";
    el.firstVeinBadge.className = "first-vein-pill";
    el.firstVeinBadge.textContent = "九印落滿才結算";
    el.aiTelemetry.textContent = "Minimax · 電腦後手";

    el.sealBeads.forEach((b) => b.classList.remove("human", "ai"));
    el.heroCard.classList.add("active-turn");
    el.bossCard.classList.remove("active-turn");

    el.cells.forEach((cell, idx) => {
      cell.setAttribute("aria-label", PALACE_NAMES[idx] + "，空格");
      cell.classList.remove(
        "occupied",
        "in-vein",
        "bonus-vein-cell",
        "threat-human",
        "threat-ai",
        "threat-both"
      );
      cell.querySelector(".piece-mount").innerHTML = "";
      cell.querySelector(".move-order-badge").textContent = "";
      cell.querySelector(".hint-overlay").textContent = "";
    });

    el.turnStatusText.textContent = "🔴 請落第 1 印";
    setBanterAndSpeak("tamamo", "九尾妖狐・玉藻前", "【從容等待】", "「先下你的第一印吧，陰陽師。」", false);
    updateSpellProgressionLadders();
    refreshBoardThreatAndHints();
    updateBoardInput();
    if (!el.titleGate.classList.contains("hidden") || cinemaActive) return;
    revealBoard();
  }

  function refreshBoardThreatAndHints() {
    const hThreats = aiEngine.findImmediateThreats(state.board, HUMAN);
    const aThreats = aiEngine.findImmediateThreats(state.board, AI);
    const hints =
      state.showHints && !state.spellInFlight && state.turn === HUMAN && !state.roundEnded
        ? aiEngine.evaluateHumanOptions(state.board, state.firstVein)
        : null;

    for (let i = 0; i < 9; i++) {
      const cell = el.cells[i];
      cell.classList.remove("threat-human", "threat-ai", "threat-both");

      if (state.showHints && state.board[i] === EMPTY && !state.roundEnded) {
        const hT = hThreats.has(i);
        const aT = aThreats.has(i);
        if (hT && aT) cell.classList.add("threat-both");
        else if (hT) cell.classList.add("threat-human");
        else if (aT) cell.classList.add("threat-ai");
      }

      const hintEl = cell.querySelector(".hint-overlay");
      if (hints && hints[i]) {
        hintEl.classList.remove("hint-draw", "hint-lose");
        if (hints[i].val <= 0) {
          hintEl.classList.add("hint-draw");
          hintEl.textContent = "可守和局";
        } else {
          hintEl.classList.add("hint-lose");
          hintEl.textContent = "會輸";
        }
      } else {
        hintEl.textContent = "";
      }
    }
  }

  function executeSealDrop(cellIdx, mover, isCounter) {
    if (state.roundEnded || state.spellInFlight || state.turn !== mover || state.board[cellIdx] !== EMPTY) return;
    const upcomingMoveNum = state.moveCount + 1;
    const dropToken = state.roundToken;
    const moveInfo = BOARD.classify(state.board, cellIdx, mover);
    const isCorner = cellIdx % 2 === 0 && cellIdx !== 4;
    const splitStar = mover === HUMAN && isCorner && !state.starSplitUsed;
    if (splitStar) state.starSplitUsed = true;
    if (BOARD) BOARD.setHover(null);

    state.board[cellIdx] = mover;
    state.moveCount = upcomingMoveNum;
    state.spellInFlight = true;
    const newlyCompleted = winningLines(state.board, mover)
      .filter((lineIndex) => WIN_LINES[lineIndex].includes(cellIdx));
    const firstLine = state.firstVein === EMPTY ? newlyCompleted[0] : undefined;
    if (firstLine !== undefined) state.firstVein = mover;
    newlyCompleted.forEach((lineIndex) => state.completedLines.push({ lineIndex, owner: mover }));
    // v10：雙方「第一次」成線各有專屬奧義（玩家＝天照日輪，電腦＝血月月蝕）
    let lineFx = null;
    if (newlyCompleted.length) {
      const line = WIN_LINES[newlyCompleted[0]];
      if (mover === HUMAN && !state.humanLined) { state.humanLined = true; lineFx = ["sun", { line, index: cellIdx }]; }
      if (mover === AI && !state.aiLined) { state.aiLined = true; lineFx = ["moon", { line, index: cellIdx }]; }
    }

    const decided = upcomingMoveNum === 9;
    const callTalisman = mover === HUMAN && !decided &&
      (upcomingMoveNum === 1 || upcomingMoveNum === 5 || moveInfo.blocked);
    if (decided) {
      BOARD?.endRound();
      SPEC?.endRound();
      el.btnRestart.disabled = true;
      el.btnReplayOpening.disabled = true;
    }
    refreshBoardThreatAndHints();
    updateBoardInput();

    const cell = el.cells[cellIdx];
    cell.setAttribute("aria-label", PALACE_NAMES[cellIdx] + (mover === HUMAN ? "，玩家御守" : "，電腦狐印"));

    // Gaze tracking toward targeted cell
    const colNorm = ((cellIdx % 3) - 1) * 0.75;
    const rowNorm = (Math.floor(cellIdx / 3) - 1) * 0.75;
    if (window.HW06_RIGS && typeof window.HW06_RIGS.setLookTarget === "function") {
      window.HW06_RIGS.setLookTarget(colNorm, rowNorm);
    }

    const slotIndex =
      mover === HUMAN
        ? Math.min(4, Math.floor((upcomingMoveNum - 1) / 2))
        : Math.min(3, Math.floor((upcomingMoveNum - 2) / 2));

    // 1. Character Voice Chant + Articulated Attack Pose!
    if (!window.HW06_CINEMA?.isPlaying() && window.HW06_VOICE) {
      window.HW06_VOICE.speakMoveChant(mover === HUMAN ? "ren" : "tamamo", slotIndex, isCounter || moveInfo.blocked);
    }

    const isKeyMove = decided || isCounter;
    if (decided) {
      el.turnStatusText.textContent = "最後一印正在落下…";
      SHOW.setThinking(false);
    }
    const launchCast = () => {
      let originPt = null;
      if (window.HW06_RIGS && typeof window.HW06_RIGS.triggerCharacterAction === "function") {
        const rigAct =
          mover === HUMAN
            ? HERO_RIG_ACTIONS[slotIndex] || "attack_1"
            : isCounter
            ? "counter_strike"
            : BOSS_RIG_ACTIONS[slotIndex] || "attack_1";
        originPt = window.HW06_RIGS.triggerCharacterAction(
          mover === HUMAN ? "ren" : "tamamo",
          rigAct,
          740
        );
      }

      const srcCard = mover === HUMAN ? el.heroCard : el.bossCard;
      const srcRect = srcCard.getBoundingClientRect();
      const fromX = originPt && originPt.handScreenX ? originPt.handScreenX : srcRect.left + srcRect.width * 0.5;
      const fromY = originPt && originPt.handScreenY ? originPt.handScreenY : srcRect.top + srcRect.height * 0.48;

      const dstRect = cell.getBoundingClientRect();
      const toX = dstRect.left + dstRect.width * 0.5;
      const toY = dstRect.top + dstRect.height * 0.5;

      // 2. Impact Handler when Projectile Reaches the Palace Cell
      const finalizeImpact = () => {
        if (dropToken !== state.roundToken) return;
        state.spellInFlight = decided;

        if (window.HW06_RIGS && typeof window.HW06_RIGS.triggerCharacterAction === "function") {
          window.HW06_RIGS.triggerCharacterAction(
            mover === HUMAN ? "tamamo" : "ren",
            "hit_recoil",
            360
          );
        }

        cell.classList.add("occupied");
        const elemColors = ELEMENT_STYLES[state.elementId] || ELEMENT_STYLES.suzaku;
        cell.querySelector(".ink-splat-bg").style.color =
          mover === HUMAN ? elemColors.primary : bossMeta.themeColor;

        const sealHref = mover === HUMAN ? "#seal-ren" : "#seal-tamamo";
        cell.querySelector(".piece-mount").innerHTML =
          `<svg class="piece-token slam-enter" viewBox="0 0 100 100" aria-hidden="true"><use href="${sealHref}"></use></svg>`;
        cell.querySelector(".move-order-badge").textContent = `#${upcomingMoveNum}`;

        const bead = el.sealBeads[upcomingMoveNum - 1];
        if (bead) {
          bead.classList.add(mover === HUMAN ? "human" : "ai");
        }
        el.moveProgressText.textContent = `${upcomingMoveNum} / 9 印`;

        // Blood-Moon Midgame Escalation at Move >= 5!
        if (upcomingMoveNum >= 5) {
          el.boardFrame.classList.add("blood-moon-climax");
          AUDIO.requestAutoTrack("yokai_storm");
        }

        if (isCounter && !decided) {
          AUDIO.playCounterThunder();
          AUDIO.playCutInSfx();
          vfx.spawnLightningStrike(el.svgTransient, cellIdx, bossMeta.themeColor);
          vfx.spawnCalloutText(
            el.calloutLayer,
            cellIdx,
            pickRandom(bossMeta.counterCallouts),
            "counter-stamp"
          );
        }

        AUDIO.playPlaceSlam(mover === HUMAN, "tamamo", cellIdx);
        const FORCE = { normal: 0.75, fork: 1.0, block: 1.25, score: 1.6, double: 1.9 };
        if (!decided) vfx.shakeBoardFrame(el.boardFrame, cellIdx, FORCE[moveInfo.kind] || 1);
        if (BOARD) BOARD.onLanded(cellIdx, mover, moveInfo, upcomingMoveNum);
        vfx.spawnShockwaves(el.svgTransient, cellIdx, mover === HUMAN, bossMeta.themeColor, isCounter);
        vfx.burstSealSlam(toX, toY, mover === HUMAN, "tamamo", isCounter || upcomingMoveNum >= 7);

        const h = aiEngine.scorePlayerLines(state.board, HUMAN);
        const a = aiEngine.scorePlayerLines(state.board, AI);
        el.humanScore.textContent = String(h);
        el.aiScore.textContent = String(a);
        if (firstLine !== undefined && !decided) {
          el.svgVeins.dataset.owner = mover === HUMAN ? "human" : "ai";
          vfx.drawDuelLine(el.svgVeins, firstLine, mover === HUMAN);
          BOARD?.awakenLine(WIN_LINES[firstLine]);
          ARENA.play("alignment", { index: cellIdx, human: mover === HUMAN });
        }
        if (newlyCompleted.length && !decided) {
          const firstName = state.firstVein === HUMAN ? "神樂坂 蓮" : "玉藻前";
          el.firstVeinBadge.textContent = `先成線：${firstName} · 繼續落子`;
        }
        if (SPEC) SPEC.onLanded(cellIdx, mover, moveInfo, upcomingMoveNum, isCounter && !decided, { h, a });
        const human = mover === HUMAN;
        if (!decided && firstLine === undefined) {
          ARENA.play(human ? "stellar" : "fox", { index: cellIdx, human });
        }
        if (callTalisman) ARENA.play("blessing", { index: cellIdx, human });
        if (isCounter && !decided) ARENA.play("fracture", { index: cellIdx, human });
        if (upcomingMoveNum === 7) {
          const slots = Array.from(state.board.keys()).filter((i) => state.board[i] === EMPTY);
          ARENA.play("endgame", { index: cellIdx, slots });
        }
        const settleBoard = SHOW.onLanded(cellIdx, mover, moveInfo, state.board, { decided, callTalisman });
        updateSpellProgressionLadders();

        // v10 十大奧義：等這一手的舊特效落定後，依「封路 → 首次成線 → 手數」順序排隊播放
        const grandList = [];
        if (!decided) {
          if (mover === HUMAN && moveInfo.blocked) grandList.push(["thunder", { index: cellIdx }]);
          if (mover === AI && (isCounter || moveInfo.blocked)) grandList.push(["ink", { index: cellIdx }]);
          if (lineFx) grandList.push(lineFx);
          if (upcomingMoveNum === 1) grandList.push(["pentagram", { index: cellIdx }]);
          if (upcomingMoveNum === 2) grandList.push(["ninetails", { index: cellIdx }]);
          if (upcomingMoveNum === 3) grandList.push(["flip", { index: cellIdx }]);
          if (upcomingMoveNum === 4) grandList.push(["raiko", { index: cellIdx }]);
          if (upcomingMoveNum === 6) grandList.push(["lotus", { index: cellIdx }]);
          if (upcomingMoveNum === 5) grandList.push(["spin", { index: cellIdx }]);
          if (upcomingMoveNum === 7) grandList.push(["orochi", { index: cellIdx }]);
          if (upcomingMoveNum === 8) grandList.push(["foxfire", { index: cellIdx }]);
          // v14：每一手至少兩招大型奧義（電腦落子前的狐眼也算這一手）；不足就從替補池補上
          const have = grandList.length + (mover === AI && state.eyeThisMove ? 1 : 0);
          for (let k = have; k < 2; k++) grandList.push(["__pool", { index: cellIdx }]);
        } else if (lineFx) {
          state.pendingLineFx = lineFx;
        }
        state.eyeThisMove = false;
        const afterGrand = settleBoard.then(() => (dropToken === state.roundToken ? playGrandList(grandList) : null));

        if (decided) {
          settleBoard.then(() => SHOW.leaveLastShot()).then(() => {
            if (dropToken === state.roundToken) concludeRound(cellIdx);
          });
          return;
        }

        state.turn = -mover;
        state.aiBusy = state.turn === AI;
        el.heroCard.classList.toggle("active-turn", !state.aiBusy);
        el.bossCard.classList.toggle("active-turn", state.aiBusy);
        el.turnStatusText.textContent = state.aiBusy
          ? "🦊 玉藻前正在推演下一手…"
          : `🔴 輪到你落第 ${state.moveCount + 1} 印`;
        if (mover === AI && isCounter) {
          setBanterAndSpeak("tamamo", "九尾妖狐・玉藻前", "【封路】", "「這條路，妾身先堵住了。」", false);
        }
        state.entering = !state.aiBusy;
        refreshBoardThreatAndHints();
        updateBoardInput();
        if (state.entering) afterGrand.then(() => {
          if (dropToken !== state.roundToken) return;
          state.entering = false;
          updateBoardInput();
        });

        if (state.aiBusy) {
          SHOW.setThinking(true);
          afterGrand.then(() => {
            if (dropToken !== state.roundToken) return;
            // v16：奧義播完時符紙早已落定，不再額外等 1.3 秒，直接換電腦出手
            addTimer(performBossTurn, 120);
          });
        }
      };

      if (window.HW06_SPELLS && typeof window.HW06_SPELLS.castMoveTechnique === "function") {
        const info = window.HW06_SPELLS.getTechniqueInfo(mover === HUMAN, "tamamo", upcomingMoveNum);
        if (info && info.name) {
          showTechniqueRibbon(`第 ${upcomingMoveNum} 印 · ${info.name}`, mover === AI);
        }
        let impactFired = false;
        // The flying star and fox arrive before the existing impact particles.
        if (SPEC && mover === AI) SPEC.tailSweep(cellIdx);
        const flight = FLIGHT
          ? FLIGHT.fly({
              who: mover === HUMAN ? "ren" : "tamamo",
              fromX, fromY, toX, toY,
              cellW: el.washiBoard.clientWidth / 3, cellIdx,
              split: splitStar, decisive: decided
            })
          : Promise.resolve();
        flight.then(() => {
          if (dropToken !== state.roundToken) return;
          window.HW06_SPELLS.castMoveTechnique({
            isHuman: mover === HUMAN,
            bossId: "tamamo",
            moveNumber: upcomingMoveNum,
            cellIndex: cellIdx,
            fromX: FLIGHT ? toX : fromX,
            fromY: FLIGHT ? toY - dstRect.height * 0.35 : fromY,
            toX,
            toY,
            isCounter,
            shikigamiId: state.elementId,
            onImpact: () => {
              if (impactFired) return;
              impactFired = true;
              finalizeImpact();
            }
          });
          addTimer(() => {
            if (!impactFired) {
              impactFired = true;
              finalizeImpact();
            }
          }, 280);
        });
      } else {
        finalizeImpact();
      }
    };

    if (isKeyMove && !reducedMotion.matches) {
      const who = mover === HUMAN ? "ren" : "tamamo";
      if (decided) {
        AUDIO.setDecisionFocus(true);
        ARENA.play("gravity", { index: cellIdx });
        BOARD?.finalFocus(cellIdx, 430);
      }
      playKeyShot(decided ? "final" : "counter", who,
        decided ? "滿盤結算・最後一印" : bossMeta.cutinCounterTitle,
        decided ? "DECISIVE SEAL" : "KITSUNE COUNTER ART"
      ).then(() => {
        if (dropToken !== state.roundToken) return;
        return decided ? SHOW.enterLastShot() : undefined;
      }).then(() => { if (dropToken === state.roundToken) launchCast(); });
    } else {
      launchCast();
    }
  }

  function performBossTurn() {
    if (state.roundEnded || state.turn !== AI || state.moveCount >= 9) return;
    SHOW.setThinking(false);
    const decision = aiEngine.chooseBestMove(state.board, state.firstVein);

    el.aiTelemetry.textContent =
      decision.nodes > 0
        ? `推演 ${decision.nodes} 節點 · ${decision.elapsedMs.toFixed(1)}ms`
        : `快取命中 (${decision.totalStates} 態) · ${decision.elapsedMs.toFixed(1)}ms`;

    // N2 巨型狐眼凝視：電腦第一次落子前，以及每次要封住玩家成線點之前
    const eyeFx = GRAND && (state.moveCount === 1 || decision.isCounter) ? uniqueGrand("eye") : null;
    if (eyeFx) {
      state.eyeThisMove = true;
      const tok = state.roundToken;
      GRAND.play(eyeFx, { index: decision.move, counter: decision.isCounter }).then(() => {
        if (tok === state.roundToken && state.turn === AI && !state.roundEnded) {
          executeSealDrop(decision.move, AI, decision.isCounter);
        }
      });
      return;
    }
    executeSealDrop(decision.move, AI, decision.isCounter);
  }

  function concludeRound(lastCell) {
    const token = state.roundToken;
    const { winner, humanPoints, aiPoints } = aiEngine.getFullBoardResult(state.board, state.firstVein);
    const winnerLine = state.completedLines.find((line) => line.owner === winner);
    state.lastWinner = winner;
    state.spellInFlight = false;
    state.roundEnded = true;
    refreshBoardThreatAndHints();
    state.aiBusy = false;
    const winnerId = winner === AI ? "tamamo" : "ren";
    window.HW06_RIGS?.triggerCharacterAction(winnerId, winner ? "victory" : "seal_bow", 1250);
    if (winner === AI) window.HW06_RIGS?.triggerCharacterAction("ren", "hit_recoil", 750);
    el.heroCard.classList.remove("active-turn");
    el.bossCard.classList.remove("active-turn");
    updateBoardInput();
    AUDIO.setDecisionFocus(false);
    AUDIO.playFinaleFanfare(winner);
    if (winner) ARENA.play("crown", { index: lastCell, human: winner === HUMAN });
    SHOW.finish(winner, lastCell);
    el.svgVeins.replaceChildren();
    delete el.svgVeins.dataset.owner;
    let winnerAnimation = Promise.resolve();
    if (winnerLine) {
      const { lineIndex } = winnerLine;
      const line = WIN_LINES[lineIndex];
      el.svgSlashes.dataset.winner = winner === AI ? "ai" : "human";
      winnerAnimation = SHOW.liftWinner(line, el.svgSlashes, () => {
        vfx.drawFinaleGrandSlash(el.svgSlashes, el.svgTransient, lineIndex, winner === HUMAN, bossMeta.themeColor, WIN_LINES);
        el.cells.forEach((cell, i) => cell.classList.toggle("in-vein", line.includes(i)));
      });
    } else {
      delete el.svgSlashes.dataset.winner;
    }

    const score = `9 / 9 印落定 · 玩家 ${humanPoints}：${aiPoints} 電腦`;
    const tiebreak = humanPoints === aiPoints ? " · 線數相同，先連成線的一方勝" : "";
    let finaleVoice;
    if (winner === AI) {
      savedStats.aiWins++;
      el.finaleBanner.classList.add("boss-victory");
      el.finaleTitle.textContent = "挑戰失敗 · 玉藻前獲勝";
      el.finaleDetail.textContent = score + tiebreak;
      finaleVoice = setBanterAndSpeak("tamamo", "九尾妖狐・玉藻前", "【連線成功】", "蒼炎，連成一線。", true);
    } else if (winner === HUMAN) {
      savedStats.humanWins++;
      el.finaleTitle.textContent = "挑戰成功 · 蓮獲勝";
      el.finaleDetail.textContent = score + tiebreak;
      finaleVoice = setBanterAndSpeak("ren", "神樂坂 蓮", "【連線成功】", "靈脈，連成了！", true);
    } else {
      savedStats.draws++;
      el.finaleTitle.textContent = "和局 · 陰陽平衡";
      el.finaleDetail.textContent = score + " · 雙方皆未成線";
      finaleVoice = setBanterAndSpeak("tamamo", "九尾妖狐・玉藻前", "【心服口服】", "九宮下滿，陰陽平衡……你一步都沒算錯。好吧，伏見結界就照約定平息吧。", true);
    }
    el.turnStatusText.textContent = el.finaleTitle.textContent;
    el.firstVeinBadge.textContent = winner ? "勝負已定" : "九宮平衡";
    el.finaleBanner.classList.add("visible");
    SafeStorage.write("hw06_1142949_single_stats", savedStats);
    renderStats();

    const result = { winner, human: humanPoints, ai: aiPoints, round: savedStats.humanWins + savedStats.draws + savedStats.aiWins };
    Promise.all([winnerAnimation, finaleVoice]).then(() => {
      if (token !== state.roundToken) return;
      // N10 終局奧義：電腦勝 → 棋盤碎裂重組；和局 → 太極大漩渦（第 9 手才首次成線時先補播天照日輪／血月）
      const finaleList = [];
      if (state.pendingLineFx) finaleList.push(state.pendingLineFx);
      state.pendingLineFx = null;
      if (finaleList.length < 1) finaleList.push(["__pool", { index: lastCell }]);   // v14：最後一手也是兩招
      finaleList.push([winner === AI ? "shatter" : "taiji", {
        board: Array.from(state.board), winner,
        line: winnerLine ? WIN_LINES[winnerLine.lineIndex] : null
      }]);
      return playGrandList(finaleList);
    }).then(() => {
      if (token !== state.roundToken) return;
      // 先用大字勝負畫面清楚宣告結果，再播結局動畫
      showResultScreen(result, true);
      return new Promise((r) => addTimer(r, 3200));
    }).then(() => {
      if (token !== state.roundToken) return;
      hideResultScreen();
      addTimer(() => {
        launchAnimeCutscene(winner === AI ? "ch1_defeat" : "ch1_seal", () => {
          if (token !== state.roundToken) return;
          showResultScreen(result, false);
          el.finaleBanner.classList.add("epilogue-done");
          el.btnRestart.disabled = false;
          el.btnReplayOpening.disabled = false;
          updateBoardInput();
        });
        updateBoardInput();
      }, 380);
    });
  }

  /* --------------------------------------------------------------------------
     Initialize Sub-Engines & Bind Events
     -------------------------------------------------------------------------- */
  function initSubSystems() {
    if (window.HW06_RIGS && typeof window.HW06_RIGS.mountBattleStages === "function") {
      window.HW06_RIGS.mountBattleStages(el.heroRigCanvas, el.bossRigCanvas);
      window.HW06_RIGS.setBossCharacter("tamamo");
      window.HW06_RIGS.setPerformanceTier(vfx.activeTier);
    }

    ARENA.init(el.washiBoard, el.cells);
    ARENA.setPerformanceTier(vfx.activeTier);
    SHOW.init(el.boardFrame, el.washiBoard, el.cells);
    if (SPEC) {
      SPEC.init({ cells: el.cells, frameEl: el.boardFrame, heroCard: el.heroCard, bossCard: el.bossCard });
      SPEC.setPerformanceTier(vfx.activeTier);
    }
    if (FLIGHT) {
      FLIGHT.init({ cells: el.cells, frameEl: el.boardFrame });
      FLIGHT.setPerformanceTier(vfx.activeTier);
    }
    if (BOARD) {
      BOARD.init({ cells: el.cells, boardEl: el.washiBoard, frameEl: el.boardFrame });
      BOARD.setPerformanceTier(vfx.activeTier);
    }

    if (GRAND) {
      GRAND.init({ frame: el.boardFrame, board: el.washiBoard, cells: el.cells, heroCard: el.heroCard, bossCard: el.bossCard });
      GRAND.setPerformanceTier(vfx.activeTier);
      GRAND.onBusyChange(() => updateBoardInput());
    }

    if (window.HW06_SPELLS && typeof window.HW06_SPELLS.init === "function") {
      window.HW06_SPELLS.init(el.spellCanvas);
      window.HW06_SPELLS.setPerformanceTier(vfx.activeTier);
    }

    if (window.HW06_CINEMA && typeof window.HW06_CINEMA.init === "function") {
      window.HW06_CINEMA.init({
        overlayEl: el.cinemaOverlay,
        canvasEl: el.cinemaCanvas,
        speakerEl: el.cinemaSpeaker,
        subtitleEl: el.cinemaSubtitle,
        progressFillEl: el.cinemaProgressFill,
        titleBadgeEl: el.cinemaTitleBadge
      });
      window.HW06_CINEMA.setPerformanceTier(vfx.activeTier);
    }
  }

  function bindEvents() {
    el.btnStartStory.addEventListener("click", () => {
      AUDIO.ensureContext();
      AUDIO.startSequencer();
      if (window.HW06_VOICE) window.HW06_VOICE.unlock();
      el.titleGate.classList.add("hidden");
      launchAnimeCutscene("prologue_opening", revealBoard);
      updateBoardInput();
    });

    el.btnReplayOpening.addEventListener("click", () => {
      if (state.spellInFlight || state.aiBusy || state.entering || GRAND?.isBusy() || window.HW06_CINEMA?.isPlaying()) return;
      AUDIO.ensureContext();
      window.HW06_VOICE?.unlock();
      launchAnimeCutscene("prologue_opening", () => {
        if (state.moveCount === 0) revealBoard();
        else updateBoardInput();
      });
      updateBoardInput();
    });

    el.btnOpenRules.addEventListener("click", () => {
      el.rulesModal.classList.add("open");
    });

    el.btnCloseRules.addEventListener("click", () => {
      el.rulesModal.classList.remove("open");
    });

    // Audio & Voice Controls
    el.btnBgmToggle.addEventListener("click", () => {
      const on = AUDIO.toggleBgm();
      el.btnBgmToggle.setAttribute("aria-pressed", String(on));
      el.bgmToggleLabel.textContent = on ? "🎵 BGM 演奏中" : "🔇 BGM 靜音";
    });

    el.bgmTrackSelect.addEventListener("change", () => {
      AUDIO.setUserTrackSelection(el.bgmTrackSelect.value);
    });

    el.bgmVolume.addEventListener("input", () => {
      AUDIO.setVolume(Number(el.bgmVolume.value) / 100);
    });

    el.btnSfxToggle.addEventListener("click", () => {
      const on = AUDIO.toggleSfx();
      el.btnSfxToggle.setAttribute("aria-pressed", String(on));
      el.sfxToggleLabel.textContent = on ? "🔊 音效開啟" : "🔇 音效靜音";
    });

    el.btnVoiceToggle.addEventListener("click", () => {
      if (!window.HW06_VOICE) return;
      const nextOn =
        typeof window.HW06_VOICE.toggle === "function"
          ? window.HW06_VOICE.toggle()
          : (window.HW06_VOICE.setEnabled(!window.HW06_VOICE.isEnabled()),
             window.HW06_VOICE.isEnabled());
      el.btnVoiceToggle.setAttribute("aria-pressed", String(nextOn));
      el.voiceToggleLabel.textContent = nextOn ? "🎙️ 角色語音開啟" : "🔇 角色語音關閉";
    });

    el.btnHintToggle.addEventListener("click", () => {
      state.showHints = !state.showHints;
      el.btnHintToggle.setAttribute("aria-pressed", String(state.showHints));
      document.body.classList.toggle("show-hints", state.showHints);
      refreshBoardThreatAndHints();
    });

    el.btnPerfMode.addEventListener("click", () => {
      vfx.cycleQualityMode();
    });

    // Elemental Talisman Style Switcher
    el.elemBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        AUDIO.playUiClick();
        state.elementId = btn.dataset.elem || "suzaku";
        el.elemBtns.forEach((b) => b.classList.toggle("active", b === btn));
        const st = ELEMENT_STYLES[state.elementId] || ELEMENT_STYLES.suzaku;
        document.documentElement.style.setProperty("--ren-crimson", st.primary);
        document.documentElement.style.setProperty("--ren-gold-bright", st.accent);
        if (window.HW06_RIGS) {
          window.HW06_RIGS.triggerCharacterAction("ren", "chant", 550);
        }
      });
    });

    // 9 Shrine Palace Hover Gaze-Tracking & Clicks
    el.cells.forEach((cell, idx) => {
      const preview = () => {
        const canCast = cell.getAttribute("aria-disabled") === "false";
        BOARD?.setHover(idx, canCast);
        window.HW06_RIGS?.setLookTarget(((idx % 3) - 1) * .72, (Math.floor(idx / 3) - 1) * .72);
      };
      cell.addEventListener("pointerleave", () => BOARD?.setHover(null));
      cell.addEventListener("pointerenter", preview);
      cell.addEventListener("focus", preview);
      cell.addEventListener("blur", () => BOARD?.setHover(null));
      cell.addEventListener("click", () => {
        if (state.roundEnded || state.entering || state.aiBusy || state.spellInFlight || GRAND?.isBusy() ||
            state.turn !== HUMAN || window.HW06_CINEMA?.isPlaying() ||
            !el.titleGate.classList.contains("hidden")) return;
        if (state.board[idx] !== EMPTY) {
          SHOW.reject(idx);
          return;
        }
        executeSealDrop(idx, HUMAN, false);
      });
    });

    el.btnRestart.addEventListener("click", () => {
      if (window.HW06_CINEMA?.isPlaying()) return;
      AUDIO.playUiClick();
      startNewBattleRound();
    });
    document.getElementById("btn-end-rematch").addEventListener("click", () => el.btnRestart.click());
    document.getElementById("btn-end-exit").addEventListener("click", returnToTitle);
    document.getElementById("result-rematch").addEventListener("click", () => { hideResultScreen(); el.btnRestart.disabled = false; el.btnRestart.click(); });
    document.getElementById("result-view").addEventListener("click", hideResultScreen);
    document.getElementById("result-title").addEventListener("click", () => { hideResultScreen(); returnToTitle(); });

    el.btnResetStats.addEventListener("click", () => {
      savedStats.humanWins = 0;
      savedStats.draws = 0;
      savedStats.aiWins = 0;
      SafeStorage.write("hw06_1142949_single_stats", savedStats);
      renderStats();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        el.rulesModal.classList.remove("open");
      }
    });

    // Live BGM Spectrum + Voice Speaking Indicator Loop
    window.setInterval(() => {
      const levels = AUDIO.getEqualizerLevels();
      for (let i = 0; i < el.eqBars.length; i++) {
        el.eqBars[i].style.height = `${Math.round((levels[i] || 0.16) * 100)}%`;
      }

      if (window.HW06_VOICE && typeof window.HW06_VOICE.getLipSyncState === "function") {
        const heroLip = window.HW06_VOICE.getLipSyncState("ren");
        const bossLip = window.HW06_VOICE.getLipSyncState("tamamo");
        el.heroCard.classList.toggle("speaking-now", Boolean(heroLip && heroLip.speaking));
        el.bossCard.classList.toggle("speaking-now", Boolean(bossLip && bossLip.speaking));
      }
    }, 95);
  }

  /* --------------------------------------------------------------------------
     Diagnostic Hook for Automated Chrome GPU-ON & GPU-OFF Verification
     -------------------------------------------------------------------------- */
  window.__HW06_DIAGNOSTICS__ = {
    getState: () => ({
      moveCount: state.moveCount,
      winner: state.lastWinner,
      board: Array.from(state.board),
      roundEnded: state.roundEnded,
      firstVein: state.firstVein,
      turn: state.turn,
      aiBusy: state.aiBusy,
      spellInFlight: state.spellInFlight,
      activeTier: vfx.activeTier,
      measuredFps: vfx.measuredFps,
      bgmPlaying: AUDIO.isPlayingBgm,
      bgmTrack: AUDIO.currentTrackId,
      cinemaPlaying: Boolean(
        window.HW06_CINEMA &&
          typeof window.HW06_CINEMA.isPlaying === "function" &&
          window.HW06_CINEMA.isPlaying()
      ),
      hasVoiceEngine: Boolean(window.HW06_VOICE),
      hasRigEngine: Boolean(window.HW06_RIGS),
      hasSpellEngine: Boolean(window.HW06_SPELLS),
      stats: { ...savedStats },
      grandBusy: Boolean(GRAND && GRAND.isBusy()),
      grandHistory: GRAND ? GRAND.history.slice() : []
    }),
    forceCompatMode: () => vfx.applyTier("compat", false)
  };

  // Boot!
  initSubSystems();
  renderStats();
  bindEvents();
  startNewBattleRound();
})();
