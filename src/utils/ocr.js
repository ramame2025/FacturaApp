import Tesseract from "tesseract.js";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

const isDataUrl = (value) => typeof value === "string" && value.startsWith("data:");

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });

const normalizeToDataUrl = async (imagen) => {
  if (isDataUrl(imagen)) return imagen;
  if (imagen instanceof File) return fileToDataUrl(imagen);
  throw new Error("Formato de imagen no soportado para OCR");
};

const extractImageContent = (imageDataUrl) => {
  if (typeof imageDataUrl !== "string") return "";
  const commaIndex = imageDataUrl.indexOf(",");
  if (commaIndex === -1) return "";
  return imageDataUrl.slice(commaIndex + 1).trim();
};

const reconocerTextoConVision = async (imagenDataUrl) => {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      throw new Error("Falta VITE_GOOGLE_VISION_API_KEY");
    }

    const imageContent = extractImageContent(imagenDataUrl);
    if (!imageContent) {
      throw new Error("imageDataUrl invalido");
    }

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

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const json = await response.json();
        detail = json?.error || detail;
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || "Error de OCR en Google Vision");
    }

    const payload = await response.json();
    return payload?.responses?.[0]?.fullTextAnnotation?.text || "";
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Vision API Error]", msg);
    throw error;
  }
};

const reconocerTextoConTesseract = async (imagen, onProgress) => {
  const result = await Tesseract.recognize(imagen, "spa", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  return result.data.text || "";
};

export const reconocerTexto = async (imagen, onProgress) => {
  try {
    if (onProgress) onProgress(10);
    const imageDataUrl = await normalizeToDataUrl(imagen);
    if (onProgress) onProgress(35);

    const text = await reconocerTextoConVision(imageDataUrl);
    if (text && text.trim().length > 0) {
      if (onProgress) onProgress(100);
      return text;
    }
    
    // Si Vision retorna texto vacío, usar fallback
    console.warn("Vision retornó texto vacío, usando Tesseract");
    return reconocerTextoConTesseract(imagen, onProgress);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[OCR Fallback] Vision falló (${msg}), usando Tesseract...`);
    try {
      return await reconocerTextoConTesseract(imagen, onProgress);
    } catch (tesseractError) {
      const tesMsg = tesseractError instanceof Error ? tesseractError.message : String(tesseractError);
      console.error(`[OCR Fatal] Ambos OCRs fallaron. Vision: ${msg}, Tesseract: ${tesMsg}`);
      throw new Error(`OCR no disponible: ${msg}`);
    }
  }
};
