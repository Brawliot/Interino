import { buildPushPayload } from "@block65/webcrypto-web-push";
import { json } from "../../shared/auth.js";
import {
  evaluarSeguimiento,
  prefsNormalizadas,
  textoAviso,
  tocaComprobar,
} from "../../shared/pushCheck.js";

function unauthorized() {
  return json({ error: "unauthorized" }, 401);
}

function authOk(request, env) {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const h = request.headers.get("Authorization") || "";
  return h === `Bearer ${secret}`;
}

async function enviarPush(env, row, message) {
  const vapid = {
    subject: env.VAPID_SUBJECT || "mailto:fedebotija@gmail.com",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const subscription = {
    endpoint: row.endpoint,
    expirationTime: null,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  const payload = await buildPushPayload(
    {
      data: {
        title: message.title,
        body: message.body,
        tag: message.tag,
        url: "/?paso=seguimientos",
      },
      options: { ttl: 60 * 60 * 24, urgency: "normal" },
    },
    subscription,
    vapid,
  );
  const res = await fetch(row.endpoint, payload);
  return res.status;
}

/**
 * Cron: reconsulta R2 y envía Web Push según preferencias de cada suscripción.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authOk(request, env)) return unauthorized();
  if (!env.DB) return json({ error: "DB no configurada" }, 503);
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID no configurado" }, 503);
  }

  const r2Base =
    env.R2_PUBLIC_URL ||
    env.VITE_DATA_CATEGORIAS_URL ||
    "https://pub-1d2aaf9854a14a9b98dac42c39874392.r2.dev/";

  const { results } = await env.DB.prepare(
    "SELECT endpoint, p256dh, auth, seguimientos_json, prefs_json, last_checked_at FROM push_subscriptions",
  ).all();

  const rows = results || [];
  let checked = 0;
  let skipped = 0;
  let notified = 0;
  let gone = 0;
  let errors = 0;

  for (const row of rows) {
    let prefs = {};
    try {
      prefs = JSON.parse(row.prefs_json || "{}");
    } catch {
      prefs = {};
    }
    prefs = prefsNormalizadas(prefs);

    if (!tocaComprobar(prefs, row.last_checked_at)) {
      skipped += 1;
      continue;
    }

    checked += 1;
    let lista = [];
    try {
      lista = JSON.parse(row.seguimientos_json || "[]");
    } catch {
      lista = [];
    }
    if (!Array.isArray(lista) || !lista.length) {
      await env.DB.prepare("UPDATE push_subscriptions SET last_checked_at = ? WHERE endpoint = ?")
        .bind(new Date().toISOString(), row.endpoint)
        .run();
      continue;
    }

    const evaluaciones = [];
    for (const seg of lista) {
      // eslint-disable-next-line no-await-in-loop
      evaluaciones.push(await evaluarSeguimiento(r2Base, seg));
    }

    const aviso = textoAviso(evaluaciones, prefs);
    const listaNueva = evaluaciones.map((e) => e.seguimiento);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE push_subscriptions
       SET seguimientos_json = ?, last_checked_at = ?, updated_at = ?
       WHERE endpoint = ?`,
    )
      .bind(JSON.stringify(listaNueva), now, now, row.endpoint)
      .run();

    if (!aviso) continue;

    try {
      const status = await enviarPush(env, row, aviso);
      if (status === 404 || status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
          .bind(row.endpoint)
          .run();
        gone += 1;
      } else if (status >= 200 && status < 300) {
        notified += 1;
      } else {
        errors += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return json({
    ok: true,
    subscriptions: rows.length,
    checked,
    skipped,
    notified,
    gone,
    errors,
  });
}
