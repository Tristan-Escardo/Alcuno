# Lance tous les tests du jeu l'un après l'autre et affiche un résumé (voir README.txt).
# Usage, depuis le dossier tests :
#   powershell -File tout_tester.ps1             tests hors connexion (environ 10 minutes)
#   powershell -File tout_tester.ps1 -enLigne    + les tests en ligne (vrai Firebase, environ 15 minutes de plus)
#   powershell -File tout_tester.ps1 -rapide     lisibilité sur Givre et Bordeaux seulement (au lieu des 8 thèmes)
# La sortie complète de chaque test est gardée dans tests/resultats/ (ignoré par git).
# Après un push : powershell -File verifier_mise_en_ligne.ps1 (le site en ligne a-t-il bien la nouvelle version ?)
param([switch]$enLigne, [switch]$rapide)

$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeuDossier = Split-Path -Parent $banc
$dossierResultats = Join-Path $banc "resultats"
New-Item -ItemType Directory -Force $dossierResultats | Out-Null
$bash = (Get-Command bash -ErrorAction SilentlyContinue).Source
if (-not $bash) { $bash = "C:\Program Files\Git\bin\bash.exe" }

$bilan = New-Object System.Collections.Generic.List[object]

# Lance une commande, garde sa sortie, puis vérifie chaque condition (texte attendu, expression régulière)
function Tester([string]$nom, [scriptblock]$commande, [string[]]$attendus, [string[]]$interdits = @()) {
  Write-Host ""
  Write-Host "=== $nom ===" -ForegroundColor Cyan
  $debut = Get-Date
  $sortie = (& $commande 2>&1 | Out-String)
  $duree = [int]((Get-Date) - $debut).TotalSeconds
  $fichier = Join-Path $dossierResultats (($nom -replace '[^\w\-]+', '_') + ".txt")
  [IO.File]::WriteAllText($fichier, $sortie, (New-Object Text.UTF8Encoding $false))
  $manques = @($attendus | Where-Object { $sortie -notmatch $_ })
  $trouves = @($interdits | Where-Object { $sortie -match $_ })
  $ok = ($manques.Count -eq 0 -and $trouves.Count -eq 0)
  if ($ok) { Write-Host "OK ($duree s)" -ForegroundColor Green }
  else {
    Write-Host "ÉCHEC ($duree s) : voir $fichier" -ForegroundColor Red
    $manques | ForEach-Object { Write-Host "   attendu, pas trouvé : $_" -ForegroundColor Red }
    $trouves | ForEach-Object { Write-Host "   trouvé alors qu'il ne faut pas : $_" -ForegroundColor Red }
  }
  $bilan.Add([pscustomobject]@{ Test = $nom; Resultat = $(if ($ok) { "OK" } else { "ÉCHEC" }); Secondes = $duree })
}

# Erreur JavaScript : tableau d'erreurs non vide dans la sortie
$erreurJs = 'Erreurs JS[^\r\n]*: \[[^\]\r\n]'

Push-Location $banc
try {
  Tester "Partie classique" { & $bash (Join-Path $banc "generer.sh") } @('"fin": "ok"', '"erreurs": \[\]')

  $themes = if ($rapide) { "givre,bordeaux" } else { "bordeaux,noir,vert,bleu,violet,cerisier,givre,prestige" }
  Tester "Lisibilité des thèmes" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_contraste.ps1") -themes $themes } @('RÉSULTAT : OK')

  Tester "Rien ne déborde (portrait, paysage, PC)" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_debordement.ps1") } @('RÉSULTAT : OK') @('PROBLÈME', 'EXCEPTION')

  Tester "Changement de thème (iPhone)" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_rechargement_theme.ps1") } @(
    '1\)[^\r\n]*"theme":"bleu","reglages":"block"',
    '2\)[^\r\n]*"theme":"prestige","reglages":"block"',
    '3\)[^\r\n]*"theme":"violet","reglages":"none"',
    '4\)[^\r\n]*"theme":"cerisier","reglages":"none"',
    '5\)[^\r\n]*"reglages":"block"') @('"erreurs":\[[^\]]', 'EXCEPTION')

  Tester "Écrans iPhone" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_manque_bas.ps1") } @('Erreurs JS : \[\]') @($erreurJs, 'EXCEPTION')

  Tester "Notification dorée" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_notif_or.ps1") } @(
    'présente = True', 'Glissée vers le haut : fermée = True', 'Tap : fermée = True',
    'Toute seule après 6 s : fermée = True', 'Erreurs JS : \[\]') @('EXCEPTION')

  # Sons : ont besoin d'un petit serveur web (fichiers chargés par fetch)
  $serveur = Start-Process python -ArgumentList (Join-Path $banc "serveur.py"), "8765" -WorkingDirectory $jeuDossier -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 2
  try {
    Tester "Sons" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_sons.ps1") } @('Erreurs JS : \[\]', 'Durée de distribuer_gorgees.mp3 : [0-9.]+ s') @($erreurJs, 'EXCEPTION')
    Tester "Sons d'annulation" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_annuler.ps1") } @('Erreurs JS : \[\]', 'Annulations de 1 ou plus : (\d+) -> sons « annuler » : \1 \| « Annuler 0 » : (\d+) -> sons « annuler 0 » : \2') @($erreurJs, 'EXCEPTION')
  }
  finally { Stop-Process -Id $serveur.Id -Force -ErrorAction SilentlyContinue }

  if ($enLigne) {
    Tester "En ligne : parties à 3" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_traque.ps1") } @('IDENTIQUES=True') @('IDENTIQUES=False', $erreurJs)
    Tester "En ligne : joueur qui revient" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_retour.ps1") } @('supprimée de Firebase') @('False', $erreurJs)
    Tester "En ligne : reconnexion" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_reconnexion.ps1") } @('IDENTIQUES : True') @('IDENTIQUES : False', $erreurJs)
    Tester "En ligne : coupure réseau" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_coupure.ps1") } @('ouvert : True') @($erreurJs)
    Tester "En ligne : action refusée" { powershell -ExecutionPolicy Bypass -File (Join-Path $banc "test_refus.ps1") } @('\[') @('erreurs JS : A \[[^\]]', 'B \[[^\]]')
  }
}
finally { Pop-Location }

Write-Host ""
Write-Host "===== RÉSUMÉ =====" -ForegroundColor Cyan
$bilan | Format-Table -AutoSize | Out-String | Write-Host
$echecs = @($bilan | Where-Object { $_.Resultat -ne "OK" }).Count
if ($echecs -eq 0) { Write-Host "TOUT EST OK ($($bilan.Count) tests)" -ForegroundColor Green; exit 0 }
else { Write-Host "$echecs test(s) en échec sur $($bilan.Count) : sorties complètes dans tests/resultats/" -ForegroundColor Red; exit 1 }
