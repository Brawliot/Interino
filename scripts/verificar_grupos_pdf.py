"""Verifica UN PDF por grupo: URL, descarga y parser."""
import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scraper import GERENCIAS, AMBITOS, construir_url_pdf, obtener_listado, parsear_pdf
import requests

GERENCIA = GERENCIAS[0]  # Albacete
AMBITO = AMBITOS[0]  # Atencion Primaria

# Categoría de prueba por grupo (nombre PDF, sin acentos)
PRUEBAS = {
    "diplomado": "FISIOTERAPEUTA",
    "facultativo": "MEDICO/A DE FAMILIA",
    "licenciados": "FARMACEUTICO/A DE ATENCION PRIMARIA",
    "tecnico": "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERIA",
    "gestion": "AUXILIAR ADMINISTRATIVO/A",
}

VARIANTES_EXTRA = {
    "tecnico": [
        "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERIA",
        "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERÍA",
    ],
    "gestion": ["AUXILIAR ADMINISTRATIVO/A", "AUXILIAR ADMINISTRATIVO/AB"],
}


def probar_categoria(categoria: str) -> dict:
    url = construir_url_pdf(categoria, GERENCIA, AMBITO)
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ListasApp/0.1)"},
            timeout=20,
        )
        status = resp.status_code
        if status == 404:
            return {"ok": False, "categoria": categoria, "url": url, "status": 404, "filas": 0}
        resp.raise_for_status()
        filas = parsear_pdf(resp.content, categoria, GERENCIA, AMBITO)
        muestra = None
        if filas:
            f = filas[0]
            muestra = {
                "orden": f.orden,
                "nombre": f.apellidos_nombre[:50],
                "dni": f.dni_parcial,
                "baremo": f.comprobado_baremo,
                "contratos": list(f.tipos_contrato.keys())[:3],
            }
        return {
            "ok": len(filas) > 0,
            "categoria": categoria,
            "url": url,
            "status": status,
            "filas": len(filas),
            "muestra": muestra,
        }
    except Exception as e:
        return {"ok": False, "categoria": categoria, "url": url, "error": str(e), "filas": 0}


def main():
    out = {}
    for grupo, cat in PRUEBAS.items():
        variantes = VARIANTES_EXTRA.get(grupo, [cat])
        detalle = None
        for v in variantes:
            detalle = probar_categoria(v)
            if detalle["ok"]:
                break
        out[grupo] = detalle
        estado = "OK" if detalle["ok"] else "FALLO"
        print(f"{grupo}: {estado} ({detalle.get('filas', 0)} filas) {detalle.get('categoria')}")

    path = Path("data/verificacion_grupos_pdf.json")
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado {path}")


if __name__ == "__main__":
    main()
