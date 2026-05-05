import { useEffect, useMemo, useState } from "react";
import Upload from "./components/Upload";
import Resultado from "./components/Resultado";
import TablaGastos from "./components/TablaGastos";
import AdminUsers from "./components/AdminUsers";
import Login from "./components/Login";
import { reconocerTexto } from "./utils/ocr";
import { extraerDatos } from "./utils/parser";
import { exportarExcelMensual } from "./utils/excel";
import { pdfToImageDataUrl } from "./utils/pdf";
import { apiLogin, apiGetGastos, apiSaveGasto, apiUploadImagen, apiDeleteGasto, apiGetUsers, saveSession, clearSession, loadSession } from "./utils/api";
import { checkRateLimit, incrementUsage, getUsageStats } from "./utils/rateLimit";
const TIPOS_GASTO = ["Comidas", "Hotel", "Movilidad", "Combustible", "Otros"];
const OBLIGATORIOS_SIN_CUIT = [
  ["total", "Total"],
  ["subtotal", "Subtotal"],
  ["impuestos", "Impuestos"],
  ["proveedor", "Proveedor"],
  ["concepto", "Concepto"],
];

const mesActual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result || null);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });

const compressPreviewImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 1400;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("No se pudo preparar la imagen"));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    image.src = source;
  });

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [gastosLoading, setGastosLoading] = useState(false);
  const [adminSelectedUser, setAdminSelectedUser] = useState("");
  const [adminViewingUser, setAdminViewingUser] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [tipoGasto, setTipoGasto] = useState(TIPOS_GASTO[0]);
  const [ocrText, setOcrText] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [usageStats, setUsageStats] = useState(getUsageStats);
  const [resultado, setResultado] = useState({
    total: "",
    subtotal: "",
    impuestos: "",
    cuit: "",
    proveedor: "",
    concepto: "",
  });
  const [gastos, setGastos] = useState([]);
  const [mesExportacion, setMesExportacion] = useState(mesActual());

  // Restore session on mount
  useEffect(() => {
    try {
      const session = loadSession();
      if (session?.user?.username && session?.token) {
        setAuthUser(session.user);
      }
    } catch {
      setAuthUser(null);
    }
  }, []);

  // Load gastos from API when user logs in
  useEffect(() => {
    if (!authUser) {
      setGastos([]);
      return;
    }
    setGastosLoading(true);
    apiGetGastos()
      .then(setGastos)
      .catch(() => setGastos([]))
      .finally(() => setGastosLoading(false));
  }, [authUser]);

  // Load users list (admin only)
  useEffect(() => {
    if (authUser?.role !== "admin") return;
    apiGetUsers().then(setUsers).catch(() => {});
  }, [authUser]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    if (imageFile.type === "application/pdf") {
      let isCancelled = false;
      pdfToImageDataUrl(imageFile)
        .then((previewUrl) => {
          if (!isCancelled) setImagePreview(previewUrl);
        })
        .catch(() => {
          if (!isCancelled) setImagePreview("");
        });

      return () => {
        isCancelled = true;
      };
    }

    const objectURL = URL.createObjectURL(imageFile);
    setImagePreview(objectURL);
    return () => URL.revokeObjectURL(objectURL);
  }, [imageFile]);

  const faltantesObligatorios = useMemo(
    () =>
      OBLIGATORIOS_SIN_CUIT.filter(([key]) => !String(resultado[key] || "").trim()).map(
        ([, label]) => label
      ),
    [resultado]
  );

  const puedeGuardar = faltantesObligatorios.length === 0;

  const procesarFactura = async () => {
    if (!imageFile || procesando) return;

    const { allowed, reason } = checkRateLimit();
    if (!allowed) {
      alert(reason);
      return;
    }

    setProcesando(true);

    try {
      const sourceForOcr =
        imageFile.type === "application/pdf" ? await pdfToImageDataUrl(imageFile, 2) : imageFile;

      const text = await reconocerTexto(sourceForOcr);
      incrementUsage();
      setUsageStats(getUsageStats());
      setOcrText(text);
      setResultado(extraerDatos(text));
    } catch {
      alert("No se pudo procesar el archivo. Proba con una imagen/PDF mas claro.");
    } finally {
      setProcesando(false);
    }
  };

  const onGuardar = async () => {
    if (!puedeGuardar) return;
    if (!authUser) return;
    
    const gastoId = crypto.randomUUID();
    const now = new Date();

    // Build image source (PDF → first page render, image → read directly)
    let imagen_url = null;
    if (imageFile) {
      const imageSource = imageFile.type === "application/pdf"
        ? imagePreview
        : await readFileAsDataUrl(imageFile);

      if (imageSource) {
        const compressed = await compressPreviewImage(imageSource);
        imagen_url = await apiUploadImagen(gastoId, compressed);
      }
    }

    const nuevo = {
      id: gastoId,
      fecha: now.toLocaleString("es-AR"),
      fechaISO: now.toISOString(),
      usuarioNombre: authUser.nombre,
      tipoGasto,
      total: resultado.total,
      subtotal: resultado.subtotal,
      impuestos: resultado.impuestos,
      cuit: resultado.cuit,
      proveedor: resultado.proveedor,
      concepto: resultado.concepto,
      textoOCR: ocrText,
      imagen_url,
    };

    try {
      await apiSaveGasto(nuevo);
      setGastos((prev) => [{ ...nuevo, usuario: authUser.username }, ...prev]);
      setImageFile(null);
      setOcrText("");
      setResultado({ total: "", subtotal: "", impuestos: "", cuit: "", proveedor: "", concepto: "" });
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
  };

  const onEliminar = async (id) => {
    try {
      await apiDeleteGasto(id);
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const login = async (username, password) => {
    try {
      const { token, user } = await apiLogin(username, password);
      saveSession(token, user);
      setAuthUser(user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    clearSession();
    setAuthUser(null);
    setUsers([]);
    setGastos([]);
    setAdminSelectedUser("");
    setAdminViewingUser("");
  };

  if (!authUser) {
    return <Login onLogin={login} />;
  }

  const usersWithCounts = users
    .filter((u) => u.role === "user")
    .map((u) => ({
      ...u,
      totalGastos: gastos.filter((g) => g.usuario === u.username).length,
    }));

  const gastosVisibles =
    authUser.role === "admin"
      ? adminViewingUser
        ? gastos.filter((g) => g.usuario === adminViewingUser)
        : gastos
      : gastos.filter((g) => g.usuario === authUser.username);

  const vistaAdminLabel = adminViewingUser
    ? `Gastos de ${users.find((u) => u.username === adminViewingUser)?.nombre || adminViewingUser}`
    : "Todos los gastos";

  const beneficiarioExport =
    authUser.role === "admin"
      ? adminViewingUser
        ? users.find((u) => u.username === adminViewingUser)?.nombre || adminViewingUser
        : "Todos"
      : authUser.nombre;

  const esAdmin = authUser.role === "admin";

  return (
    <main className="layout">
      <section className="hero slide-in">
        <div className="topbar">
          <h1>FacturaAPP · MVP</h1>
          <button className="btn btn-danger" onClick={logout}>
            Cerrar sesion
          </button>
        </div>

        <div className="hint hero-meta">
          Sesion: {authUser.nombre} ({esAdmin ? "Admin" : "Usuario"})
        </div>
        <div className="hero-kpis" role="status" aria-live="polite">
          <span className="hero-kpi">Gastos cargados: {gastos.length}</span>
          {!esAdmin ? (
            <span className="hero-kpi">
              OCR semanal: {usageStats.week.used}/{usageStats.week.max}
            </span>
          ) : null}
          {!esAdmin ? (
            <span className="hero-kpi">
              OCR minuto: {usageStats.minute.used}/{usageStats.minute.max}
            </span>
          ) : null}
        </div>
      </section>

      {esAdmin ? (
        <>
        <section className="panel slide-in">
          <h2>Vista Admin · Usuarios</h2>
          <div className="actions admin-tools">
            <div className="field" style={{ minWidth: "260px" }}>
              <label htmlFor="admin-user">Seleccionar usuario</label>
              <select
                id="admin-user"
                value={adminSelectedUser}
                onChange={(e) => setAdminSelectedUser(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {usersWithCounts.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.nombre} ({u.username})
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              disabled={!adminSelectedUser}
              onClick={() => setAdminViewingUser(adminSelectedUser)}
            >
              Ingresar a ver gastos
            </button>
            <button className="btn btn-accent" onClick={() => setAdminViewingUser("")}>
              Ver todos
            </button>
          </div>

          <div className="admin-user-grid">
            {usersWithCounts.map((u) => (
              <button
                key={u.id}
                className={`admin-user-card ${adminViewingUser === u.username ? "active" : ""}`}
                onClick={() => {
                  setAdminSelectedUser(u.username);
                  setAdminViewingUser(u.username);
                }}
                type="button"
              >
                <strong>{u.nombre}</strong>
                <span>@{u.username}</span>
                <span>{u.totalGastos} gastos</span>
              </button>
            ))}
          </div>

          <div className="hint">Vista actual: {vistaAdminLabel}</div>
        </section>

        <AdminUsers onUsersChange={setUsers} />
        </>
      ) : (
        <div className="user-workspace">
          <section className="panel slide-in workspace-main">
            <h2>Cargar y procesar</h2>
            <Upload imagePreview={imagePreview} onSelectImage={setImageFile} />

            <div className="grid-2 section-gap-sm">
              <div className="field">
                <label htmlFor="tipo-gasto">Tipo de gasto</label>
                <select
                  id="tipo-gasto"
                  value={tipoGasto}
                  onChange={(e) => setTipoGasto(e.target.value)}
                >
                  {TIPOS_GASTO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="actions">
              <button
                className="btn btn-primary"
                onClick={procesarFactura}
                disabled={!imageFile || procesando}
              >
                {procesando ? "Procesando..." : "Procesar OCR"}
              </button>
            </div>
            {procesando ? <div className="status">Analizando imagen...</div> : null}
            <div className="hint ocr-usage-hint">
              Consultas OCR: {usageStats.week.used}/{usageStats.week.max} esta semana
              {" · "}{usageStats.minute.used}/{usageStats.minute.max} este minuto
            </div>
          </section>

          <div className="workspace-side">
            <Resultado
              values={resultado}
              onChangeField={(key, value) => setResultado((prev) => ({ ...prev, [key]: value }))}
              onGuardar={onGuardar}
              disabled={!puedeGuardar}
              faltantes={faltantesObligatorios}
            />

            <section className="panel slide-in">
              <details className="ocr-accordion">
                <summary>Ver texto OCR crudo</summary>
                <textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  placeholder="Aca se vera el texto reconocido..."
                />
              </details>
            </section>
          </div>
        </div>
      )}

      <TablaGastos
        gastos={gastosVisibles}
        onExportar={() =>
          exportarExcelMensual(gastosVisibles, mesExportacion, {
            beneficiario: beneficiarioExport,
            usuarioCarga: authUser.nombre,
            concepto: "GASTOS TARJETA",
            moneda: "Pesos",
          })
        }
        onEliminar={onEliminar}
        mesExportacion={mesExportacion}
        onCambiarMesExportacion={setMesExportacion}
        showUsuarioColumn={authUser.role === "admin"}
      />
    </main>
  );
}

export default App;
