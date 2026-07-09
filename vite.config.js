import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, createReadStream, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "data");

function dataStaticPlugin() {
  return {
    name: "data-static",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const rel = decodeURIComponent((req.url || "/").replace(/^\//, ""));
        const file = path.join(dataDir, rel);
        if (!file.startsWith(dataDir) || !existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      cpSync(dataDir, path.resolve(__dirname, "dist/data"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), dataStaticPlugin()],
});
