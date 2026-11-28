# 1142949 HW06 — 角色配音產生器（Windows 內建語音，離線執行）
# 神樂坂蓮 = 男聲（Zhiwei / YunJhe / Kangkang …）；玉藻前 = 女聲（Yating / Hanhan / HsiaoChen …）
# 兩人使用「不同的基礎語音」，不做升降調假裝男女聲。
# 產生 assets/voice/*.wav 與 assets/voice/manifest.js，之後整包上傳 GitHub，老師電腦會聽到同一組聲音。
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "assets\voice"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# 台詞直接讀 js/voice-lines.js（遊戲字幕用的同一份），改台詞後重跑本工具，字幕與聲音就會一句一句對上。
$linesPath = Join-Path $root "js\voice-lines.js"
$rawJs = [IO.File]::ReadAllText($linesPath, [Text.Encoding]::UTF8)
$jsonText = $rawJs.Substring($rawJs.IndexOf("{")).Trim().TrimEnd(";")
$lineData = $jsonText | ConvertFrom-Json
$LINES = @($lineData.lines | ForEach-Object { @{ id = $_.id; who = $_.char; kind = $_.kind; text = $_.text } })
Write-Host ("讀到 " + $LINES.Count + " 句台詞：" + $linesPath)

# 原始語音先放 _raw，之後（若電腦有 Python + ffmpeg）做語氣後製再放到 assets\voice
$rawDir = Join-Path $outDir "_raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null


$MALE   = @("Zhiwei", "YunJhe", "Yunjhe", "Kangkang", "Yunxi", "Yunyang")
$FEMALE = @("Yating", "Hanhan", "HsiaoChen", "HsiaoYu", "Huihui", "Yaoyao", "Xiaoxiao")

function Pick-Name($names, $prefs) {
  foreach ($p in $prefs) { foreach ($n in $names) { if ($n -match $p) { return $n } } }
  return $null
}

function Esc($s) { return [System.Security.SecurityElement]::Escape($s) }

function Make-Ssml($lang, $voiceName, $item) {
  $t = Esc $item.text
  if ($item.who -eq "ren") {
    if ($item.kind -eq "chant") { $rate = "-6%"; $vol = "loud" } else { $rate = "0%"; $vol = "medium" }
  } else {
    if ($item.kind -eq "chant") { $rate = "-8%"; $vol = "medium" } else { $rate = "-14%"; $vol = "medium" }
  }
  return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='$lang'><voice name='$voiceName'><prosody rate='$rate' volume='$vol'>$t</prosody></voice></speak>"
}

function Wav-Seconds($path) {
  $b = [IO.File]::ReadAllBytes($path)
  $byteRate = [BitConverter]::ToInt32($b, 28)
  # find "data" chunk
  $i = 12
  while ($i -lt $b.Length - 8) {
    $id = [Text.Encoding]::ASCII.GetString($b, $i, 4)
    $sz = [BitConverter]::ToInt32($b, $i + 4)
    if ($id -eq "data") { return [Math]::Round($sz / $byteRate, 3) }
    $i += 8 + $sz
  }
  return [Math]::Round(($b.Length - 44) / $byteRate, 3)
}

$results = @{}
$engine = $null
$maleName = $null; $femaleName = $null

# ---------- 1) Windows OneCore（WinRT）語音：Win10/11 中文（台灣）語言包內建 ----------
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  function Await-Op($op, [Type]$t) {
    $task = $asTaskGeneric.MakeGenericMethod($t).Invoke($null, @($op))
    $null = $task.Wait(-1)
    return $task.Result
  }
  $all = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
  $names = @($all | ForEach-Object { $_.DisplayName })
  Write-Host "OneCore 語音：" ($names -join ", ")
  $m = Pick-Name $names $MALE; $f = Pick-Name $names $FEMALE
  if ($m -and $f) {
    $vm = ($all | Where-Object { $_.DisplayName -eq $m })[0]
    $vf = ($all | Where-Object { $_.DisplayName -eq $f })[0]
    $synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    foreach ($it in $LINES) {
      $v = if ($it.who -eq "ren") { $vm } else { $vf }
      $synth.Voice = $v
      $ssml = Make-Ssml $v.Language $v.DisplayName $it
      $stream = Await-Op ($synth.SynthesizeSsmlToStreamAsync($ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
      $path = Join-Path $rawDir ($it.id + ".wav")
      $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0))
      $fs = [IO.File]::Create($path)
      $netStream.CopyTo($fs); $fs.Close(); $netStream.Close()
      $results[$it.id] = @{ file = "assets/voice/" + $it.id + ".wav"; dur = (Wav-Seconds $path); voice = $v.DisplayName; who = $it.who; text = $it.text }
      Write-Host ("  [" + $it.who + "] " + $it.id + "  " + $v.DisplayName)
    }
    $engine = "Windows OneCore"; $maleName = $m; $femaleName = $f
  } else {
    Write-Host "OneCore 缺少男聲或女聲，改試 SAPI……"
  }
} catch {
  Write-Host "OneCore 語音無法使用：" $_.Exception.Message
  $results = @{}
}

