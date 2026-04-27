import Tesseract from "tesseract.js";

export const reconocerTexto = async (imagen, onProgress) => {
  const result = await Tesseract.recognize(imagen, "spa", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  return result.data.text || "";
};
