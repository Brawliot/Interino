# Subida unificada a R2 (boto3). Requiere variables R2_* en el entorno.
# Alternativa local sin boto3: scripts/subir_educacion_r2.ps1 (wrangler)
#
# Ejemplos:
#   .\scripts\subir_r2.ps1 -Sectores educacion-bolsa -SkipExisting
#   .\scripts\subir_r2.ps1 -Sectores sanidad,educacion,educacion-bolsa,admin-clm

param(
    [string]$Sectores = "",
    [switch]$SkipExisting
)

$Root = Join-Path $PSScriptRoot ".." | Resolve-Path
$py = Join-Path $Root "scripts\subir_sectores_r2.py"
$args = @($py)
if ($Sectores) { $args += @("--sectores", $Sectores) }
if ($SkipExisting) { $args += "--skip-existing" }

Write-Host ">>> python $($args -join ' ')" -ForegroundColor Cyan
& python @args
exit $LASTEXITCODE
