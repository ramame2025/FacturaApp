function Resultado({ values, onChangeField, onGuardar, disabled, faltantes }) {
  return (
    <div className="panel slide-in">
      <h2>Datos extraídos</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="total">Total</label>
          <input
            id="total"
            value={values.total}
            onChange={(e) => onChangeField("total", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="subtotal">Subtotal</label>
          <input
            id="subtotal"
            value={values.subtotal}
            onChange={(e) => onChangeField("subtotal", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="impuestos">Impuestos</label>
          <input
            id="impuestos"
            value={values.impuestos}
            onChange={(e) => onChangeField("impuestos", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="cuit">CUIT factura</label>
          <input
            id="cuit"
            value={values.cuit}
            onChange={(e) => onChangeField("cuit", e.target.value)}
            placeholder="20-12345678-9"
          />
        </div>
        <div className="field">
          <label htmlFor="proveedor">Proveedor</label>
          <input
            id="proveedor"
            value={values.proveedor}
            onChange={(e) => onChangeField("proveedor", e.target.value)}
            placeholder="Nombre del proveedor/emisor"
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="concepto">Concepto</label>
          <textarea
            id="concepto"
            value={values.concepto}
            onChange={(e) => onChangeField("concepto", e.target.value)}
            placeholder="Ej: Almuerzo con cliente / Taxi aeropuerto / Hotel noche"
          />
        </div>
      </div>
      {faltantes.length > 0 ? (
        <div className="status status-error">
          Para guardar, completa: {faltantes.join(", ")}.
        </div>
      ) : null}
      <div className="actions">
        <button className="btn btn-accent" onClick={onGuardar} disabled={disabled}>
          Guardar gasto
        </button>
      </div>
      <div className="hint">Tip: siempre revisa estos campos antes de guardar.</div>
    </div>
  );
}

export default Resultado;
