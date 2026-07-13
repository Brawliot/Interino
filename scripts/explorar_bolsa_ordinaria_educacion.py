#!/usr/bin/env python3
"""Explora PDFs «Admitidos ordinaria» — v2 (href sin comillas Drupal)."""
from __future__ import annotations

import io
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import unquote, urljoin

import pdfplumber
import requests

BASE = "https://educacion.castillalamancha.es"
BOLSAS = f"{BASE}/profesorado/bolsas-de-trabajo"
UA = {"User-Agent": "Interino-App/1.0 (contacto: fedebotija@gmail.com)"}
OUTDIR = Path(__file__).resolve().parents[1] / "data" / "_local" / "educacion_bolsa_exploracion"

RE_LINK = re.compile(r'href="(/profesorado/bolsas-de-trabajo/[^"#?]+)"', re.I)
RE_PDF_HREF = re.compile(r"href=\s*([^\s>\"']+\.pdf[^\s>\"']*)", re.I)
RE_PDF_TITLE = re.compile(
    r'file--title">([^<]*(?:Admitidos|ordinaria|Bolsa|0590|0597)[^<]*\.pdf)\s*<',
    re.I,
)
RE_DNI = re.compile(r"\*{3}\d{4}\*{2}")
RE_FILA = re.compile(r"^(\d+)\s+(\*{3}\d{4}\*{2})\s+")


@dataclass
class PdfRef:
    nombre: str
    url: str
    pagina: str
    fecha: str | None
    tipo: str


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def fecha_nombre(n: str) -> str | None:
    m = re.search(r"(\d{8})", unquote(n))
    return m.group(1) if m else None


def tipo_pdf(n: str) -> str:
    u = unquote(n).upper()
    if "ADMITID" in u and "ORDINARIA" in u:
        return "admitidos_ordinaria"
    if "DEFINITIV" in u and "ORDINARIA" in u:
        return "bolsa_definitiva"
    if "EXCLUID" in u:
        return "excluidos"
    if "RESERVA" in u:
        return "reserva"
    return "otro"


def paginas_a_rastrear() -> list[str]:
    urls = [BOLSAS]
    try:
        html = requests.get(BOLSAS, headers=UA, timeout=45).text
        for m in RE_LINK.finditer(html):
            u = urljoin(BASE, m.group(1))
            if any(
                k in u.lower()
                for k in (
                    "renovacion",
                    "bolsa",
                    "interin",
                    "ordinaria",
                    "admitid",
                    "maestros",
                    "ensenanzas",
                    "2025",
                    "2026",
                )
            ):
                urls.append(u)
    except requests.RequestException:
        pass

    extras = [
        "procedimiento-de-renovacion-de-aspirantes-interinidades-y-solicitud-de-destinos-para-el-curso-1",
        "procedimiento-de-renovacion-de-aspirantes-interinidades-y-solicitud-de-destinos-para-el-curso",
        "bolsas-interinos-071224",
    ]
    for slug in extras:
        urls.append(f"{BOLSAS}/{slug}")

    out, seen = [], set()
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def pdfs_en_html(html: str, pagina: str) -> list[PdfRef]:
    refs: list[PdfRef] = []
    seen: set[str] = set()

    for m in RE_PDF_HREF.finditer(html):
        href = unquote(m.group(1).split("?")[0])
        if not href.startswith("/"):
            continue
        url = urljoin(BASE, href)
        nombre = href.split("/")[-1]
        if url in seen:
            continue
        seen.add(url)
        refs.append(
            PdfRef(
                nombre=nombre,
                url=url,
                pagina=pagina,
                fecha=fecha_nombre(nombre),
                tipo=tipo_pdf(nombre),
            )
        )

    for m in RE_PDF_TITLE.finditer(html):
        nombre = norm(m.group(1))
        # reconstruir URL aproximada desde nombre si no está en href
        if any(r.nombre == nombre for r in refs):
            continue
        # buscar href cercano en html
        esc = re.escape(nombre[:30])
        block = html[html.lower().find(nombre.lower()) : html.lower().find(nombre.lower()) + 500]
        hm = RE_PDF_HREF.search(block)
        if hm:
            href = unquote(hm.group(1).split("?")[0])
            url = urljoin(BASE, href)
            if url not in seen:
                seen.add(url)
                refs.append(
                    PdfRef(nombre=nombre, url=url, pagina=pagina, fecha=fecha_nombre(nombre), tipo=tipo_pdf(nombre))
                )
    return refs


