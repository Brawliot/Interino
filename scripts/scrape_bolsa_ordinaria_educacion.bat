@echo off
cd /d "%~dp0.."
python scraper_bolsa_ordinaria_educacion_clm.py --bolsa-ordinaria --cuerpo %1 %2 %3 %4 %5
