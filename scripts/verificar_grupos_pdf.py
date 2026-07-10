"""Verifica UN PDF por grupo: URL, descarga y parser (formulario portal SESCAM)."""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scraper import GERENCIAS, AMBITOS, obtener_listado_detalle, GRUPOS_PORTAL_SLUG, BASE_BAREMOS

GERENCIA = GERENCIAS[4]  # Cuenca
AMBITO = AMBITOS[0]  # Atencion Primaria

PRUEBAS = {
    "diplomado": "ENFERMERO/A",
    "licenciados": "MEDICO/A DE FAMILIA",
    "tecnico": "TECNICO/A MEDIO SANITARIO: CUIDADOS AUXILIARES DE ENFERMERIA",
    "gestion": "CELADOR/A",
}


def probar_grupo(grupo: str, categoria: str) -> dict:
    resultado = obtener_listado_detalle(categoria, GERENCIA, AMBITO, grupo=grupo)
    muestra = None
    if resultado.filas:
        f = resultado.filas[0]
        muestra = {
            "orden": f.orden,
            "nombre": f.apellidos_nombre[:50],
            "dni": f.dni_parcial,
            "baremo": f.comprobado_baremo,
        }
    return {
        "ok": resultado.estado == "ok" and len(resultado.filas) > 0,
        "grupo": grupo,
        "categoria": categoria,
        "estado": resultado.estado,
        "url": resultado.url,
        "filas": len(resultado.filas),
        "muestra": muestra,
        "gerencia": GERENCIA,
        "ambito": AMBITO,
    }


def main():
    print(f"Endpoint: POST {BASE_BAREMOS}{{slug}}")
    print(f"Grupos: {GRUPOS_PORTAL_SLUG}\n")

    out = {
        "generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "gerencia": GERENCIA,
        "ambito": AMBITO,
        "grupos": {},
    }
    for grupo, cat in PRUEBAS.items():
        detalle = probar_grupo(grupo, cat)
        out["grupos"][grupo] = detalle
        estado = "OK" if detalle["ok"] else detalle["estado"].upper()
        print(f"{grupo}: {estado} ({detalle['filas']} filas) — {cat}")

    path = Path("data/verificacion_grupos_pdf.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nGuardado {path}")
    fallos = [g for g, d in out["grupos"].items() if not d["ok"]]
    if fallos:
        sys.exit(1)


if __name__ == "__main__":
    main()