def analizar_pdf(ref: PdfRef, contar_todo: bool = True) -> dict:
    r = requests.get(ref.url, headers=UA, timeout=180)
    out = {
        "nombre": ref.nombre,
        "url": ref.url,
        "pagina_origen": ref.pagina,
        "tipo": ref.tipo,
        "fecha_nombre": ref.fecha,
        "http_status": r.status_code,
        "bytes": len(r.content),
        "es_pdf": r.content[:4] == b"%PDF",
    }
    if not out["es_pdf"]:
        out["error"] = "no PDF"
        return out

    OUTDIR.mkdir(parents=True, exist_ok=True)
    local = OUTDIR / re.sub(r"[^\w.-]+", "_", ref.nombre)[:90]
    local.write_bytes(r.content)
    out["local"] = str(local)

    with pdfplumber.open(io.BytesIO(r.content)) as pdf:
        out["paginas"] = len(pdf.pages)
        p1 = pdf.pages[0].extract_text() or ""
        out["p1_chars"] = len(p1)
        out["p1_muestra"] = norm(p1)[:1600]
        out["texto_seleccionable"] = len(p1.strip()) > 100

        muestra = p1
        if len(pdf.pages) > 1:
            muestra += "\n" + (pdf.pages[1].extract_text() or "")

        out["listado_por_puntuacion"] = "LISTADO POR PUNTUACI" in muestra.upper()
        out["bolsas_ordinarias"] = "BOLSAS ORDINARIAS" in muestra.upper()

        cols = []
        for kw in ("Orden", "DNI", "Apellidos", "Nombre", "Acceso", "Bolsa", "Puntuaci", "Baremo", "Nota", "Tipo"):
            if kw.lower() in muestra.lower():
                cols.append(kw)
        out["columnas"] = cols

        especialidades = []
        for i in range(min(40, len(pdf.pages))):
            t = pdf.pages[i].extract_text() or ""
            for m in re.finditer(r"Especialidad\s+(\d{3})\s+([^\n]+)", t, re.I):
                esp = f"{m.group(1)} {norm(m.group(2))}"
                if esp not in especialidades:
                    especialidades.append(esp)
        out["especialidades_muestra"] = especialidades[:20]
        out["especialidades_muestra_n"] = len(especialidades)

        if contar_todo:
            dnis = filas = 0
            for pg in pdf.pages:
                for linea in (pg.extract_text() or "").splitlines():
                    linea = norm(linea)
                    if RE_DNI.search(linea):
                        dnis += 1
                    if RE_FILA.match(linea):
                        filas += 1
            out["personas_dni"] = dnis
            out["personas_fila_orden"] = filas

    return out


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    paginas = paginas_a_rastrear()
    todos: list[PdfRef] = []
    for p in paginas:
        try:
            html = requests.get(p, headers=UA, timeout=45).text
        except requests.RequestException as e:
            print(f"SKIP {p}: {e}")
            continue
        refs = pdfs_en_html(html, p)
        if refs:
            print(f"{p.split('/')[-1]}: {len(refs)} PDFs")
        todos.extend(refs)

    # dedupe
    by_url = {r.url: r for r in todos}
    todos = list(by_url.values())

    admitidos = [r for r in todos if r.tipo == "admitidos_ordinaria"]
    definitivas = [r for r in todos if r.tipo == "bolsa_definitiva"]

    print(f"\nTotal PDFs: {len(todos)} | admitidos ordinaria: {len(admitidos)} | definitivas: {len(definitivas)}")

    print("\n=== Todos Admitidos ordinaria (0590/0597) ===")
    for r in sorted(admitidos, key=lambda x: (x.fecha or "", x.nombre), reverse=True):
        if "0590" in r.nombre or "0597" in r.nombre:
            print(f"  {r.fecha or '?'} | {r.nombre}")

    # URLs conocidas a mano por si el rastreo falla parcial
    manual = [
        PdfRef(
            "Admitidos ordinaria 0590 20260622.pdf",
            f"{BASE}/sites/default/files/2026-06/Admitidos%20ordinaria%200590%2020260622.pdf",
            "manual",
            "20260622",
            "admitidos_ordinaria",
        ),
        PdfRef(
            "Admitidos ordinaria 0597 especialidades anteriores a LOGSE 20260622.pdf",
            f"{BASE}/sites/default/files/2026-06/Admitidos%20ordinaria%200597%20especialidades%20anteriores%20a%20LOGSE%2020260622.pdf",
            "manual",
            "20260622",
            "admitidos_ordinaria",
        ),
    ]

    # Buscar 0597 LOGSE (infantil/primaria) en bolsas 2024/2025
    for r in todos:
        n = r.nombre.upper()
        if "0597" in n and "ADMITID" in n and "LOGSE" not in n:
            manual.append(r)

    analizar: dict[str, dict] = {}
    targets = {
        "0590": next((r for r in sorted(admitidos, key=lambda x: x.fecha or "", reverse=True) if "0590" in r.nombre), manual[0]),
        "0597_logse_antigua": next((r for r in admitidos if "0597" in r.nombre and "LOGSE" in r.nombre.upper()), manual[1]),
    }

    # 0597 principal: puede estar en bolsa 2024/2025
    cand_0597 = [r for r in todos if "0597" in r.nombre and r.tipo in ("admitidos_ordinaria", "bolsa_definitiva")]
    if cand_0597:
        targets["0597_todos"] = cand_0597

    for key, ref in targets.items():
        if isinstance(ref, list):
            continue
        print(f"\n>>> Analizando {key}: {ref.nombre}")
        analizar[key] = analizar_pdf(ref, contar_todo=(key == "0590"))

    # 0597 LOGSE antigua: solo contar primeras páginas (pequeño)
    if "0597_logse_antigua" in analizar:
        pass
    else:
        analizar["0597_logse_antigua"] = analizar_pdf(manual[1], contar_todo=True)

    # Buscar bolsa definitiva 2024 en bolsas-interinos
    for r in todos:
        if "0590" in r.nombre and "definitiv" in r.nombre.lower():
            print(f"\n>>> Bolsa definitiva 0590 histórica: {r.nombre}")
            analizar["0590_definitiva_hist"] = analizar_pdf(r, contar_todo=False)
        if "0597" in r.nombre and "definitiv" in r.nombre.lower():
            print(f"\n>>> Bolsa definitiva 0597 histórica: {r.nombre}")
            analizar["0597_definitiva_hist"] = analizar_pdf(r, contar_todo=False)

    informe = {
        "pdfs_encontrados": [asdict(r) for r in sorted(todos, key=lambda x: x.nombre)],
        "analisis": analizar,
    }
    OUTDIR.mkdir(parents=True, exist_ok=True)
    path = OUTDIR / "informe_v2.json"
    path.write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nInforme: {path}")

    if "0590" in analizar:
        a = analizar["0590"]
        print(f"\n[0590 RESUMEN] págs={a.get('paginas')} personas≈{a.get('personas_dni')} cols={a.get('columnas')}")


if __name__ == "__main__":
    main()
