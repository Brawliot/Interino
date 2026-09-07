import { useState } from "react";
import { Mail, LogOut, UserRound } from "lucide-react";
import Barra from "../components/Barra.jsx";
import { C, FONT_BODY } from "../theme.js";
import { requestMagicLink, logout as apiLogout } from "../auth.js";

export default function PantallaCuenta({
  user,
  authConfigured,
  syncEstado,
  atras,
  onSesionCambio,
}) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");
  const [devLink, setDevLink] = useState("");
  const [error, setError] = useState("");

  const pedirEnlace = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setDevLink("");
    setEnviando(true);
    try {
      const data = await requestMagicLink(email);
      setMsg(data.message || "Revisa tu correo.");
      if (data.devLink) setDevLink(data.devLink);
    } catch (err) {
      setError(err.message || "No se pudo enviar el enlace");
    } finally {
      setEnviando(false);
    }
  };

  const cerrarSesion = async () => {
    setError("");
    try {
      await apiLogout();
      onSesionCambio?.(null);
      setMsg("Sesión cerrada. Los seguimientos siguen en este dispositivo.");
    } catch (err) {
      setError(err.message || "No se pudo cerrar sesión");
    }
  };

  return (
    <div className="pb-8">
      <Barra titulo="Cuenta" atras={atras} />
      <div className="px-5">
        <div
          className="flex items-start gap-3"
          style={{
            padding: "14px 16px",
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: "12px 4px 12px 4px",
            marginBottom: 18,
          }}
        >
          <div
            className="rounded-lg flex items-center justify-center"
            style={{ width: 40, height: 40, background: C.navy, flexShrink: 0 }}
          >
            <UserRound size={20} color={C.goldSoft} />
          </div>
          <div>
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy }}>
              {user ? "Sesión iniciada" : "Entra sin contraseña"}
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, lineHeight: 1.45, marginTop: 4 }}>
              {user
                ? "Tus seguimientos se sincronizan entre dispositivos cuando hay sesión."
                : "Te enviamos un enlace mágico al email. Sin pagos ni contraseñas."}
            </p>
          </div>
        </div>

        {!authConfigured && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: C.clay,
              lineHeight: 1.45,
              marginBottom: 14,
              padding: "10px 12px",
              background: C.paperDeep,
              borderRadius: 8,
            }}
          >
            Auth aún no configurada en este entorno (falta D1 / Functions). En local usa{" "}
            <code style={{ fontSize: 11 }}>wrangler pages dev</code>.
          </p>
        )}

        {user ? (
          <div
            style={{
              padding: "14px 16px",
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: "12px 4px 12px 4px",
            }}
          >
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.inkSoft }}>
              Email
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: C.navy, marginTop: 4 }}>
              {user.email}
            </p>
            {syncEstado && (
              <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 10, lineHeight: 1.4 }}>
                {syncEstado}
              </p>
            )}
            <button
              type="button"
              onClick={cerrarSesion}
              className="inline-flex items-center gap-2 focus:outline-none focus:ring-2"
              style={{
                marginTop: 16,
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.navy,
                background: C.paperDeep,
                border: `1px solid ${C.line}`,
                padding: "10px 14px",
                borderRadius: "10px 4px 10px 4px",
                cursor: "pointer",
              }}
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={pedirEnlace}>
            <label
              htmlFor="cuenta-email"
              style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.inkSoft }}
            >
              Tu email
            </label>
            <input
              id="cuenta-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="tu@email.com"
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                marginBottom: 12,
                padding: "12px 14px",
                fontFamily: FONT_BODY,
                fontSize: 15,
                color: C.ink,
                background: C.card,
                border: `1.5px solid ${C.line}`,
                borderRadius: "10px 4px 10px 4px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={enviando || !authConfigured}
              className="inline-flex items-center gap-2 focus:outline-none focus:ring-2"
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: C.navy,
                border: "none",
                padding: "12px 16px",
                borderRadius: "10px 4px 10px 4px",
                opacity: enviando || !authConfigured ? 0.55 : 1,
                cursor: enviando || !authConfigured ? "default" : "pointer",
              }}
            >
              <Mail size={15} /> {enviando ? "Enviando…" : "Enviar enlace mágico"}
            </button>
          </form>
        )}

        {msg && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ok, marginTop: 14, lineHeight: 1.45 }}>
            {msg}
          </p>
        )}
        {error && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.clay, marginTop: 14, lineHeight: 1.45 }}>
            {error}
          </p>
        )}
        {devLink && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 12, lineHeight: 1.45, wordBreak: "break-all" }}>
            Enlace de desarrollo:{" "}
            <a href={devLink} style={{ color: C.navy, fontWeight: 600 }}>
              {devLink}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
