# Scrapea las 15 categorías de diplomado que faltan (ENFERMERO/A ya migrado).
# Uso: .\scripts\scrape_diplomado_resto.ps1
# Tiempo estimado: ~8 h en total. Ejecutar de noche en local, NO en GitHub Actions.

$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)
$log = "data/_local/logs/scrape_diplomado_resto.log"
"=== Inicio $(Get-Date -Format o) ===" | Tee-Object -FilePath $log -Append

$categorias = @(
    "DIETISTA-NUTRICIONISTA",
    "ENFERMERO/A DE EMERGENCIAS",
    "ENFERMERO/A ESPECIALISTA DEL TRABAJO",
    "ENFERMERO/A ESPECIALISTA EN ENF. FAMILIAR Y COMUNITARIA",
    "ENFERMERO/A ESPECIALISTA EN ENF. GERIATRICA",
    "ENFERMERO/A ESPECIALISTA EN ENF. PEDIATRICA",
    "ENFERMERO/A ESPECIALISTA EN SALUD MENTAL",
    "ENFERMERO/A ESPECIALISTA OBSTETRICIO - GINECOLOGICA (MATRONA)",
    "ENFERMERO/A INSPECTOR/A DE SERVICIOS SANITARIOS Y PRESTACIONES",
    "ENFERMERO/A P.E.A.C.",
    "FISIOTERAPEUTA",
    "LOGOPEDA",
    "OPTICO/A OPTOMETRISTA",
    "PODOLOGO/A",
    "TERAPEUTA OCUPACIONAL"
)

foreach ($cat in $categorias) {
    ">>> $cat $(Get-Date -Format o)" | Tee-Object -FilePath $log -Append
    python scraper.py --grupo diplomado --categoria $cat --presupuesto 5400 2>&1 | Tee-Object -FilePath $log -Append
}

"=== Fin $(Get-Date -Format o) ===" | Tee-Object -FilePath $log -Append
