# Sube data/admin-clm/ a R2 → interino-data/admin-clm/
# Uso (PowerShell):  .\scripts\subir_admin_clm_r2.ps1
# Primera vez:       npx wrangler login

$ErrorActionPreference = "Stop"
$Bucket = "interino-data"
$Root = Join-Path $PSScriptRoot "..\data\admin-clm" | Resolve-Path

Write-Host "Origen: $Root"
Write-Host "Destino R2: $Bucket/admin-clm/"
Write-Host ""

$files = Get-ChildItem -Path $Root -Recurse -File
$total = $files.Count
$i = 0

foreach ($file in $files) {
    $i++
    $rel = $file.FullName.Substring($Root.Path.Length + 1).Replace("\", "/")
    $key = "admin-clm/$rel"
    Write-Host "[$i/$total] $key"
    npx --yes wrangler r2 object put "$Bucket/$key" --file $file.FullName --remote
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo al subir $key"
    }
}

Write-Host ""
Write-Host "Listo. Comprueba:"
Write-Host "  https://pub-1d2aaf9854a14a9b98dac42c39874392.r2.dev/admin-clm/manifest.json"
