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
$etat = "JSON.stringify({ chargements: sessionStorage.getItem('__chargements'), theme: document.documentElement.dataset.theme, reglages: getComputedStyle(document.getElementById('ecranReglages')).display, defil: document.getElementById('ecranReglages').scrollTop, classe: document.documentElement.classList.contains('rouvrir-reglages'), drapeau: sessionStorage.getItem('alcuno_rouvrir_reglages'), meta: Array.from(document.querySelectorAll('meta[name=theme-color]')).map(m => m.content).join(','), erreurs: window.__err })"
$pret = "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText.includes('8.8')"
try {
  $O = Ouvrir $jeu; Telephone $O
  Attendre $O $pret 30 | Out-Null
  # Faux iPhone en appli installée (jeu qui ne passe pas sous l'heure : zone de l'heure = 0 dans Chrome)
  Cdp $O "Emulation.setUserAgentOverride" @{ userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" } | Out-Null
  Cdp $O "Page.enable" @{} | Out-Null
  $r = Cdp $O "Page.addScriptToEvaluateOnNewDocument" @{ source = "Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }); window.__err = []; addEventListener('error', (e) => window.__err.push(e.message)); sessionStorage.setItem('__chargements', String(Number(sessionStorage.getItem('__chargements') || 0) + 1));" }
  Write-Output "Script injecté : $($r | ConvertTo-Json -Compress)"
  Eval $O "localStorage.clear(); sessionStorage.clear(); localStorage.setItem('alcuno_theme_prestige', '1'); localStorage.setItem('alcuno_theme', 'vert'); location.reload(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3; Attendre $O $pret 30 | Out-Null
  Write-Output "Départ : $(Eval $O $etat) | standalone = $(Eval $O "navigator.standalone")"

  # 1) Réglages, défilés, tap sur Nuit : rechargement puis Réglages rouverts au même endroit
  Eval $O "document.getElementById('btnReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  Eval $O "document.getElementById('ecranReglages').scrollTop = 300; document.querySelector('.pastilleTheme[data-theme=bleu]').click(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3; Attendre $O $pret 30 | Out-Null; Start-Sleep -Milliseconds 500
  Write-Output "1) Après tap sur Nuit : $(Eval $O $etat)"
  Capturer $O "rechargement_reglages"

  # 2) Trois taps d'affilée : un seul rechargement, dernier thème gardé
  Eval $O "['vert', 'noir', 'prestige'].forEach(t => document.querySelector('.pastilleTheme[data-theme=' + t + ']').click()); 'ok'" | Out-Null
  Start-Sleep -Seconds 3; Attendre $O $pret 30 | Out-Null; Start-Sleep -Milliseconds 500
  Write-Output "2) Après 3 taps d'affilée : $(Eval $O $etat)"

  # 3) Tap sur un thème puis Retour tout de suite : rechargement sur l'accueil, Réglages fermés
  Eval $O "document.querySelector('.pastilleTheme[data-theme=violet]').click(); document.getElementById('btnFermerReglages').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('btnFermerReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3; Attendre $O $pret 30 | Out-Null; Start-Sleep -Milliseconds 500
  Write-Output "3) Thème puis Retour : $(Eval $O $etat)"

  # 4) Le Retour des Réglages rouverts marche toujours
  Eval $O "document.getElementById('btnReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  Eval $O "document.querySelector('.pastilleTheme[data-theme=cerisier]').click(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3; Attendre $O $pret 30 | Out-Null; Start-Sleep -Milliseconds 600
  Eval $O "document.getElementById('btnFermerReglages').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('btnFermerReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  Write-Output "4) Retour après réouverture : $(Eval $O $etat)"

  # 5) Jeu passé sous l'heure : pas de rechargement (zone de l'heure simulée à 59 px)
  Eval $O "document.getElementById('btnReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  Eval $O "const s = document.createElement('style'); s.textContent = 'div[style*=safe-area-inset-top]{ padding-top: 59px !important; }'; document.head.appendChild(s); document.querySelector('.pastilleTheme[data-theme=bordeaux]').click(); 'ok'" | Out-Null
  Start-Sleep -Seconds 2
  Write-Output "5) Jeu sous l'heure : $(Eval $O $etat)"
}
finally {
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
