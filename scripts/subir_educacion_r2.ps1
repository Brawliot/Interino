# Sube data/educacion/ y data/educacion-bolsa/ a R2 (wrangler; alternativa: scripts/subir_r2.ps1 con boto3)
# Uso:
#   .\scripts\subir_educacion_r2.ps1
#   .\scripts\subir_educacion_r2.ps1 -SkipExisting          # omite los que ya responden 200 en R2
#   .\scripts\subir_educacion_r2.ps1 -Solo educacion-bolsa  # solo bolsa ordinaria
# Primera vez: npx wrangler login

param(
    [switch]$SkipExisting,
    [ValidateSet("all", "educacion", "educacion-bolsa")]
    [string]$Solo = "all",
    [int]$Reintentos = 5,
    [int]$PausaMs = 400
)

$ErrorActionPreference = "Stop"
$Bucket = "interino-data"
$R2Public = "https://pub-1d2aaf9854a14a9b98dac42c39874392.r2.dev"
$Root = Join-Path $PSScriptRoot ".." | Resolve-Path
$LogFallos = Join-Path $Root "data\_local\r2_subida_fallos.txt"

function Test-ObjetoR2($key) {
    try {
        $r = Invoke-WebRequest -Uri "$R2Public/$key" -Method Head -UseBasicParsing -TimeoutSec 15
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Subir-Objeto($key, $filePath) {
    for ($intento = 1; $intento -le $Reintentos; $intento++) {
        npx --yes wrangler r2 object put "$Bucket/$key" --file $filePath --remote 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0) {
            Start-Sleep -Milliseconds $PausaMs
            return $true
        }
        $espera = [Math]::Min(60, 5 * $intento)
        Write-Host "  Reintento $intento/$Reintentos en ${espera}s (503/u otro error)..." -ForegroundColor Yellow
        Start-Sleep -Seconds $espera
    }
    return $false
}

function Subir-Carpeta($localRel, $r2Prefix) {
    $dir = Join-Path $Root $localRel
    if (-not (Test-Path $dir)) {
        Write-Host "SKIP $localRel (no existe)" -ForegroundColor DarkYellow
        return
    }
    $dir = Resolve-Path $dir
    $files = Get-ChildItem -Path $dir -Recurse -File | Sort-Object FullName
    $total = $files.Count
    $i = 0
    $ok = 0
    $skip = 0
    $fail = 0
    $fallidos = @()

    Write-Host "`n=== $r2Prefix ($total archivos) ===" -ForegroundColor Cyan

    foreach ($file in $files) {
        $i++
        $rel = $file.FullName.Substring($dir.Path.Length + 1).Replace("\", "/")
        $key = "$r2Prefix/$rel"
        Write-Host "[$i/$total] $key"

        if ($SkipExisting -and -not ($rel -eq "manifest.json" -or $rel -eq "afinidad.json" -or $rel -eq "categorias.json") -and (Test-ObjetoR2 $key)) {
            Write-Host "  ya en R2 - omitido" -ForegroundColor DarkGray
            $skip++
            continue
        }

        if (Subir-Objeto $key $file.FullName) {
            $ok++
        } else {
            $fail++
            $fallidos += $key
            Write-Host "  FALLO definitivo: $key" -ForegroundColor Red
        }
    }

    Write-Host "Resumen $r2Prefix -> subidos: $ok | omitidos: $skip | fallos: $fail" -ForegroundColor Cyan
    return $fallidos
}

$fallidosTotales = @()
if ($Solo -eq "all" -or $Solo -eq "educacion") {
    $fallidosTotales += Subir-Carpeta "data\educacion" "educacion"
}
if ($Solo -eq "all" -or $Solo -eq "educacion-bolsa") {
    $fallidosTotales += Subir-Carpeta "data\educacion-bolsa" "educacion-bolsa"
}

if ($fallidosTotales.Count -gt 0) {
    New-Item -ItemType Directory -Force -Path (Split-Path $LogFallos) | Out-Null
    $fallidosTotales | Set-Content -Path $LogFallos -Encoding UTF8
    Write-Host "`nFallaron $($fallidosTotales.Count) archivos. Lista: $LogFallos" -ForegroundColor Red
    Write-Host "Vuelve a ejecutar con -SkipExisting para reanudar." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nListo. Comprueba:"
Write-Host "  $R2Public/educacion/manifest.json"
Write-Host "  $R2Public/educacion/afinidad.json"
Write-Host "  $R2Public/educacion-bolsa/manifest.json"
