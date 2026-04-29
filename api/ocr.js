const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

const extractImageContent = (imageDataUrl) => {
  if (typeof imageDataUrl !== "string") return "";
  const commaIndex = imageDataUrl.indexOf(",");
  if (commaIndex === -1) return "";
  return imageDataUrl.slice(commaIndex + 1).trim();
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const apiKey = process.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta VITE_GOOGLE_VISION_API_KEY" });
  }

  const imageDataUrl = req.body?.imageDataUrl;
  const imageContent = extractImageContent(imageDataUrl);

  if (!imageContent) {
    return res.status(400).json({ error: "imageDataUrl invalido" });
  }

  try {
    const response = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
      const visionError = payload?.error?.message || "Error en Google Vision";
      return res.status(response.status).json({ error: visionError });
    }

    const text = payload?.responses?.[0]?.fullTextAnnotation?.text || "";
    return res.status(200).json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return res.status(500).json({ error: message });
  }
}
