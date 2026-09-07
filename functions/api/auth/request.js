import {
  MAGIC_MINUTES,
  appOrigin,
  expiresIso,
  isDevMode,
  json,
  normalizeEmail,
  randomId,
  sendMagicEmail,
  sha256Hex,
  validEmail,
} from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) {
    return json({ error: "Base de datos no configurada (D1)." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const email = normalizeEmail(body.email);
  if (!validEmail(email)) {
    return json({ error: "Email no válido" }, 400);
  }

  const rawToken = randomId(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = expiresIso(MAGIC_MINUTES);

  await env.DB.prepare(
    "INSERT INTO magic_tokens (token_hash, email, expires_at, used_at) VALUES (?, ?, ?, NULL)",
  )
    .bind(tokenHash, email, expiresAt)
    .run();

  const link = `${appOrigin(env)}/api/auth/callback?token=${encodeURIComponent(rawToken)}`;
  const mailed = await sendMagicEmail(env, email, link);
  if (!mailed.ok) {
    return json({ error: mailed.error || "No se pudo enviar el correo" }, 502);
  }

  const payload = {
    ok: true,
    message: isDevMode(env)
      ? "Modo desarrollo: usa el enlace devLink (no se envió email)."
      : "Si el email existe o es nuevo, te hemos enviado un enlace. Revisa la bandeja de entrada.",
  };
  if (isDevMode(env)) payload.devLink = link;
  return json(payload);
}
