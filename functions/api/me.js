import { clearSessionCookie, cookieSecure, getSessionUser, isDevMode, json } from "../shared/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return json({ user: null, authConfigured: false, authDevMode: false });
  }
  const user = await getSessionUser(env, request);
  if (!user) {
    return json(
      { user: null, authConfigured: true, authDevMode: isDevMode(env) },
      200,
      { "Set-Cookie": clearSessionCookie({ secure: cookieSecure(env) }) },
    );
  }
  return json({
    user: { id: user.userId, email: user.email },
    authConfigured: true,
    authDevMode: isDevMode(env),
  });
}
