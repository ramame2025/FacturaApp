import { handleUpload } from "@vercel/blob/client";
import { validateToken } from "./_db.js";

// Client-side upload handler: issues a signed token so the browser
// can upload directly to Vercel Blob without proxying through the function.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await validateToken(req).catch(() => null);
  if (!session) return res.status(401).json({ error: "No autenticado" });

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Only allow jpg/png/webp/pdf under the tickets/ prefix
        if (!pathname.startsWith("tickets/")) {
          throw new Error("Ruta no permitida");
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do post-upload server-side
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error("[upload-token]", err);
    return res.status(400).json({ error: err.message });
  }
}
