param([string]$url = "", [string]$label = "local")
$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $url) { $url = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/") }
$jeu = $url
$auto = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "auto_en_ligne.js")
$port = 9352
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
  foreach ($n in @("B")) {
    $o = Ouvrir $jeu; Preparer $o
    Eval $o "document.getElementById('btnModeEnLigne').click(); document.getElementById('btnRejoindrePartie').click(); document.getElementById('codeRejoindre').value='$code'; document.getElementById('pseudoRejoindre').value='Test$n'; document.getElementById('validerRejoindre').click(); 'ok'" | Out-Null
    Attendre $A "document.getElementById('listeJoueursEnLigne').innerText.includes('Test$n')" 30 | Out-Null
    Set-Variable -Name $n -Value $o
  }
  Eval $A "document.getElementById('lancerPartieEnLigne').click(); 'ok'" | Out-Null
  @($A, $B) | ForEach-Object { Attendre $_ "document.querySelectorAll('#plateau .Carte').length === 52" 30 | Out-Null }
  Write-Output "[$label] partie $code | jeu : $(Jouer @($A, $B) 6)"
  Comparer "[$label] Avant le refus" @($A, $B)

  # La prochaine action de B sera refusée par le serveur (champ interdit par les règles)
  $piege = @'
window.__toasts = [];
new MutationObserver(() => { const t = document.getElementById('toastEnLigne'); if (t && t.innerText && window.__toasts[window.__toasts.length - 1] !== t.innerText) window.__toasts.push(t.innerText); }).observe(document.body, { subtree: true, childList: true, characterData: true });
window.__refus = 'pas encore';
window.__console = [];
['log', 'warn', 'error'].forEach((t) => { const f = console[t].bind(console); console[t] = (...a) => { const s = a.map(x => (x && x.stack) ? x.stack : String(x)).join(' '); if (/FIREBASE|Error|rror/.test(s)) window.__console.push(t + ': ' + s.slice(0, 600)); f(...a); }; });
const vrai = window.fbUpdate;
window.fbUpdate = function (ref, valeurs) {
  const k = Object.keys(valeurs).find(c => c.includes('/actions/'));
  if (!k) return vrai(ref, valeurs);
  window.fbUpdate = vrai;
  window.__refus = 'action ' + valeurs[k].id + ' envoyée avec un champ interdit';
  const v = Object.assign({}, valeurs, { [k]: Object.assign({}, valeurs[k], { pirate: 1 }) });
  return vrai(ref, v).then(() => { window.__refus += ' => ACCEPTÉE ?!'; }, (e) => { window.__refus += ' => refusée par le serveur'; throw e; });
};
'ok'
'@
  Eval $B $piege | Out-Null
  Write-Output "[$label] jeu : $(Jouer @($A, $B) 14)"
  Write-Output "[$label] B : $(Eval $B 'window.__refus') | messages de B : $(Eval $B 'JSON.stringify(window.__toasts)')"
  Comparer "[$label] Après le refus" @($A, $B)
  $diag = "JSON.stringify({ rattrapage: (document.getElementById('ecranRattrapage') || {}).innerText || 'non', visible: document.visibilityState, file: window.__etatFileAlcuno && window.__etatFileAlcuno(), tour: (document.querySelector('#stickyJoueurActif') || {}).innerText, overlays: Array.from(document.querySelectorAll('[id^=overlay]')).map(o => o.id + ':' + (o.innerText || '').replace(/\s+/g, ' ').slice(0, 60)), cartesDispo: document.querySelectorAll('#plateau .Carte:not(.retournee)').length, envoye: Array.from(document.querySelectorAll('[data-net-envoye]')).map(e => e.dataset.netId), utilise: Array.from(document.querySelectorAll('[data-net-utilise]')).map(e => e.dataset.netId) })"
  Write-Output "[$label] diag A : $(Eval $A $diag)"
  Write-Output "[$label] diag B : $(Eval $B $diag)"
  Write-Output "[$label] console B : $(Eval $B 'JSON.stringify(window.__console)')"
  Write-Output "[$label] erreurs JS : A $(Eval $A 'JSON.stringify(window.__erreurs)') B $(Eval $B 'JSON.stringify(window.__erreurs)')"
}
finally {
  if ($code) { Invoke-RestMethod -Method Delete -Uri "https://alcuno-default-rtdb.europe-west1.firebasedatabase.app/parties/$code.json" | Out-Null }
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
