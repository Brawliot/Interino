function ambitoLegibleLocal(ambito) {
  if (!ambito) return "";
  if (ambito === "Atencion Primaria") return "Atención Primaria";
  if (ambito === "Atencion Especializada") return "Atención Especializada";
  return ambito;
}

/** Fusiona apariciones AP/AE idénticas (misma gerencia, posición y puntos). */
export function deduplicarApariciones(apariciones) {
  const map = new Map();
  for (const a of apariciones) {
    const k = `${a.gerencia}\0${a.posicion}\0${a.puntos}`;
    if (!map.has(k)) {
      map.set(k, { ...a, _ambitos: a.ambito ? [a.ambito] : [] });
      continue;
    }
    const e = map.get(k);
    if (a.ambito && !e._ambitos.includes(a.ambito)) e._ambitos.push(a.ambito);
  }
  return [...map.values()].map(({ _ambitos, ...rest }) => {
    if (_ambitos.length <= 1) {
      return { ...rest, ambito: _ambitos[0] || rest.ambito || "" };
    }
    const labels = _ambitos.map((ab) => ambitoLegibleLocal(ab)).filter(Boolean);
    return {
      ...rest,
      ambito: _ambitos[0] || "",
      ambitosMerged: labels.length ? labels.join(" y ") : null,
    };
  });
}

export function etiquetaAmbitoAparicion(a) {
  if (a.ambitosMerged) return a.ambitosMerged;
  return ambitoLegibleLocal(a.ambito) || "";
}
