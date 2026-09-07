import {
  clearSessionCookie,
  cookieSecure,
  json,
  readCookie,
  COOKIE,
} from "../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const sid = readCookie(request, COOKIE);
  if (sid && env.DB) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }
  return json(
    { ok: true },
    200,
    { "Set-Cookie": clearSessionCookie({ secure: cookieSecure(env) }) },
  );
}
