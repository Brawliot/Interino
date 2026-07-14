#!/usr/bin/env python3
"""Exploracion rapida portal facultativo SESCAM (cajon A/B)."""
from __future__ import annotations

import re
import sys

import requests

URL = (
    "https://sanidad.castillalamancha.es/profesionales/atencion-al-profesional/"
    "bolsas-constituidas/baremos/personal-facultativo"
)


def main() -> int:
    r = requests.get(URL, timeout=30, headers={"User-Agent": "interino-probe/1.0"})
    html = r.text
    print(f"status={r.status_code} bytes={len(html)}")
    opts = re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)</option>', html, re.I)
    print(f"options en HTML estatico: {len(opts)}")
    for v, t in opts[:20]:
        print(f"  {v!r} -> {t.strip()[:60]}")
    apis = sorted(set(re.findall(r'["\'](/[^"\']*(?:ajax|api|json)[^"\']*)["\']', html, re.I)))
    print(f"urls ajax/api/json: {len(apis)}")
    for u in apis[:15]:
        print(f"  {u}")
    if len(opts) <= 1:
        print("\nConclusion: Cajon B — categorias cargadas por JS; requiere investigar endpoint Drupal.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
