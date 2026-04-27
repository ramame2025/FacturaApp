import ExcelJS from "exceljs";

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDateFromRecord = (item) => {
  if (item.fechaISO) {
    const byIso = new Date(item.fechaISO);
    if (!Number.isNaN(byIso.getTime())) return byIso;
  }

  if (item.fecha) {
    const byFecha = new Date(item.fecha);
    if (!Number.isNaN(byFecha.getTime())) return byFecha;
  }

  return null;
};

const matchesMonth = (date, monthKey) => {
  if (!date) return false;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return key === monthKey;
};

const formatDate = (date) => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear());
  return `${d}.${m}.${y}`;
};

const formatMoney = (value) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const moneyFormatCode = '"$" #,##0.00';

const thin = { style: "thin", color: { argb: "FF000000" } };
const medium = { style: "medium", color: { argb: "FF000000" } };

const setFont = (cell, opts = {}) => {
  cell.font = {
    name: "Calibri",
    size: 11,
    ...opts,
  };
};

const setBorder = (cell, border) => {
  cell.border = border;
};

const setAllThinBorder = (cell) => {
  setBorder(cell, { top: thin, right: thin, bottom: thin, left: thin });
};

const setRangeOuterBorder = (ws, startRow, endRow, startCol, endCol, borderStyle = medium) => {
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      const cell = ws.getCell(r, c);
      const current = cell.border || {};
      cell.border = {
        top: r === startRow ? borderStyle : current.top,
        bottom: r === endRow ? borderStyle : current.bottom,
        left: c === startCol ? borderStyle : current.left,
        right: c === endCol ? borderStyle : current.right,
      };
    }
  }
};

const safeMerge = (ws, range) => {
  const [start, end] = range.split(":");
  if (ws.getCell(start).isMerged || ws.getCell(end).isMerged) return;
  ws.mergeCells(range);
};

const tipoToColumn = (tipoGasto) => {
  const normalized = String(tipoGasto || "").toLowerCase();
  if (normalized.includes("comida")) return "Comidas";
  if (normalized.includes("hotel")) return "Hotel";
  if (normalized.includes("movilidad")) return "Movilidad";
  if (normalized.includes("combust")) return "Combustible";
  return "Otros";
};

