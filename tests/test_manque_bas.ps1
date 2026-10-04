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
$partie = "const pd = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('btnModeClassique').click(); for (const n of ['Tristan', 'Ylana', 'Célien']) { document.getElementById('nomJoueur').value = n; pd(document.getElementById('ajouterJoueur')); } pd(document.getElementById('jouer')); document.activeElement && document.activeElement.blur(); 'ok'"
function Iphone($onglet, [int]$hauteurFenetre) {
  Cdp $onglet "Emulation.setDeviceMetricsOverride" @{ width = 393; height = $hauteurFenetre; deviceScaleFactor = 1; mobile = $true; screenWidth = 393; screenHeight = 852 } | Out-Null
}
$rect = "(sel) => { const e = document.querySelector(sel); if (!e) return sel + ' absent'; const r = e.getBoundingClientRect(); return sel + ' ' + Math.round(r.top) + '→' + Math.round(r.bottom); }"
$accueil = "(() => { const b = document.getElementById('btnAccueilEnLigne'); return getComputedStyle(b).display === 'none' ? 'caché' : 'visible'; })()"
try {
  $O = Ouvrir $jeu; Telephone $O
  Attendre $O "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Cdp $O "Page.enable" @{} | Out-Null
  Cdp $O "Emulation.setUserAgentOverride" @{ userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" } | Out-Null
  Cdp $O "Page.addScriptToEvaluateOnNewDocument" @{ source = "Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }); window.__err = []; addEventListener('error', (e) => window.__err.push(e.message));" } | Out-Null
  Iphone $O 793
  Eval $O "localStorage.clear(); localStorage.setItem('alcuno_theme', 'violet'); location.reload(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3
  Attendre $O "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Eval $O "window.__rect = $rect; 'ok'" | Out-Null
  Write-Output "Fenêtre 793 / écran 852 : classe manque-bas = $(Eval $O "document.documentElement.classList.contains('manque-bas')") | --manque-bas = $(Eval $O "document.documentElement.style.getPropertyValue('--manque-bas')")"
  Write-Output "Diagnostic : $(Eval $O "(() => { let t = ''; const n = navigator.clipboard; return 'ok'; })()")"
  Eval $O "document.getElementById('btnReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 700
  Eval $O "window.__copie = null; navigator.clipboard.writeText = (t) => { window.__copie = t; return Promise.resolve(); }; document.getElementById('btnDiagnostic').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 500
  Write-Output "   $(Eval $O "(window.__copie || '').split(String.fromCharCode(10)).filter(l => l.indexOf('cran : ') === 1).join('')")"
  Eval $O "document.getElementById('btnFermerReglages').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('btnFermerReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  Write-Output "   $(Eval $O "__rect('#choixMode')") | décor du fond : bottom = $(Eval $O "getComputedStyle(document.body, '::before').bottom")"
  Eval $O "document.getElementById('btnReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 900
  Eval $O "const r = document.getElementById('ecranReglages'); r.scrollTop = r.scrollHeight; 'ok'" | Out-Null
  Start-Sleep -Milliseconds 300
  Write-Output "   $(Eval $O "__rect('#ecranReglages')") | dernier élément : $(Eval $O "__rect('#ecranReglages .aPropos')")"
  Eval $O "document.getElementById('btnFermerReglages').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.getElementById('btnFermerReglages').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  # En ligne : bouton ⌂ selon la page
  Eval $O "document.getElementById('btnModeEnLigne').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 800
  Write-Output "   $(Eval $O "__rect('#enLigne')")"
  Write-Output "⌂ sur le choix Créer/Rejoindre : $(Eval $O $accueil)"
  Eval $O "document.getElementById('btnCreerPartie').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 600
  Write-Output "⌂ sur Créer : $(Eval $O $accueil)"
  Eval $O "document.getElementById('btnRetourCreer').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 600
  Eval $O "document.getElementById('btnRejoindrePartie').click(); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 600
  Write-Output "⌂ sur Rejoindre : $(Eval $O $accueil)"
  Eval $O "document.getElementById('btnRetourRejoindre').click(); document.getElementById('enLigneChoix').style.display = 'none'; document.getElementById('enLigneRevenir').style.display = ''; 'ok'" | Out-Null
  Start-Sleep -Milliseconds 300
  Write-Output "⌂ sur Revenir : $(Eval $O $accueil)"
  Eval $O "document.getElementById('enLigneRevenir').style.display = 'none'; document.getElementById('salleAttente').style.display = ''; 'ok'" | Out-Null
  Start-Sleep -Milliseconds 300
  Write-Output "⌂ en salle d'attente : $(Eval $O $accueil)"
  Eval $O "location.reload(); 'ok'" | Out-Null
  Start-Sleep -Seconds 3
  Attendre $O "document.getElementById('versionJeu') && document.getElementById('versionJeu').innerText && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Eval $O "window.__rect = $rect; 'ok'" | Out-Null
  # Partie + overlay avec la fenêtre courte
  Eval $O $partie | Out-Null
  Start-Sleep -Seconds 1
  Eval $O ($autoClassique + "; 'ok'") | Out-Null
  $ouvert = "document.documentElement.classList.contains('overlay-ouvert') && Array.from(document.querySelectorAll('[id^=overlay]')).some(o => getComputedStyle(o).display !== 'none' && getComputedStyle(o).opacity === '1')"
  $vu = $false
  for ($i = 0; $i -lt 10 -and -not $vu; $i++) {
    Eval $O "__auto.start(); 'ok'" | Out-Null
    Attendre $O $ouvert 120 | Out-Null
    Eval $O "__auto.stop(); 'ok'" | Out-Null
    Start-Sleep -Milliseconds 800
    $vu = Eval $O $ouvert
  }
  Write-Output "Overlay ($vu) : $(Eval $O "(() => { const o = Array.from(document.querySelectorAll('[id^=overlay]')).filter(o => getComputedStyle(o).display !== 'none').pop(); return __rect('#' + o.id); })()") | $(Eval $O "__rect('#voileOverlays')")"
  # Sans décalage : rien ne change
  Iphone $O 852
  Eval $O "window.dispatchEvent(new Event('resize')); 'ok'" | Out-Null
  Start-Sleep -Milliseconds 500
  Write-Output "Fenêtre 852 / écran 852 : classe manque-bas = $(Eval $O "document.documentElement.classList.contains('manque-bas')")"
  Write-Output "Erreurs JS : $(Eval $O "JSON.stringify(window.__err)")"
}
finally {
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
