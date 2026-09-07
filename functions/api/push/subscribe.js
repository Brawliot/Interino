import { getSessionUser, json } from "../../shared/auth.js";
import { prefsNormalizadas } from "../../shared/pushCheck.js";

function validSub(sub) {
  return (
    sub &&
    typeof sub.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    sub.keys &&
    typeof sub.keys.p256dh === "string" &&
    typeof sub.keys.auth === "string"
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "DB no configurada" }, 503);
  if (!env.VAPID_PUBLIC_KEY) return json({ error: "Push no configurado (VAPID)" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  if (!validSub(body.subscription)) {
    return json({ error: "subscription inválida" }, 400);
  }

  const lista = Array.isArray(body.seguimientos) ? body.seguimientos : [];
  if (lista.length > 200) return json({ error: "Demasiados seguimientos" }, 400);

  const prefs = prefsNormalizadas(body.prefs);
  const user = await getSessionUser(env, request);
  const now = new Date().toISOString();
  const endpoint = body.subscription.endpoint;
  const p256dh = body.subscription.keys.p256dh;
  const auth = body.subscription.keys.auth;
  const payload = JSON.stringify(lista);
  const prefsJson = JSON.stringify(prefs);
  const userId = user?.userId || null;

  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, seguimientos_json, prefs_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       user_id = COALESCE(excluded.user_id, push_subscriptions.user_id),
       seguimientos_json = excluded.seguimientos_json,
       prefs_json = excluded.prefs_json,
       updated_at = excluded.updated_at`,
  )
    .bind(endpoint, p256dh, auth, userId, payload, prefsJson, now, now)
    .run();

  return json({ ok: true, count: lista.length, prefs });
}
