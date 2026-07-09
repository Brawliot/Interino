import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scraper import GERENCIAS, AMBITOS, construir_url_pdf, obtener_listado
import requests

G = GERENCIAS[0]
A = AMBITOS[0]

candidatos = [
    ("facultativo", "MEDICO/A DE FAMILIA"),
    ("facultativo", "FEA MEDICINA DE FAMILIA"),
    ("licenciados", "MEDICO/A DE FAMILIA"),
    ("licenciados", "PEDIATRA ATENCION PRIMARIA"),
    ("tecnico", "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERIA"),
    ("tecnico", "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERÍA"),
    ("gestion", "CELADOR/A"),
    ("gestion", "AUXILIAR ADMINISTRATIVO/A"),
    ("gestion", "AUXILIAR ADMINISTRATIVO/AB"),
    ("gestion", "PINCHE"),
]

for grupo, cat in candidatos:
    url = construir_url_pdf(cat, G, A)
    r = requests.get(url, headers={"User-Agent": "x"}, timeout=15)
    filas = 0
    if r.status_code == 200:
        from scraper import parsear_pdf
        filas = len(parsear_pdf(r.content, cat, G, A))
    print(grupo, cat[:40], "->", r.status_code, filas)
