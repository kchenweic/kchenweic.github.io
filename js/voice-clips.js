/* ==========================================================================
   1142949 HW06 — 角色配音播放器（取代 voice-synth.js）
   - 神樂坂蓮＝男聲、玉藻前＝女聲：兩個「不同的基礎語音」，絕不升降調假裝男女聲
   - 優先播放隨遊戲打包的音檔（assets/voice/*.wav + manifest.js，由 make_voices.bat 產生）
   - 沒有音檔時，改用瀏覽器內建語音，依語音名稱挑選男聲／女聲
   - 一次只播一句；句與句之間停 0.3 秒；不再疊加合成音與吶喊
   - 連續落子時：過期的招式台詞直接丟棄，不會排到好幾手之後才播
   ========================================================================== */
(function () {
  "use strict";

  const GAP_MS = 300;            // 句間停頓
  const CHANT_TTL_MS = 2600;     // 招式台詞排隊超過這個時間就丟棄（新招式一到，舊的未播招式也會直接丟棄）
  const LINE_TTL_MS = 6000;

  const LINES = (window.HW06_VOICE_LINES && window.HW06_VOICE_LINES.lines) || [];
  const CHANTS = (window.HW06_VOICE_LINES && window.HW06_VOICE_LINES.chants) || {};

  const norm = (s) => String(s || "").replace(/[\s「」『』，。！？、…—～~,.!?:：；;（）()\-]/g, "");
  const byText = new Map();
  const byId = new Map();
  LINES.forEach((l) => { byText.set(norm(l.text), l); byId.set(l.id, l); });

  const MALE_RE = /(Zhiwei|YunJhe|Yunjhe|Kangkang|Yunxi|Yunyang|Yunjian|男)/i;
  const FEMALE_RE = /(Yating|Hanhan|HsiaoChen|HsiaoYu|Huihui|Yaoyao|Xiaoxiao|Xiaoyi|Google\s*國語|Google\s*普通话|Mei-Jia|Meijia|Sin-ji|Tingting|女)/i;

  function manifest() {
    const m = window.HW06_VOICE_MANIFEST;
    return m && m.clips ? m : null;
  }

  /* 音檔若是用「舊台詞」錄的（manifest 記錄的 text 與目前台詞不同），就不播它，
     改用瀏覽器內建中文語音念新台詞，避免字幕和聲音對不上。重新執行 tools/make_voices.bat 後自動恢復音檔。 */
  function clipFor(id) {
    const m = manifest();
    const clip = m && id ? m.clips[id] : null;
    if (!clip) return null;
    const line = byId.get(id);
    if (clip.text && line && norm(clip.text) !== norm(line.text)) return null;
    return clip;
  }

  class VoiceClipDirector {
    constructor() {
      this.enabled = true;
      this.queue = [];
      this.current = null;       // { item, audio|utter, startMs, endMs }
      this.gapUntil = 0;
      this.pumpTimer = 0;
      this.watchdog = 0;
      this.counterCursor = { ren: 0, tamamo: 0 };
      this.webVoices = { ren: null, tamamo: null };
      this.audioCache = new Map();
      this.volume = 1;
      this._loadWebVoices();
      if ("speechSynthesis" in window) {
        try { window.speechSynthesis.onvoiceschanged = () => this._loadWebVoices(); } catch (_) {}
      }
      this._preload();
    }

    /* ---------- voice sources ---------- */
    _preload() {
      const m = manifest();
      if (!m) return;
      Object.keys(m.clips).forEach((id) => {
        if (!clipFor(id)) return;
        const a = new Audio();
        a.preload = "auto";
        a.src = m.clips[id].file;
        this.audioCache.set(id, a);
      });
    }

    _loadWebVoices() {
      if (!("speechSynthesis" in window)) return;
      let list = [];
      try { list = window.speechSynthesis.getVoices() || []; } catch (_) { list = []; }
      const zh = list.filter((v) => /^zh|cmn|yue/i.test(v.lang || "") || /Chinese|中文|國語|普通话/i.test(v.name));
      const tw = (v) => /TW|Hant|Taiwan|台灣|臺灣/i.test((v.lang || "") + v.name);
      const pick = (re) => zh.filter((v) => re.test(v.name)).sort((a, b) => (tw(b) - tw(a)) || (/Natural|Online/i.test(b.name) - /Natural|Online/i.test(a.name)))[0] || null;
      this.webVoices.ren = pick(MALE_RE);
      this.webVoices.tamamo = pick(FEMALE_RE);
      if (this.webVoices.ren && this.webVoices.tamamo && this.webVoices.ren === this.webVoices.tamamo) this.webVoices.ren = null;
    }

    clipDuration(id) { const c = clipFor(id); return c ? c.dur : null; }

    staleClipIds() {
      const m = manifest();
      return m ? Object.keys(m.clips).filter((id) => !clipFor(id)) : [];
    }

    getVoiceSourceInfo() {
      const m = manifest();
      if (m) {
        return { mode: "clips", engine: m.engine, ren: m.male, tamamo: m.female,
                 stale: this.staleClipIds().length,
                 label: `隨遊戲打包的音檔（${m.engine}：蓮＝${m.male}，玉藻前＝${m.female}）` +
                   (this.staleClipIds().length ? `；${this.staleClipIds().length} 句台詞已改寫、音檔待重新產生，暫用瀏覽器內建語音` : "") };
      }
      this._loadWebVoices();
      const r = this.webVoices.ren, t = this.webVoices.tamamo;
      return { mode: "web", ren: r ? r.name : null, tamamo: t ? t.name : null,
               label: `瀏覽器內建語音（蓮＝${r ? r.name : "此電腦沒有中文男聲，只顯示字幕"}；玉藻前＝${t ? t.name : "此電腦沒有中文女聲，只顯示字幕"}）` };
    }

    /* ---------- public API (compatible with old HW06_VOICE) ---------- */
    unlock() {
      // 解鎖音訊（使用者手勢內呼叫）
      this.audioCache.forEach((a) => { try { a.load(); } catch (_) {} });
      if ("speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch (_) {}
        this._loadWebVoices();
      }
    }

    isEnabled() { return this.enabled; }
    setEnabled(on) { this.enabled = Boolean(on); if (!this.enabled) this.stopAll(); return this.enabled; }
    toggle() { return this.setEnabled(!this.enabled); }

    isSpeaking() { return Boolean(this.current) || this.queue.length > 0 || performance.now() < this.gapUntil; }

    /** 台詞：回傳 Promise，在這句「講完」時 resolve（旁白/無語音時依字數估算閱讀時間） */
    speakLine(charId, text, mood, opts) {
      opts = opts || {};
      const line = this._resolve(charId, text);
      if (opts.interrupt) this.stopAll();
      else if (opts.priority) this._dropPending((it) => it.kind === "chant");
      return this._enqueue({ who: charId, text: line ? line.text : text, id: line ? line.id : null,
                             kind: "line", ttl: LINE_TTL_MS });
    }

    /** 招式短句：同一角色只保留最新一句；排太久就丟棄 */
    speakMoveChant(charId, slotIndex, isCounter) {
      const set = CHANTS[charId];
      if (!set) return Promise.resolve();
      let id;
      if (isCounter && set.counters) {
        id = set.counters[(this.counterCursor[charId] = (this.counterCursor[charId] || 0) + 1) % set.counters.length];
      } else {
        id = set.moves[Math.max(0, Math.min(set.moves.length - 1, slotIndex | 0))];
      }
      return this.speakById(id, { kind: "chant" });
    }

    speakVeinChant(charId) {
      const set = CHANTS[charId];
      return set && set.vein ? this.speakById(set.vein, { kind: "chant" }) : Promise.resolve();
    }

    speakById(id, opts) {
      const line = byId.get(id);
      if (!line) return Promise.resolve();
      const kind = (opts && opts.kind) || line.kind;
      if (kind === "chant") {
        // 同角色尚未播出的舊招式 → 丟棄，避免幾手之後才念
        this._dropPending((it) => it.kind === "chant");
      }
      const rate = (opts && opts.rate) || 1;   // 劇情動畫用 >1 讓台詞念快一點（保持音高）
      return this._enqueue({ who: line.char, text: line.text, id: line.id, kind, rate, ttl: kind === "chant" ? CHANT_TTL_MS : LINE_TTL_MS });
    }

    stopAll() {
      this.queue.forEach((it) => it.resolve());
      this.queue = [];
      this._stopCurrent();
      this.gapUntil = 0;
    }

    getLipSyncState(charId) {
      const c = this.current;
      if (!c || c.item.who !== charId) return { speaking: false, mouth: 0, mouthOpen: 0 };
      const t = (performance.now() - c.startMs) / 1000;
      // 依語速產生自然的開合（音節約 5～6 Hz），句尾收口
      const total = c.durMs ? c.durMs / 1000 : 2;
      const fade = Math.min(1, Math.max(0, (total - t) / 0.18));
      const syl = 0.5 + 0.5 * Math.sin(t * (c.item.who === "tamamo" ? 30 : 35));
      const jitter = 0.65 + 0.35 * Math.sin(t * 11.3 + 1.7);
      const v = Math.max(0, Math.min(1, syl * jitter * fade));
      return { speaking: true, mouth: v, mouthOpen: v };
    }

    /* ---------- internals ---------- */
    _resolve(charId, text) {
      const hit = byText.get(norm(text));
      if (hit && (hit.char === charId || !charId)) return hit;
      return null;
    }

    _dropPending(pred) {
      const keep = [];
      this.queue.forEach((it) => { if (pred(it)) it.resolve(); else keep.push(it); });
      this.queue = keep;
    }

    _enqueue(item) {
      return new Promise((resolve) => {
        item.resolve = resolve;
        item.queuedAt = performance.now();
        if (!this.enabled || item.who === "narrator" || !this._canVoice(item)) {
          // 沒有可用的聲音 → 只顯示字幕：依字數估計閱讀時間後 resolve
          const ms = Math.min(6500, 900 + norm(item.text).length * 190) / (item.rate || 1);
          window.setTimeout(resolve, item.kind === "chant" ? 0 : ms);
          return;
        }
        this.queue.push(item);
        this._pump();
      });
    }

    _canVoice(item) {
      if (clipFor(item.id)) return true;
      if (!("speechSynthesis" in window)) return false;
      if (!this.webVoices[item.who]) this._loadWebVoices();
      return Boolean(this.webVoices[item.who]);
    }

    _pump() {
      window.clearTimeout(this.pumpTimer);
      if (this.current) return;
      const now = performance.now();
      if (now < this.gapUntil) {
        this.pumpTimer = window.setTimeout(() => this._pump(), this.gapUntil - now + 5);
        return;
      }
      while (this.queue.length) {
        const it = this.queue.shift();
        if (now - it.queuedAt > it.ttl) { it.resolve(); continue; }   // 過期：丟棄
        this._play(it);
        return;
      }
    }

    _duck(on) {
      window.clearTimeout(this.unduckTimer);
      const A = window.HW06_AUDIO;
      if (!A || typeof A.duck !== "function") return;
      if (on) A.duck(true);
      else this.unduckTimer = window.setTimeout(() => { if (!this.current) A.duck(false); }, 450);
    }

    _finish(item) {
      if (!this.current || this.current.item !== item) return;
      window.clearTimeout(this.watchdog);
      this.current = null;
      this._duck(false);
      this.gapUntil = performance.now() + GAP_MS;
      item.resolve();
      this._pump();
    }

    _stopCurrent() {
      window.clearTimeout(this.watchdog);
      const c = this.current;
      this.current = null;
      if (!c) return;
      this._duck(false);
      if (c.audio) { try { c.audio.pause(); c.audio.currentTime = 0; } catch (_) {} }
      if (c.utter && "speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch (_) {} }
      c.item.resolve();
    }

    _play(item) {
      this._duck(true);
      const clip = clipFor(item.id);
      const startMs = performance.now();
      if (clip) {
        let a = this.audioCache.get(item.id);
        if (!a) { a = new Audio(clip.file); this.audioCache.set(item.id, a); }
        try { a.currentTime = 0; } catch (_) {}
        a.volume = this.volume;
        const rate = item.rate || 1;
        try { a.preservesPitch = true; a.playbackRate = rate; } catch (_) {}
        const durMs = (clip.dur || 2) * 1000 / rate;
        this.current = { item, audio: a, startMs, durMs };
        a.onended = () => this._finish(item);
        a.onerror = () => this._finish(item);
        const p = a.play();
        if (p && p.catch) p.catch(() => this._finish(item));
        this.watchdog = window.setTimeout(() => this._finish(item), durMs + 1500);
        return;
      }
      // Web Speech：依角色使用不同的基礎語音，不調 pitch
      const voice = this.webVoices[item.who];
      const u = new SpeechSynthesisUtterance(item.text);
      u.voice = voice;
      u.lang = voice.lang || "zh-TW";
      u.pitch = 1;
      u.volume = this.volume;
      u.rate = (item.who === "tamamo" ? (item.kind === "chant" ? 0.92 : 0.86) : (item.kind === "chant" ? 0.95 : 1.0)) * (item.rate || 1);
      const estMs = (600 + norm(item.text).length * (item.who === "tamamo" ? 260 : 220)) / (item.rate || 1);
      this.current = { item, utter: u, startMs, durMs: estMs };
      u.onstart = () => { if (this.current && this.current.item === item) this.current.startMs = performance.now(); };
      u.onend = () => this._finish(item);
      u.onerror = () => this._finish(item);
      try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (_) { this._finish(item); return; }
      this.watchdog = window.setTimeout(() => this._finish(item), estMs + 4000);
    }
  }

  window.HW06_VOICE = new VoiceClipDirector();
})();
document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btn-voice-toggle");
  if (b && window.HW06_VOICE) setTimeout(() => { b.title = "目前配音來源：" + window.HW06_VOICE.getVoiceSourceInfo().label; }, 1200);
});
