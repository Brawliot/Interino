# Operacion Interino CLM

Runbook para mantener datos en R2, vigia diario y comprobaciones.

## Arquitectura rapida

| Capa | Que es |
|------|--------|
| **App** | Cloudflare Pages (`interino.pages.dev`) |
| **Datos** | Bucket R2 `interino-data` (URL publica en `.env.production`) |
| **Scrapers** | Python local + GitHub Actions (`Vigia diario CLM`) |
| **Repo** | Metadatos y sanidad en git; listados grandes solo en disco/R2 |

## Comprobaciones

```bash
# Completa (local + R2) — ejecutar en tu PC tras scrape/subida
python scripts/auditar_paridad_clm.py

# Solo URLs de produccion (CI o comprobar sin datos locales)
python scripts/auditar_paridad_clm.py --smoke
```

Workflow GitHub: **Auditoria paridad R2** (lunes + manual).

## Subir datos a R2

### Opcion A — boto3 (CI y local con API token)

Variables de entorno:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (opcional, default `interino-data`)

```powershell
# Desde la raiz del repo
.\scripts\subir_r2.ps1 -Sectores educacion-bolsa -SkipExisting
.\scripts\subir_r2.ps1 -Sectores sanidad,educacion,educacion-bolsa,admin-clm -SkipExisting
```

O directamente:

```bash
python scripts/subir_sectores_r2.py --sectores educacion-bolsa --skip-existing
```

**Importante:** `manifest.json`, `afinidad.json` y `categorias.json` **siempre se suben**, aunque uses `--skip-existing`. Evita el bug de JSON en R2 pero manifest desactualizado.

### Opcion B — wrangler (solo educacion, sin boto3)

```powershell
npx wrangler login   # primera vez
.\scripts\subir_educacion_r2.ps1 -SkipExisting -Solo educacion-bolsa
```

Con `-SkipExisting`, los manifests (`manifest.json`, `afinidad.json`) **siempre se re-suben**.

## Vigia diario (GitHub Actions)

Workflow: `.github/workflows/daily_scraper.yml`

1. `vigia.py` — detecta cambios en portales CLM
2. Si hay cambios → `ejecutar_vigia_scrapers.py` (scrape por sector)
3. Si educacion cambio → regenera `data/educacion/afinidad.json`
4. Sube sectores afectados a R2 (`subir_sectores_r2.py --skip-existing`)
5. Commit sanidad + metadatos admin + estado vigia

Secrets necesarios en GitHub → Settings → Secrets → Actions:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Probar: Actions → **Vigia diario CLM** → Run workflow.

## Scrape manual

```bash
python vigia.py
python scripts/ejecutar_vigia_scrapers.py
python scripts/scrape_educacion_faltantes.py
python scripts/generar_afinidad_educacion.py
```

## Problemas frecuentes

| Sintoma | Causa | Solucion |
|---------|-------|----------|
| App muestra menos especialidades educacion bolsa | `educacion-bolsa/manifest.json` en R2 viejo | Subir manifest (forzado) con subir_r2 o wrangler |
| Modo AFIN vacio | Falta `educacion/afinidad.json` en R2 | `generar_afinidad_educacion.py` + subir educacion |
| Facultativo sin categorias | Portal SESCAM sin listado estatico | `python scripts/probe_facultativo_clm.py` (Cajon B) |

## Informes

```bash
python scripts/informe_clm.py
python scripts/informe_clm.py -o data/_local/informe_clm.md
python scripts/test_cobertura_clm.py
```
| Murcia/Madrid 404 en smoke | No subidos a R2 | Subir `data/public/murcia/` y metadatos Madrid si los usas |
| Subida wrangler interrumpida | Rate limit / 503 | Repetir con `-SkipExisting` |

## CORS

Sin CORS en el bucket, la app en Pages no puede leer R2 desde el navegador. Policy: `r2-cors.json` en la raiz del repo.

## Que no esta en git

Por tamano (`.gitignore`):

- `data/educacion/**/*.json` (listados)
- `data/educacion-bolsa/**/*.json`
- `data/admin-clm/**/listados`
- `data/public/diplomado|tecnico|.../*.json`

**Fuente de verdad en produccion:** R2. Backup local recomendado.
