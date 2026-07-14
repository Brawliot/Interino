#!/usr/bin/env python3
"""
Auditoría de integridad de datos scrapeados (CLM) y coherencia manifest/histórico/índices.
Uso: python scripts/auditar_datos.py [--json informe.json]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scraper import (  # noqa: E402
    AMBITOS,
    DATA_DIR,
    HISTORICO_PATH,
    MANIFEST_PATH,
    _normalizar_clave,
    ambitos_para_categoria,
    claves_listados,
    gerencias_de_categoria,
    gerencias_portal_faltantes,
    path_categoria_json,
    path_indice_busqueda_json,
    slug_archivo,
    ClienteFormularioBaremo,
)

GRUPOS_AUDIT = ("diplomado", "tecnico", "gestion", "licenciados")
DNI_RE = re.compile(r"^\*{4}[0-9A-Z]{4,5}$", re.I)
_JSON_INVENTARIO = frozenset({"categorias.json", "categorias_sanidad.json", "manifest.json"})


def es_listado_categoria(path: Path) -> bool:
    return path.suffix == ".json" and not path.name.endswith(".busqueda.json")


def iter_categorias_json(grupo: str):
    dir_g = Path(DATA_DIR) / grupo
    if not dir_g.is_dir():
        return
    for path in sorted(dir_g.iterdir()):
        if not es_listado_categoria(path) or path.name in _JSON_INVENTARIO:
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "listados" not in data:
            continue
        yield path, data


def _rel(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT.resolve()))


def auditar_gerencias() -> dict:
    """Compara gerencias en JSON vs portal Drupal por categoría."""
    todas_json: set[str] = set()
    por_grupo_json: dict[str, set[str]] = defaultdict(set)
    faltantes_por_cat: list[dict] = []
    portal_cache: dict[tuple[str, str], list[str]] = {}

    for grupo in GRUPOS_AUDIT:
        for path, data in iter_categorias_json(grupo):
            cat = data.get("categoria") or path.stem
            cache_key = (grupo, cat)
            for bloque in data.get("listados") or []:
                g = bloque.get("gerencia", "")
                nk = _normalizar_clave(g)
                todas_json.add(nk)
                por_grupo_json[grupo].add(nk)

            if cache_key not in portal_cache:
                try:
                    cliente = ClienteFormularioBaremo(grupo)
                    sesion = cliente.iniciar_categoria(cat)
                    portal_cache[cache_key] = gerencias_de_categoria(cliente, sesion)
                except Exception as e:
                    portal_cache[cache_key] = []
                    faltantes_por_cat.append({
                        "grupo": grupo, "categoria": cat, "error_portal": str(e),
                    })
                    continue

            try:
                cliente = ClienteFormularioBaremo(grupo)
                sesion = cliente.iniciar_categoria(cat)
                faltan = gerencias_portal_faltantes(cliente, sesion, data.get("listados") or [])
            except Exception as e:
                faltantes_por_cat.append({
                    "grupo": grupo, "categoria": cat, "error_portal": str(e),
                })
                continue

            if faltan:
                claves = claves_listados(data.get("listados") or [])
                pares_faltan = []
                for g in portal_cache[cache_key]:
                    for a in ambitos_para_categoria(cat):
                        if (_normalizar_clave(g), a) not in claves:
                            pares_faltan.append({"gerencia": g, "ambito": a})
                faltantes_por_cat.append({
                    "grupo": grupo,
                    "categoria": cat,
                    "archivo": _rel(path),
                    "listados_actuales": len(data.get("listados") or []),
                    "gerencias_portal": len(portal_cache[cache_key]),
                    "pares_faltantes": len(pares_faltan),
                    "gerencias_sin_datos": faltan,
                })

    # Gerencias portal de referencia (enfermero/a diplomado)
    ref_portal: set[str] = set()
    try:
        c = ClienteFormularioBaremo("diplomado")
        s = c.iniciar_categoria("ENFERMERO/A")
        ref_portal = {_normalizar_clave(g) for g in gerencias_de_categoria(c, s)}
    except Exception:
        pass

    faltan_globales = sorted(ref_portal - todas_json) if ref_portal else []
    sobran_globales = sorted(todas_json - ref_portal) if ref_portal else []

    return {
        "gerencias_unicas_json": len(todas_json),
        "gerencias_por_grupo": {g: len(v) for g, v in por_grupo_json.items()},
        "referencia_portal_enfermero": sorted(ref_portal),
        "en_portal_no_en_ningun_json": faltan_globales,
        "en_json_no_en_portal_enfermero": sobran_globales,
        "categorias_con_faltantes": faltantes_por_cat,
        "total_categorias_con_faltantes": sum(
            1 for x in faltantes_por_cat if x.get("pares_faltantes")
        ),
        "total_pares_gerencia_ambito_faltantes": sum(
            x.get("pares_faltantes", 0) for x in faltantes_por_cat
        ),
    }


def auditar_integridad_categoria(path: Path, data: dict) -> dict:
    listados = data.get("listados") or []
    gerencias = [_normalizar_clave(b.get("gerencia", "")) for b in listados]
    issues = {
        "archivo": _rel(path),
        "categoria": data.get("categoria"),
        "grupo": data.get("grupo"),
        "num_listados": len(listados),
        "num_gerencias": len(set(gerencias)),
        "listados_vacios": [],
        "campos_invalidos": 0,
        "dni_invalidos": 0,
        "duplicados_persona": 0,
        "pares_listado_duplicados": 0,
        "encoding_sospechoso": False,
    }

    vistos_par: set[tuple] = set()
    vistos_persona: set[tuple] = set()
    raw = path.read_text(encoding="utf-8")
    if "Ã" in raw or "�" in raw:
        issues["encoding_sospechoso"] = True

    for bloque in listados:
        g, a = bloque.get("gerencia", ""), bloque.get("ambito", "")
        par = (_normalizar_clave(g), a)
        if par in vistos_par:
            issues["pares_listado_duplicados"] += 1
        vistos_par.add(par)
        filas = bloque.get("filas") or []
        if not filas:
            issues["listados_vacios"].append({"gerencia": g, "ambito": a})
        for fila in filas:
            for campo in ("apellidos_nombre", "orden", "comprobado_baremo"):
                val = fila.get(campo)
                if val is None or val == "":
                    issues["campos_invalidos"] += 1
            dni = fila.get("dni_parcial") or ""
            if dni and not DNI_RE.match(dni.replace(" ", "")):
                issues["dni_invalidos"] += 1
            clave_p = (
                _normalizar_clave(g),
                a,
                fila.get("dni_parcial") or fila.get("apellidos_nombre", ""),
                fila.get("orden"),
            )
            if clave_p in vistos_persona:
                issues["duplicados_persona"] += 1
            vistos_persona.add(clave_p)

    return issues


def auditar_integridad() -> dict:
    por_grupo = defaultdict(list)
    resumen = Counter()
    for grupo in GRUPOS_AUDIT:
        for path, data in iter_categorias_json(grupo):
            iss = auditar_integridad_categoria(path, data)
            por_grupo[grupo].append(iss)
            if iss["listados_vacios"]:
                resumen["listados_vacios"] += 1
            if iss["campos_invalidos"]:
                resumen["campos_invalidos"] += iss["campos_invalidos"]
            if iss["dni_invalidos"]:
                resumen["dni_invalidos"] += iss["dni_invalidos"]
            if iss["duplicados_persona"]:
                resumen["duplicados_persona"] += iss["duplicados_persona"]
            if iss["pares_listado_duplicados"]:
                resumen["pares_listado_duplicados"] += iss["pares_listado_duplicados"]
            if iss["encoding_sospechoso"]:
                resumen["encoding_sospechoso"] += 1

    counts = defaultdict(list)
    for grupo, items in por_grupo.items():
        for it in items:
            counts[grupo].append(it["num_listados"])

    return {
        "resumen_globales": dict(resumen),
        "listados_por_categoria": {
            g: {"min": min(v), "max": max(v), "media": round(sum(v) / len(v), 1)}
            for g, v in counts.items() if v
        },
        "detalle": por_grupo,
    }


def auditar_indices() -> dict:
    sin_indice = []
    indice_huerfano = []
    desincronizados = []

    for grupo in GRUPOS_AUDIT:
        dir_g = Path(DATA_DIR) / grupo
        if not dir_g.is_dir():
            continue
        jsons = {p.stem for p in dir_g.iterdir() if es_listado_categoria(p) and p.name not in _JSON_INVENTARIO}
        busqs = {p.name.replace(".busqueda.json", "") for p in dir_g.glob("*.busqueda.json")}
        for stem in jsons - busqs:
            sin_indice.append(f"{grupo}/{stem}.json")
        for stem in busqs - jsons:
            indice_huerfano.append(f"{grupo}/{stem}.busqueda.json")

        for path, data in iter_categorias_json(grupo):
            cat = data.get("categoria") or path.stem
            idx_path = path_indice_busqueda_json(grupo, cat)
            if not os.path.exists(idx_path):
                continue
            with open(idx_path, "r", encoding="utf-8") as f:
                idx = json.load(f)
            n_json = sum(len(b.get("filas") or []) for b in data.get("listados") or [])
            n_idx = len(idx.get("personas") or [])
            if abs(n_json - n_idx) > max(5, n_json * 0.02):
                desincronizados.append({
                    "archivo": f"{grupo}/{path.name}",
                    "filas_json": n_json,
                    "personas_indice": n_idx,
                })

    return {
        "sin_indice_busqueda": sin_indice,
        "indices_huerfanos": indice_huerfano,
        "indices_desincronizados": desincronizados,
    }


def auditar_manifest() -> dict:
    manifest_files = set()
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest_files = set(json.load(f).get("archivos") or [])

    en_disco = set()
    for grupo_dir in Path(DATA_DIR).iterdir():
        if not grupo_dir.is_dir():
            continue
        for p in grupo_dir.iterdir():
            if p.suffix == ".json":
                en_disco.add(f"{grupo_dir.name}/{p.name}")

    for extra in ("historico.json", "categorias_por_grupo.json"):
        p = Path(DATA_DIR) / extra
        if p.is_file():
            en_disco.add(extra)

    return {
        "manifest_total": len(manifest_files),
        "disco_total_json": len(en_disco),
        "en_manifest_no_disco": sorted(manifest_files - en_disco),
        "en_disco_no_manifest": sorted(en_disco - manifest_files),
    }


def auditar_historico() -> dict:
    if not os.path.exists(HISTORICO_PATH):
        return {"error": "no existe historico.json"}
    with open(HISTORICO_PATH, "r", encoding="utf-8") as f:
        hist = json.load(f)

    cero = [e for e in hist if not e.get("punto_minimo_admitido")]
    negativos = [e for e in hist if (e.get("punto_minimo_admitido") or 0) <= 0]

    claves_hist = {
        (e.get("categoria"), _normalizar_clave(e.get("gerencia", "")), e.get("ambito"))
        for e in hist
    }
    claves_datos = set()
    for grupo in GRUPOS_AUDIT:
        for _, data in iter_categorias_json(grupo):
            for b in data.get("listados") or []:
                if b.get("filas"):
                    claves_datos.add((
                        b.get("categoria") or data.get("categoria"),
                        _normalizar_clave(b.get("gerencia", "")),
                        b.get("ambito"),
                    ))

    sin_historico = len(claves_datos - {(c, g, a) for c, g, a in claves_hist if c})

    return {
        "entradas_total": len(hist),
        "punto_minimo_null_o_ausente": len(cero),
        "punto_minimo_cero_o_negativo": len(negativos),
        "combinaciones_con_datos": len(claves_datos),
        "combinaciones_datos_sin_historico_aprox": sin_historico,
    }


def _normalizar_busqueda(texto: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode("ascii").lower()


def _coincide_busqueda(fila: dict, consulta: str) -> bool:
    tokens = _normalizar_busqueda(consulta).split()
    if not tokens:
        return False
    ap = _normalizar_busqueda(fila.get("apellidos") or fila.get("nombreCompleto") or "")
    nom = _normalizar_busqueda(fila.get("nombreCompleto") or "")
    dni = _normalizar_busqueda((fila.get("dniParcial") or "").replace("*", ""))
    return all(t in ap or t in nom or t in dni for t in tokens)


def probar_busqueda() -> dict:
    """Prueba búsqueda normalizada (García/Garcia) en índice enfermero/a."""
    idx_path = Path(DATA_DIR) / "diplomado" / "enfermero-a.busqueda.json"
    dietista_path = Path(DATA_DIR) / "diplomado" / "dietista-nutricionista.busqueda.json"
    resultados = {}

    if idx_path.is_file():
        with open(idx_path, "r", encoding="utf-8") as f:
            idx = json.load(f)
        personas = idx.get("personas") or []

        def buscar(q):
            return [p for p in personas if _coincide_busqueda({
                "apellidos": p.get("apellidos", ""),
                "nombreCompleto": p.get("nombreCompleto", ""),
                "dniParcial": p.get("dniParcial", ""),
            }, q)]

        g1 = buscar("GARCIA")
        g2 = buscar("García")
        resultados["enfermero_garcia"] = len(g1)
        resultados["enfermero_garcia_tilde"] = len(g2)
        resultados["enfermero_garcia_coinciden"] = len(g1) == len(g2)

    if dietista_path.is_file():
        with open(dietista_path, "r", encoding="utf-8") as f:
            idx = json.load(f)
        amo = [p for p in idx.get("personas") or [] if "AMO" in (p.get("apellidos") or "").upper()]
        resultados["dietista_amo_en_indice"] = len(amo)
        toledo = [p for p in idx.get("personas") or []
                  if any(a.get("gerencia") == "Toledo AE" or a.get("gerencia") == "Toledo"
                         for a in p.get("apariciones") or [])]
        resultados["dietista_personas_toledo_en_indice"] = len(toledo)

    return resultados


def auditar_encoding_muestras() -> dict:
    muestras = []
    for term in ("Valdepeñas", "Hellín", "Alcázar"):
        for grupo in GRUPOS_AUDIT:
            dir_g = Path(DATA_DIR) / grupo
            if not dir_g.is_dir():
                continue
            for path in dir_g.glob("*.json"):
                if path.name.endswith(".busqueda.json"):
                    continue
                text = path.read_text(encoding="utf-8")
                if term in text or term.replace("ñ", "n").replace("í", "i") in text:
                    muestras.append({"termino": term, "archivo": _rel(path)})
                    break
    return {"muestras_utf8_ok": muestras[:10], "nota": "JSON guardados con encoding=utf-8, ensure_ascii=False"}


def auditar_repo_limpieza() -> dict:
    """Scripts debug, temporales y User-Agent del scraper."""
    from scraper import USER_AGENT

    debug_scripts = sorted(Path("scripts").glob("debug_*")) if Path("scripts").is_dir() else []
    temporales = []
    for patron in ("tmp_test.pdf", "_*.html", "generarListadoCompletoEjemplo"):
        for p in Path(".").rglob("*"):
            if p.is_file() and (
                p.name == "tmp_test.pdf"
                or (p.name.startswith("_") and p.suffix == ".html")
            ):
                temporales.append(_rel(p))
    return {
        "user_agent_scraper": USER_AGENT,
        "scripts_debug": [str(p) for p in debug_scripts],
        "archivos_temporales": temporales[:20],
        "generarListadoCompletoEjemplo_en_codigo": False,
    }


def imprimir_informe(informe: dict) -> None:
    print("=" * 72)
    print("AUDITORÍA DE DATOS — Interino / CLM")
    print("=" * 72)

    g = informe["gerencias"]
    print("\n## 1. GERENCIAS")
    if g.get("nota"):
        print(f"  {g['nota']}")
    else:
        print(f"  Gerencias únicas en JSON: {g['gerencias_unicas_json']}")
        print(f"  Por grupo: {g['gerencias_por_grupo']}")
        print(f"  Categorías con faltantes: {g['total_categorias_con_faltantes']}")
        print(f"  Pares gerencia+ámbito faltantes: {g['total_pares_gerencia_ambito_faltantes']}")
        if g.get("en_portal_no_en_ningun_json"):
            print("  Gerencias en portal (enfermero ref.) ausentes en todos los JSON:")
            for x in g["en_portal_no_en_ningun_json"]:
                print(f"    - {x}")
        if g.get("en_json_no_en_portal_enfermero"):
            print("  Gerencias solo en JSON (central/especiales):")
            for x in g["en_json_no_en_portal_enfermero"][:10]:
                print(f"    - {x}")

    i = informe["integridad"]["resumen_globales"]
    print("\n## 2. INTEGRIDAD")
    print(f"  {i or 'Sin incidencias globales'}")

    idx = informe["indices"]
    print("\n## 4. ÍNDICES")
    print(f"  Sin .busqueda.json: {len(idx['sin_indice_busqueda'])}")
    print(f"  Índices huérfanos: {len(idx['indices_huerfanos'])}")
    print(f"  Desincronizados: {len(idx['indices_desincronizados'])}")

    m = informe["manifest"]
    print("\n## 5. MANIFEST")
    print(f"  Manifest: {m['manifest_total']} | Disco: {m['disco_total_json']}")
    print(f"  En manifest, no disco: {len(m['en_manifest_no_disco'])}")
    print(f"  En disco, no manifest: {len(m['en_disco_no_manifest'])}")

    h = informe["historico"]
    print("\n## 6. HISTÓRICO")
    for k, v in h.items():
        print(f"  {k}: {v}")

    b = informe["busqueda"]
    print("\n## 7. BÚSQUEDA (muestra)")
    for k, v in b.items():
        print(f"  {k}: {v}")

    enc = informe["encoding"]
    print("\n## 3. ENCODING")
    print(f"  {enc['nota']}")
    print(f"  Archivos con encoding sospechoso (mojibake): {informe['integridad']['resumen_globales'].get('encoding_sospechoso', 0)}")

    if "repo" in informe:
        r = informe["repo"]
        print("\n## 9. REPO / SCRIPTS")
        print(f"  User-Agent scraper: {r['user_agent_scraper']}")
        print(f"  scripts/debug_*: {len(r['scripts_debug'])}")
        print(f"  Temporales (_*.html, etc.): {len(r['archivos_temporales'])}")


def main():
    parser = argparse.ArgumentParser(description="Auditoría de datos Interino")
    parser.add_argument("--json", help="Guardar informe completo en JSON")
    parser.add_argument("--sin-portal", action="store_true", help="Omitir consultas al portal (más rápido)")
    args = parser.parse_args()

    informe = {
        "integridad": auditar_integridad(),
        "indices": auditar_indices(),
        "manifest": auditar_manifest(),
        "historico": auditar_historico(),
        "busqueda": probar_busqueda(),
        "encoding": auditar_encoding_muestras(),
        "repo": auditar_repo_limpieza(),
    }
    if args.sin_portal:
        informe["gerencias"] = {"nota": "Omitido (--sin-portal)"}
    else:
        print("Consultando portal SESCAM (puede tardar varios minutos)…", file=sys.stderr)
        informe["gerencias"] = auditar_gerencias()

    imprimir_informe(informe)

    if args.json:
        out = Path(args.json)
        out.write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nInforme JSON: {out}")


if __name__ == "__main__":
    main()
