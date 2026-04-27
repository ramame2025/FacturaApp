# FacturaApp

**Gestor de gastos con OCR** - Sube tickets/facturas, extrae datos automáticamente con reconocimiento óptico de caracteres (OCR), edita y exporta a Excel.

## 🎯 Características

- 📸 **Upload de imágenes y PDFs** - Drag & drop o seleccionar archivo
- 🤖 **OCR automático** - Extrae Total, Subtotal, Impuestos, CUIT, Proveedor y Concepto con Tesseract.js
- ✏️ **Edición de datos** - Corrige campos extraídos antes de guardar
- 💾 **Persistencia local** - localStorage por usuario (sin backend)
- 👤 **Multi-usuario** - 3 usuarios + 1 admin con control de permisos
- 📊 **Exportación Excel** - Genera reportes mensuales en formato plantilla con estilos avanzados
- 📱 **Responsive** - Mobile-first design (cards en móvil, tabla en desktop)
- 🔒 **Seguridad** - Cada usuario solo ve sus propios gastos
- 🖼️ **Galería de imágenes** - Ver recibos guardados (se eliminan después de 30 días automáticamente)

## 🚀 Quick Start

### Requisitos
- Node.js 16+ y npm

### Instalación
```bash
git clone https://github.com/ramame2025/FacturaApp.git
cd FacturaApp
npm install
npm run dev
```

La app abrirá en `http://localhost:5173` (o 5174 si 5173 está en uso)

## 🔐 Usuarios de prueba

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin123 | Admin (ve todos los gastos) |
| juan | juan123 | Usuario |
| maria | maria123 | Usuario |
| carlos | carlos123 | Usuario |

## 📦 Stack técnico

- **Frontend**: React 19.2.5
- **Build**: Vite 8.0.10
- **OCR**: Tesseract.js 7.0.0 (Spanish language)
- **PDF**: pdfjs-dist 5.6.205
- **Excel**: ExcelJS (estilos avanzados)
- **Storage**: localStorage (multi-usuario por clave)

## 🏗️ Estructura del proyecto

```
src/
├── App.jsx                 # Lógica principal, OCR orchestration, auth
├── components/
│   ├── Login.jsx           # Formulario de login
│   ├── Upload.jsx          # Drag-drop file upload
│   ├── Resultado.jsx       # Editable form para datos extraídos
│   └── TablaGastos.jsx     # Tabla/cards de gastos + galería de imágenes
├── utils/
│   ├── ocr.js              # Tesseract.js integration
│   ├── parser.js           # Regex para extraer campos financieros
│   ├── pdf.js              # PDF to image conversion
│   ├── excel.js            # ExcelJS export con styling
│   └── auth.js             # User credentials y roles
└── style.css               # Mobile-first responsive CSS
```

## 💡 Funcionalidades por rol

### Usuario normal
- ✅ Subir y procesar sus propios gastos
- ✅ Editar datos extraídos
- ✅ Ver su tabla de gastos con filtros
- ✅ Eliminar solo sus propios gastos
- ✅ Exportar sus gastos mensuales
- ✅ Ver imágenes de sus recibos
- ❌ No ve gastos de otros usuarios
- ❌ No puede acceder a gastos ajenos

### Admin
- ✅ Ver gastos de TODOS los usuarios
- ✅ Seleccionar usuario y visualizar/editar sus gastos
- ✅ Eliminar gastos de cualquier usuario
- ✅ Exportar gastos de un usuario específico
- ✅ Ver tabla consolidada de todos
- ✅ Acceso total a toda la data

## 🔧 Desarrollo

### Comandos
```bash
npm run dev     # Inicia dev server con hot reload
npm run build   # Build para producción
npm run preview # Preview del build
```

### Notas técnicas

**Storage multi-usuario:**
- Cada usuario tiene clave `gastos_{username}` en localStorage
- Admin carga gastos de TODOS los usuarios al login
- Guardado automático cada vez que cambia el estado `gastos`
- Limpieza de imágenes antiguas: >30 días se eliminan automáticamente

**OCR:**
- Tesseract.js configurado para español
- Extrae números (Total, Subtotal, Impuestos) con regex flexible
- Detecta CUIT en formato XX-XXXXXXXX-X
- Heurística para identificar proveedor

**Excel:**
- Template-style con estilos (bordes, fonts, row heights)
- Separación por tipo de gasto (Comidas, Hotel, Movilidad, Combustible, Otros)
- Totales por categoría y resumen general
- Currency formatting automático

## 📝 Permisos y validaciones

- ✅ Campos obligatorios: Total, Subtotal, Impuestos, Proveedor, Concepto (CUIT es opcional)
- ✅ Usuarios normales no pueden ver/editar/eliminar gastos de otros
- ✅ Solo admin puede cambiar de usuario en la vista
- ✅ Storage scoped por usuario (isolación de datos)

## 🚢 Deploy

Listo para deploy en **Vercel** (sin backend requerido)

## 📄 Licencia

Proyecto personal. Libre para usar.

---

**Autor**: Ramiro Mendoza  
**Status**: MVP funcional ✅