export const exportarExcelMensual = (datos, mesExportacion, options = {}) => {
  if (!Array.isArray(datos) || datos.length === 0 || !mesExportacion) return;

  const filtrados = datos.filter((item) => matchesMonth(getDateFromRecord(item), mesExportacion));
  if (filtrados.length === 0) {
    alert("No hay gastos para el mes seleccionado.");
    return;
  }

  const ordenados = [...filtrados].sort((a, b) => {
    const da = getDateFromRecord(a)?.getTime() || 0;
    const db = getDateFromRecord(b)?.getTime() || 0;
    return da - db;
  });

  const [year, month] = mesExportacion.split("-").map(Number);
  const fechaDesde = new Date(year, month - 1, 1);
  const fechaHasta = new Date(year, month, 0);

  const totales = {
    Comidas: 0,
    Hotel: 0,
    Movilidad: 0,
    Combustible: 0,
    Otros: 0,
    Total: 0,
  };

  const detailRows = ordenados.map((g) => {
    const total = toNumber(g.total);
    const categoria = tipoToColumn(g.tipoGasto);
    const row = {
      fecha: formatDate(getDateFromRecord(g) || new Date()),
      concepto: (g.concepto || g.descripcion || "").toUpperCase(),
      comidas: null,
      hotel: null,
      movilidad: null,
      combustible: null,
      otros: null,
      total,
    };

    if (categoria === "Comidas") row.comidas = total;
    if (categoria === "Hotel") row.hotel = total;
    if (categoria === "Movilidad") row.movilidad = total;
    if (categoria === "Combustible") row.combustible = total;
    if (categoria === "Otros") row.otros = total;

    totales[categoria] += total;
    totales.Total += total;

    return row;
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Gastos Mensual", {
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { width: 12 },
    { width: 42 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
  ];

  // Encabezado superior (sin marca de texto fija).
  ws.getCell("A1").value = "Beneficiario";
  ws.getCell("B1").value = options.beneficiario || "";
  ws.getCell("E1").value = "Usuario que cargo los datos";
  ws.getCell("F1").value = options.usuarioCarga || "";
  safeMerge(ws, "B1:D1");
  safeMerge(ws, "F1:H1");

  ws.getCell("A2").value = "Concepto";
  ws.getCell("B2").value = options.concepto || "GASTOS TARJETA";
  safeMerge(ws, "B2:H2");

  ws.getCell("A3").value = "Moneda";
  ws.getCell("B3").value = options.moneda || "Pesos";
  safeMerge(ws, "B3:D3");
  ws.getCell("E3").value = "Fecha Desde";
  ws.getCell("F3").value = formatDate(fechaDesde);
  ws.getCell("G3").value = "Fecha Hasta";
  ws.getCell("H3").value = formatDate(fechaHasta);

  const headerRow = 5;
  ws.getRow(headerRow).values = [
    "Fecha",
    "Concepto",
    "Comidas",
    "Hotel",
    "Movilidad",
    "Combustible",
    "Otros",
    "Total",
  ];

  const thin = { style: "thin", color: { argb: "FF000000" } };
  const medium = { style: "medium", color: { argb: "FF000000" } };
  const allThin = { top: thin, left: thin, bottom: thin, right: thin };

  const styleHeaderCell = (addr) => {
    const cell = ws.getCell(addr);
    setFont(cell, { size: 12, bold: true });
    cell.alignment = { vertical: "middle", horizontal: "center" };
    setAllThinBorder(cell);
  };

  ["A1", "A2", "A3", "E1", "E3", "G3"].forEach((addr) => {
    const cell = ws.getCell(addr);
    setFont(cell, { size: 12, bold: false });
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  ["B1", "F1", "B2", "B3", "F3", "H3"].forEach((addr) => {
    const cell = ws.getCell(addr);
    setFont(cell, { size: 12, bold: false });
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  // Cajas finas en cabecera de datos.
  [
    "A1",
    "B1",
    "C1",
    "D1",
    "E1",
    "F1",
    "G1",
    "H1",
    "A2",
    "B2",
    "C2",
    "D2",
    "E2",
    "F2",
    "G2",
    "H2",
    "A3",
    "B3",
    "C3",
    "D3",
    "E3",
    "F3",
    "G3",
    "H3",
  ].forEach((addr) => setAllThinBorder(ws.getCell(addr)));

  ["A5", "B5", "C5", "D5", "E5", "F5", "G5", "H5"].forEach((addr) => styleHeaderCell(addr));
  ws.getRow(5).height = 24;
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 8;

  let row = headerRow + 1;
  detailRows.forEach((item) => {
    ws.getCell(`A${row}`).value = item.fecha;
    ws.getCell(`B${row}`).value = item.concepto;
    ws.getCell(`C${row}`).value = item.comidas;
    ws.getCell(`D${row}`).value = item.hotel;
    ws.getCell(`E${row}`).value = item.movilidad;
    ws.getCell(`F${row}`).value = item.combustible;
    ws.getCell(`G${row}`).value = item.otros;
    ws.getCell(`H${row}`).value = item.total;

    ws.getRow(row).height = 21;

    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      const cell = ws.getCell(`${col}${row}`);
      setFont(cell, { size: 12 });
      setAllThinBorder(cell);
      cell.alignment = {
        vertical: "middle",
        horizontal: col === "B" ? "left" : col >= "C" ? "right" : "center",
      };
      if (["C", "D", "E", "F", "G", "H"].includes(col) && typeof cell.value === "number") {
        cell.numFmt = moneyFormatCode;
      }
    });

    row += 1;
  });

  const totalsRow = row + 1;
  ws.getCell(`A${totalsRow}`).value = "Totales";
  safeMerge(ws, `A${totalsRow}:B${totalsRow}`);
  ws.getCell(`C${totalsRow}`).value = totales.Comidas;
  ws.getCell(`D${totalsRow}`).value = totales.Hotel;
  ws.getCell(`E${totalsRow}`).value = totales.Movilidad;
  ws.getCell(`F${totalsRow}`).value = totales.Combustible;
  ws.getCell(`G${totalsRow}`).value = totales.Otros;
  ws.getCell(`H${totalsRow}`).value = totales.Total;

  ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
    const cell = ws.getCell(`${col}${totalsRow}`);
    setFont(cell, { size: 12, bold: true });
    setAllThinBorder(cell);
    cell.alignment = {
      vertical: "middle",
      horizontal: ["C", "D", "E", "F", "G", "H"].includes(col) ? "right" : "center",
    };
    if (["C", "D", "E", "F", "G", "H"].includes(col) && typeof cell.value === "number") {
      cell.numFmt = moneyFormatCode;
    }
  });

  ws.getRow(totalsRow).height = 24;

  const summaryStart = totalsRow + 2;
  ws.getCell(`A${summaryStart}`).value = "Son Pesos:";
  ws.getCell(`B${summaryStart}`).value = formatMoney(totales.Total);
  safeMerge(ws, `B${summaryStart}:H${summaryStart}`);
  setFont(ws.getCell(`A${summaryStart}`), { size: 12 });
  setFont(ws.getCell(`B${summaryStart}`), { size: 12, bold: true });
  setAllThinBorder(ws.getCell(`B${summaryStart}`));
  setRangeOuterBorder(ws, summaryStart, summaryStart, 2, 8, thin);

  ws.getRow(summaryStart).height = 22;
  ws.getRow(summaryStart + 1).height = 10;

  ws.getCell(`A${summaryStart + 2}`).value = "Resumen";
  ws.getCell(`B${summaryStart + 2}`).value = "Fecha/s Anticipo/s";
  ws.getCell(`E${summaryStart + 2}`).value = "Beneficiario";
  safeMerge(ws, `E${summaryStart + 2}:H${summaryStart + 2}`);

  ws.getCell(`B${summaryStart + 3}`).value = "Monto Anticipo";
  ws.getCell(`E${summaryStart + 4}`).value = "Aprobo";
  safeMerge(ws, `E${summaryStart + 4}:H${summaryStart + 4}`);

  ws.getCell(`B${summaryStart + 4}`).value = "Monto Rendicion";
  ws.getCell(`C${summaryStart + 4}`).value = totales.Total;
  ws.getCell(`C${summaryStart + 4}`).numFmt = moneyFormatCode;
  ws.getCell(`E${summaryStart + 6}`).value = "Autorizo";
  safeMerge(ws, `E${summaryStart + 6}:H${summaryStart + 6}`);

  ws.getCell(`B${summaryStart + 5}`).value = "Diferencia Empresa / (Beneficiario)";
  ws.getCell(`C${summaryStart + 5}`).value = totales.Total;
  ws.getCell(`C${summaryStart + 5}`).numFmt = moneyFormatCode;

  // Cajas y firmas en bloque resumen.
  [summaryStart + 3, summaryStart + 5, summaryStart + 7].forEach((r) => {
    safeMerge(ws, `E${r}:H${r}`);
    setRangeOuterBorder(ws, r, r, 5, 8, thin);
    const signCell = ws.getCell(`F${r}`);
    signCell.value = "Firma y Aclaracion";
    signCell.alignment = { vertical: "middle", horizontal: "center" };
    setFont(signCell, { size: 12 });
  });

  setRangeOuterBorder(ws, summaryStart + 2, summaryStart + 2, 3, 4, thin);
  setRangeOuterBorder(ws, summaryStart + 3, summaryStart + 3, 3, 4, thin);
  setRangeOuterBorder(ws, summaryStart + 4, summaryStart + 4, 3, 4, thin);
  setRangeOuterBorder(ws, summaryStart + 5, summaryStart + 5, 3, 4, thin);

  [summaryStart + 2, summaryStart + 3, summaryStart + 4, summaryStart + 5, summaryStart + 6, summaryStart + 7].forEach((r) => {
    ws.getRow(r).height = 22;
  });

  for (let r = summaryStart + 2; r <= summaryStart + 7; r += 1) {
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((c) => {
      const cell = ws.getCell(`${c}${r}`);
      if (!cell.font) setFont(cell, { size: 12 });
    });
  }

  for (let r = 1; r <= summaryStart + 7; r += 1) {
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((c) => {
      const cell = ws.getCell(`${c}${r}`);
      if (!cell.font) setFont(cell, { size: 11 });
    });
  }

  // Borde exterior grueso de la tabla principal + bordes internos finos.
  const tableStart = 5;
  const tableEnd = totalsRow;
  for (let r = tableStart; r <= tableEnd; r += 1) {
    for (let c = 1; c <= 8; c += 1) {
      const cell = ws.getCell(r, c);
      const border = {
        top: r === tableStart ? medium : thin,
        bottom: r === tableEnd ? medium : thin,
        left: c === 1 ? medium : thin,
        right: c === 8 ? medium : thin,
      };
      cell.border = border;
    }
  }

  // Marco exterior general del reporte.
  setRangeOuterBorder(ws, 1, summaryStart + 7, 1, 8, medium);

  const buffer = workbook.xlsx.writeBuffer();
  Promise.resolve(buffer).then((content) => {
    const blob = new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gastos-${mesExportacion}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  });
};
