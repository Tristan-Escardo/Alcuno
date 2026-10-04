$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force (Join-Path $banc "acc") | Out-Null
$jeu = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/")
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9409
$profil = Join-Path $env:TEMP ("alcuno_cdp_" + [guid]::NewGuid().ToString("N"))

$chrome = Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--remote-debugging-port=$port", "--user-data-dir=$profil",
  "--allow-file-access-from-files", "--no-first-run", "--disable-background-timer-throttling",
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
$pt = "const n = document.getElementById('notifHaut'); const ev = (t, y) => n.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, clientX: 200, clientY: y }));"
try {
  $O = Ouvrir $jeu; Telephone $O
  Attendre $O "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText" 30 | Out-Null
  Eval $O "localStorage.clear(); localStorage.setItem('alcuno_theme', 'prestige'); localStorage.setItem('alcuno_theme_prestige', '1'); location.reload(); 'ok'" | Out-Null; Start-Sleep -Seconds 3
  Capturer $O "or_accueil"
  Eval $O "window.__erreursTest = []; window.addEventListener('error', (e) => window.__erreursTest.push(e.message)); localStorage.removeItem('alcuno_theme_prestige'); 'ok'" | Out-Null
  Eval $O "(async () => { const t = document.getElementById('titreAccueil'); for (let i = 0; i < 4; i++) { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); } return 'ok'; })()" | Out-Null
  Start-Sleep -Milliseconds 1200
  Capturer $O "or_notif"
  Write-Output "Notif : $(Eval $O "(document.getElementById('notifHaut')||{}).innerText") | étincelles : $(Eval $O "document.querySelectorAll('#notifHaut .notifHaut-eclats span').length")"
  # Tenue au doigt 7 s : elle reste
  Eval $O "{ $pt ev('pointerdown', 40); ev('pointermove', 70); } 'ok'" | Out-Null
  Start-Sleep -Seconds 7
  Write-Output "Tenue 7 s (tirée vers le bas) : présente = $(Eval $O "!!document.getElementById('notifHaut')") | transform = $(Eval $O "document.getElementById('notifHaut').style.transform")"
  Eval $O "{ $pt ev('pointerup', 70); } 'ok'" | Out-Null
  Start-Sleep -Milliseconds 500
  Write-Output "Lâchée : revenue = $(Eval $O "document.getElementById('notifHaut').style.transform")"
  # Glissement vers le haut
  Eval $O "{ $pt ev('pointerdown', 40); ev('pointermove', 20); ev('pointermove', -10); ev('pointermove', -40); } 'ok'" | Out-Null
  Start-Sleep -Milliseconds 300
  Eval $O "{ $pt ev('pointerup', -40); } 'ok'" | Out-Null
  Start-Sleep -Milliseconds 600
  Write-Output "Glissée vers le haut : fermée = $(Eval $O "!document.getElementById('notifHaut')")"
  # Tap simple + fermeture automatique
  Eval $O "localStorage.removeItem('alcuno_theme_prestige'); (async () => { const t = document.getElementById('titreAccueil'); await new Promise(r => setTimeout(r, 700)); for (let i = 0; i < 4; i++) { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); } return 'ok'; })()" | Out-Null
  Start-Sleep -Milliseconds 600
  Eval $O "{ $pt ev('pointerdown', 40); ev('pointerup', 42); } 'ok'" | Out-Null
  Start-Sleep -Milliseconds 600
  Write-Output "Tap : fermée = $(Eval $O "!document.getElementById('notifHaut')")"
  Eval $O "localStorage.removeItem('alcuno_theme_prestige'); (async () => { const t = document.getElementById('titreAccueil'); await new Promise(r => setTimeout(r, 700)); for (let i = 0; i < 4; i++) { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); } return 'ok'; })()" | Out-Null
  Start-Sleep -Seconds 6
  Write-Output "Toute seule après 6 s : fermée = $(Eval $O "!document.getElementById('notifHaut')")"
  Write-Output "Erreurs JS : $(Eval $O "JSON.stringify(window.__erreursTest)")"
}
finally {
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
