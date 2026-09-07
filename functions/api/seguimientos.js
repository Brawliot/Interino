import { getSessionUser, json } from "../shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(env, request);
  if (!user) return json({ error: "No autenticado" }, 401);

  const row = await env.DB.prepare(
    "SELECT payload_json, updated_at FROM seguimientos WHERE user_id = ?",
  )
    .bind(user.userId)
    .first();

  let seguimientos = [];
  if (row?.payload_json) {
    try {
      const parsed = JSON.parse(row.payload_json);
      seguimientos = Array.isArray(parsed) ? parsed : [];
    } catch {
      seguimientos = [];
    }
  }

  return json({
    seguimientos,
    updatedAt: row?.updated_at || null,
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const user = await getSessionUser(env, request);
  if (!user) return json({ error: "No autenticado" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const lista = Array.isArray(body.seguimientos) ? body.seguimientos : null;
  if (!lista) return json({ error: "seguimientos debe ser un array" }, 400);
  if (lista.length > 200) return json({ error: "Demasiados seguimientos" }, 400);

  const now = new Date().toISOString();
  const payload = JSON.stringify(lista);
  await env.DB.prepare(
    `INSERT INTO seguimientos (user_id, payload_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
  )
    .bind(user.userId, payload, now)
    .run();

  return json({ ok: true, updatedAt: now, count: lista.length });
}
