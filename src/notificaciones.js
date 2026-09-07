/** Registro PWA (service worker), notificaciones locales y Web Push. */

import { leerPrefsNotif } from "./notifPrefs.js";

export const LS_NOTIF_HABILITADAS = "interino_notif_habilitadas_v1";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Payload ligero para el servidor (sin campos enormes de candidato). */
export function seguimientosParaPush(lista) {
  return (lista || [])
    .filter((s) => s && s.avisos !== false)
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const persona = s.persona || {
        nombreCompleto: s.candidato?.nombreCompleto,
        dniParcial: s.candidato?.dniParcial,
      };
      return {
        id: s.id,
        ccaaId: s.ccaaId || "clm",
        sector: s.sector || "sanidad",
        grupoId: s.grupoId || "",
        categoria: s.categoria || "",
        gerencia: s.gerencia || "",
        ambito: s.ambito || "",
        modoListado: s.modoListado || null,
        alias: s.alias || "",
        avisos: true,
        persona: {
          nombreCompleto: String(persona?.nombreCompleto || "").trim(),
          dniParcial: String(persona?.dniParcial || "").trim(),
        },
        snapshot: {
          posicion: Number(s.snapshot?.posicion ?? s.candidato?.posicion) || 0,
          puntos: Number(s.snapshot?.puntos ?? s.candidato?.puntos) || 0,
          total: Number(s.snapshot?.total ?? s.candidato?.total) || 0,
        },
      };
    })
    .filter((s) => s && (s.persona.nombreCompleto || s.persona.dniParcial));
}

/** `?nosw=1` desregistra SW y borra caches de Interino (recuperacion si el worker deja la app en blanco). */
export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const params = new URLSearchParams(window.location.search);
  const forzarReset = params.has("nosw");

  // En Vite el SW rompe HMR/modulos; en local solo permitir reset explicito.
  if (import.meta.env.DEV && !forzarReset) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (!regs.length) return;
      Promise.all(regs.map((r) => r.unregister()))
        .then(() => caches.keys())
        .then((keys) =>
          Promise.all(keys.filter((k) => k.startsWith("interino-")).map((k) => caches.delete(k))),
        )
        .then(() => {
          if (navigator.serviceWorker.controller) window.location.reload();
        })
        .catch(() => undefined);
    });
    return;
  }

  if (forzarReset) {
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("interino-")).map((k) => caches.delete(k))),
      ),
    ])
      .catch(() => undefined)
      .then(() => {
        params.delete("nosw");
        const q = params.toString();
        window.location.replace(`${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
      });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update().catch(() => undefined))
      .catch(() => {
        /* entorno sin SW o error silencioso */
      });
  });
}

export function notificacionesSoportadas() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function pushSoportado() {
  return (
    notificacionesSoportadas() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof window.PushManager !== "undefined"
  );
}

export async function solicitarPermisoNotificaciones() {
  if (!notificacionesSoportadas()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function marcarNotificacionesHabilitadas() {
  try {
    localStorage.setItem(LS_NOTIF_HABILITADAS, "1");
  } catch {
    /* quota */
  }
}

export function notificacionesHabilitadasEnDispositivo() {
  try {
    return localStorage.getItem(LS_NOTIF_HABILITADAS) === "1" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

/** Muestra notificacion del sistema si hay permiso. */
export function notificarLocal(titulo, cuerpo) {
  if (!notificacionesSoportadas() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(titulo, {
      body: cuerpo,
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: "interino-seguimiento",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

async function obtenerClaveVapidPublica() {
  const res = await fetch("/api/push/vapid-public-key", { credentials: "same-origin" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.configured || !data.publicKey) return null;
  return data.publicKey;
}

/**
 * Suscribe el dispositivo a Web Push y guarda seguimientos en el servidor.
 * @returns {Promise<'ok'|'no_vapid'|'no_push'|'error'>}
 */
export async function suscribirPush(listaSeguimientos) {
  if (!pushSoportado()) return "no_push";
  try {
    const publicKey = await obtenerClaveVapidPublica();
    if (!publicKey) return "no_vapid";

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        seguimientos: seguimientosParaPush(listaSeguimientos),
        prefs: leerPrefsNotif(),
      }),
    });
    if (!res.ok) return "error";
    return "ok";
  } catch {
    return "error";
  }
}

/** Actualiza la lista de seguimientos asociada a la suscripción push (si existe). */
export async function sincronizarPushSeguimientos(listaSeguimientos) {
  if (!notificacionesHabilitadasEnDispositivo() || !pushSoportado()) return "skip";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      return suscribirPush(listaSeguimientos);
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        seguimientos: seguimientosParaPush(listaSeguimientos),
        prefs: leerPrefsNotif(),
      }),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function cancelarPush() {
  if (!pushSoportado()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/**
 * Tras activar seguimiento: pide permiso, suscribe push y confirma.
 * @returns {'granted'|'denied'|'unsupported'}
 */
export async function activarNotificacionesSeguimiento(etiqueta, listaSeguimientos = []) {
  const perm = await solicitarPermisoNotificaciones();
  if (perm === "granted") {
    marcarNotificacionesHabilitadas();
    const pushResult = await suscribirPush(listaSeguimientos);
    const pushOk = pushResult === "ok";
    notificarLocal(
      "Seguimiento activado",
      pushOk
        ? `Te avisaremos en segundo plano si cambia tu posición en ${etiqueta}. No sustituye la llamada oficial.`
        : `Te avisaremos al abrir la app si cambia tu posición en ${etiqueta}. No sustituye la llamada oficial.`,
    );
  }
  return perm;
}
