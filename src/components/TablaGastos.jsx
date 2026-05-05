import { useMemo, useState } from "react";
import { apiGetImagenPrivada } from "../utils/api";

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

const moneyOrDash = (value) => {
  if (value == null || value === "") return "-";
  return money(toNumber(value));
};

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

  const abrirImagen = async (url) => {
    if (!url) return;

    // Compatibilidad con datos historicos en base64
    if (url.startsWith("data:")) {
      setImagenModal(url);
      return;
    }

    try {
      const blob = await apiGetImagenPrivada(url);
      const objectUrl = URL.createObjectURL(blob);
      setImagenModal((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return objectUrl;
      });
    } catch (err) {
      alert(err.message || "No se pudo abrir la imagen");
    }
  };

  const cerrarModal = () => {
    setImagenModal((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  };

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
                <td colSpan={showUsuarioColumn ? 11 : 10} className="empty-state">
                  Todavia no hay gastos guardados.
                </td>
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
                  <td>{moneyOrDash(g.total)}</td>
                  <td>{moneyOrDash(g.subtotal)}</td>
                  <td>{moneyOrDash(g.impuestos)}</td>
                  <td>
                    {(g.imagen_url || g.imagenBase64) ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => abrirImagen(g.imagen_url || g.imagenBase64)}
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
          <div className="hint empty-state">Todavia no hay gastos guardados.</div>
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
              {(g.imagen_url || g.imagenBase64) && (
                <button
                  className="btn btn-secondary"
                  onClick={() => abrirImagen(g.imagen_url || g.imagenBase64)}
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
          className="image-modal-backdrop"
          onClick={cerrarModal}
        >
          <div
            className="image-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrarModal}
              className="image-modal-close"
            >
              ✕
            </button>
            <img src={imagenModal} alt="Recibo" />
          </div>
        </div>
      )}
    </div>
  );
}

export default TablaGastos;
