#!/usr/bin/env python3
"""Tests minimos de cobertura CLM (slug educacion, conteos)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from cobertura_clm import (  # noqa: E402
    _rel,
    contar_listados_manifest,
    slug_archivo,
)


class TestCoberturaClm(unittest.TestCase):
    def test_slug_archivo_acentos(self):
        self.assertEqual(
            slug_archivo("512 DISEÑO GRAFICO"),
            "512-diseno-grafico",
        )

    def test_rel_maestros(self):
        rel = _rel("0597", "031 EDUCACION INFANTIL")
        self.assertEqual(rel, "maestros/031-educacion-infantil.json")

    def test_contar_listados_excluye_metadata(self):
        man = {
            "archivos": [
                "maestros/031-educacion-infantil.json",
                "manifest.json",
                "categorias.json",
                "maestros/031-educacion-infantil.busqueda.json",
            ]
        }
        self.assertEqual(contar_listados_manifest(man), 1)

    def test_educacion_huecos_catalogo_96(self):
        from cobertura_clm import educacion_huecos

        cat = ROOT / "data/educacion/categorias.json"
        if not cat.is_file():
            self.skipTest("sin categorias educacion")
        edu = educacion_huecos()
        self.assertEqual(edu["catalogo"], 96)


if __name__ == "__main__":
    raise SystemExit(unittest.main())
