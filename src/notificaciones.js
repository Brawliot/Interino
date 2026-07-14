/** Registro PWA (service worker) y utilidades de notificacion local. */

export const LS_NOTIF_HABILITADAS = "interino_notif_habilitadas_v1";

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* entorno sin SW o error silencioso */
    });
  });
}

export function notificacionesSoportadas() {
  return typeof window !== "undefined" && "Notification" in window;
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

/**
 * Tras activar seguimiento: pide permiso y confirma con notificacion de prueba.
 * @returns {'granted'|'denied'|'unsupported'}
 */
export async function activarNotificacionesSeguimiento(etiqueta) {
  const perm = await solicitarPermisoNotificaciones();
  if (perm === "granted") {
    marcarNotificacionesHabilitadas();
    notificarLocal(
      "Seguimiento activado",
      `Te avisaremos al abrir la app si cambia tu posicion en ${etiqueta}. No sustituye la llamada oficial.`,
    );
  }
  return perm;
}
