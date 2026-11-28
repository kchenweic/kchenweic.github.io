# 配音語氣後製：以使用者電腦產生的 Windows 中文語音（Zhiwei / Yating）為原料，
# 依台詞標點切句，逐句調整語速、語調、音量與停頓，讓「照稿念」變成有起伏的演出。
# 不改變基礎音色（只在 ±4 半音內做語調起伏，formant 保留），男女聲仍是兩個不同的基礎語音。
import json, os, re, subprocess, sys, tempfile, wave
import numpy as np

SRC = sys.argv[1]       # 原始 wav 資料夾
DST = sys.argv[2]       # 輸出資料夾
LINES_JS = sys.argv[3]  # js/voice-lines.js
SR = 22050

lines = json.loads(open(LINES_JS, encoding="utf-8").read().split("HW06_VOICE_LINES =", 1)[1].strip().rstrip(";"))["lines"]

def load(path):
    raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def save(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def ff(x, af):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        save(a, x)
        subprocess.check_call(["ffmpeg", "-loglevel", "error", "-y", "-i", a, "-af", af, "-ar", str(SR), "-ac", "1", b])
        return load(b)

def voiced_mask(x, thr_db=-40, win=0.01):
    n = int(SR * win); m = len(x) // n
    e = np.array([np.sqrt(np.mean(x[i * n:(i + 1) * n] ** 2) + 1e-12) for i in range(m)])
    return 20 * np.log10(e) > thr_db, n

def segments(x, min_gap=0.05):
    v, n = voiced_mask(x)
    segs, i = [], 0
    while i < len(v):
        if v[i]:
            j = i
            while j < len(v) and v[j]: j += 1
            segs.append([i * n, j * n]); i = j
        else: i += 1
    # 合併過短的間隔
    out = []
    for s in segs:
        if out and (s[0] - out[-1][1]) < min_gap * SR: out[-1][1] = s[1]
        else: out.append(s)
    return out

def split_text(t):
    parts = re.findall(r"[^，。！？…—、]+[，。！？…—、]*", t)
    return [p for p in parts if p.strip()]

def phrase_cuts(segs, phrases):
    """依字數比例，在最接近的停頓處切成與台詞短句對應的段落"""
    if len(phrases) <= 1 or len(segs) <= 1:
        return [[segs[0][0], segs[-1][1]]]
    counts = [len(re.sub(r"[，。！？…—、]", "", p)) for p in phrases]
    total_v = sum(e - s for s, e in segs)
    gaps = [(i, segs[i][1], segs[i + 1][0]) for i in range(len(segs) - 1)]
    # 每個間隔之前累積的有聲長度
    cum, acc = [], 0
    for i, (s, e) in enumerate(segs):
        acc += e - s; cum.append(acc)
    chosen, used = [], set()
    c_acc = 0
    for k in range(len(phrases) - 1):
        c_acc += counts[k]
        target = total_v * c_acc / sum(counts)
        best = min((g for g in gaps if g[0] not in used), key=lambda g: abs(cum[g[0]] - target) - 0.15 * (g[2] - g[1]) / SR * total_v / 3, default=None)
        if best is None: break
        used.add(best[0]); chosen.append(best)
    chosen.sort()
    bounds, start = [], segs[0][0]
    for g in chosen:
        bounds.append([start, g[1]]); start = g[2]
    bounds.append([start, segs[-1][1]])
    return bounds

def st(r): return 2 ** (r / 12)

def direct(who, kind, phrase, idx, n):
    """回傳 (半音, 速度, 增益dB, 停頓秒, 特效)"""
    end = phrase.strip()[-1:] if phrase.strip() else ""
    ell = phrase.endswith("……") or phrase.endswith("…")
    laugh = phrase.startswith("呵呵")
    last = idx == n - 1
    if who == "ren":
        if kind == "chant": return (-0.7, 1.05, 3.0, 0.0, "chant")
        p, t, g, pause = 0.0, 1.0, 0.0, 0.2
        if idx == 0: p += 0.5; g += 1.0                    # 開口有力
        if end == "！": p += 1.0; g += 2.5; t = 1.04; pause = 0.34
        if end == "。": p -= 0.6; pause = 0.36
        if ell: t = 0.92; pause = 0.45
        if last and end == "！": p += 0.6; g += 1.0       # 收尾堅定
        if end == "，": pause = 0.2
        return (p, t, g, pause, "")
    else:
        if kind == "chant": return (-1.0, 0.95, 1.5, 0.0, "chant")
        p, t, g, pause = 0.0, 0.93, 0.0, 0.3
        if laugh: return (2.8, 1.08, -1.0, 0.42, "laugh")
        if end == "？": p += 2.0; pause = 0.4                 # 尾音上揚、挑釁
        if end == "！": p += 1.0; g += 1.2; pause = 0.38
        if end == "。": p -= 1.0; t = 0.9; pause = 0.42       # 壓低、施壓
        if ell: p -= 0.4; t = 0.86; pause = 0.55              # 拖長、玩味
        if phrase.endswith("喔。") or phrase.endswith("喔"): p += 1.6
        if idx == 0 and not laugh: p += 0.4
        if end == "，": pause = 0.28
        return (p, t, g, pause, "")

def process_phrase(seg, p, t, g, fx):
    chain = [f"rubberband=pitch={st(p):.5f}:tempo={t:.4f}:formant=preserved:transients=mixed"]
    if g: chain.append(f"volume={g}dB")
    if fx == "laugh":
        # 笑聲：每個「呵」音高逐次升高，帶一點氣音抖動
        sub = segments(seg, 0.03)
        if len(sub) >= 2:
            out = []
            for k, (a, b) in enumerate(sub):
                pk = p + k * 0.9
                piece = ff(seg[a:b], f"rubberband=pitch={st(pk):.5f}:tempo=1.1:formant=preserved,tremolo=f=11:d=0.35,volume={-1 - k * 0.5}dB")
                out.append(piece); out.append(np.zeros(int(SR * 0.07), np.float32))
            return np.concatenate(out)
        chain.append("tremolo=f=11:d=0.35")
    return ff(seg, ",".join(chain))

def master(x, who, kind):
    if who == "ren":
        af = "acompressor=threshold=-20dB:ratio=3:attack=5:release=80,"
        af += "aecho=0.8:0.55:38|76:0.22|0.12" if kind == "chant" else "aecho=0.8:0.4:24:0.1"
    else:
        af = "acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120,"
        af += "aecho=0.8:0.5:60|120:0.26|0.14" if kind == "chant" else "aecho=0.8:0.45:52:0.15"
    y = ff(x, af)
    pk = np.max(np.abs(y)) + 1e-9
    return y * (0.89 / pk)

os.makedirs(DST, exist_ok=True)
report = {}
for L in lines:
    sid, who, kind, text = L["id"], L["char"], L["kind"], L["text"]
    x = load(os.path.join(SRC, sid + ".wav"))
    segs = segments(x)
    if not segs: continue
    phrases = split_text(text) if kind == "line" else [text]
    bounds = phrase_cuts(segs, phrases) if kind == "line" else [[segs[0][0], segs[-1][1]]]
    if len(bounds) != len(phrases): phrases = phrases[:len(bounds)] + [""] * (len(bounds) - len(phrases))
    out = [np.zeros(int(SR * 0.03), np.float32)]
    for i, (a, b) in enumerate(bounds):
        p, t, g, pause, fx = direct(who, kind, phrases[i] or text, i, len(bounds))
        a2, b2 = max(0, a - int(SR * 0.02)), min(len(x), b + int(SR * 0.03))
        y = process_phrase(x[a2:b2], p, t, g, fx)
        out.append(y)
        if i < len(bounds) - 1: out.append(np.zeros(int(SR * pause), np.float32))
    out.append(np.zeros(int(SR * 0.12), np.float32))
    y = master(np.concatenate(out), who, kind)
    save(os.path.join(DST, sid + ".wav"), y)
    report[sid] = {"dur": round(len(y) / SR, 3), "phrases": len(bounds)}
    print(sid, len(bounds), "phrases", round(len(y) / SR, 2), "s")
json.dump(report, open(os.path.join(DST, "_report.json"), "w"))
