import { useRef } from "react";

function Upload({ imagePreview, onSelectImage }) {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    onSelectImage(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  };

  return (
    <div className="uploader" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <strong>Subi o arrastra tu ticket/factura</strong>
      <div className="hint">Formato sugerido: JPG, PNG, WEBP o PDF</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {imagePreview ? <img className="preview" src={imagePreview} alt="Preview ticket" /> : null}
    </div>
  );
}

export default Upload;
