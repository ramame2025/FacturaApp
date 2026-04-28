const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

const toBase64 = (source) => {
  if (typeof source === "string") {
    return source.includes(",") ? source.split(",")[1] : source;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result || "";
      resolve(dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(source);
  });
};

export const reconocerTexto = async (source) => {
  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  const base64 = await toBase64(source);

  const response = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        imageContext: { languageHints: ["es"] },
      }],
    }),
  });

  if (!response.ok) throw new Error(`Google Vision error: ${response.status}`);

  const data = await response.json();
  if (data.responses?.[0]?.error) throw new Error(data.responses[0].error.message);

  return data.responses?.[0]?.fullTextAnnotation?.text || "";
};
