@echo off
cd /d "%~dp0.."
python scraper_admin_clm.py --inventario
python scraper_admin_clm.py --todos --presupuesto 14400
