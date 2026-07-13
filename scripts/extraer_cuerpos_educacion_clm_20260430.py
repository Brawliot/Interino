from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pdfplumber
import requests

OUTDIR = Path("data/_local/educacion_tmp")
OUTDIR.mkdir(parents=True, exist_ok=True)

# Adjudicación 30/04/2026 (según portal): PDFs en carpeta 2026-04 con fecha 20260430
MONTH = "2026-04"
DATE = "20260430"

CODES = ["0591", "0592", "0593", "0594", "0595", "0596", "0598"]

RE_WS = re.compile(r"\s+")
RE_CUERPO = re.compile(r"CUERPO\s*-\s*(\d{4})\s*-\s*([A-ZÁÉÍÓÚÜÑ0-9\s.,\-]+)", re.IGNORECASE)
RE_ESPECIALIDAD_LINEA = re.compile(r"^Especialidad\s+(\d{3})\s+(.+)$", re.IGNORECASE)
RE_ESPECIALIDAD_INLINE = re.compile(
    r"Especialidad\s+(\d{3})\s+([A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9\s\-./:]+)",
    re.IGNORECASE,
)


def norm(s: str) -> str:
    return RE_WS.sub(" ", (s or "").strip())


def descargar(url: str, path: Path) -> None:
    sess = requests.Session()
    sess.headers.update({"User-Agent": "Interino-App/1.0 (contacto: fedebotija@gmail.com)"})
    r = sess.get(url, timeout=60)
    r.raise_for_status()
    path.write_bytes(r.content)


def detectar_especialidades(pages_text: list[str]) -> list[str]:
    encontrados: list[str] = []
    for t in pages_text:
        if not t:
            continue
        for line in t.splitlines():
            line = norm(line)
            m = RE_ESPECIALIDAD_LINEA.match(line)
            if m:
                encontrados.append(f"{m.group(1)} {m.group(2)}")
                continue
            for m2 in RE_ESPECIALIDAD_INLINE.finditer(line):
                encontrados.append(f"{m2.group(1)} {m2.group(2)}")

    out: list[str] = []
    seen: set[str] = set()
    for e in encontrados:
        e = norm(e)
        if e and e not in seen:
            seen.add(e)
            out.append(e)
    return out


def extraer_nombre_cuerpo(texto_p1: str, codigo: str) -> str | None:
    t = norm(texto_p1)
    m = RE_CUERPO.search(t)
    if not m:
        return None
    code = m.group(1)
    name = norm(m.group(2))
    if code != codigo:
        # Si pilló otro code por ruido, lo ignoramos.
        return None
    # Limpieza de colas típicas: "FECHA PUBLICACIÓN..."
    name = re.split(r"\bFECHA\b", name, maxsplit=1, flags=re.IGNORECASE)[0].strip(" -")
    return name or None


def analizar_pdf(codigo: str) -> dict[str, Any]:
    url = f"https://educacion.castillalamancha.es/sites/default/files/{MONTH}/Aspirantes%20disponibles%20{codigo}%20{DATE}.pdf"
    pdf_path = OUTDIR / f"aspirantes_disponibles_{codigo}_{DATE}.pdf"
    if not pdf_path.exists() or pdf_path.stat().st_size < 10_000:
        descargar(url, pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        p1 = pdf.pages[0].extract_text() or ""
        nombre = extraer_nombre_cuerpo(p1, codigo)
        all_text = [(pg.extract_text() or "") for pg in pdf.pages]
        especialidades = detectar_especialidades(all_text)

    return {
        "codigo": codigo,
        "nombre": nombre,
        "ejemplo_pdf_url": url,
        "especialidades": especialidades,
        "meta": {
            "month": MONTH,
            "date": DATE,
            "bytes": pdf_path.stat().st_size,
        },
    }


def main() -> None:
    out: list[dict[str, Any]] = []
    for c in CODES:
        info = analizar_pdf(c)
        print(c, "nombre=", info["nombre"], "especialidades=", len(info["especialidades"]))
        out.append(info)

    (OUTDIR / "cuerpos_20260430.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("guardado", (OUTDIR / "cuerpos_20260430.json").as_posix())


if __name__ == "__main__":
    main()

