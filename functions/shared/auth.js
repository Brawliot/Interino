/** Helpers compartidos para Pages Functions (auth). */

export const COOKIE = "interino_session";
export const MAGIC_MINUTES = 30;
export const SESSION_DAYS = 30;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function appOrigin(env) {
  return (env.APP_ORIGIN || "https://interino.pages.dev").replace(/\/$/, "");
}

export function isDevMode(env) {
  return env.AUTH_DEV_MODE === "1" || env.AUTH_DEV_MODE === "true";
}

export function randomId(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sessionCookie(sessionId, maxAgeSec = SESSION_DAYS * 86400, { secure = true } = {}) {
  const parts = [
    `${COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie({ secure = true } = {}) {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function cookieSecure(env) {
  if (isDevMode(env)) return false;
  return appOrigin(env).startsWith("https");
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    if (p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}

export function expiresIso(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function sessionExpiresIso() {
  return expiresIso(SESSION_DAYS * 24 * 60);
}

export async function getSessionUser(env, request) {
  const sid = readCookie(request, COOKIE);
  if (!sid || !env.DB) return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
  )
    .bind(sid)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }
  return { sessionId: row.session_id, userId: row.user_id, email: row.email };
}

export async function sendMagicEmail(env, email, link) {
  if (isDevMode(env)) {
    return { ok: true, dev: true };
  }
  const key = env.RESEND_API_KEY;
  const from = env.AUTH_FROM_EMAIL || "Interino <onboarding@resend.dev>";
  if (!key) {
    return { ok: false, error: "Falta RESEND_API_KEY (o activa AUTH_DEV_MODE=1)" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Tu enlace para entrar en Interino",
      text: `Entra en Interino con este enlace (válido ${MAGIC_MINUTES} min):\n\n${link}\n\nSi no lo pediste, ignora este correo.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}
