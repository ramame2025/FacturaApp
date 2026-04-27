import { useMemo, useState } from "react";

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value || 0);

function TablaGastos({
  gastos,
  onExportar,
  onEliminar,
  mesExportacion,
  onCambiarMesExportacion,
  showUsuarioColumn,
}) {
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [imagenModal, setImagenModal] = useState(null); // Para mostrar imagen en modal

  const tiposDisponibles = useMemo(() => {
    const setTipos = new Set(gastos.map((g) => g.tipoGasto).filter(Boolean));
    return ["Todos", ...Array.from(setTipos)];
  }, [gastos]);

  const gastosFiltrados = useMemo(() => {
    if (tipoFiltro === "Todos") return gastos;
    return gastos.filter((g) => g.tipoGasto === tipoFiltro);
  }, [gastos, tipoFiltro]);

  const totalFiltrado = useMemo(
    () => gastosFiltrados.reduce((acc, g) => acc + toNumber(g.total), 0),
    [gastosFiltrados]
  );

  const subtotalFiltrado = useMemo(
    () => gastosFiltrados.reduce((acc, g) => acc + toNumber(g.subtotal), 0),
    [gastosFiltrados]
  );

  const impuestosFiltrados = useMemo(
    () => gastosFiltrados.reduce((acc, g) => acc + toNumber(g.impuestos), 0),
    [gastosFiltrados]
  );

  return (
    <div className="panel">
      <h2>Listado de gastos</h2>
      <div className="actions">
        <div className="field control-field">
          <label htmlFor="mes-exportacion">Mes de exportacion</label>
          <input
            id="mes-exportacion"
            type="month"
            value={mesExportacion}
            onChange={(e) => onCambiarMesExportacion(e.target.value)}
          />
        </div>
        <div className="field control-field">
          <label htmlFor="tipo-filtro">Filtrar por tipo</label>
          <select id="tipo-filtro" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
            {tiposDisponibles.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={onExportar} disabled={gastos.length === 0}>
          Exportar Excel mensual
        </button>
        <span className="badge">{gastosFiltrados.length} registros</span>
      </div>

      <div className="totals-strip">
        <div className="total-box">
          <span>Subtotal filtrado</span>
          <strong>{money(subtotalFiltrado)}</strong>
        </div>
        <div className="total-box">
          <span>Impuestos filtrados</span>
          <strong>{money(impuestosFiltrados)}</strong>
        </div>
        <div className="total-box total-highlight">
          <span>Total filtrado</span>
          <strong>{money(totalFiltrado)}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              {showUsuarioColumn ? <th>Usuario</th> : null}
              <th>Tipo</th>
              <th>Proveedor</th>
              <th>CUIT</th>
              <th>Concepto</th>
              <th>Total</th>
              <th>Subtotal</th>
              <th>Impuestos</th>
              <th>Imagen</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {gastosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={showUsuarioColumn ? 11 : 10}>Todavia no hay gastos guardados.</td>
              </tr>
            ) : (
              gastosFiltrados.map((g) => (
                <tr key={g.id}>
                  <td>{g.fecha}</td>
                  {showUsuarioColumn ? <td>{g.usuarioNombre || g.usuario || "-"}</td> : null}
                  <td>{g.tipoGasto}</td>
                  <td>{g.proveedor || "-"}</td>
                  <td>{g.cuit || "-"}</td>
                  <td>{g.concepto || g.descripcion || "-"}</td>
                  <td>{g.total || "-"}</td>
                  <td>{g.subtotal || "-"}</td>
                  <td>{g.impuestos || "-"}</td>
                  <td>
                    {g.imagenBase64 ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setImagenModal(g.imagenBase64)}
                      >
                        Ver
                      </button>
                    ) : (
                      <span style={{ color: "#999" }}>-</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-danger" onClick={() => onEliminar(g.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {gastosFiltrados.length === 0 ? (
          <div className="hint">Todavia no hay gastos guardados.</div>
        ) : (
          gastosFiltrados.map((g) => (
            <article key={`mobile-${g.id}`} className="gasto-card">
              <header>
                <strong>{g.tipoGasto}</strong>
                <span>{g.fecha}</span>
              </header>
              {showUsuarioColumn ? <p>Usuario: {g.usuarioNombre || g.usuario || "-"}</p> : null}
              <p>Proveedor: {g.proveedor || "-"}</p>
              <p>CUIT: {g.cuit || "-"}</p>
              <p>Concepto: {g.concepto || g.descripcion || "-"}</p>
              <p>Subtotal: {money(toNumber(g.subtotal))}</p>
              <p>Impuestos: {money(toNumber(g.impuestos))}</p>
              <p className="mobile-total">Total: {money(toNumber(g.total))}</p>
              {g.imagenBase64 && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setImagenModal(g.imagenBase64)}
                  style={{ marginBottom: "8px" }}
                >
                  Ver imagen
                </button>
              )}
              <button className="btn btn-danger" onClick={() => onEliminar(g.id)}>
                Eliminar
              </button>
            </article>
          ))
        )}
      </div>

      {/* Modal para ver imagen */}
      {imagenModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setImagenModal(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "20px",
              maxWidth: "90%",
              maxHeight: "90%",
              overflow: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImagenModal(null)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "#9f7f4f",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "30px",
                height: "30px",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <img
              src={imagenModal}
              alt="Recibo"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TablaGastos;
