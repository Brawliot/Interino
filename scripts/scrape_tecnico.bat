@echo off
REM 9 categorias de tecnico (serial, una por una).
REM Uso: scripts\scrape_tecnico.bat
REM Tiempo estimado: varias horas. Ejecutar de noche.

cd /d "%~dp0\.."
set LOG=data\scrape_tecnico.log
echo === Inicio %date% %time% === >> "%LOG%"

call :run "HIGIENISTA DENTAL"
call :run "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERIA"
call :run "TECNICO/A MEDIO SANITARIO: FARMACIA"
call :run "TECNICO/A SUPERIOR EN DOCUMENTACION SANITARIA"
call :run "TECNICO/A SUPERIOR SANITARIO EN ANATOMIA PATOLOGICA"
call :run "TECNICO/A SUPERIOR SANITARIO EN LABORATORIO"
call :run "TECNICO/A SUPERIOR SANITARIO EN MEDICINA NUCLEAR"
call :run "TECNICO/A SUPERIOR SANITARIO EN RADIODIAGNOSTICO"
call :run "TECNICO/A SUPERIOR SANITARIO EN RADIOTERAPIA"

echo === Fin %date% %time% === >> "%LOG%"
echo Listo. Log: %LOG%
pause
exit /b 0

:run
echo.
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOG%"
python scraper.py --grupo tecnico --categoria "%~1" --presupuesto 5400 >> "%LOG%" 2>&1
exit /b 0
