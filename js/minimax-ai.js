/* ==========================================================================
   1142949 HW06 — 京都百鬼夜行：陰陽鎮魂錄
   File: js/minimax-ai.js
   100% Unbeatable 9-Move Full-Board Minimax Solver + Tactical Commentary
   + Step-by-Step Match Replay Recorder
   ========================================================================== */

(function () {
  "use strict";

  const HUMAN = 1; // 先手：神樂坂 蓮（5 印）
  const AI = -1;   // 後手：百鬼大妖（4 印，100% 不敗）
  const EMPTY = 0;

  const PALACE_NAMES = [
    "巽四宮（左上）",
    "離九宮（中上）",
    "坤二宮（右上）",
    "震三宮（左中）",
    "中宮五（正中）",
    "兌七宮（右中）",
    "艮八宮（左下）",
    "坎一宮（中下）",
    "乾六宮（右下）"
  ];

  const PALACE_SHORT = ["巽四", "離九", "坤二", "震三", "中宮", "兌七", "艮八", "坎一", "乾六"];

  const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  const LINE_NAMES = [
    "上段橫脈（巽四—離九—坤二）",
    "中段橫脈（震三—中宮—兌七）",
    "下段橫脈（艮八—坎一—乾六）",
    "左翼縱脈（巽四—震三—艮八）",
    "中軸縱脈（離九—中宮—坎一）",
    "右翼縱脈（坤二—兌七—乾六）",
    "乾巽斜脈（巽四—中宮—乾六）",
    "坤艮斜脈（坤二—中宮—艮八）"
  ];

  /* --------------------------------------------------------------------------
     Safe LocalStorage Wrapper
     -------------------------------------------------------------------------- */
  const SafeStorage = {
    read(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    write(key, val) {
      try {
        window.localStorage.setItem(key, JSON.stringify(val));
      } catch (_) {
        /* Ignore private-browsing quota restriction */
      }
    }
  };

  /* --------------------------------------------------------------------------
     UnbeatableOnmyoAI — Evaluates ONLY when all 9 pieces are placed (9/9)
     -------------------------------------------------------------------------- */
  function winningLines(board, player) {
    return WIN_LINES.flatMap((line, i) => line.every((cell) => board[cell] === player) ? [i] : []);
  }

  class UnbeatableOnmyoAI {
    constructor() {
      this.ruleMode = "standard"; // 'standard' | 'dragon' | 'twin_gale'
      this.bonusCells = [];       // [] | [dragonIdx] | [1,7] or [3,5]
      this.memoVal = new Map();
      this.memoTrap = new Map();
      this.lastNodes = 0;
      this.lastCacheHits = 0;
      this.lastElapsedMs = 0;
    }

    configureRule(ruleMode, bonusCells) {
      this.ruleMode = ruleMode || "standard";
      this.bonusCells = Array.isArray(bonusCells) ? bonusCells.slice() : [];
      this.memoVal.clear();
      this.memoTrap.clear();
    }

    encodeState(board, turn, firstVein) {
      let code = 0;
      for (let i = 0; i < 9; i++) {
        code = code * 3 + (board[i] + 1);
      }
      code = code * 3 + (firstVein + 1);
      code = code * 2 + (turn === HUMAN ? 1 : 0);
      return code;
    }

    linePointValue(lineIdx) {
      if (this.bonusCells.length === 0) return 1;
      const [a, b, c] = WIN_LINES[lineIdx];
      let pts = 1;
      for (let k = 0; k < this.bonusCells.length; k++) {
        const bc = this.bonusCells[k];
        if (bc === a || bc === b || bc === c) {
          pts += 1;
        }
      }
      return pts;
    }

    scorePlayerLines(board, player) {
      let pts = 0;
      for (let i = 0; i < 8; i++) {
        const [a, b, c] = WIN_LINES[i];
        if (board[a] === player && board[b] === player && board[c] === player) {
          pts += this.linePointValue(i);
        }
      }
      return pts;
    }

    getFullBoardResult(board, firstVein) {
      const humanPoints = this.scorePlayerLines(board, HUMAN);
      const aiPoints = this.scorePlayerLines(board, AI);
      const winner = humanPoints === aiPoints
        ? (humanPoints === 0 ? EMPTY : firstVein)
        : (humanPoints > aiPoints ? HUMAN : AI);
      return { winner, humanPoints, aiPoints };
    }

    findImmediateThreats(board, player) {
      const threats = new Set();
      for (let i = 0; i < 8; i++) {
        const [a, b, c] = WIN_LINES[i];
        const sum = board[a] + board[b] + board[c];
        if (sum === player * 2) {
          if (board[a] === EMPTY) threats.add(a);
          if (board[b] === EMPTY) threats.add(b);
          if (board[c] === EMPTY) threats.add(c);
        }
      }
      return threats;
    }

    solve(board, turn, firstVein, emptyCount) {
      const key = this.encodeState(board, turn, firstVein);
      if (this.memoVal.has(key)) {
        this.lastCacheHits++;
        return {
          val: this.memoVal.get(key),
          trap: this.memoTrap.get(key)
        };
      }

      this.lastNodes++;

      // Mandatory Full-Board Terminal Condition: Round ends ONLY when emptyCount === 0 (9/9)!
      if (emptyCount === 0) {
        const { winner, humanPoints: hPts, aiPoints: aPts } = this.getFullBoardResult(board, firstVein);
        let val = 0;
        let trap = 0;

        if (aPts > hPts) {
          val = 100 + (aPts - hPts) * 15 + (firstVein === AI ? 5 : 0);
          trap = 1.0;
        } else if (hPts > aPts) {
          val = -100 - (hPts - aPts) * 15;
          trap = -1.0;
        } else if (aPts > 0) {
          if (winner === AI) {
            val = 80;
            trap = 1.0;
          } else {
            val = -80;
            trap = -1.0;
          }
        } else {
          val = 0;
          trap = 0.0;
        }

        this.memoVal.set(key, val);
        this.memoTrap.set(key, trap);
        return { val, trap };
      }

      if (turn === AI) {
        let bestVal = -9999;
        let bestTrap = -9999;
        let sumTrap = 0;
        let cnt = 0;

        for (let i = 0; i < 9; i++) {
          if (board[i] !== EMPTY) continue;
          board[i] = AI;
          let nextFv = firstVein;
          if (nextFv === 0 && this.scorePlayerLines(board, AI) > 0) {
            nextFv = AI;
          }
          const child = this.solve(board, HUMAN, nextFv, emptyCount - 1);
          board[i] = EMPTY;

          sumTrap += child.trap;
          cnt++;
          if (child.val > bestVal || (child.val === bestVal && child.trap > bestTrap)) {
            bestVal = child.val;
            bestTrap = child.trap;
          }
        }

        const avgTrap = sumTrap / cnt;
        this.memoVal.set(key, bestVal);
        this.memoTrap.set(key, avgTrap);
        return { val: bestVal, trap: avgTrap };
      } else {
        let worstForAI = 9999;
        let sumTrap = 0;
        let cnt = 0;

        for (let i = 0; i < 9; i++) {
          if (board[i] !== EMPTY) continue;
          board[i] = HUMAN;
          let nextFv = firstVein;
          if (nextFv === 0 && this.scorePlayerLines(board, HUMAN) > 0) {
            nextFv = HUMAN;
          }
          const child = this.solve(board, AI, nextFv, emptyCount - 1);
          board[i] = EMPTY;

          sumTrap += child.trap;
          cnt++;
          if (child.val < worstForAI) {
            worstForAI = child.val;
          }
        }

        const avgTrap = sumTrap / cnt;
        this.memoVal.set(key, worstForAI);
        this.memoTrap.set(key, avgTrap);
        return { val: worstForAI, trap: avgTrap };
      }
    }

    chooseBestMove(board, firstVein) {
      const t0 = performance.now();
      this.lastNodes = 0;
      this.lastCacheHits = 0;

      const simBoard = Int8Array.from(board);
      let emptyCount = 0;
      for (let i = 0; i < 9; i++) {
        if (simBoard[i] === EMPTY) emptyCount++;
      }

      const humanThreats = this.findImmediateThreats(simBoard, HUMAN);
      const aiThreats = this.findImmediateThreats(simBoard, AI);
      const baseTactical = [3, 1, 3, 1, 4, 1, 3, 1, 3];

      let bestMove = -1;
      let bestVal = -9999;
      let bestTrap = -9999;
      let bestTac = -99;

      for (let i = 0; i < 9; i++) {
        if (simBoard[i] !== EMPTY) continue;
        simBoard[i] = AI;
        let nextFv = firstVein;
        if (nextFv === 0 && this.scorePlayerLines(simBoard, AI) > 0) {
          nextFv = AI;
        }
        const res = this.solve(simBoard, HUMAN, nextFv, emptyCount - 1);
        simBoard[i] = EMPTY;

        const bonusWeight = this.bonusCells.includes(i) ? 2 : 0;
        const tac = baseTactical[i] + bonusWeight;
        const trA = Math.round(res.trap * 1e6);
        const trB = Math.round(bestTrap * 1e6);

        if (
          res.val > bestVal ||
          (res.val === bestVal && trA > trB) ||
          (res.val === bestVal && trA === trB && tac > bestTac)
        ) {
          bestVal = res.val;
          bestTrap = res.trap;
          bestTac = tac;
          bestMove = i;
        }
      }

      this.lastElapsedMs = Math.max(0.1, performance.now() - t0);

      const trapPct = Math.max(0, Math.min(100, Math.round(bestTrap * 100)));
      const commentary = this.buildTacticalCommentary(
        bestMove,
        bestVal,
        trapPct,
        humanThreats.has(bestMove),
        aiThreats.has(bestMove)
      );

      return {
        move: bestMove,
        evalScore: bestVal,
        trapPct,
        nodes: this.lastNodes,
        cacheHits: this.lastCacheHits,
        totalStates: this.memoVal.size,
        elapsedMs: this.lastElapsedMs,
        isCounter: humanThreats.has(bestMove),
        isCompletingOwnLine: aiThreats.has(bestMove),
        commentary
      };
    }

    buildTacticalCommentary(moveIdx, evalScore, trapPct, isCounter, isOwnLine) {
      const palace = PALACE_NAMES[moveIdx] || "九宮要衝";
      if (isOwnLine && isCounter) {
        return `AI 鎮守【${palace}】：一石二鳥！直接貫通妖脈得分，同時斬斷陰陽師聽牌路線！`;
      }
      if (isOwnLine) {
        return `AI 強襲【${palace}】：率先貫通三印妖脈鎖定分數，掌握第 9 手終局主動權！`;
      }
      if (isCounter) {
        return `AI 落雷反制【${palace}】：精準識破並封死陰陽師聽牌殺著（後續誘敵陷阱率 ${trapPct}%）。`;
      }
      if (evalScore > 0) {
        return `AI 布印【${palace}】：Minimax 已鎖定 9 印滿盤必勝因果，無論先手如何應對皆難逃敗局！`;
      }
      return `AI 鎮印【${palace}】：封鎖雙線交叉要衝，維持後手 100% 不敗鐵壁（誘敵失誤率 ${trapPct}%）。`;
    }

    evaluateHumanOptions(board, firstVein) {
      const simBoard = Int8Array.from(board);
      let emptyCount = 0;
      for (let i = 0; i < 9; i++) {
        if (simBoard[i] === EMPTY) emptyCount++;
      }
      const out = new Array(9).fill(null);
      for (let i = 0; i < 9; i++) {
        if (simBoard[i] !== EMPTY) continue;
        simBoard[i] = HUMAN;
        let nextFv = firstVein;
        if (nextFv === 0 && this.scorePlayerLines(simBoard, HUMAN) > 0) {
          nextFv = HUMAN;
        }
        const res = this.solve(simBoard, AI, nextFv, emptyCount - 1);
        simBoard[i] = EMPTY;
        out[i] = res;
      }
      return out;
    }
  }

  /* --------------------------------------------------------------------------
     ReplayArchive — Saves Last 12 Full 9-Move Games for Step-by-Step Review
     -------------------------------------------------------------------------- */
  class ReplayArchive {
    constructor() {
      this.storageKey = "hw06_1142949_replays_v2";
      this.records = SafeStorage.read(this.storageKey, []);
    }

    addMatchRecord(record) {
      this.records.unshift(record);
      if (this.records.length > 12) {
        this.records.length = 12;
      }
      SafeStorage.write(this.storageKey, this.records);
    }

    getAll() {
      return this.records;
    }
  }

  window.HW06_AI = {
    HUMAN,
    AI,
    EMPTY,
    PALACE_NAMES,
    PALACE_SHORT,
    WIN_LINES,
    winningLines,
    LINE_NAMES,
    SafeStorage,
    UnbeatableOnmyoAI,
    ReplayArchive
  };
})();
