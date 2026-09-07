import {
  appOrigin,
  cookieSecure,
  json,
  randomId,
  sessionCookie,
  sessionExpiresIso,
  sha256Hex,
} from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return json({ error: "Base de datos no configurada (D1)." }, 503);
  }

  const url = new URL(request.url);
  const rawToken = url.searchParams.get("token") || "";
  if (!rawToken || rawToken.length < 16) {
    return Response.redirect(`${appOrigin(env)}/?login=error`, 302);
  }

  const tokenHash = await sha256Hex(rawToken);
  const row = await env.DB.prepare(
    "SELECT email, expires_at, used_at FROM magic_tokens WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first();

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return Response.redirect(`${appOrigin(env)}/?login=expired`, 302);
  }

  const email = row.email;
  const now = new Date().toISOString();

  await env.DB.prepare("UPDATE magic_tokens SET used_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash)
    .run();

  let user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (!user) {
    const userId = randomId(16);
    await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
      .bind(userId, email, now)
      .run();
    user = { id: userId, email };
  }

  const sessionId = randomId(24);
  const expiresAt = sessionExpiresIso();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(sessionId, user.id, expiresAt, now)
    .run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appOrigin(env)}/?login=ok`,
      "Set-Cookie": sessionCookie(sessionId, undefined, { secure: cookieSecure(env) }),
    },
  });
}
