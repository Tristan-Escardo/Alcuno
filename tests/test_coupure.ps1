$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeu = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/")
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9370
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
function Preparer($onglet) {
  Attendre $onglet "document.getElementById('btnModeEnLigne') && window.firebaseDB && document.getElementById('versionJeu').innerText" 30 | Out-Null
  Eval $onglet ("window.__alertes = []; window.alert = (m) => window.__alertes.push(String(m)); window.confirm = (m) => { window.__alertes.push('CONFIRM: ' + String(m).slice(0, 70)); return true; }; " + $auto + "; 'ok'") | Out-Null
}
$retournees = "document.querySelectorAll('#plateau .Carte.retournee').length"
$calme = "!document.querySelector('[id^=overlay]') && !document.getElementById('ecranRattrapage')"
# Tous jouent jusqu'à $n cartes retournées, puis s'arrêtent plateau au repos
function Jouer($onglets, [int]$n) {
  foreach ($o in $onglets) { Eval $o "__auto.start(); 'ok'" | Out-Null }
  $ok = Attendre $onglets[0] "$retournees >= $n" 240
  Attendre $onglets[0] $calme 30 | Out-Null
  foreach ($o in $onglets) { Eval $o "__auto.stop(); 'ok'" | Out-Null }
  Start-Sleep -Seconds 6
  # Un overlay a pu s'ouvrir juste avant l'arrêt : on le termine
  for ($i = 0; $i -lt 5 -and -not (Eval $onglets[0] $calme); $i++) {
    foreach ($o in $onglets) { Eval $o "__auto.start(); 'ok'" | Out-Null }
    Attendre $onglets[0] $calme 30 | Out-Null
    foreach ($o in $onglets) { Eval $o "__auto.stop(); 'ok'" | Out-Null }
    Start-Sleep -Seconds 5
  }
  return $ok
}
function Comparer($titre, $onglets) {
  $etats = @($onglets | ForEach-Object { Eval $_ "__etat()" })
  $identiques = ($etats | Select-Object -Unique).Count -eq 1
  Write-Output "$titre : IDENTIQUES=$identiques | joueurs: $(Eval $onglets[0] "document.getElementById('listeJoueurs').innerText.replace(/\s+/g,' ')") | cartes: $(Eval $onglets[0] $retournees)"
  if (-not $identiques) { $etats | ForEach-Object { Write-Output "   $_" } }
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
function Reseau($onglet, [bool]$coupe) {
  Cdp $onglet "Network.emulateNetworkConditions" @{ offline = $coupe; latency = 0; downloadThroughput = -1; uploadThroughput = -1 } | Out-Null
}
$etatC = "JSON.stringify({ logo: !!document.getElementById('coupureReseau'), enLigne: navigator.onLine, toast: (document.getElementById('toastEnLigne')||{}).innerText })"

$code = $null
try {
  $A = Ouvrir $jeu; Preparer $A
  Eval $A "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnCreerPartie').click(); document.getElementById('pseudoCreateur').value='TestA'; document.getElementById('validerCreation').click(); 'ok'" | Out-Null
  Attendre $A "document.getElementById('codePartieAffiche').innerText.includes(':')" 30 | Out-Null
  $code = (Eval $A "document.getElementById('codePartieAffiche').innerText.split(': ')[1]").Trim()
  Write-Output "Partie de test créée : $code"
  foreach ($n in @("B", "C")) {
    $o = Ouvrir $jeu; Preparer $o
    Eval $o "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='Test$n'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
    Attendre $A "document.getElementById('listeJoueursEnLigne').innerText.includes('Test$n')" 30 | Out-Null
    Set-Variable -Name $n -Value $o
  }
  Eval $A "document.getElementById('lancerPartieEnLigne').click(); 'ok'" | Out-Null
  $ok = @($A, $B, $C | ForEach-Object { Attendre $_ "document.querySelectorAll('#plateau .Carte').length === 52" 30 })
  Write-Output "Manche lancée : $ok"
  Write-Output ("Jeu : " + (Jouer @($A, $B, $C) 8))
  Comparer "Avant la coupure" @($A, $B, $C)
  Cdp $C "Network.enable" @{} | Out-Null

  # --- Coupure du réseau de C pendant que tout le monde joue ---
  foreach ($o in @($A, $B, $C)) { Eval $o "__auto.start(); 'ok'" | Out-Null }
  Start-Sleep -Seconds 2
  Reseau $C $true
  Write-Output "=== Réseau de C COUPÉ (les 3 continuent de jouer automatiquement) ==="
  Start-Sleep -Seconds 1
  Write-Output "C après 1 s : $(Eval $C $etatC)"
  $bloque = "JSON.stringify([[0.5,0.5],[0.05,0.05],[0.95,0.95],[0.05,0.95],[0.5,0.1]].map(([x,y]) => (document.elementFromPoint(innerWidth*x, innerHeight*y)||{}).id === 'coupureReseau'))"
  Write-Output "Taps bloqués partout après 1 s (avant le logo) : $(Eval $C $bloque)"
  $logo = Attendre $C "document.getElementById('coupureReseau')" 10
  Write-Output "Logo affiché chez C : $logo | $(Eval $C $etatC) | logo chez A : $(Eval $A "!!document.getElementById('coupureReseau')")"
  Write-Output "Taps bloqués partout avec le logo : $(Eval $C $bloque)"
  $cle = Eval $C "(() => { const r = document.getElementById('btnCodePartie').getBoundingClientRect(); return JSON.stringify([r.x + r.width/2, r.y + r.height/2]); })()" | ConvertFrom-Json
  foreach ($t in @("mousePressed", "mouseReleased")) { Cdp $C "Input.dispatchMouseEvent" @{ type = $t; x = $cle[0]; y = $cle[1]; button = "left"; clickCount = 1 } | Out-Null }
  Write-Output "Vrai clic sur le bouton 🔑 pendant la coupure => ouvert : $(Eval $C "document.getElementById('btnCodePartie').classList.contains('ouvert')") (attendu : False)"
  $capture = Cdp $C "Page.captureScreenshot" @{ format = "png" }
  [IO.File]::WriteAllBytes((Join-Path $banc "coupure_logo.png"), [Convert]::FromBase64String($capture.data))
  Start-Sleep -Seconds 22
  Write-Output "Cartes pendant la coupure : A=$(Eval $A $retournees) C=$(Eval $C $retournees) | A voit : $(Eval $A "document.getElementById('listeJoueurs').innerText.replace(/\s+/g,' ')") | tour chez A : $(Eval $A "(document.querySelector('#stickyJoueurActif')||{}).innerText")"

  # --- Retour du réseau ---
  Reseau $C $false
  Write-Output "=== Réseau de C RÉTABLI ==="
  $parti = Attendre $C "!document.getElementById('coupureReseau')" 30
  Write-Output "Logo retiré chez C : $parti | $(Eval $C $etatC)"
  foreach ($t in @("mousePressed", "mouseReleased")) { Cdp $C "Input.dispatchMouseEvent" @{ type = $t; x = $cle[0]; y = $cle[1]; button = "left"; clickCount = 1 } | Out-Null }
  Write-Output "Témoin : même vrai clic sur 🔑 après le retour du réseau => ouvert : $(Eval $C "document.getElementById('btnCodePartie').classList.contains('ouvert')") (attendu : True)"
  Start-Sleep -Seconds 3
  $cible = [int](Eval $A $retournees) + 8
  Write-Output ("Jeu après la coupure : " + (Jouer @($A, $B, $C) $cible))
  Comparer "Après la coupure" @($A, $B, $C)
  Write-Output ("Erreurs JS  A: " + (Eval $A "JSON.stringify(window.__erreurs)") + "  B: " + (Eval $B "JSON.stringify(window.__erreurs)") + "  C: " + (Eval $C "JSON.stringify(window.__erreurs)"))
}
finally {
  if ($code) {
    Invoke-RestMethod -Method Delete -Uri "https://alcuno-default-rtdb.europe-west1.firebasedatabase.app/parties/$code.json" | Out-Null
    Write-Output "Partie de test $code supprimée de Firebase."
  }
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
