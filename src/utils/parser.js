const toNumberString = (value) => {
  if (!value) return "";
  const clean = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "");
  const normalized = clean.replace(",", ".");
  return Number.isNaN(Number(normalized)) ? "" : Number(normalized).toFixed(2);
};

const extractAmountFromLine = (linea) => {
  const matches = linea.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d+)?/g);
  if (!matches?.length) return "";
  return toNumberString(matches[matches.length - 1]);
};

const formatCuit = (raw) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return "";
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const extractCuit = (lineas, texto) => {
  for (const linea of lineas) {
    const cuitWithDash = linea.match(/\b\d{2}-\d{8}-\d\b/);
    if (cuitWithDash?.[0]) return formatCuit(cuitWithDash[0]);

    if (linea.toUpperCase().includes("CUIT")) {
      const elevenDigits = linea.match(/\d{11}/);
      if (elevenDigits?.[0]) return formatCuit(elevenDigits[0]);
    }
  }

  const cuitAnywhere = texto.match(/\b\d{11}\b/);
  return cuitAnywhere?.[0] ? formatCuit(cuitAnywhere[0]) : "";
};

const cleanProveedor = (linea) => {
  if (!linea) return "";
  return linea
    .replace(/(RAZON\s*SOCIAL|RAZON\s*SOCIAl|PROVEEDOR|EMISOR)\s*:?/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const extractProveedor = (lineas) => {
  const blockedWords = ["CUIT", "TOTAL", "SUBTOTAL", "IVA", "IMPUEST", "FACTURA", "TICKET"];

  for (const linea of lineas) {
    const upper = linea.toUpperCase();
    if (upper.includes("RAZON SOCIAL") || upper.includes("PROVEEDOR") || upper.includes("EMISOR")) {
      const cleaned = cleanProveedor(linea);
      if (cleaned) return cleaned;
    }
  }

  // Fallback: primeras lineas con texto util que no parezcan importes o metadatos.
  for (const linea of lineas.slice(0, 6)) {
    const upper = linea.toUpperCase();
    const hasBlockedWord = blockedWords.some((w) => upper.includes(w));
    const hasDigits = /\d/.test(linea);
    if (!hasBlockedWord && !hasDigits && linea.length > 3) {
      return linea.trim();
    }
  }

  return "";
};

export const extraerDatos = (texto) => {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);

  let total = "";
  let subtotal = "";
  let impuestos = "";

  // Si el keyword está solo en la línea (sin número), busca en la línea siguiente
  const amountOnLineOrNext = (i) => {
    const a = extractAmountFromLine(lineas[i]);
    if (a) return a;
    return extractAmountFromLine(lineas[i + 1] || "");
  };

  for (let i = 0; i < lineas.length; i++) {
    const upper = lineas[i].toUpperCase();

    if (!subtotal && upper.includes("SUBTOTAL")) {
      subtotal = amountOnLineOrNext(i);
      continue;
    }

    if (!total && upper.includes("TOTAL") && !upper.includes("SUBTOTAL")) {
      total = amountOnLineOrNext(i);
      continue;
    }

    // IVA: evita matchear headers como "(IVA) [%B.I.]" — solo líneas donde IVA aparece como keyword principal
    if (!impuestos && (upper.startsWith("IVA") || upper.includes("IMPUEST"))) {
      const amount = amountOnLineOrNext(i);
      // Filtra porcentajes (ej: 10.50%) — montos reales son > 1
      if (amount && parseFloat(amount) > 1) impuestos = amount;
      continue;
    }
  }

  // Fallback: si no hubo línea "TOTAL", buscar "SALDO" (formato tique)
  if (!total) {
    for (let i = 0; i < lineas.length; i++) {
      const upper = lineas[i].toUpperCase();
      if (upper.startsWith("SALDO")) {
        const amount = amountOnLineOrNext(i);
        if (amount) { total = amount; break; }
      }
    }
  }

  const cuit = extractCuit(lineas, texto);
  const proveedor = extractProveedor(lineas);

  return { total, subtotal, impuestos, cuit, proveedor, concepto: "" };
};
