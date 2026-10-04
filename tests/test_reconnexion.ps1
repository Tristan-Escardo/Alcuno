# Test réel de la reconnexion en ligne : Chrome sans interface piloté par le protocole DevTools.
# A crée, B rejoint, ils jouent, B se déconnecte, B' revient avec le code et le pseudo de B (en minuscules),
# puis on compare l'état du jeu de A et B' et on les laisse jouer encore.
$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeu = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/")
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9340
$profil = Join-Path $env:TEMP ("alcuno_cdp_" + [guid]::NewGuid().ToString("N"))

$chrome = Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--remote-debugging-port=$port", "--user-data-dir=$profil",
  "--allow-file-access-from-files", "--no-first-run", "about:blank")
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
  Attendre $onglet "document.getElementById('btnModeEnLigne') && window.firebaseDB" 30 | Out-Null
  Eval $onglet ("window.__alertes = []; window.alert = (m) => window.__alertes.push(String(m)); window.confirm = (m) => { window.__alertes.push('CONFIRM: ' + String(m).slice(0, 60)); return true; }; " + $auto + "; 'ok'") | Out-Null
}

$code = $null
try {
  # --- A crée la partie ---
  $A = Ouvrir $jeu; Preparer $A
  Eval $A "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnCreerPartie').click(); document.getElementById('pseudoCreateur').value='TestA'; document.getElementById('validerCreation').click(); 'ok'" | Out-Null
  Attendre $A "document.getElementById('codePartieAffiche').innerText.includes(':')" 30 | Out-Null
  $code = (Eval $A "document.getElementById('codePartieAffiche').innerText.split(': ')[1]").Trim()
  Write-Output "Partie de test créée : $code"

  # --- B rejoint, A lance ---
  $B = Ouvrir $jeu; Preparer $B
  Eval $B "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='TestB'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
  Attendre $A "document.getElementById('lancerPartieEnLigne').style.display !== 'none'" 30 | Out-Null
  Eval $A "document.getElementById('lancerPartieEnLigne').click(); 'ok'" | Out-Null
  $okA = Attendre $A "document.querySelectorAll('#plateau .Carte').length === 52" 30
  $okB = Attendre $B "document.querySelectorAll('#plateau .Carte').length === 52" 30
  Write-Output "Manche lancée : A=$okA B=$okB"

  # --- Les deux jouent jusqu'à ~12 cartes retournées ---
  Eval $A "__auto.start(); 'ok'" | Out-Null; Eval $B "__auto.start(); 'ok'" | Out-Null
  $ok = Attendre $A "document.querySelectorAll('#plateau .Carte.retournee').length >= 12" 240
  Eval $A "__auto.stop(); 'ok'" | Out-Null; Eval $B "__auto.stop(); 'ok'" | Out-Null
  Start-Sleep -Seconds 6
  $nbAvant = Eval $A "document.querySelectorAll('#plateau .Carte.retournee').length"
  Write-Output "Cartes retournées avant la déconnexion : $nbAvant (objectif atteint : $ok)"
  $etatB = Eval $B "__etat()"
  $etatA = Eval $A "__etat()"
  Write-Output ("A et B identiques avant déconnexion : " + ($etatA -eq $etatB))

  # --- B se déconnecte (onglet fermé) ---
  Fermer $B
  Write-Output "B déconnecté."

  # --- B' revient avec le code et le pseudo de B en minuscules ---
  $B2 = Ouvrir $jeu; Preparer $B2
  # MODE_TEST=autre : autre téléphone (mémoire effacée) ; sinon même téléphone (se souvient du pseudo)
  if ($env:MODE_TEST -eq 'autre') { Eval $B2 "localStorage.clear(); 'ok'" | Out-Null }
  # Reconnexion avec le CODE SEULEMENT (pseudo vide)
  Eval $B2 "document.getElementById('btnModeEnLigne').click(); 'ok'" | Out-Null
  Write-Output ("Bouton affiché à B' : " + (Eval $B2 "document.getElementById('btnRevenirPartie').innerText"))
  Eval $B2 "document.getElementById('btnRevenirPartie').click(); if (!document.getElementById('codeRevenir').value) document.getElementById('codeRevenir').value='$($code.ToLower())'; document.getElementById('validerRevenir').click(); 'ok'" | Out-Null
  if ($env:MODE_TEST -eq 'autre') {
    $vuChoix = Attendre $B2 "getComputedStyle(document.getElementById('ecranChoixPseudo')).display !== 'none'" 20
    $choixProposes = Eval $B2 "Array.from(document.querySelectorAll('#listeChoixPseudo button')).map(b => b.innerText).join(', ')"
    Write-Output "Écran « Qui es-tu ? » affiché : $vuChoix | choix proposés : $choixProposes"
    Eval $B2 "Array.from(document.querySelectorAll('#listeChoixPseudo button')).find(b => b.innerText.startsWith('TestB')).click(); 'ok'" | Out-Null
  }
  $vuRattrapage = Attendre $B2 "document.getElementById('ecranRattrapage') || document.querySelectorAll('#plateau .Carte.retournee').length > 0" 30
  $finRattrapage = Attendre $B2 "!document.getElementById('ecranRattrapage') && document.querySelectorAll('#plateau .Carte').length === 52" 90
  Start-Sleep -Seconds 4
  Write-Output ("Alertes B' : " + (Eval $B2 "JSON.stringify(window.__alertes)"))
  Write-Output ("Écrans B' : " + (Eval $B2 "['choixMode','enLigne','enLigneRejoindre','salleAttente','jeu'].map(i => i + '=' + getComputedStyle(document.getElementById(i)).display).join(' ')"))
  $pseudoB2 = Eval $B2 "(document.querySelector('#stickyJoueurActif .sticky-label')||{}).innerText + ' | badge: ' + (document.getElementById('badgeCodePartie')||{}).innerText"
  Write-Output "B' : rattrapage terminé=$finRattrapage | $pseudoB2"
  $etatA = Eval $A "__etat()"
  $etatB2 = Eval $B2 "__etat()"
  Write-Output ("A et B' IDENTIQUES après reconnexion : " + ($etatA -eq $etatB2))
  if ($etatA -ne $etatB2) { Write-Output "A : $etatA"; Write-Output "B': $etatB2" }

  # --- La partie continue : ils jouent encore ---
  Eval $A "__auto.start(); 'ok'" | Out-Null; Eval $B2 "__auto.start(); 'ok'" | Out-Null
  $cible = [int]$nbAvant + 8
  $ok2 = Attendre $A "document.querySelectorAll('#plateau .Carte.retournee').length >= $cible" 240
  Eval $A "__auto.stop(); 'ok'" | Out-Null; Eval $B2 "__auto.stop(); 'ok'" | Out-Null
  Start-Sleep -Seconds 6
  $nbApres = Eval $A "document.querySelectorAll('#plateau .Carte.retournee').length"
  $etatA = Eval $A "__etat()"; $etatB2 = Eval $B2 "__etat()"
  Write-Output "La partie a continué après la reconnexion : $ok2 ($nbAvant -> $nbApres cartes)"
  Write-Output ("A et B' toujours IDENTIQUES : " + ($etatA -eq $etatB2))
  $diag = "JSON.stringify({ overlays: Array.from(document.querySelectorAll('[id^=overlay]')).map(o => o.id + ':' + (o.innerText || '').replace(/\s+/g,' ').slice(0,80)), tour: (document.querySelector('#stickyJoueurActif') || {}).innerText, toast: (document.getElementById('toastEnLigne') || {}).innerText, rattrapage: !!document.getElementById('ecranRattrapage'), visible: document.visibilityState, net: window.__etatNet && window.__etatNet(), journal: (window.__journalNet || []).slice(-30) })"
  Write-Output ("Diagnostic A : " + (Eval $A $diag))
  Write-Output ("Diagnostic B': " + (Eval $B2 $diag))
  Write-Output ("Erreurs JS  A: " + (Eval $A "JSON.stringify(window.__erreurs)") + "  B': " + (Eval $B2 "JSON.stringify(window.__erreurs)"))
}
finally {
  if ($code) {
    Invoke-RestMethod -Method Delete -Uri "https://alcuno-default-rtdb.europe-west1.firebasedatabase.app/parties/$code.json" | Out-Null
    Write-Output "Partie de test $code supprimée de Firebase."
  }
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}





