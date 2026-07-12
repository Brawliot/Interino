@echo off
REM 57 categorias de licenciados (serial, una por una).
REM Uso: scripts\scrape_licenciados.bat
REM Tiempo estimado: muchas noches. Ejecutar de noche.

cd /d "%~dp0\.."
set LOG=data\_local\logs\scrape_licenciados.log
echo === Inicio %date% %time% === >> "%LOG%"

call :run "FARMACEUTICO/A DE ATENCION PRIMARIA"
call :run "FEA ALERGOLOGIA"
call :run "FEA ANALISIS CLINICOS"
call :run "FEA ANATOMIA PATOLOGICA"
call :run "FEA ANESTESIOLOGIA Y REANIMACION"
call :run "FEA ANGIOLOGIA Y CIRUGIA VASCULAR"
call :run "FEA APARATO DIGESTIVO"
call :run "FEA BIOQUIMICA CLINICA"
call :run "FEA CARDIOLOGIA"
call :run "FEA CIRUGIA CARDIOVASCULAR"
call :run "FEA CIRUGIA GENERAL Y DIGESTIVO"
call :run "FEA CIRUGIA ORAL Y MAXILOFACIAL"
call :run "FEA CIRUGIA PEDIATRICA"
call :run "FEA CIRUGIA PLASTICA Y REPARADORA"
call :run "FEA CIRUGIA TORACICA"
call :run "FEA DERMATOLOGIA Y VENEREOLOGIA"
call :run "FEA ENDOCRINOLOGIA Y NUTRICION"
call :run "FEA FARMACIA HOSPITALARIA"
call :run "FEA FARMACOLOGIA CLINICA"
call :run "FEA GERIATRIA"
call :run "FEA HEMATOLOGIA Y HEMOTERAPIA"
call :run "FEA INMUNOLOGIA"
call :run "FEA MEDICINA DEL TRABAJO"
call :run "FEA MEDICINA FISICA Y REHABILITACION"
call :run "FEA MEDICINA INTENSIVA"
call :run "FEA MEDICINA INTERNA"
call :run "FEA MEDICINA NUCLEAR"
call :run "FEA MEDICINA PREVENTIVA Y SALUD PUBLICA"
call :run "FEA MICROBIOLOGIA Y PARASITOLOGIA"
call :run "FEA NEFROLOGIA"
call :run "FEA NEUMOLOGIA"
call :run "FEA NEUROCIRUGIA"
call :run "FEA NEUROFISIOLOGIA CLINICA"
call :run "FEA NEUROLOGIA"
call :run "FEA OBSTETRICIA Y GINECOLOGIA"
call :run "FEA OFTALMOLOGIA"
call :run "FEA ONCOLOGIA MEDICA"
call :run "FEA ONCOLOGIA RADIOTERAPIA"
call :run "FEA OTORRINOLARINGOLOGIA"
call :run "FEA PEDIATRIA Y SUS AREAS ESPECIFICAS"
call :run "FEA PSICOLOGIA CLINICA"
call :run "FEA PSIQUIATRIA"
call :run "FEA RADIODIAGNOSTICO"
call :run "FEA RADIOFISICA HOSPITALARIA"
call :run "FEA REUMATOLOGIA"
call :run "FEA TRAUMATOLOGIA Y CIRUGIA ORTOPEDICA"
call :run "FEA UROLOGIA"
call :run "INSPECTOR/A FARMACEUTICO/A"
call :run "INSPECTOR/A MEDICO/A"
call :run "MEDICO/A DE URGENCIAS HOSPITALARIAS"
call :run "MEDICO/A DE ADMISION, ARCHIVOS Y DOCUMENTACION CLINICA"
call :run "MEDICO/A DE EMERGENCIAS"
call :run "MEDICO/A DE FAMILIA"
call :run "MEDICO/A P.E.A.C."
call :run "ODONTOESTOMATOLOGO"
call :run "PEDIATRA ATENCION PRIMARIA"
call :run "TECNICO/A DE SALUD PUBLICA"

echo === Fin %date% %time% === >> "%LOG%"
echo Listo. Log: %LOG%
pause
exit /b 0

:run
echo.
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOG%"
python scraper.py --grupo licenciados --categoria "%~1" --presupuesto 5400 >> "%LOG%" 2>&1
exit /b 0
