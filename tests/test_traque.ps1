# Test réel : un joueur retiré en pleine partie revient (même téléphone via « Revenir », puis autre
# téléphone via « Rejoindre » avec son pseudo en minuscules). A, B, C : 3 onglets Chrome, vrai Firebase.
$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeu = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/")
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9354
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
  Attendre $onglet "document.getElementById('btnModeEnLigne') && window.firebaseDB && document.getElementById('versionJeu').innerText && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Eval $onglet ("window.__console = []; ['log', 'warn', 'error'].forEach((t) => { const f = console[t].bind(console); console[t] = (...a) => { const s = a.map(x => (x && x.stack) ? x.stack : String(x)).join(' '); if (/FIREBASE|rror/.test(s)) window.__console.push(t + ': ' + s.slice(0, 400)); f(...a); }; }); window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toastEnLigne'); if (t && t.innerText && window.__toasts[window.__toasts.length - 1] !== t.innerText) window.__toasts.push(t.innerText); }).observe(document.documentElement, { subtree: true, childList: true, characterData: true }); window.__alertes = []; window.alert = (m) => window.__alertes.push(String(m)); window.confirm = (m) => { window.__alertes.push('CONFIRM: ' + String(m).slice(0, 70)); return true; }; " + $auto + "; 'ok'") | Out-Null
}
$retournees = "document.querySelectorAll('#plateau .Carte.retournee').length"
$calme = "!document.querySelector('[id^=overlay]') && !document.getElementById('ecranRattrapage')"
# Tous jouent jusqu'à $n cartes retournées, puis s'arrêtent plateau au repos
function Jouer($onglets, [int]$n) {
  foreach ($o in $onglets) { Eval $o "__auto.start(); 'ok'" | Out-Null }
  $ok = Attendre $onglets[0] "$retournees >= $n" 200
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
function Retirer($onglet, [string]$nom) {
  return Eval $onglet "document.getElementById('supprimerJoueur').click(); const b = Array.from(document.querySelectorAll('#listeSuppression button')).find(x => x.innerText.startsWith('$nom')); if (b) { b.click(); document.getElementById('btnConfirmerRetraitOui').click(); 'retrait demandé' } else ('pas de bouton, toast: ' + (document.getElementById('toastEnLigne')||{}).innerText)"
}

$fb = "https://alcuno-default-rtdb.europe-west1.firebasedatabase.app/parties"
$etatFile = "JSON.stringify({ file: window.__etatFileAlcuno && window.__etatFileAlcuno(), tour: ((document.querySelector('#stickyJoueurActif') || {}).innerText || '').replace(/\s+/g, ' '), overlays: Array.from(document.querySelectorAll('[id^=overlay]')).map(o => o.id), visible: document.visibilityState, toasts: window.__toasts, console: window.__console, erreurs: window.__erreurs })"
foreach ($essai in 1..6) {
  $code = $null
  try {
    $A = Ouvrir $jeu; Preparer $A
    Eval $A "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnCreerPartie').click(); document.getElementById('pseudoCreateur').value='TestA'; document.getElementById('validerCreation').click(); 'ok'" | Out-Null
    Attendre $A "document.getElementById('codePartieAffiche').innerText.includes(':')" 30 | Out-Null
    $texteCode = Eval $A "document.getElementById('codePartieAffiche').innerText"
    if (-not ($texteCode -match ': ')) {
      Write-Output "Essai $essai : partie pas créée à temps | bouton : $(Eval $A "document.getElementById('validerCreation').innerText") | alertes : $(Eval $A 'JSON.stringify(window.__alertes)') | console : $(Eval $A 'JSON.stringify(window.__console)') | firebase chargé : $(Eval $A '!!window.firebaseDB')"
      continue
    }
    $code = $texteCode.Split(': ')[-1].Trim()
    $B = Ouvrir $jeu; Preparer $B
    Eval $B "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='TestB'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
    Attendre $A "document.getElementById('listeJoueursEnLigne').innerText.includes('TestB')" 30 | Out-Null
    $C = Ouvrir $jeu; Preparer $C
    Eval $C "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='TestC'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
    Attendre $A "document.getElementById('listeJoueursEnLigne').innerText.includes('TestC')" 30 | Out-Null
    Eval $A "document.getElementById('lancerPartieEnLigne').click(); 'ok'" | Out-Null
    @($A, $B, $C) | ForEach-Object { Attendre $_ "document.querySelectorAll('#plateau .Carte').length === 52" 30 | Out-Null }
    $ok = Jouer @($A, $B, $C) 30
    $etats = @($A, $B, $C | ForEach-Object { Eval $_ "__etat()" })
    $identiques = ($etats | Select-Object -Unique).Count -eq 1
    Write-Output "Essai $essai (partie $code) : 30 cartes atteintes = $ok | identiques = $identiques | cartes A=$(Eval $A $retournees) B=$(Eval $B $retournees) C=$(Eval $C $retournees)"
    if (-not $ok -or -not $identiques) {
      Write-Output "===== PROBLÈME REPRODUIT ====="
      foreach ($p in @(@{ n = "A"; o = $A }, @{ n = "B"; o = $B }, @{ n = "C"; o = $C })) {
        Write-Output "----- $($p.n) -----"
        $e = Eval $p.o $etatFile | ConvertFrom-Json
        Write-Output "tour : $($e.tour) | overlays : $($e.overlays -join ',') | visible : $($e.visible) | prochainSeq : $($e.file.prochainSeq) | en attente : $($e.file.traitementEnCours) | file : $($e.file.actions -join ',') | trou : $($e.file.trouEnAttente)"
        Write-Output "toasts : $($e.toasts -join ' / ')"
        Write-Output "console : $($e.console -join ' / ')"
        Write-Output "journal (fin) :"
        $e.file.journal | Select-Object -Last 60 | ForEach-Object { Write-Output "   $_" }
      }
      $serveur = Invoke-RestMethod -Uri "$fb/$code/manches.json"
      Write-Output "----- SERVEUR -----"
      $serveur | ConvertTo-Json -Depth 6 -Compress | ForEach-Object { $_.Substring([Math]::Max(0, $_.Length - 2500)) }
      break
    }
  }
  finally {
    if ($code) { Invoke-RestMethod -Method Delete -Uri "$fb/$code.json" | Out-Null }
    foreach ($o in @($A, $B, $C)) { if ($o) { try { Fermer $o } catch {} } }
  }
}
Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
