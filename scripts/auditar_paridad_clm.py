#!/usr/bin/env python3
"""Audita huecos locales CLM, paridad local↔R2 y smoke test de URLs de la app."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R2 = "https://pub-1d2aaf9854a14a9b98dac42c39874392.r2.dev"

CUERPO_SLUG = {
    "0597": "maestros",
    "0590": "secundaria",
    "0591": "tecnicos-fp",
    "0592": "eoii",
    "0593": "catedraticos-musica",
    "0594": "profesores-musica",
    "0595": "artes-plasticas",
    "0596": "maestros-taller",
    "0598": "fp-singulares",
}

# URLs que cargarDatos() pide al arrancar (datos.jsx)
SMOKE_BOOTSTRAP = [
    ("sanidad", "historico.json"),
    ("sanidad", "manifest.json"),
    ("sanidad", "categorias_por_grupo.json"),
    ("murcia", "murcia/categorias.json"),
    ("murcia", "murcia/manifest.json"),
    ("madrid", "madrid/categorias_sanidad.json"),
    ("educacion", "educacion/manifest.json"),
    ("educacion", "educacion/categorias.json"),
    ("educacion-bolsa", "educacion-bolsa/manifest.json"),
    ("educacion-afin", "educacion/afinidad.json"),
    ("admin", "admin-clm/manifest.json"),
    ("admin", "admin-clm/categorias.json"),
]

PARITY_SECTORS = [
    ("sanidad", ROOT / "data/public", "", "manifest.json"),
    ("educacion-disponibles", ROOT / "data/educacion", "educacion", "manifest.json"),
    ("educacion-bolsa", ROOT / "data/educacion-bolsa", "educacion-bolsa", "manifest.json"),
    ("admin-clm", ROOT / "data/admin-clm", "admin-clm", "manifest.json"),
]


def slug(n: str) -> str:
    s = n.lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _fetch_via_powershell(url: str) -> tuple[bytes | None, int | None, str | None]:
    """Fallback en Windows cuando urllib falla por SSL del entorno."""
    ps = (
        f"try {{ "
        f"$r=Invoke-WebRequest -Uri '{url}' -UseBasicParsing -TimeoutSec 90; "
        f"$body = if ($r.Content -is [byte[]]) {{ [Text.Encoding]::UTF8.GetString($r.Content) }} else {{ [string]$r.Content }}; "
        f"Write-Output $r.StatusCode; Write-Output $body "
        f"}} catch {{ "
        f"if ($_.Exception.Response) {{ Write-Output ([int]$_.Exception.Response.StatusCode.value__); Write-Output '' }} "
        f"else {{ Write-Output 'ERR'; Write-Output $_.Exception.Message }} "
        f"}}"
    )
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, None, str(e)
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace").strip()
        return None, None, err or f"powershell exit {proc.returncode}"
    raw = proc.stdout.decode("utf-8", errors="replace")
    if not raw:
        return None, None, "respuesta vacia"
    nl = raw.find("\n")
    if nl == -1:
        return None, None, "formato powershell inesperado"
    status_line = raw[:nl].strip()
    if status_line == "ERR":
        return None, None, raw[nl + 1 :].strip() or "error desconocido"
    try:
        status = int(status_line)
    except ValueError:
        return None, None, "status code invalido"
    body = raw[nl + 1 :].encode("utf-8")
    return body, status, None


def fetch_bytes(url: str) -> tuple[bytes | None, int | None, str | None]:
    req = urllib.request.Request(url, headers={"User-Agent": "interino-audit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read(), resp.status, None
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
        except OSError:
            body = None
        return body, e.code, str(e.reason)
    except OSError as e:
        if sys.platform == "win32":
            return _fetch_via_powershell(url)
        return None, None, str(e)


def fetch_status(url: str) -> tuple[int | None, str | None]:
    _, status, err = fetch_bytes(url)
    return status, err


def fetch_json(url: str) -> tuple[dict | list | None, int | None, str | None]:
    body, status, err = fetch_bytes(url)
    if body is None or status != 200:
        return None, status, err
    try:
        return json.loads(body.decode("utf-8")), status, None
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return None, status, str(e)


def listados_manifest(archivos: list[str]) -> list[str]:
    return [
        a
        for a in archivos
        if a.endswith(".json")
        and not a.endswith(".busqueda.json")
        and a not in ("manifest.json", "categorias.json", "afinidad.json")
    ]


def educacion_huecos_catalogo() -> tuple[list[str], list[str]]:
    sin_d, sin_b = [], []
    edu = json.loads((ROOT / "data/educacion/categorias.json").read_text(encoding="utf-8"))
    man_d = set(json.loads((ROOT / "data/educacion/manifest.json").read_text(encoding="utf-8"))["archivos"])
    man_b = set(json.loads((ROOT / "data/educacion-bolsa/manifest.json").read_text(encoding="utf-8"))["archivos"])
    for c in edu["cuerpos"]:
        g = CUERPO_SLUG.get(c["codigo"])
        if not g:
            continue
        for esp in c.get("especialidades", []):
            m = re.match(r"^(\d{3})\s+(.+)$", esp)
            if not m:
                continue
            rel = f"{g}/{m.group(1)}-{slug(m.group(2))}.json"
            if rel not in man_d:
                sin_d.append(rel)
            if rel not in man_b:
                sin_b.append(rel)
    return sin_d, sin_b


def comparar_manifest(nombre: str, local_dir: Path, r2_prefix: str, manifest_name: str) -> dict:
    local_path = local_dir / manifest_name
    if not local_path.is_file():
        return {"sector": nombre, "error": f"sin manifest local {local_path}"}

    local = json.loads(local_path.read_text(encoding="utf-8"))
    local_files = set(local.get("archivos") or [])
    r2_key = f"{r2_prefix}/{manifest_name}" if r2_prefix else manifest_name
    r2_url = f"{R2}/{r2_key}"
    r2_data, status, err = fetch_json(r2_url)

    out = {
        "sector": nombre,
        "local_count": len(local_files),
        "local_generado": local.get("generado"),
        "r2_url": r2_url,
        "r2_status": status,
        "r2_error": err,
    }
    if r2_data is None:
        out["r2_count"] = 0
        out["solo_local"] = sorted(local_files)
        out["solo_r2"] = []
        out["en_ambos"] = 0
        return out

    r2_files = set(r2_data.get("archivos") or [])
    solo_local = sorted(local_files - r2_files)
    solo_r2 = sorted(r2_files - local_files)
    out.update(
        {
            "r2_count": len(r2_files),
            "r2_generado": r2_data.get("generado"),
            "en_ambos": len(local_files & r2_files),
            "solo_local": solo_local,
            "solo_r2": solo_r2,
        }
    )
    return out


def smoke_test() -> list[dict]:
    results = []
    for sector, key in SMOKE_BOOTSTRAP:
        url = f"{R2}/{key}"
        status, err = fetch_status(url)
        ok = status == 200
        entry = {"sector": sector, "url": url, "ok": ok, "status": status, "error": err}
        if ok and key.endswith("manifest.json"):
            data, _, _ = fetch_json(url)
            if isinstance(data, dict):
                entry["archivos"] = len(data.get("archivos") or [])
                entry["generado"] = data.get("generado")
        results.append(entry)

    # Muestra sanidad (como datos.jsx línea ~1517)
    url = f"{R2}/diplomado/enfermero-a.json"
    status, err = fetch_status(url)
    results.append(
        {
            "sector": "sanidad-muestra",
            "url": url,
            "ok": status == 200,
            "status": status,
            "error": err,
        }
    )
    return results


def muestras_listado_r2(comparisons: list[dict]) -> list[dict]:
    """Comprueba en R2 algunos listados que faltan vs local (max. 5 por sector)."""
    out = []
    prefix_map = {
        "educacion-disponibles": "educacion",
        "educacion-bolsa": "educacion-bolsa",
        "admin-clm": "admin-clm",
        "sanidad": "",
    }
    for cmp in comparisons:
        if cmp.get("r2_status") != 200:
            continue
        sector = cmp["sector"]
        prefix = prefix_map.get(sector, "")
        faltantes = cmp.get("solo_local") or []
        listados = [f for f in faltantes if f.endswith(".json") and "manifest" not in f][:5]
        for rel in listados:
            key = f"{prefix}/{rel}" if prefix else rel
            status, err = fetch_status(f"{R2}/{key}")
            out.append({"sector": sector, "archivo": rel, "ok": status == 200, "status": status, "error": err})
    return out


def main() -> int:
    exit_code = 0

    print("=" * 60)
    print("0.4 - HUECOS LOCALES (catalogo educacion vs manifests)")
    print("=" * 60)
    sin_d, sin_b = educacion_huecos_catalogo()
    print(f"Disponibles sin JSON local: {len(sin_d)}/{96} catálogo")
    for rel in sin_d:
        print(f"  - {rel}")
    print(f"Bolsa ordinaria sin JSON local: {len(sin_b)}")
    for rel in sin_b:
        print(f"  - {rel}")
    print(f"afinidad.json local: {(ROOT / 'data/educacion/afinidad.json').is_file()}")

    print("\n=== Admin sin PDF en portal ===")
    admin = json.loads((ROOT / "data/admin-clm/categorias.json").read_text(encoding="utf-8"))
    for e in admin:
        if not e.get("pdfs"):
            print(f"  {e.get('categoria')} ({e.get('colectivo')})")

    print("\n=== Facultativo sanidad ===")
    cats = json.loads((ROOT / "data/public/categorias_por_grupo.json").read_text(encoding="utf-8"))
    fac = cats.get("facultativo", {})
    print(f"  categorias_pdf: {len(fac.get('categorias_pdf') or [])}")
    if fac.get("nota"):
        print(f"  nota: {fac.get('nota')[:80]}...")

    print("\n" + "=" * 60)
    print("0.4 - PARIDAD LOCAL <-> R2 (manifests)")
    print("=" * 60)
    comparisons = []
    for nombre, local_dir, r2_prefix, manifest_name in PARITY_SECTORS:
        cmp = comparar_manifest(nombre, local_dir, r2_prefix, manifest_name)
        comparisons.append(cmp)
        print(f"\n[{cmp['sector']}]")
        if cmp.get("error"):
            print(f"  ERROR: {cmp['error']}")
            exit_code = 1
            continue
        if cmp.get("r2_status") != 200:
            print(f"  R2 manifest: FALTA ({cmp.get('r2_status')} {cmp.get('r2_error')})")
            exit_code = 1
        else:
            print(f"  Local: {cmp['local_count']} archivos ({cmp.get('local_generado')})")
            print(f"  R2:    {cmp['r2_count']} archivos ({cmp.get('r2_generado')})")
            print(f"  En ambos: {cmp['en_ambos']}")
            delta = len(cmp.get("solo_local") or [])
            if delta:
                print(f"  [!] Solo en local (falta subir a R2): {delta}")
                exit_code = 1
                for f in (cmp["solo_local"])[:15]:
                    print(f"      {f}")
                if delta > 15:
                    print(f"      ... y {delta - 15} más")
            extra = len(cmp.get("solo_r2") or [])
            if extra:
                print(f"  Solo en R2 (obsoleto local): {extra}")

    print("\n" + "=" * 60)
    print("0.5 - SMOKE TEST URLs (cargarDatos produccion)")
    print("=" * 60)
    smoke = smoke_test()
    for row in smoke:
        icon = "OK" if row["ok"] else "FALLO"
        extra = ""
        if row.get("archivos") is not None:
            extra = f" | {row['archivos']} archivos | {row.get('generado', '?')}"
        print(f"  [{icon}] {row['sector']}: {row['url']} ({row.get('status')}){extra}")
        if not row["ok"]:
            exit_code = 1
            if row.get("error"):
                print(f"         {row['error']}")

    print("\n=== Verificacion muestras faltantes en R2 ===")
    muestras = muestras_listado_r2(comparisons)
    if not muestras:
        print("  (sin faltantes locales vs R2 o R2 no accesible)")
    ok_muestras = sum(1 for m in muestras if m["ok"])
    for m in muestras:
        icon = "OK" if m["ok"] else "404"
        print(f"  [{icon}] {m['sector']}/{m['archivo']}")
    if muestras and ok_muestras == len(muestras) and ok_muestras > 0:
        print(
            "\n  NOTA: los listados responden 200 pero el manifest R2 no los lista."
            " Sube educacion-bolsa/manifest.json (y revisa generado)."
        )

    print("\n" + "=" * 60)
    print("RESUMEN")
    print("=" * 60)
    smoke_ok = sum(1 for r in smoke if r["ok"])
    print(f"Smoke bootstrap: {smoke_ok}/{len(smoke)} OK")
    for cmp in comparisons:
        if cmp.get("error"):
            continue
        delta = len(cmp.get("solo_local") or [])
        if delta:
            print(f"  {cmp['sector']}: subir {delta} archivo(s) a R2")
        elif cmp.get("r2_count") == cmp.get("local_count"):
            print(f"  {cmp['sector']}: paridad OK ({cmp['local_count']})")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
