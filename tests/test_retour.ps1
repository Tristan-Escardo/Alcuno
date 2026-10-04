# Test réel : un joueur retiré en pleine partie revient (même téléphone via « Revenir », puis autre
# téléphone via « Rejoindre » avec son pseudo en minuscules). A, B, C : 3 onglets Chrome, vrai Firebase.
$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeu = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/")
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9350
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
function Retirer($onglet, [string]$nom) {
  return Eval $onglet "document.getElementById('supprimerJoueur').click(); const b = Array.from(document.querySelectorAll('#listeSuppression button')).find(x => x.innerText.startsWith('$nom')); if (b) { b.click(); document.getElementById('btnConfirmerRetraitOui').click(); 'retrait demandé' } else ('pas de bouton, toast: ' + (document.getElementById('toastEnLigne')||{}).innerText)"
}

$code = $null
try {
  $A = Ouvrir $jeu; Preparer $A
  Eval $A "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnCreerPartie').click(); document.getElementById('pseudoCreateur').value='TestA'; document.getElementById('validerCreation').click(); 'ok'" | Out-Null
  Attendre $A "document.getElementById('codePartieAffiche').innerText.includes(':')" 30 | Out-Null
  $code = (Eval $A "document.getElementById('codePartieAffiche').innerText.split(': ')[1]").Trim()
  Write-Output "Partie de test créée : $code"

  $B = Ouvrir $jeu; Preparer $B
  Eval $B "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='TestB'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
  Attendre $A "document.getElementById('listeJoueursEnLigne').innerText.includes('TestB')" 30 | Out-Null
  $C = Ouvrir $jeu; Preparer $C
  Eval $C "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='TestC'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
  Attendre $A "document.getElementById('listeJoueursEnLigne').innerText.includes('TestC')" 30 | Out-Null
  Eval $A "document.getElementById('lancerPartieEnLigne').click(); 'ok'" | Out-Null
  $ok = @($A, $B, $C | ForEach-Object { Attendre $_ "document.querySelectorAll('#plateau .Carte').length === 52" 30 })
  Write-Output "Manche lancée : $ok"

  Write-Output ("Jeu : " + (Jouer @($A, $B, $C) 8))
  Comparer "Avant le retrait" @($A, $B, $C)

  # --- 1) A retire C ---
  Write-Output ("A retire TestC : " + (Retirer $A "TestC"))
  $vuAlerte = Attendre $C "window.__alertes.some(a => a.includes('retiré'))" 20
  Start-Sleep -Seconds 3
  Write-Output "C a reçu l'alerte : $vuAlerte | mémoire C : $(Eval $C "localStorage.getItem('alcuno_partie_en_ligne')") | bouton Revenir : $(Eval $C "getComputedStyle(document.getElementById('btnRevenirPartie')).display")"
  Write-Output "Fiche Firebase de TestC : $(Invoke-RestMethod -Uri "https://alcuno-default-rtdb.europe-west1.firebasedatabase.app/parties/$code/joueurs/TestC.json" | ConvertTo-Json -Compress)"
  Comparer "Après le retrait (A, B)" @($A, $B)

  Write-Output ("Jeu A+B : " + (Jouer @($A, $B) 13))

  # --- 2) C revient avec « Revenir » (même téléphone) ---
  Eval $C "window.__alertes = []; document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRevenirPartie').click(); document.getElementById('validerRevenir').click(); 'ok'" | Out-Null
  $revenu = Attendre $A "document.getElementById('listeJoueurs').innerText.includes('TestC')" 60
  Start-Sleep -Seconds 4
  Write-Output "C remis dans la partie (vu par A) : $revenu | alertes C : $(Eval $C "JSON.stringify(window.__alertes)") | toast C : $(Eval $C "(document.getElementById('toastEnLigne')||{}).innerText") | toast B : $(Eval $B "(document.getElementById('toastEnLigne')||{}).innerText")"
  Comparer "Après le retour de C" @($A, $B, $C)

  Write-Output ("Jeu A+B+C : " + (Jouer @($A, $B, $C) 20))
  Comparer "La partie continue à 3" @($A, $B, $C)

  # --- 3) B retire C à nouveau ; C revient depuis un AUTRE téléphone avec « Rejoindre » + pseudo en minuscules ---
  Write-Output ("B retire TestC : " + (Retirer $B "TestC"))
  Attendre $C "window.__alertes.some(a => a.includes('retiré'))" 20 | Out-Null
  Fermer $C
  Start-Sleep -Seconds 3
  Comparer "Après le 2e retrait (A, B)" @($A, $B)
  $D = Ouvrir $jeu; Preparer $D
  Eval $D "localStorage.clear(); document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='testc'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
  $revenu = Attendre $A "document.getElementById('listeJoueurs').innerText.includes('TestC')" 60
  Start-Sleep -Seconds 4
  Write-Output "C revenu depuis un autre téléphone : $revenu | alertes D : $(Eval $D "JSON.stringify(window.__alertes)")"
  Comparer "Après le 2e retour" @($A, $B, $D)

  Write-Output ("Jeu A+B+D : " + (Jouer @($A, $B, $D) 28))
  Comparer "Fin du test" @($A, $B, $D)
  Write-Output ("Erreurs JS  A: " + (Eval $A "JSON.stringify(window.__erreurs)") + "  B: " + (Eval $B "JSON.stringify(window.__erreurs)") + "  D: " + (Eval $D "JSON.stringify(window.__erreurs)"))
}
finally {
  if ($code) {
    Invoke-RestMethod -Method Delete -Uri "https://alcuno-default-rtdb.europe-west1.firebasedatabase.app/parties/$code.json" | Out-Null
    Write-Output "Partie de test $code supprimée de Firebase."
  }
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
