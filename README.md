# App de consulta de bolsas de empleo público

App para que personas apuntadas a bolsas de empleo público temporal (interinos/opositores) consulten su posición y puntuación buscando por nombre y apellidos — replicando datos que la administración ya publica, pero de forma mucho más accesible que sus portales oficiales. Incluye seguimiento de varias bolsas a la vez, avisos de cambios y (en sanidad) estimación de "zona de riesgo" de llamamiento basada en la tendencia histórica del punto de corte.

Desarrollador único (estudiante de Informática + ADE), con un mes de dedicación intensiva antes de volver a tener poco tiempo por estudios.

## Decisiones cerradas (no reabrir sin motivo nuevo)

- **Monetización — freemium.** Consulta básica gratis siempre (es dato público). De pago (2,99 €, por debajo de la competencia a 4,99 €): notificaciones, seguimiento de varias bolsas, zona de riesgo con tendencia. Primeros 100 usuarios gratis de por vida. **No activar cobros** hasta hacer la consulta legal y validar gratis con usuarios reales.
- **Lanzamiento — web (posible PWA en el futuro), no tiendas.** Sin Capacitor/React Native por ahora. Se evitan los costes de Apple (99 $/año) y Google (25 $) hasta tener usuarios que lo justifiquen.
- **Base de datos:** de momento JSON en el repo; Supabase recomendada para cuando toque migrar. **Backend:** GitHub Actions basta para el scraper diario; nada de Railway salvo necesidad real de backend propio.
- **Privacidad:** nunca pedir DNI completo — se busca por apellidos, igual que el propio listado público.
- **Honestidad del copy:** el "punto de corte" mostrado es la puntuación mínima ADMITIDA actual, no "la última persona llamada" (ese dato el SESCAM no lo publica). Mantener este matiz en cualquier texto nuevo.

## Regla de oro (aplicar siempre)

Antes de comprometer desarrollo en cualquier fuente nueva (comunidad, sector o grupo profesional), clasificarla en **máximo 1 hora** de exploración:

- **Cajón A (seguir):** PDF público, sin login, texto seleccionable, patrón de nombre de archivo reconstruible o enlaces localizables sin rastreo masivo.
- **Cajón B (parar):** requiere login/certificado para el dato personal, aplicación dinámica sin patrón claro, o datos escaneados (OCR).

No seguir invirtiendo en una fuente de Cajón B "porque ya se ha empezado" — cortar pronto y priorizar otra.

## Sectores CLM (estado jul 2026)

| Sector | App | Scraper | R2 | Notas |
|--------|-----|---------|-----|-------|
| **Sanidad** | ✅ 4 grupos activos | ✅ `scraper.py` | ✅ ~227 listados | Facultativo sin categorías en portal |
| **Educación** | ✅ 3 modos (disponibles / bolsa / AFIN) | ✅ | ⚠️ bolsa manifest | Ver `docs/OPERACION.md` |
| **Administración** | ✅ 91 bolsas | ✅ `scraper_admin_clm.py` | ✅ ~150 listados | 4 bolsas sin PDF en portal |
| **Murcia / Madrid** | ✅ sanidad | Parcial | ❌ no en R2 | Metadatos + docs expansión |

Producción: **https://interino.pages.dev** · Datos: bucket R2 `interino-data`.

### Fase 4 — crecimiento (jul 2026)

- **Freemium:** `src/plan.js` — beta gratis (`BETA_GRATIS`), límites preparados sin Stripe.
- **Backup seguimientos:** export/import JSON en pantalla Seguimientos (`src/seguimientos-backup.js`).
- **Expansión CCAA:** Murcia/Madrid en `subir_sectores_r2.py`, `scripts/estado_regiones.py`, avisos UI si R2 vacío.
- **Docs:** `docs/PLAN-PRODUCTO.md`, `docs/EXPANSION-CCAA.md`, `docs/TEXTO-BETA.md`, `docs/APP-STORES.md`.
- **Plantilla env:** `.env.example` (Supabase futuro).

## Sanidad CLM (5 grupos)

| Grupo | Estado |
|-------|--------|
| Diplomado | ✅ datos reales |
| Licenciados | ✅ |
| Técnico | ✅ |
| Gestión y servicios | ✅ |
| Facultativo | ⚠️ portal sin listado estático (dropdown vacío) |

## Operación y CI

- **Vigía diario:** `.github/workflows/daily_scraper.yml` — detecta cambios, scrapea, regenera `afinidad.json` si educación cambia, sube a R2 con `--skip-existing`.
- **Auditoría R2:** `.github/workflows/auditar_r2.yml` + `python scripts/auditar_paridad_clm.py`.
- **Runbook:** `docs/OPERACION.md`.
- **Subida R2 unificada:** `scripts/subir_sectores_r2.py` (boto3) o `scripts/subir_r2.ps1` / `subir_educacion_r2.ps1` (local).

Secrets GitHub: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

## App (React + Vite)

- `listas-app.jsx` — búsqueda por apellidos, seguimientos, listado completo, histórico de corte, hub de herramientas.
- Sectores CLM en selector; educación con modos **disponibles**, **bolsa ordinaria** y **bolsas afines** (Orden 32/2018).
- Datos desde R2 en producción (`VITE_DATA_CATEGORIAS_URL` en `.env.production`).

### Pendiente producto (no bloquea consulta básica)

1. ~~PWA (manifest, iconos)~~ — hecho (`public/manifest.webmanifest`, `sw.js`).
2. Dominio propio — ver `docs/DEPLOY.md`.
3. ~~Feedback in-app~~ — email en pantalla Más.
4. Push en segundo plano (requiere backend/VAPID; ahora notificaciones locales al activar seguimiento).
5. Consulta legal antes de freemium / cobros.
6. Murcia/Madrid en R2 si se promocionan esas CCAA — ver `docs/EXPANSION-CCAA.md` y `python scripts/estado_regiones.py`.
7. Activar freemium / Stripe tras consulta legal — ver `docs/PLAN-PRODUCTO.md`.

## Legal

Sin consulta con abogado todavía (decisión consciente). Mitigaciones aplicadas: lanzar gratis primero, canal de baja/contacto visible, no enriquecer datos más allá de lo público, retención mínima (snapshot diario; histórico sin datos personales). **Antes de activar cobros, hacer la consulta legal puntual.**

## Promoción (para el lanzamiento)

Grupos de Telegram/Facebook de "Plataforma de Afectados por la Bolsa del Sescam", foros de oposiciones sanitarias (buscaoposiciones.com), Diario Sanitario, grupos de Facebook por categoría en CLM. Presentarlo como petición genuina de feedback, no como promoción directa.
