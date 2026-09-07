/**
 * Cliente de auth (magic link) + sync de seguimientos vía Pages Functions.
 * Misma origen: /api/*
 */

import { normalizarSeguimiento } from "./seguimientos.js";

export async function fetchMe() {
  try {
    const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
    if (!res.ok) return { user: null, authConfigured: false };
    return await res.json();
  } catch {
    return { user: null, authConfigured: false };
  }
}

export async function requestMagicLink(email) {
  const res = await fetch("/api/auth/request", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

export async function logout() {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return true;
}

export async function fetchSeguimientosNube() {
  const res = await fetch("/api/seguimientos", {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) return { seguimientos: null, unauthorized: true };
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return await res.json();
}

export async function putSeguimientosNube(seguimientos) {
  const res = await fetch("/api/seguimientos", {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seguimientos }),
  });
  if (res.status === 401) return { ok: false, unauthorized: true };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/** Clave estable para unir local y nube. */
export function claveSeguimiento(raw) {
  const s = normalizarSeguimiento(raw) || raw || {};
  const p = s.persona || {};
  return [
    s.ccaaId || "",
    s.sector || "",
    String(s.categoria || "").trim().toLowerCase(),
    String(s.gerencia || "").trim().toLowerCase(),
    String(s.ambito || "").trim().toLowerCase(),
    s.modoListado || "",
    String(p.dniParcial || "").trim().toLowerCase(),
    String(p.nombreCompleto || "").trim().toLowerCase(),
  ].join("|");
}

function tsSnapshot(s) {
  const t = s?.snapshot?.actualizadoEn || s?.ultimoCambio || "";
  const n = Date.parse(t);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Unión por identidad; si chocan, gana el snapshot más reciente.
 */
export function fusionarSeguimientos(local = [], remoto = []) {
  const map = new Map();
  for (const raw of [...(remoto || []), ...(local || [])]) {
    const s = normalizarSeguimiento(raw);
    if (!s) continue;
    const k = claveSeguimiento(s);
    const prev = map.get(k);
    if (!prev || tsSnapshot(s) >= tsSnapshot(prev)) {
      map.set(k, s);
    }
  }
  return [...map.values()];
}

/** Lee ?login=ok|error|expired y limpia la URL. */
export function consumirParamLogin() {
  if (typeof window === "undefined") return null;
  try {
    const u = new URL(window.location.href);
    const v = u.searchParams.get("login");
    if (!v) return null;
    u.searchParams.delete("login");
    const clean = u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : "") + u.hash;
    window.history.replaceState({}, "", clean);
    return v;
  } catch {
    return null;
  }
}
