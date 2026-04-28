import { useEffect, useMemo, useState } from "react";
import Upload from "./components/Upload";
import Resultado from "./components/Resultado";
import TablaGastos from "./components/TablaGastos";
import Login from "./components/Login";
import { reconocerTexto } from "./utils/ocr";
import { extraerDatos } from "./utils/parser";
import { exportarExcelMensual } from "./utils/excel";
import { pdfToImageDataUrl } from "./utils/pdf";
import { authenticate, getAllUsers } from "./utils/auth";
import { checkRateLimit, incrementUsage, getUsageStats } from "./utils/rateLimit";

const AUTH_KEY = "authUser";
const getUserStorageKey = (username) => `gastos_${username}`;
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
  const [storageReady, setStorageReady] = useState(false);
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

  useEffect(() => {
    try {
      const savedAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (savedAuth?.username && savedAuth?.role) {
        setAuthUser(savedAuth);
      }
    } catch {
      setAuthUser(null);
    }
  }, []);

  // Cargar gastos del usuario actual cuando authUser cambia
  useEffect(() => {
    if (!authUser) {
      setStorageReady(false);
      setGastos([]);
      return;
    }
    try {
      let gastosACargar = [];
      
      if (authUser.role === "admin") {
        // Admin carga gastos de TODOS los usuarios
        const users = getAllUsers();
        users.forEach((u) => {
          const key = getUserStorageKey(u.username);
          const saved = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(saved)) {
            gastosACargar.push(
              ...saved.map((g) => ({
                ...g,
                concepto: g.concepto || g.descripcion || "",
              }))
            );
          }
        });
      } else {
        // Usuario normal carga solo sus propios gastos
        const key = getUserStorageKey(authUser.username);
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(saved)) {
          gastosACargar = saved.map((g) => ({
            ...g,
            concepto: g.concepto || g.descripcion || "",
          }));
        }
      }
      
      setGastos(gastosACargar);
      setStorageReady(true);
    } catch {
      setGastos([]);
      setStorageReady(true);
    }
  }, [authUser]);

  // Limpiar imágenes antiguas (>30 días) automáticamente
  useEffect(() => {
    setGastos((prev) => {
      const now = Date.now();
      const treintaDias = 30 * 24 * 60 * 60 * 1000;
      
      return prev.map((g) => {
        const fechaGasto = new Date(g.fechaISO).getTime();
        const diasTranscurridos = (now - fechaGasto) / (24 * 60 * 60 * 1000);
        
        // Si pasaron más de 30 días, eliminar imagen
        if (diasTranscurridos > 30 && g.imagenBase64) {
          return { ...g, imagenBase64: null };
        }
        return g;
      });
    });
  }, []); // Solo ejecutar una vez al montar
  useEffect(() => {
    if (!authUser || !storageReady) return;
    
    if (authUser.role === "admin") {
      // Admin: guardar cada gasto en la clave de su usuario
      const gastosPorUsuario = {};
      gastos.forEach((g) => {
        const key = getUserStorageKey(g.usuario);
        if (!gastosPorUsuario[key]) {
          gastosPorUsuario[key] = [];
        }
        gastosPorUsuario[key].push(g);
      });
      
      // Guardar cada grupo en su clave
      Object.entries(gastosPorUsuario).forEach(([key, gastosUser]) => {
        localStorage.setItem(key, JSON.stringify(gastosUser));
      });
    } else {
      // Usuario normal: guardar solo sus gastos en su clave
      const key = getUserStorageKey(authUser.username);
      localStorage.setItem(key, JSON.stringify(gastos));
    }
  }, [gastos, authUser, storageReady]);

  useEffect(() => {
    if (!authUser) return;
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
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
    
    let imagenBase64 = null;
    
    // Guardar una vista comprimida para no exceder el limite de localStorage
    if (imageFile) {
      const imageSource = imageFile.type === "application/pdf"
        ? imagePreview
        : await readFileAsDataUrl(imageFile);

      if (imageSource) {
        imagenBase64 = await compressPreviewImage(imageSource);
      }
    }
    
    const now = new Date();
    const nuevo = {
      id: crypto.randomUUID(),
      fecha: now.toLocaleString("es-AR"),
      fechaISO: now.toISOString(),
      usuario: authUser.username,
      usuarioNombre: authUser.nombre,
      tipoGasto,
      total: resultado.total,
      subtotal: resultado.subtotal,
      impuestos: resultado.impuestos,
      cuit: resultado.cuit,
      proveedor: resultado.proveedor,
      concepto: resultado.concepto,
      textoOCR: ocrText,
      imagenBase64, // ← Guardar la imagen
    };

    setGastos((prev) => [nuevo, ...prev]);
    setImageFile(null);
    setOcrText("");
    setResultado({
      total: "",
      subtotal: "",
      impuestos: "",
      cuit: "",
      proveedor: "",
      concepto: "",
    });
  };

  const onEliminar = (id) => {
    const gastoAEliminar = gastos.find((g) => g.id === id);
    
    // Validar permisos: usuario normal solo puede eliminar sus propios gastos
    if (authUser.role !== "admin" && gastoAEliminar?.usuario !== authUser.username) {
      alert("No tienes permiso para eliminar este gasto");
      return;
    }
    
    setGastos((prev) => prev.filter((g) => g.id !== id));
  };

  const login = (username, password) => {
    const user = authenticate(username, password);
    if (!user) return false;
    setAuthUser(user);
    return true;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setStorageReady(false);
    setAuthUser(null);
    setAdminSelectedUser("");
    setAdminViewingUser("");
  };

  if (!authUser) {
    return <Login onLogin={login} />;
  }

  const users = getAllUsers();
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

  return (
    <main className="layout">
      <section className="hero slide-in">
        <div className="topbar">
          <h1>FacturaAPP · MVP</h1>
          <button className="btn btn-danger" onClick={logout}>
            Cerrar sesion
          </button>
        </div>
  
        <div className="hint" style={{ marginTop: "8px" }}>
          Sesion: {authUser.nombre} ({authUser.role === "admin" ? "Admin" : "Usuario"})
        </div>
      </section>

      {authUser.role === "admin" ? (
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
      ) : (
        <>
          <section className="panel slide-in">
            <h2>1) Cargar y procesar</h2>
            <Upload imagePreview={imagePreview} onSelectImage={setImageFile} />

            <div className="grid-2" style={{ marginTop: "14px" }}>
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
            {procesando ? <div className="status">Analizando con Google Vision...</div> : null}
            <div className="hint" style={{ marginTop: "6px" }}>
              Consultas OCR: {usageStats.week.used}/{usageStats.week.max} esta semana
              {" · "}{usageStats.minute.used}/{usageStats.minute.max} este minuto
            </div>
          </section>

          <Resultado
            values={resultado}
            onChangeField={(key, value) => setResultado((prev) => ({ ...prev, [key]: value }))}
            onGuardar={onGuardar}
            disabled={!puedeGuardar}
            faltantes={faltantesObligatorios}
          />

          <section className="panel slide-in">
            <h2>Texto OCR detectado</h2>
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              placeholder="Aca se vera el texto reconocido..."
            />
          </section>
        </>
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
