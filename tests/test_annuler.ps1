$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force (Join-Path $banc "acc") | Out-Null
$jeu = "http://127.0.0.1:8765/index.html"
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9409
$profil = Join-Path $env:TEMP ("alcuno_cdp_" + [guid]::NewGuid().ToString("N"))

$chrome = Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--remote-debugging-port=$port", "--user-data-dir=$profil",
  "--allow-file-access-from-files", "--no-first-run", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "about:blank")
Start-Sleep -Seconds 3

$script:idMsg = 0
function Ouvrir($url) {
  $t = Invoke-RestMethod -Method Put -Uri ("http://127.0.0.1:$port/json/new?" + $url)
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$t.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  return @{ ws = $ws; id = $t.id }
}
function Fermer($onglet) {
  try { $onglet.ws.Dispose() } catch {}
  Invoke-RestMethod -Uri ("http://127.0.0.1:$port/json/close/" + $onglet.id) | Out-Null
}
function Eval($onglet, [string]$expr) {
  $script:idMsg++
  $id = $script:idMsg
  $msg = @{ id = $id; method = "Runtime.evaluate"; params = @{ expression = $expr; awaitPromise = $true; returnByValue = $true } } | ConvertTo-Json -Depth 6 -Compress
  $octets = [Text.Encoding]::UTF8.GetBytes($msg)
  $onglet.ws.SendAsync([ArraySegment[byte]]$octets, [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  $tampon = New-Object byte[] 1048576
  while ($true) {
    $texte = ""
    do {
      $r = $onglet.ws.ReceiveAsync([ArraySegment[byte]]$tampon, [Threading.CancellationToken]::None).Result
      $texte += [Text.Encoding]::UTF8.GetString($tampon, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $rep = $texte | ConvertFrom-Json
    if ($rep.id -eq $id) {
      if ($rep.result.exceptionDetails) { return "EXCEPTION: " + $rep.result.exceptionDetails.text + " " + $rep.result.exceptionDetails.exception.description }
      return $rep.result.result.value
    }
  }
}
function Attendre($onglet, [string]$condition, [int]$maxSec = 60) {
  $expr = "new Promise(r => { const t0 = Date.now(); const f = () => { let ok = false; try { ok = !!($condition); } catch(e) {} if (ok) return r(true); if (Date.now() - t0 > $($maxSec * 1000)) return r(false); setTimeout(f, 200); }; f(); })"
  return Eval $onglet $expr
}
# Commande DevTools quelconque (réseau coupé, capture d'écran)
function Cdp($onglet, [string]$methode, $params) {
  $script:idMsg++
  $id = $script:idMsg
  $msg = @{ id = $id; method = $methode; params = $params } | ConvertTo-Json -Depth 6 -Compress
  $octets = [Text.Encoding]::UTF8.GetBytes($msg)
  $onglet.ws.SendAsync([ArraySegment[byte]]$octets, [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  $tampon = New-Object byte[] 8388608
  while ($true) {
    $texte = ""
    do {
      $r = $onglet.ws.ReceiveAsync([ArraySegment[byte]]$tampon, [Threading.CancellationToken]::None).Result
      $texte += [Text.Encoding]::UTF8.GetString($tampon, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $rep = $texte | ConvertFrom-Json
    if ($rep.id -eq $id) { return $rep.result }
  }
}
$autoClassique = $auto.Replace('if (label && /à toi/i.test(label.innerText))', 'if (true)')
function Capturer($onglet, [string]$nom) {
  $c = Cdp $onglet "Page.captureScreenshot" @{ format = "png" }
  [IO.File]::WriteAllBytes((Join-Path $banc "acc\$nom.png"), [Convert]::FromBase64String($c.data))
}
function Telephone($onglet) {
  Cdp $onglet "Emulation.setDeviceMetricsOverride" @{ width = 390; height = 844; deviceScaleFactor = 1; mobile = $true } | Out-Null
}
$partie = "const pd = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('btnModeClassique').click(); for (const n of ['Tristan', 'Ylana', 'Célien']) { document.getElementById('nomJoueur').value = n; pd(document.getElementById('ajouterJoueur')); } pd(document.getElementById('jouer')); document.activeElement && document.activeElement.blur(); 'ok'"
$espion = "window.__ctxs = []; const C = window.AudioContext; window.AudioContext = function (...a) { const c = new C(...a); window.__ctxs.push(c); return c; }; window.AudioContext.prototype = C.prototype; window.__arrets = []; const a0 = AudioBufferSourceNode.prototype.stop; AudioBufferSourceNode.prototype.stop = function (t) { window.__arrets.push(Math.round((t - this.context.currentTime) * 100) / 100 + ' s (fichier ' + Math.round(this.buffer.duration * 100) / 100 + ' s)'); return a0.apply(this, arguments); }; window.__lectures = []; const s0 = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__lectures.push(Math.round(this.buffer.duration * 100) / 100); return s0.apply(this, a); };"
$tap = "document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 'ok'"
$autoTest = $autoClassique.Replace('    const choix = [', '    if ($("#overlayAnnulation")) { const bs = $$("#overlayAnnulation .bouton-annulation").filter(cliquable); if (bs.length) { window.__nbAnnul = (window.__nbAnnul || 0) + 1; const b = bs[Math.min(bs.length - 1, window.__nbAnnul % 2)]; window.__clicsAnnul = (window.__clicsAnnul || []).concat(b.innerText); pd(b); return setTimeout(tick, 300); } }' + "`n" + '    const choix = [')
try {
  $O = Ouvrir $jeu; Telephone $O
  Attendre $O "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Cdp $O "Page.enable" @{} | Out-Null
  Cdp $O "Page.addScriptToEvaluateOnNewDocument" @{ source = $espion } | Out-Null
  Eval $O "localStorage.clear(); location.reload(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3
  Attendre $O "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Write-Output "Version : $(Eval $O "document.getElementById('versionJeu').innerText")"
  Eval $O $tap | Out-Null
  Start-Sleep -Seconds 3
  $duree = Eval $O "fetch('Sons/annuler_gorgees.mp3').then(r => r.arrayBuffer()).then(d => new (Object.getPrototypeOf(window.__ctxs[0]).constructor)().decodeAudioData(d)).then(b => Math.round(b.duration * 100) / 100)"
  $duree0 = Eval $O "fetch('Sons/annuler_0_gorgees.mp3').then(r => r.arrayBuffer()).then(d => new (Object.getPrototypeOf(window.__ctxs[0]).constructor)().decodeAudioData(d)).then(b => Math.round(b.duration * 100) / 100)"
  Write-Output "Durée de annuler_gorgees.mp3 : $duree s | annuler_0_gorgees.mp3 : $duree0 s"
  Eval $O "window.__lectures = []; window.__arrets = []; 'ok'" | Out-Null
  Eval $O $partie | Out-Null
  Start-Sleep -Seconds 1
  Eval $O ($autoTest + "; __auto.start(); 'ok'") | Out-Null
  $ok = Attendre $O "(window.__clicsAnnul || []).length >= 4 || document.querySelector('#overlayFinUnRestants, #overlayPredictionFin')" 400
  Start-Sleep -Seconds 2
  Eval $O "__auto.stop(); 'ok'" | Out-Null
  $clics = Eval $O "JSON.stringify(window.__clicsAnnul || [])"
  $avecSon = Eval $O "(window.__clicsAnnul || []).filter(t => !/Annuler 0/.test(t)).length"
  $sons = Eval $O "window.__lectures.filter(d => d === $duree).length"
  Write-Output "Boutons d'annulation tapés : $clics"
  $sons0 = Eval $O "window.__lectures.filter(d => d === $duree0).length"
  Write-Output "Annulations de 1 ou plus : $avecSon -> sons « annuler » : $sons | « Annuler 0 » : $(Eval $O "(window.__clicsAnnul || []).filter(t => /Annuler 0/.test(t)).length") -> sons « annuler 0 » : $sons0"
  Write-Output "Erreurs JS : $(Eval $O "JSON.stringify(window.__erreurs || [])")"
}
finally {
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
