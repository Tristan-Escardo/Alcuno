# Rien ne déborde (voir README.txt) : sur chaque écran et chaque overlay, en téléphone portrait (390 x 844),
# téléphone en paysage (844 x 390) et fenêtre de PC basse (1280 x 645), vérifie que rien n'est coupé en haut
# sans pouvoir défiler, que rien ne dépasse sur le côté et qu'aucun bouton n'est écrasé à 0 px.
# Usage, depuis le dossier tests :  powershell -File test_debordement.ps1   (-formats paysage : un seul format)
param([string[]]$formats = @("portrait", "paysage", "pc"), [string]$theme = "bordeaux")
$formats = $formats -split ","
$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeu = "file:///" + ((Resolve-Path (Join-Path $banc "..\index.html")).Path -replace "\\", "/")
$port = 9439
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
function Capturer($onglet, [string]$nom) {
  $c = Cdp $onglet "Page.captureScreenshot" @{ format = "png" }
  [IO.File]::WriteAllBytes((Join-Path $banc "acc\$nom.png"), [Convert]::FromBase64String($c.data))
}
$tailles = @{ portrait = @(390, 844, $true); paysage = @(844, 390, $true); pc = @(1280, 645, $false) }
function Format($onglet, [string]$f) {
  $t = $tailles[$f]
  Cdp $onglet "Emulation.setDeviceMetricsOverride" @{ width = $t[0]; height = $t[1]; deviceScaleFactor = 1; mobile = $t[2] } | Out-Null
}
$verif = Get-Content -Raw -Encoding UTF8 (Join-Path $banc "debordement.js")
$resultats = New-Object System.Collections.Generic.List[string]
function Verifier($O, [string]$f, [string]$ecran) {
  Eval $O $verif | Out-Null
  $r = Eval $O "JSON.stringify(verifierDebordement())"
  if ($r -like "EXCEPTION*") { $resultats.Add("$f | $ecran | ERREUR DU TEST $r"); return }
  foreach ($x in ($r | ConvertFrom-Json)) { $resultats.Add("$f | $ecran | $x") }
}
function Recharger($O) {
  Eval $O "location.reload(); 'ok'" | Out-Null; Start-Sleep -Milliseconds 1200
  Attendre $O "document.readyState === 'complete' && !document.documentElement.classList.contains('chargement')" 30 | Out-Null
  Start-Sleep -Milliseconds 300
}
function LancerPartie($O) {
  Eval $O "document.getElementById('btnModeClassique').click(); 'ok'" | Out-Null; Start-Sleep -Milliseconds 700
  Eval $O "(async () => { for (const n of ['Tristan','Ylana','Celien','Roseanna']) { document.getElementById('nomJoueur').value = n; document.getElementById('ajouterJoueur').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); await new Promise(r => setTimeout(r, 150)); } document.getElementById('jouer').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); return 'ok'; })()" | Out-Null
  Start-Sleep -Milliseconds 1500
}
# Montre seulement ces écrans (les autres cachés) : pour tester les écrans rarement affichés
$montrer = "(ids) => { document.querySelectorAll('body > section, body > div, main > section, main > div, #enLigne > div').forEach(e => { e.style.display = 'none'; }); ids.forEach(id => { const e = document.getElementById(id); e.style.display = ''; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) p.style.display = ''; }); }"
$overlays = [ordered]@{
  "regle"         = "montrerOverlayRegle('Tristan boit 3 gorgées\nEt un détail en dessous', 'trois_rouge')"
  "celien"        = "montrerOverlayRegle('Ylana boit 2 gorgées', 'deux_bleu'); habillerOverlayCelien('Ylana boit 2 gorgées', 'Une citation de Célien', 'Célien')"
  "couleur"       = "afficherOverlayCouleur(0)"
  "doree annonce" = "montrerOverlayRegle('CARTE DORÉE\nDistribue un CUL SEC', 'carte_doree'); habillerOverlayCarteDoree('Distribue un CUL SEC de la part du développeur')"
  "doree choix"   = "afficherOverlayCarteDoree(0)"
  "tiens"         = "afficherOverlayTiensGueule(1)"
  "duel"          = "lancerOverlayChoixDuel(0, '')"
  "duel tirage"   = "lancerOverlayChoixDuel(0, ''); const tap = (k) => { const b = document.querySelectorAll('#overlayDuel .duel-boutons .bouton-pigeon')[k]; b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); b.click(); }; setTimeout(() => tap(0), 300); setTimeout(() => tap(1), 700)"
  "plus4"         = "afficherOverlayPlus4(0, 'plus_4')"
  "pigeon"        = "afficherMenuPigeon()"
  "annulation"    = "annulations[joueurs[1]] = 2; afficherOverlayAnnulation(1, 3)"
  "resultat"      = "afficherOverlayResultatAnnulation('Ylana annule ses 3 gorgées')"
  "pari de fin"   = "cartesRestantes = () => 1; lancerOverlayPrediction(0)"
  "fin"           = "afficherOverlayFinUnRestants()"
}
try {
  $O = Ouvrir $jeu; Format $O $formats[0]
  Attendre $O "!document.documentElement.classList.contains('chargement')" 30 | Out-Null
  foreach ($f in $formats) {
    Write-Output "Format $f..."
    Format $O $f
    $th = $f
    Eval $O "localStorage.clear(); localStorage.setItem('alcuno_theme', '$theme'); localStorage.setItem('alcuno_theme_prestige', '1'); 'ok'" | Out-Null
    Recharger $O
    Verifier $O $th "accueil"
    Eval $O "document.getElementById('btnReglages').click(); document.getElementById('lignePartieMemoire').style.display=''; document.getElementById('textePartieMemoire').innerText='Partie de test'; 'ok'" | Out-Null
    Start-Sleep -Milliseconds 700
    Verifier $O $th "réglages"
    Eval $O "fermerPage(document.getElementById('ecranReglages')); 'ok'" | Out-Null; Start-Sleep -Milliseconds 500
    foreach ($id in @("enLigneChoix", "enLigneCreer", "enLigneRejoindre", "enLigneRevenir", "salleAttente")) {
      Eval $O "($montrer)(['enLigne', '$id']); document.getElementById('codePartieAffiche').innerText = 'Code : ABCD'; document.getElementById('infoModeSoft').style.display=''; document.getElementById('listeJoueursEnLigne').innerHTML = '<div>Tristan<button class=btnExclure>X</button></div><div>Ylana</div>'; document.getElementById('lancerPartieEnLigne').style.display=''; 'ok'" | Out-Null
      Start-Sleep -Milliseconds 700  # fin de l'animation d'apparition
      Verifier $O $th $id
    }
    foreach ($id in @("ecranNouvellePartie", "ecranChoixPseudo", "ecranConfirmerAccueil", "ecranConfirmerHote", "ecranConfirmerRetrait")) {
      Eval $O "($montrer)(['$id']); document.querySelectorAll('#$id .texteConfirmation, #$id h2').forEach(e => { if (!e.innerText) e.innerText = 'Texte de test'; }); 'ok'" | Out-Null
      Start-Sleep -Milliseconds 700  # fin de l'animation d'apparition
      Verifier $O $th $id
    }
    Recharger $O
    LancerPartie $O
    Verifier $O $th "plateau"
    Eval $O "document.getElementById('supprimerJoueur').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); document.getElementById('supprimerJoueur').click(); 'ok'" | Out-Null
    Start-Sleep -Milliseconds 700
    Verifier $O $th "retirer un joueur"
    Recharger $O
    Eval $O "ouvrirPage(document.getElementById('ecranCredits')); 'ok'" | Out-Null; Start-Sleep -Milliseconds 700
    Verifier $O $th "créateurs"
    # Overlays : les mêmes (noirs) dans tous les thèmes sombres, différents en Givre
    if ($true) {
      foreach ($nom in $overlays.Keys) {
        Recharger $O
        LancerPartie $O
        $r = Eval $O "(() => { try { $($overlays[$nom]); return 'ok'; } catch (e) { return 'ERREUR ' + e.message; } })()"
        if ($r -ne "ok") { $resultats.Add("$th | overlay $nom | ERREUR DU TEST $r`t0") }
        Start-Sleep -Milliseconds $(if ($nom -eq "duel tirage") { 2500 } else { 1100 })
        Verifier $O $th "overlay $nom"
      }
    }
  }
}
finally {
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$profil*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}

# ===== Bilan =====
$fichier = Join-Path $banc "debordement_actuel.txt"
[IO.File]::WriteAllLines($fichier, [string[]]$resultats, (New-Object Text.UTF8Encoding $false))
$resultats | ForEach-Object { Write-Output "PROBLÈME  $_" }
if ($resultats.Count -eq 0) { Write-Output "RÉSULTAT : OK, rien ne déborde ($($formats -join ', '))" }
else { Write-Output "RÉSULTAT : $($resultats.Count) problème(s) d'affichage" }
