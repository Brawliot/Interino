@echo off
REM 11 categorias diplomado que faltan (una por una, serial).
REM Uso: scripts\scrape_diplomado_faltantes.bat
REM Tiempo estimado: varias horas. Ejecutar de noche.

cd /d "%~dp0\.."
set LOG=data\_local\logs\scrape_diplomado_faltantes.log
echo === Inicio %date% %time% === >> "%LOG%"

call :run "ENFERMERO/A DE EMERGENCIAS"
call :run "ENFERMERO/A ESPECIALISTA DEL TRABAJO"
call :run "ENFERMERO/A ESPECIALISTA EN ENF. FAMILIAR Y COMUNITARIA"
call :run "ENFERMERO/A ESPECIALISTA EN ENF. GERIATRICA"
call :run "ENFERMERO/A ESPECIALISTA EN ENF. PEDIATRICA"
call :run "ENFERMERO/A ESPECIALISTA EN SALUD MENTAL"
call :run "ENFERMERO/A ESPECIALISTA OBSTETRICIO - GINECOLOGICA (MATRONA)"
call :run "ENFERMERO/A INSPECTOR/A DE SERVICIOS SANITARIOS Y PRESTACIONES"
call :run "ENFERMERO/A P.E.A.C."
call :run "OPTICO/A OPTOMETRISTA"
call :run "TERAPEUTA OCUPACIONAL"

echo === Fin %date% %time% === >> "%LOG%"
echo Listo. Log: %LOG%
pause
exit /b 0

:run
echo.
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOG%"
python scraper.py --grupo diplomado --categoria "%~1" --presupuesto 5400 >> "%LOG%" 2>&1
exit /b 0
