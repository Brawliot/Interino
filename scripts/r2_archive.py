#!/usr/bin/env python3
"""
Histórico de snapshots de listados en R2 (todos los sectores del MAPEO).

Convención:
  archive/YYYY-MM-DD/{prefijo_live}/…mismos paths que live…
  archive/index.json  — fechas disponibles, sectores y conteos

No sustituye el “latest”: convive con la subida normal.
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ARCHIVE_ROOT = "archive"
INDEX_KEY = f"{ARCHIVE_ROOT}/index.json"
DEFAULT_RETENTION_DAYS = 730  # ~24 meses


def fecha_hoy_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def archive_object_key(fecha: str, live_prefix: str, rel: str) -> str:
    """Clave R2 del snapshot. live_prefix '' (sanidad) → archive/fecha/rel."""
    rel = rel.lstrip("/")
    if live_prefix:
        return f"{ARCHIVE_ROOT}/{fecha}/{live_prefix}/{rel}"
    return f"{ARCHIVE_ROOT}/{fecha}/{rel}"


def debe_archivar(path: Path) -> bool:
    """Solo JSON de datos; ignora basura local."""
    if not path.is_file():
        return False
    name = path.name
    if not name.endswith(".json"):
        return False
    if name.startswith("."):
        return False
    return True


def sha256_archivo(path: Path, chunk: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def index_vacio(retencion_dias: int = DEFAULT_RETENTION_DAYS) -> dict[str, Any]:
    return {
        "version": 1,
        "retencion_dias": retencion_dias,
        "actualizado": None,
        "fechas": {},
    }


def merge_index_fecha(
    index: dict[str, Any],
    fecha: str,
    *,
    sectores: list[str],
    archivos: int,
    bytes_total: int,
    retencion_dias: int,
) -> dict[str, Any]:
    out = dict(index) if index else index_vacio(retencion_dias)
    out["version"] = 1
    out["retencion_dias"] = retencion_dias
    out["actualizado"] = datetime.now(timezone.utc).isoformat()
    fechas = dict(out.get("fechas") or {})
    prev = dict(fechas.get(fecha) or {})
    secs = sorted(set(prev.get("sectores") or []) | set(sectores))
    fechas[fecha] = {
        "sectores": secs,
        "archivos": int(prev.get("archivos") or 0) + int(archivos),
        "bytes": int(prev.get("bytes") or 0) + int(bytes_total),
    }
    out["fechas"] = dict(sorted(fechas.items(), reverse=True))
    return out


def fechas_a_purgar(index: dict[str, Any], *, hoy: str | None = None, retencion_dias: int | None = None) -> list[str]:
    hoy_d = date.fromisoformat(hoy or fecha_hoy_utc())
    dias = int(retencion_dias if retencion_dias is not None else index.get("retencion_dias") or DEFAULT_RETENTION_DAYS)
    limite = hoy_d - timedelta(days=dias)
    out = []
    for f in (index.get("fechas") or {}):
        try:
            if date.fromisoformat(f) < limite:
                out.append(f)
        except ValueError:
            continue
    return sorted(out)


def fecha_previa(index: dict[str, Any], fecha: str) -> str | None:
    anteriores = sorted((f for f in (index.get("fechas") or {}) if f < fecha), reverse=True)
    return anteriores[0] if anteriores else None


def _head_size(s3, bucket: str, key: str, ClientError) -> int | None:
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
        return int(head.get("ContentLength") or 0)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return None
        raise


def leer_index(s3, bucket: str, ClientError) -> dict[str, Any]:
    try:
        obj = s3.get_object(Bucket=bucket, Key=INDEX_KEY)
        raw = obj["Body"].read().decode("utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            return index_vacio()
        data.setdefault("fechas", {})
        return data
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return index_vacio()
        raise
    except (json.JSONDecodeError, UnicodeDecodeError):
        return index_vacio()


def _leer_index(s3, bucket: str, ClientError) -> dict[str, Any]:
    """Alias compat."""
    return leer_index(s3, bucket, ClientError)

def _guardar_index(s3, bucket: str, index: dict[str, Any]) -> None:
    body = json.dumps(index, ensure_ascii=False, indent=2).encode("utf-8")
    s3.put_object(
        Bucket=bucket,
        Key=INDEX_KEY,
        Body=body,
        ContentType="application/json; charset=utf-8",
        CacheControl="no-cache, max-age=0, must-revalidate",
    )


def _borrar_prefijo(s3, bucket: str, prefix: str) -> int:
    """Borra todos los objetos bajo prefix. Devuelve cuántos."""
    borrados = 0
    token = None
    while True:
        kw: dict[str, Any] = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kw["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kw)
        contents = resp.get("Contents") or []
        if contents:
            # delete_objects máx 1000
            for i in range(0, len(contents), 1000):
                chunk = contents[i : i + 1000]
                s3.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": [{"Key": o["Key"]} for o in chunk], "Quiet": True},
                )
                borrados += len(chunk)
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return borrados


def archivar_carpeta(
    s3,
    bucket: str,
    local_dir: Path,
    live_prefix: str,
    *,
    sector: str,
    fecha: str,
    index: dict[str, Any],
    ClientError,
) -> dict[str, int]:
    """
    Copia JSON locales a archive/{fecha}/…
    Omite si ya existe hoy con el mismo tamaño (re-run del mismo día).
    """
    stats = {"subidos": 0, "omitidos": 0, "fallos": 0, "bytes": 0}
    if not local_dir.is_dir():
        print(f"  ARCHIVE SKIP {local_dir} (no existe)")
        return stats

    _ = index  # reserva: dedupe multi-día vía index en el futuro
    for path in sorted(local_dir.rglob("*")):
        if not debe_archivar(path):
            continue
        rel = path.relative_to(local_dir).as_posix()
        key = archive_object_key(fecha, live_prefix, rel)
        size = path.stat().st_size

        existing = _head_size(s3, bucket, key, ClientError)
        if existing is not None and existing == size:
            stats["omitidos"] += 1
            continue

        try:
            print(f"  ARCHIVE {key}")
            s3.upload_file(
                str(path),
                bucket,
                key,
                ExtraArgs={
                    "ContentType": "application/json; charset=utf-8",
                    "CacheControl": "public, max-age=31536000, immutable",
                    "Metadata": {
                        "sector": sector,
                        "fecha": fecha,
                        "sha256": sha256_archivo(path)[:32],
                    },
                },
            )
            stats["subidos"] += 1
            stats["bytes"] += size
        except ClientError as e:
            print(f"  ARCHIVE FALLO {key}: {e}")
            stats["fallos"] += 1
    return stats


def actualizar_index_y_retencion(
    s3,
    bucket: str,
    *,
    fecha: str,
    sector_stats: dict[str, dict[str, int]],
    retencion_dias: int,
    ClientError,
    purgar: bool = True,
) -> dict[str, Any]:
    index = _leer_index(s3, bucket, ClientError)
    sectores = list(sector_stats.keys())
    archivos = sum(s.get("subidos", 0) for s in sector_stats.values())
    bytes_total = sum(s.get("bytes", 0) for s in sector_stats.values())
    # Aunque todo se omita por dedupe, registramos la fecha si hubo intento
    # (sectores tocados hoy) para que la app sepa “hubo run”.
    if not archivos and sectores:
        # Marca fecha con 0 archivos nuevos pero sectores observados
        index = merge_index_fecha(
            index,
            fecha,
            sectores=sectores,
            archivos=0,
            bytes_total=0,
            retencion_dias=retencion_dias,
        )
    else:
        index = merge_index_fecha(
            index,
            fecha,
            sectores=sectores,
            archivos=archivos,
            bytes_total=bytes_total,
            retencion_dias=retencion_dias,
        )

    if purgar:
        for vieja in fechas_a_purgar(index, hoy=fecha, retencion_dias=retencion_dias):
            pref = f"{ARCHIVE_ROOT}/{vieja}/"
            n = _borrar_prefijo(s3, bucket, pref)
            print(f"  RETENCION borrados {n} objetos bajo {pref}")
            index.get("fechas", {}).pop(vieja, None)

    _guardar_index(s3, bucket, index)
    print(f"  INDEX actualizado → s3://{bucket}/{INDEX_KEY}")
    return index
