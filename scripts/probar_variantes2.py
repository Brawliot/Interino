import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scraper import GERENCIAS, AMBITOS, construir_url_pdf, parsear_pdf
import requests

def test(cat, g_idx=0, a_idx=0):
    g, a = GERENCIAS[g_idx], AMBITOS[a_idx]
    url = construir_url_pdf(cat, g, a)
    r = requests.get(url, headers={"User-Agent": "x"}, timeout=20)
    n = len(parsear_pdf(r.content, cat, g, a)) if r.status_code == 200 else 0
    print(f"{r.status_code} {n:5d} | {g[:25]} | {a[:15]} | {cat[:55]}")
    return r.status_code == 200 and n > 0

# tecnico
for cat in [
    "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERIA",
    "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERÍA",
    "TECNICO/A MEDIO SANITARIO: FARMACIA",
    "TECNICO/A SUPERIOR SANITARIO EN RADIODIAGNOSTICO",
    "TECNICO/A SUPERIOR SANITARIO EN LABORATORIO",
    "HIGIENISTA DENTAL",
]:
    for gi in range(3):
        for ai in range(2):
            if test(cat, gi, ai):
                break

print("--- licenciados/facultativo ---")
for cat in [
    "MEDICO/A DE FAMILIA",
    "MEDICO/A DE EMERGENCIAS",
    "FEA MEDICINA INTERNA",
    "FARMACEUTICO/A DE ATENCION PRIMARIA",
    "ODONTOESTOMATOLOGO",
    "PEDIATRA ATENCION PRIMARIA",
]:
    for gi in range(3):
        if test(cat, gi, 0):
            break
