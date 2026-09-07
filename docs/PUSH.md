# Web Push (avisos en segundo plano)

Cuando hay cambios de posición en seguimientos, Interino puede avisar **sin abrir la app** (Web Push + Service Worker).

## Arquitectura

| Pieza | Rol |
|-------|-----|
| `public/sw.js` | `push` + `notificationclick` |
| `POST /api/push/subscribe` | Guarda endpoint + claves + seguimientos en D1 |
| `POST /api/push/unsubscribe` | Borra la suscripción |
| `GET /api/push/vapid-public-key` | Clave pública para `PushManager.subscribe` |
| `POST /api/cron/push-check` | Reconsulta R2 y envía avisos (`Authorization: Bearer CRON_SECRET`) |
| Vigía diario | Tras scrape/commit, llama al cron |

No hace falta estar logueado: la suscripción se identifica por el `endpoint` del navegador. Si hay sesión, se guarda también `user_id`.

## Preferencias

En **Seguimientos → Avisos** (y en `prefs_json` de D1):

| Campo | Valores | Default |
|-------|---------|---------|
| `frecuencia` | `diaria` · `cada_3_dias` · `semanal` | `diaria` |
| `avisosPosicion` | bool | `true` |
| `avisosAdjudicacion` | bool | `true` |

El vigía llama al cron a diario. Si la frecuencia es menor, esa suscripción se **omite** hasta que `last_checked_at` cumpla el intervalo.

**Adjudicación:** si el listado carga bien y la persona (con posición previa) ya no aparece → aviso «fuera del listado» (posible adjudicación o desactivación; no es fuente oficial).

## Migración D1

```bash
npx wrangler d1 migrations apply interino-auth --remote
npx wrangler d1 migrations apply interino-auth --local
```

Tablas/columnas: `push_subscriptions` (`0002_push.sql`, `0003_push_prefs.sql` con `prefs_json` y `last_checked_at`).

## Secrets (Pages + GitHub)

Genera claves VAPID (una sola vez):

```bash
npx --yes web-push generate-vapid-keys
```

### Cloudflare Pages → Settings → Environment variables / Secrets

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `VAPID_PUBLIC_KEY` | secret | Clave pública (también la sirve la API) |
| `VAPID_PRIVATE_KEY` | secret | Clave privada (solo servidor) |
| `VAPID_SUBJECT` | var | p.ej. `mailto:tu@email` (ya en `wrangler.toml`) |
| `CRON_SECRET` | secret | Token aleatorio largo para el cron |
| `R2_PUBLIC_URL` | var | Base pública del bucket (ya en `wrangler.toml`) |

### GitHub → Actions secrets

| Secret | Descripción |
|--------|-------------|
| `CRON_SECRET` | El mismo valor que en Pages |
| `PUSH_CRON_URL` | Opcional. Default: `https://interino.pages.dev/api/cron/push-check` |

## Probar a mano

```bash
curl -X POST -H "Authorization: Bearer TU_CRON_SECRET" \
  https://interino.pages.dev/api/cron/push-check
```

Respuesta típica: `{ ok, subscriptions, checked, skipped, notified, gone, errors }`.

## Cliente

1. Usuario permite notificaciones al seguir una lista.
2. La app registra SW, suscribe `PushManager` y llama a `/api/push/subscribe`.
3. Cada cambio de seguimientos locales se re-sincroniza con el servidor.
4. Al abrir la app sigue habiendo refresco local (redundancia útil si el push falló).

## Privacidad

Se almacenan: endpoint de push, claves de cifrado de la suscripción, preferencias de avisos, y un resumen de seguimientos (categoría, gerencia, DNI parcial / nombre, snapshot de posición). Sin contenido de listados completos.
