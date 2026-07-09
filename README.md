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

## Estructura del mercado

**Niveles:** Autonómico (donde trabajamos ahora) → Provincial/Gerencial (resuelto como filtro; en sanidad CLM, 13 gerencias) → Estatal (no explorado, no priorizado).

**Sectores:**

- **Sanidad** — ✅ investigado, scraper funcionando (ver abajo). Sin competencia de apps dedicadas. Prioridad máxima.
- **Administración General** — ⚠️ superficial. PDFs públicos sin login en empleopublico.castillalamancha.es, pero sin fórmula de nombre de archivo fija (hay que rastrear enlaces). Sin competencia detectada. Segunda prioridad.
- **Educación** — ⚠️ superficial. Baremos públicos en PDFs adjuntos a resoluciones, sin patrón de URL. Mercado saturado (4-5 apps establecidas). Baja prioridad.

## Subsectores de Sanidad CLM (5 grupos profesionales)

Viven en `sanidad.castillalamancha.es/profesionales/atencion-al-profesional/bolsas-constituidas/baremos/{slug}`:

| Grupo | Estado scraper | Notas |
|---|---|---|
| personal-sanitario-diplomado | ✅ funcionando | Enfermero/a (+7 especialidades), Fisioterapeuta, Logopeda, Óptico-Optometrista, Podólogo/a, Terapeuta Ocupacional, Dietista-Nutricionista. 14 categorías, datos reales confirmados. |
| personal-facultativo | ❌ pendiente | Categorías no extraídas. |
| personal-sanitario-licenciados | ❌ pendiente | Categorías no extraídas. |
| personal-sanitario-tecnico | ❌ pendiente | Categorías no extraídas (TCAE, laboratorio, radiodiagnóstico…). |
| personal-de-gestion-y-servicios | ❌ pendiente | Categorías no extraídas (aux. administrativo, celador…). |

**Hipótesis no verificada:** los 5 grupos probablemente comparten carpeta de PDFs y patrón de nombre de archivo confirmado con Enfermería — comprobar con un PDF real de cada grupo antes de dar nada por bueno.

## Estado técnico actual

### Hecho y funcionando

- `scraper.py` — descarga y parsea los PDFs reales (grupo diplomado), con reintentos, presupuesto de tiempo total, y guardado en `data/latest.json` (snapshot diario, se sobrescribe) y `data/historico.json` (agregado por categoría+gerencia+ámbito+fecha, sin datos personales).
- `.github/workflows/daily_scraper.yml` — ejecución diaria, `timeout-minutes: 45`, caché de pip, commit + push del resultado.
- `requirements.txt` — necesario para la caché de pip.
- `politica-privacidad.md` — borrador, pendiente rellenar contacto real.
- **Prototipo React (`listas-app.jsx`)** con: búsqueda por apellidos, desambiguación de coincidencias, "mis seguimientos", listado completo consultable, aviso de listado desactualizado, gráfico de tendencia del corte, aviso legal, notificaciones simuladas con aviso de que no sustituyen la llamada oficial.

### Novedad (esta sesión): prototipo con los 5 grupos profesionales

El prototipo ya cubre la estructura completa de subsectores de sanidad:

- `GRUPOS_SANIDAD` sustituye a la antigua lista plana de categorías: los 5 grupos, cada uno con flag `activo` y su lista de categorías. Solo *diplomado* está activo, con sus 7 categorías reales. Los otros 4 llevan **categorías de ejemplo (inventadas, sustituir por las reales cuando se extraigan del portal)**.
- Selector de "Grupo profesional" en la pantalla de búsqueda, con el de categoría dependiente. Grupos pendientes marcados como "· datos de ejemplo".
- `estadoActualizacion()` se deriva del grupo: cualquier categoría de un grupo sin scraper muestra automáticamente el aviso "sin scraping activo", sin hardcodear categorías.
- Las búsquedas recientes sincronizan el grupo al recuperarlas.

### Pendiente, bloqueante para publicar (en orden)

1. **Conectar la app a `data/latest.json`** — ahora usa datos inventados (`generarListadoCompleto()`). Sin esto no hay producto, hay maqueta.
2. **Selector de Gerencia** en la búsqueda — el dato está por categoría+gerencia+ámbito pero la UI solo pregunta grupo+categoría+apellidos.
3. Decidir qué mostrar en "zona de riesgo" sin histórico suficiente (día 1 habrá 1 solo día de datos).
4. Nombre definitivo + disponibilidad de dominio (y nombre de paquete por si algún día hay tiendas).
5. Envoltorio PWA: manifest.json, iconos, meta tags.
6. Dominio real donde alojar PWA y política de privacidad.
7. Prueba extremo a extremo con un nombre real conocido, con datos reales.

## Legal

Sin consulta con abogado todavía (decisión consciente). Mitigaciones aplicadas: lanzar gratis primero, canal de baja/contacto visible, no enriquecer datos más allá de lo público, retención mínima (snapshot diario; histórico sin datos personales). **Antes de activar cobros, hacer la consulta legal puntual.**

## Promoción (para el lanzamiento)

Grupos de Telegram/Facebook de "Plataforma de Afectados por la Bolsa del Sescam", foros de oposiciones sanitarias (buscaoposiciones.com), Diario Sanitario, grupos de Facebook por categoría en CLM. Presentarlo como petición genuina de feedback, no como promoción directa.
