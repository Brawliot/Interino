@echo off
REM Scrape completo de bolsas SMS (Murcia). Primero genera inventario si no existe.
REM Uso: scripts\scrape_murcia.bat
REM Log: data\_local\logs\scrape_murcia.log

cd /d "%~dp0\.."
set LOG=data\_local\logs\scrape_murcia.log
echo === Inicio %date% %time% === >> "%LOG%"

if not exist "data\murcia\categorias.json" (
  echo Generando inventario...
  echo [%date% %time%] inventario >> "%LOG%"
  python scraper_murcia.py --inventario >> "%LOG%" 2>&1
)

echo.
echo Scrapeando todas las categorias de Murcia...
echo [%date% %time%] --todas >> "%LOG%"
python scraper_murcia.py --todas --presupuesto 3600 >> "%LOG%" 2>&1

echo === Fin %date% %time% === >> "%LOG%"
echo Listo. Log: %LOG%
pause
