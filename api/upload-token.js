import { handleUpload } from "@vercel/blob/client";
import { getDb } from "./_db.js";

// Client-side upload handler: issues a signed token so the browser
// can upload directly to Vercel Blob without proxying through the function.
// Auth token arrives as clientPayload (Blob client doesn't forward custom headers).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Validate session token passed as clientPayload
        if (!clientPayload) throw new Error("No autenticado");

        const sql = getDb();
        const rows = await sql`
          SELECT username FROM sessions
          WHERE token = ${clientPayload} AND expires_at > NOW()
        `;
        if (!rows[0]) throw new Error("Sesion invalida o expirada");

        // Only allow uploads under tickets/ prefix
        if (!pathname.startsWith("tickets/")) {
          throw new Error("Ruta no permitida");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        };
      },
      onUploadCompleted: async () => {
        // No-op: imagen_url is passed back to client and saved with the gasto
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error("[upload-token]", err);
    return res.status(400).json({ error: err.message });
  }
}
