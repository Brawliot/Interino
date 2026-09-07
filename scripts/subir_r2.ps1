# Subida unificada a R2 (boto3). Requiere variables R2_* en el entorno.
# Alternativa local sin boto3: scripts/subir_educacion_r2.ps1 (wrangler)
#
# Por defecto también archiva snapshots en archive/YYYY-MM-DD/
#
# Ejemplos:
#   .\scripts\subir_r2.ps1 -Sectores educacion-bolsa -SkipExisting
#   .\scripts\subir_r2.ps1 -Sectores sanidad,educacion,educacion-bolsa,admin-clm
#   .\scripts\subir_r2.ps1 -Sectores sanidad -NoArchive

param(
    [string]$Sectores = "",
    [switch]$SkipExisting,
    [switch]$NoArchive,
    [switch]$ArchiveOnly
)

$Root = Join-Path $PSScriptRoot ".." | Resolve-Path
$py = Join-Path $Root "scripts\subir_sectores_r2.py"
$argv = @($py)
if ($Sectores) { $argv += @("--sectores", $Sectores) }
if ($SkipExisting) { $argv += "--skip-existing" }
if ($NoArchive) { $argv += "--no-archive" }
if ($ArchiveOnly) { $argv += "--archive-only" }

Write-Host ">>> python $($argv -join ' ')" -ForegroundColor Cyan
& python @argv
exit $LASTEXITCODE
