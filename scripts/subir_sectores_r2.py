#!/usr/bin/env python3
"""
Sube carpetas de datos a Cloudflare R2 (S3-compatible). Script unificado para CI y local.

Variables de entorno:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET (default: interino-data)

Uso:
  python scripts/subir_sectores_r2.py
  python scripts/subir_sectores_r2.py --sectores educacion,educacion-bolsa
  python scripts/subir_sectores_r2.py --sectores educacion-bolsa --skip-existing
  python scripts/subir_r2.ps1 -Sectores educacion-bolsa -SkipExisting
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTORES_R2_PATH = ROOT / "data" / "_local" / "vigia_sectores_r2.json"

MAPEO = {
    "sanidad": ("data/public", ""),
    "murcia": ("data/public/murcia", "murcia"),
    "madrid": ("data/public/madrid", "madrid"),
    "educacion": ("data/educacion", "educacion"),
    "educacion-bolsa": ("data/educacion-bolsa", "educacion-bolsa"),
    "admin-clm": ("data/admin-clm", "admin-clm"),
}

MANIFESTS = frozenset({"manifest.json", "afinidad.json", "categorias.json", "categorias_por_grupo.json", "categorias_sanidad.json"})


def _cliente_s3():
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError as exc:
        raise SystemExit("Instala boto3: pip install boto3") from exc

    account = os.environ.get("R2_ACCOUNT_ID")
    key = os.environ.get("R2_ACCESS_KEY_ID")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not all([account, key, secret]):
        raise SystemExit("Faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY")

    endpoint = f"https://{account}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        region_name="auto",
    ), ClientError


def _forzar_subida(nombre_archivo: str) -> bool:
    """Manifests y metadatos siempre se suben (evita R2 desincronizado)."""
    return nombre_archivo in MANIFESTS


def _objeto_igual_en_r2(s3, bucket: str, key: str, local: Path, ClientError) -> bool:
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
        return head.get("ContentLength") == local.stat().st_size
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def _subir_carpeta(
    s3,
    bucket: str,
    local_dir: Path,
    prefix: str,
    *,
    skip_existing: bool,
    ClientError,
) -> dict[str, int]:
    stats = {"subidos": 0, "omitidos": 0, "fallos": 0}
    if not local_dir.is_dir():
        print(f"SKIP {local_dir} (no existe)")
        return stats

    for path in sorted(local_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(local_dir).as_posix()
        key = f"{prefix}/{rel}" if prefix else rel
        forzar = _forzar_subida(path.name)

        if skip_existing and not forzar and _objeto_igual_en_r2(s3, bucket, key, path, ClientError):
            stats["omitidos"] += 1
            continue

        ctype, _ = mimetypes.guess_type(path.name)
        extra = {"ContentType": ctype or "application/octet-stream"}
        try:
            print(f"  {key}" + (" [manifest]" if forzar else ""))
            s3.upload_file(str(path), bucket, key, ExtraArgs=extra)
            stats["subidos"] += 1
        except ClientError as e:
            print(f"  FALLO {key}: {e}")
            stats["fallos"] += 1
    return stats


def _sectores_desde_vigia() -> list[str]:
    if not SECTORES_R2_PATH.exists():
        return []
    try:
        return json.loads(SECTORES_R2_PATH.read_text(encoding="utf-8")).get("sectores") or []
    except json.JSONDecodeError:
        return []


def main() -> int:
    p = argparse.ArgumentParser(description="Subir sectores CLM a R2 (boto3)")
    p.add_argument(
        "--sectores",
        help="Lista separada por comas (sanidad,murcia,madrid,educacion,educacion-bolsa,admin-clm). "
        "Por defecto lee vigia_sectores_r2.json",
    )
    p.add_argument(
        "--skip-existing",
        action="store_true",
        help="Omite archivos ya en R2 con el mismo tamano (manifests siempre se suben)",
    )
    args = p.parse_args()

    if args.sectores:
        sectores = [s.strip() for s in args.sectores.split(",") if s.strip()]
    else:
        sectores = _sectores_desde_vigia()
    if not sectores:
        print("Nada que subir (sin --sectores ni vigia_sectores_r2.json)")
        return 0

    bucket = os.environ.get("R2_BUCKET", "interino-data")
    s3, ClientError = _cliente_s3()
    totales = {"subidos": 0, "omitidos": 0, "fallos": 0}

    for sector in sectores:
        if sector not in MAPEO:
            print(f"AVISO sector desconocido: {sector}")
            continue
        local_rel, prefix = MAPEO[sector]
        local = ROOT / local_rel
        print(f"\n=== {sector} -> s3://{bucket}/{prefix or '(raiz)'} ===")
        stats = _subir_carpeta(
            s3, bucket, local, prefix, skip_existing=args.skip_existing, ClientError=ClientError
        )
        for k in totales:
            totales[k] += stats[k]
        print(
            f"Resumen {sector}: subidos={stats['subidos']} "
            f"omitidos={stats['omitidos']} fallos={stats['fallos']}"
        )

    print(
        f"\nTotal R2: subidos={totales['subidos']} "
        f"omitidos={totales['omitidos']} fallos={totales['fallos']}"
    )
    return 1 if totales["fallos"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
