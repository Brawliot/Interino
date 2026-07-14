#!/usr/bin/env python3
"""
Sube carpetas de datos a Cloudflare R2 (S3-compatible).

Variables de entorno:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET (default: interino-data)

Uso:
  python scripts/subir_sectores_r2.py
  python scripts/subir_sectores_r2.py --sectores educacion,admin-clm
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
    "educacion": ("data/educacion", "educacion"),
    "educacion-bolsa": ("data/educacion-bolsa", "educacion-bolsa"),
    "admin-clm": ("data/admin-clm", "admin-clm"),
}


def _cliente_s3():
    try:
        import boto3
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
    )


def _subir_carpeta(s3, bucket: str, local_dir: Path, prefix: str) -> int:
    if not local_dir.is_dir():
        print(f"SKIP {local_dir} (no existe)")
        return 0
    count = 0
    for path in local_dir.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(local_dir).as_posix()
        key = f"{prefix}/{rel}" if prefix else rel
        ctype, _ = mimetypes.guess_type(path.name)
        extra = {"ContentType": ctype or "application/octet-stream"}
        print(f"  {key}")
        s3.upload_file(str(path), bucket, key, ExtraArgs=extra)
        count += 1
    return count


def _sectores_desde_vigia() -> list[str]:
    if not SECTORES_R2_PATH.exists():
        return []
    try:
        return json.loads(SECTORES_R2_PATH.read_text(encoding="utf-8")).get("sectores") or []
    except json.JSONDecodeError:
        return []


def main() -> int:
    p = argparse.ArgumentParser(description="Subir sectores a R2")
    p.add_argument(
        "--sectores",
        help="Lista separada por comas (sanidad,educacion,educacion-bolsa,admin-clm). "
        "Por defecto lee vigia_sectores_r2.json",
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
    s3 = _cliente_s3()
    total = 0

    for sector in sectores:
        if sector not in MAPEO:
            print(f"AVISO sector desconocido: {sector}")
            continue
        local_rel, prefix = MAPEO[sector]
        local = ROOT / local_rel
        print(f"\n=== {sector} -> s3://{bucket}/{prefix or '(raíz)'} ===")
        total += _subir_carpeta(s3, bucket, local, prefix)

    print(f"\nSubidos {total} objetos a R2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
