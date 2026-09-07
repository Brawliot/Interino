import { json } from "../../shared/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "DB no configurada" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const endpoint = body.endpoint || body.subscription?.endpoint;
  if (!endpoint) return json({ error: "Falta endpoint" }, 400);

  await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
  return json({ ok: true });
}
