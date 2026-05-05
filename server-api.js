/**
 * servidor local de desarrollo – envuelve las funciones serverless de api/
 * con el mismo patrón req/res de Express para que funcionen sin Vercel.
 * Escucha en http://localhost:3001
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import express from "express";

// Cargar .env.local manualmente (dotenv/config sólo lee .env)
try {
  const raw = readFileSync(".env.local", "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local no existe – ignorar
}

// Importar handlers dinámicamente (son ES modules)
const [
  { default: authHandler },
  { default: gastosHandler },
  { default: usersHandler },
  { default: setupHandler },
  { default: uploadTokenHandler },
  { default: imagenHandler },
  { default: ocrHandler },
] = await Promise.all([
  import("./api/auth.js"),
  import("./api/gastos.js"),
  import("./api/users.js"),
  import("./api/setup.js"),
  import("./api/upload-token.js"),
  import("./api/imagen.js"),
  import("./api/ocr.js"),
]);

const PORT = 3001;
const app = express();

app.use(express.json({ limit: "12mb" }));

// CORS para desarrollo local
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rutas — coinciden con los archivos en api/
app.all("/api/auth", (req, res) => authHandler(req, res));
app.all("/api/gastos", (req, res) => gastosHandler(req, res));
app.all("/api/gastos/:id", (req, res) => gastosHandler(req, res));
app.all("/api/users", (req, res) => usersHandler(req, res));
app.all("/api/users/:id", (req, res) => usersHandler(req, res));
app.all("/api/users/:id/reset-password", (req, res) => usersHandler(req, res));
app.all("/api/setup", (req, res) => setupHandler(req, res));
app.all("/api/upload-token", (req, res) => uploadTokenHandler(req, res));
app.all("/api/imagen", (req, res) => imagenHandler(req, res));
app.post("/api/ocr", (req, res) => ocrHandler(req, res));

app.listen(PORT, () => {
  console.log(`[api] Servidor local corriendo en http://localhost:${PORT}`);
});
