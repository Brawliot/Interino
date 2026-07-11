@echo off
REM 29 categorias de gestion (serial, una por una).
REM Uso: scripts\scrape_gestion.bat
REM Tiempo estimado: varias noches. Ejecutar de noche.

cd /d "%~dp0\.."
set LOG=data\scrape_gestion.log
echo === Inicio %date% %time% === >> "%LOG%"

call :run "ALBANIL"
call :run "AUXILIAR ADMINISTRATIVO/A"
call :run "BIBLIOTECARIO/A"
call :run "CALEFACTOR"
call :run "CARPINTERO/A"
call :run "CELADOR/A"
call :run "COCINERO/A"
call :run "COSTURERO/A"
call :run "ELECTRICISTA"
call :run "FONTANERO/A"
call :run "GOBERNANTA"
call :run "GRUPO ADMINISTRATIVO DE LA FUNCION ADMINISTRATIVA"
call :run "GRUPO GESTION FUNCION ADMINISTRATIVA"
call :run "GRUPO TECNICO ESPECIALISTA DE TECNOLOGIAS DE LA INFORMACION"
call :run "GRUPO TECNICO FUNCION ADMINISTRATIVA"
call :run "GRUPO TECNICO SUPERIOR DE TECNOLOGIAS DE LA INFORMACION"
call :run "GRUPO TECNICO/A DE GESTION DE TECNOLOGIAS DE LA INFORMACION"
call :run "INGENIERO/A SUPERIOR"
call :run "INGENIERO/A TECNICO INDUSTRIAL"
call :run "LAVANDERA"
call :run "MECANICO/A"
call :run "MONITOR"
call :run "PELUQUERO/A"
call :run "PEON"
call :run "PINCHE"
call :run "PINTOR/A"
call :run "PLANCHADOR/A"
call :run "TELEFONISTA"
call :run "TRABAJADOR/A SOCIAL"

echo === Fin %date% %time% === >> "%LOG%"
echo Listo. Log: %LOG%
pause
exit /b 0

:run
echo.
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOG%"
python scraper.py --grupo gestion --categoria "%~1" --presupuesto 5400 >> "%LOG%" 2>&1
exit /b 0
