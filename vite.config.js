import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, createReadStream, readdirSync, statSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Manifest solo con JSON que existen en disco (mismo criterio que scraper.actualizar_manifest). */
function regenerarManifestEnDir(publicDir) {
  const archivos = [];
  if (!existsSync(publicDir)) return;
  for (const grupo of readdirSync(publicDir).sort()) {
    const dirGrupo = path.join(publicDir, grupo);
    if (!statSync(dirGrupo).isDirectory()) continue;
    for (const nombre of readdirSync(dirGrupo).sort()) {
      if (nombre.endsWith(".json")) archivos.push(`${grupo}/${nombre}`);
    }
  }
  const manifest = {
    generado: new Date().toISOString().slice(0, 19),
    archivos,
  };
  writeFileSync(path.join(publicDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "data/public");
const educacionDir = path.resolve(__dirname, "data/educacion");
const educacionBolsaDir = path.resolve(__dirname, "data/educacion-bolsa");
const adminClmDir = path.resolve(__dirname, "data/admin-clm");
const politicaPath = path.resolve(__dirname, "politica-privacidad.md");

function servirJsonEstatico(server, urlPrefix, rootDir) {
  server.middlewares.use(urlPrefix, (req, res, next) => {
    const rel = decodeURIComponent((req.url || "/").replace(/^\//, ""));
    const file = path.join(rootDir, rel);
    if (!file.startsWith(rootDir) || !existsSync(file) || !statSync(file).isFile()) {
      next();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    createReadStream(file).pipe(res);
  });
}

function politicaStaticPlugin() {
  return {
    name: "politica-privacidad",
    configureServer(server) {
      server.middlewares.use("/politica-privacidad.md", (req, res, next) => {
        if (!existsSync(politicaPath)) {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        createReadStream(politicaPath).pipe(res);
      });
    },
    closeBundle() {
      if (existsSync(politicaPath)) {
        cpSync(politicaPath, path.resolve(__dirname, "dist/politica-privacidad.md"));
      }
    },
  };
}

function dataStaticPlugin() {
  return {
    name: "data-static",
    configureServer(server) {
      regenerarManifestEnDir(dataDir);
      servirJsonEstatico(server, "/data", dataDir);
      if (existsSync(educacionDir)) {
        servirJsonEstatico(server, "/data/educacion", educacionDir);
      }
      if (existsSync(educacionBolsaDir)) {
        servirJsonEstatico(server, "/data/educacion-bolsa", educacionBolsaDir);
      }
      if (existsSync(adminClmDir)) {
        servirJsonEstatico(server, "/data/admin-clm", adminClmDir);
      }
    },
    closeBundle() {
      const distData = path.resolve(__dirname, "dist/data");
      cpSync(dataDir, distData, { recursive: true });
      regenerarManifestEnDir(distData);
      if (existsSync(educacionDir)) {
        cpSync(educacionDir, path.resolve(distData, "educacion"), { recursive: true });
      }
      if (existsSync(educacionBolsaDir)) {
        cpSync(educacionBolsaDir, path.resolve(distData, "educacion-bolsa"), { recursive: true });
      }
      if (existsSync(adminClmDir)) {
        cpSync(adminClmDir, path.resolve(distData, "admin-clm"), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), dataStaticPlugin(), politicaStaticPlugin()],
});
