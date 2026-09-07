#!/usr/bin/env python3
"""Tests unitarios del histórico de snapshots (sin R2)."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from r2_archive import (
    archive_object_key,
    debe_archivar,
    fecha_previa,
    fechas_a_purgar,
    merge_index_fecha,
)


class TestR2Archive(unittest.TestCase):
    def test_archive_key_sanidad_raiz(self):
        self.assertEqual(
            archive_object_key("2026-09-07", "", "diplomado/enfermero.json"),
            "archive/2026-09-07/diplomado/enfermero.json",
        )

    def test_archive_key_con_prefijo(self):
        self.assertEqual(
            archive_object_key("2026-09-07", "murcia", "categorias.json"),
            "archive/2026-09-07/murcia/categorias.json",
        )

    def test_debe_archivar(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "a.json"
            p.write_text("{}", encoding="utf-8")
            self.assertTrue(debe_archivar(p))
            txt = Path(td) / "a.txt"
            txt.write_text("x", encoding="utf-8")
            self.assertFalse(debe_archivar(txt))

    def test_merge_y_purga(self):
        idx = merge_index_fecha(
            {},
            "2026-09-07",
            sectores=["sanidad"],
            archivos=3,
            bytes_total=100,
            retencion_dias=30,
        )
        idx = merge_index_fecha(
            idx,
            "2026-01-01",
            sectores=["educacion"],
            archivos=1,
            bytes_total=10,
            retencion_dias=30,
        )
        self.assertIn("2026-09-07", idx["fechas"])
        self.assertEqual(fecha_previa(idx, "2026-09-07"), "2026-01-01")
        purgar = fechas_a_purgar(idx, hoy="2026-09-07", retencion_dias=30)
        self.assertEqual(purgar, ["2026-01-01"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
