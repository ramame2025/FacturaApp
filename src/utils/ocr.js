import Tesseract from "tesseract.js";

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

const reconocerTextoConVision = async (imagenDataUrl) => {
  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl: imagenDataUrl }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Error de OCR en Google Vision");
  }

  const payload = await response.json();
  return payload?.text || "";
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
    if (onProgress) onProgress(100);
    return text;
  } catch (error) {
    console.warn("Vision OCR no disponible, usando fallback Tesseract:", error);
    return reconocerTextoConTesseract(imagen, onProgress);
  }
};