# ---------- 2) SAPI（System.Speech）桌面語音 ----------
if (-not $engine) {
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $installed = @($s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo })
  $names = @($installed | ForEach-Object { $_.Name })
  Write-Host "SAPI 語音：" ($names -join ", ")
  $m = Pick-Name $names $MALE; $f = Pick-Name $names $FEMALE
  if (-not ($m -and $f)) {
    Write-Host ""
    Write-Host "找不到可用的中文男聲與女聲。請到「設定 > 時間與語言 > 語音」新增「中文（台灣）」語音後再執行一次。" -ForegroundColor Yellow
    Write-Host "（沒有音檔時，遊戲會改用瀏覽器內建語音，依名稱挑男聲/女聲，不做變調。）"
    exit 1
  }
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  foreach ($it in $LINES) {
    $vn = if ($it.who -eq "ren") { $m } else { $f }
    $vi = ($installed | Where-Object { $_.Name -eq $vn })[0]
    $path = Join-Path $rawDir ($it.id + ".wav")
    $s.SetOutputToWaveFile($path, $fmt)
    $s.SpeakSsml((Make-Ssml $vi.Culture.Name $vn $it))
    $s.SetOutputToNull()
    $results[$it.id] = @{ file = "assets/voice/" + $it.id + ".wav"; dur = (Wav-Seconds $path); voice = $vn; who = $it.who; text = $it.text }
    Write-Host ("  [" + $it.who + "] " + $it.id + "  " + $vn)
  }
  $engine = "Windows SAPI"; $maleName = $m; $femaleName = $f
}

# ---------- 3) 語氣後製（選用）：有 Python(numpy) + ffmpeg(含 rubberband) 就套用 tools\voice_direct.py ----------
$directed = $false
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($py -and $ff) {
  try {
    Write-Host "偵測到 Python 與 ffmpeg，套用語氣後製（逐句調整語速、語調與回音）……"
    & $py.Source (Join-Path $PSScriptRoot "voice_direct.py") $rawDir $outDir $linesPath
    $reportPath = Join-Path $outDir "_report.json"
    if ($LASTEXITCODE -eq 0 -and (Test-Path $reportPath)) {
      $report = [IO.File]::ReadAllText($reportPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
      foreach ($k in @($results.Keys)) {
        $entry = $report.PSObject.Properties[$k]
        if ($entry) { $results[$k].dur = $entry.Value.dur }
      }
      Remove-Item $reportPath -ErrorAction SilentlyContinue
      $directed = $true
    }
  } catch {
    Write-Host "語氣後製失敗，改用原始語音：" $_.Exception.Message
  }
}
if (-not $directed) {
  Write-Host "未套用語氣後製（需要 Python + numpy + ffmpeg），直接使用原始語音。"
  foreach ($it in $LINES) {
    Copy-Item (Join-Path $rawDir ($it.id + ".wav")) (Join-Path $outDir ($it.id + ".wav")) -Force
  }
}

# ---------- manifest.js（file:// 也能讀，不需 fetch）；text 欄位讓遊戲能判斷音檔是否和目前台詞一致 ----------
function Js-Str($v) { return '"' + ([string]$v).Replace('\', '\\').Replace('"', '\"') + '"' }
$clips = @()
foreach ($k in $results.Keys) {
  $r = $results[$k]
  $clips += ((Js-Str $k) + ':{"file":' + (Js-Str $r.file) + ',"dur":' + ([string]$r.dur).Replace(',', '.') + ',"voice":' + (Js-Str $r.voice) + ',"who":' + (Js-Str $r.who) + ',"text":' + (Js-Str $r.text) + '}')
}
$dirFlag = if ($directed) { "true" } else { "false" }
$js = "/* 由 tools/make_voices.ps1 產生 */`nwindow.HW06_VOICE_MANIFEST = {`"engine`":`"$engine`",`"male`":`"$maleName`",`"female`":`"$femaleName`",`"clips`":{" + ($clips -join ",") + "},`"directed`":$dirFlag};`n"
[IO.File]::WriteAllText((Join-Path $outDir "manifest.js"), $js, (New-Object Text.UTF8Encoding($false)))
Write-Host ""
Write-Host ("完成！共 " + $results.Count + " 句。神樂坂蓮＝" + $maleName + "（男聲），玉藻前＝" + $femaleName + "（女聲）。") -ForegroundColor Green
Write-Host "音檔位置：assets\voice\  —— 重新整理 index.html 即可聽到。（assets\voice\_raw 是原始語音，可刪除）"
