import http from "node:http";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const PORT = 3001;
const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

const json = (res, status, payload) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
};

const extractImageContent = (imageDataUrl) => {
  if (typeof imageDataUrl !== "string") return "";
  const commaIndex = imageDataUrl.indexOf(",");
  if (commaIndex === -1) return "";
  return imageDataUrl.slice(commaIndex + 1).trim();
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8") || "{}";
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON invalido"));
      }
    });
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.url !== "/api/ocr" || req.method !== "POST") {
    return json(res, 404, { error: "Ruta no encontrada" });
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: "Falta GOOGLE_CLOUD_VISION_API_KEY en .env.local" });
  }

  try {
    const body = await readBody(req);
    const imageContent = extractImageContent(body?.imageDataUrl);

    if (!imageContent) {
      return json(res, 400, { error: "imageDataUrl invalido" });
    }

    const response = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageContent },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      const detail = payload?.error?.message || "Error en Google Vision";
      return json(res, response.status, { error: detail });
    }

    const text = payload?.responses?.[0]?.fullTextAnnotation?.text || "";
    return json(res, 200, { text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return json(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[vision-local] API disponible en http://localhost:${PORT}/api/ocr`);
});
