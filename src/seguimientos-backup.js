/** Exportar / importar seguimientos (localStorage) — MVP sin Supabase. */

export const LS_SEGUIMIENTOS = "interino_seguimientos_v1";

export function exportarSeguimientos(seguimientos) {
  const payload = {
    app: "interino",
    version: 1,
    exportado: new Date().toISOString(),
    seguimientos: seguimientos || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interino-seguimientos-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importarSeguimientosDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const lista = Array.isArray(data) ? data : data?.seguimientos;
        if (!Array.isArray(lista)) {
          reject(new Error("Formato invalido"));
          return;
        }
        resolve(lista);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
