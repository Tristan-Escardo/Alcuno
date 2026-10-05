# Après un « git push » : attend que GitHub Pages ait publié le dernier commit, puis vérifie que le site en
# ligne affiche bien la même version que le code (VERSION_AFFICHEE de script.js). Voir README.txt.
# Usage, depuis le dossier tests :  powershell -File verifier_mise_en_ligne.ps1
# (Le 5 octobre 2026, trois publications d'affilée avaient échoué côté GitHub : le site était resté en
# 9.1.0 alors que la 9.1.3 était poussée, sans que personne ne le voie.)
param([int]$attenteMaxMinutes = 15)
$ErrorActionPreference = "Stop"
$banc = Split-Path -Parent $MyInvocation.MyCommand.Path
$jeuDossier = Split-Path -Parent $banc
$depot = "Tristan-Escardo/Alcuno"
$site = "https://tristan-escardo.github.io/Alcuno/script.js"

$commit = (git -C $jeuDossier rev-parse HEAD).Trim()
$version = ([regex]::Match((Get-Content -Raw -Encoding UTF8 (Join-Path $jeuDossier "script.js")), 'VERSION_AFFICHEE = "([^"]+)"')).Groups[1].Value
Write-Output "Commit local : $($commit.Substring(0, 7)) | version du code : $version"

# 1) La publication GitHub Pages de ce commit
$fin = (Get-Date).AddMinutes($attenteMaxMinutes)
$publication = $null
while ((Get-Date) -lt $fin) {
  try {
    $runs = (Invoke-RestMethod "https://api.github.com/repos/$depot/actions/runs?per_page=10&head_sha=$commit").workflow_runs |
      Where-Object { $_.name -eq "pages build and deployment" }
    $publication = $runs | Select-Object -First 1
  } catch { $publication = $null }
  if ($publication -and $publication.status -eq "completed") { break }
  $etat = if ($publication) { $publication.status } else { "pas encore commencée" }
  Write-Output "  publication : $etat..."
  Start-Sleep -Seconds 20
}
if (-not $publication) { Write-Output "ÉCHEC : aucune publication GitHub Pages trouvée pour ce commit (le push a-t-il bien eu lieu ?)"; exit 1 }
if ($publication.status -ne "completed") { Write-Output "ÉCHEC : publication toujours en cours après $attenteMaxMinutes minutes ($($publication.html_url))"; exit 1 }
if ($publication.conclusion -ne "success") {
  Write-Output "ÉCHEC : publication « $($publication.conclusion) » ($($publication.html_url))"
  Write-Output "        Souvent un incident passager côté GitHub : refaire un push (ou « Re-run jobs » sur GitHub)."
  exit 1
}
Write-Output "  publication : réussie"

# 2) La version réellement servie par le site (le cache du site peut avoir un peu de retard)
for ($i = 0; $i -lt 12; $i++) {
  try { $enLigne = ([regex]::Match((Invoke-WebRequest -UseBasicParsing "$site`?verif=$(Get-Random)").Content, 'VERSION_AFFICHEE = "([^"]+)"')).Groups[1].Value }
  catch { $enLigne = "" }
  if ($enLigne -eq $version) { Write-Output "RÉSULTAT : OK, le site en ligne est en $enLigne"; exit 0 }
  Start-Sleep -Seconds 10
}
Write-Output "ÉCHEC : le site en ligne affiche « $enLigne » au lieu de « $version »"
exit 1
