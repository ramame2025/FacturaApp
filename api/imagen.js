import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import { validateToken } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });

  let session;
  try {
    session = await validateToken(req);
  } catch (err) {
    console.error("[imagen] validateToken", err);
    return res.status(500).json({ error: "Error interno" });
  }

  if (!session) return res.status(401).json({ error: "No autenticado" });

  const rawUrl = String(req.query?.url || "").trim();
  if (!rawUrl) return res.status(400).json({ error: "Falta url" });

  try {
    const parsed = new URL(rawUrl);
    if (!parsed.pathname.startsWith("/tickets/")) {
      return res.status(403).json({ error: "Ruta no permitida" });
    }

    const result = await get(rawUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const contentType = result.blob?.contentType || result.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = result.blob?.contentDisposition || result.headers.get("content-disposition") || "inline";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);
    res.setHeader("Cache-Control", "private, max-age=60");

    Readable.fromWeb(result.stream).pipe(res);
  } catch (err) {
    console.error("[imagen]", err);
    return res.status(400).json({ error: err.message || "No se pudo leer la imagen" });
  }
}
