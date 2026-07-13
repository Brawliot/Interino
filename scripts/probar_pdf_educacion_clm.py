from __future__ import annotations

import re
from pathlib import Path

import pdfplumber
import requests

URLS = {
    "0597_maestros": "https://educacion.castillalamancha.es/sites/default/files/2026-04/Aspirantes%20disponibles%200597%2020260410.pdf",
    "0590_secundaria": "https://educacion.castillalamancha.es/sites/default/files/2026-05/Aspirantes%20disponibles%200590%2020260508.pdf",
}

OUTDIR = Path("data/_local/educacion_tmp")
OUTDIR.mkdir(parents=True, exist_ok=True)

RE_WS = re.compile(r"\s+")
RE_ESPECIALIDAD_LINEA = re.compile(r"^Especialidad\s+(\d{3})\s+(.+)$", re.IGNORECASE)
RE_ESPECIALIDAD_INLINE = re.compile(r"Especialidad\s+(\d{3})\s+([A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9\s\-./]+)", re.IGNORECASE)


def norm(s: str) -> str:
    return RE_WS.sub(" ", (s or "").strip())


def descargar(url: str, path: Path) -> None:
    sess = requests.Session()
    sess.headers.update({"User-Agent": "Interino-App/1.0 (contacto: fedebotija@gmail.com)"})
    r = sess.get(url, timeout=45)
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
        if e not in seen:
            seen.add(e)
            out.append(e)
    return out


def analizar_pdf(name: str, pdf_path: Path) -> None:
    with pdfplumber.open(pdf_path) as pdf:
        n = len(pdf.pages)
        print(f"\n== {name} pages={n}")

        sample_pages = sorted(
            set(
                [
                    0,
                    min(1, n - 1),
                    max(0, n // 2),
                    max(0, n - 2),
                    n - 1,
                ]
            )
        )
        for i in sample_pages:
            txt = pdf.pages[i].extract_text() or ""
            print(f"page {i+1} chars={len(txt)} head={norm(txt)[:160]}")

        first_n = min(20, n)
        pages_text_primero = [(pdf.pages[i].extract_text() or "") for i in range(first_n)]
        esp_primero = detectar_especialidades(pages_text_primero)
        print(f"especialidades_detectadas_en_primeras_{first_n}_paginas={len(esp_primero)}")
        for e in esp_primero[:30]:
            print(f" - {e}")

        # escaneo completo de especialidades (todas las páginas)
        all_text = [(pg.extract_text() or "") for pg in pdf.pages]
        esp_all = detectar_especialidades(all_text)
        print(f"especialidades_detectadas_en_todo_el_pdf={len(esp_all)}")
        out_path = OUTDIR / f"{name}_especialidades.txt"
        out_path.write_text("\n".join(esp_all) + "\n", encoding="utf-8")
        print(f"especialidades_guardadas_en={out_path.as_posix()}")

        head_text = "\n".join(pages_text_primero)
        print(
            "contiene_cabeceras?",
            "Especialidad" in head_text,
            "Provincia" in head_text,
            "Orden" in head_text,
            "Bolsa" in head_text,
        )


def main() -> None:
    paths: dict[str, Path] = {}
    for k, u in URLS.items():
        p = OUTDIR / f"{k}.pdf"
        if not p.exists() or p.stat().st_size < 10_000:
            descargar(u, p)
        print(f"{k} bytes={p.stat().st_size}")
        paths[k] = p

    for k, p in paths.items():
        analizar_pdf(k, p)


if __name__ == "__main__":
    main()

