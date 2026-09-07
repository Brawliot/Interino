import { json } from "../../shared/auth.js";

/** Clave pública VAPID para que el cliente se suscriba. */
export async function onRequestGet(context) {
  const { env } = context;
  const publicKey = env.VAPID_PUBLIC_KEY || "";
  if (!publicKey) {
    return json({ configured: false, publicKey: null });
  }
  return json({ configured: true, publicKey });
}
