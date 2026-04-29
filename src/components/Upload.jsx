import { useRef } from "react";

function Upload({ imagePreview, onSelectImage }) {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    onSelectImage(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
  };

  const onDragLeave = (event) => {
    event.currentTarget.classList.remove("drag-over");
  };

  return (
    <div
      className="uploader"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {imagePreview ? (
        <img className="preview" src={imagePreview} alt="Preview ticket" />
      ) : (
        <>
          <div style={{ fontSize: "2rem", lineHeight: 1 }}>🧾</div>
          <div style={{ marginTop: "8px", fontWeight: 600, color: "#5a4f42" }}>
            Arrastrá o seleccioná tu ticket
          </div>
          <div className="hint" style={{ marginTop: "4px" }}>JPG, PNG, WEBP o PDF</div>
          <button
            className="upload-btn"
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          >
            Elegir archivo
          </button>
        </>
      )}
    </div>
  );
}

export default Upload;

