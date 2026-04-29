const formatAmount = (value) =>
  Number.isFinite(value) && value > 0 ? value.toFixed(2) : "";

const normalizeLine = (linea) =>
  (linea || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const parseAmountToken = (token) => {
  if (!token) return null;
  const clean = token.replace(/[^\d.,]/g, "");
  if (!clean || !/\d/.test(clean)) return null;

  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  const hasComma = comma !== -1;
  const hasDot = dot !== -1;

  if (hasComma && hasDot) {
    const decimalIndex = Math.max(comma, dot);
    const decimalPart = clean.slice(decimalIndex + 1).replace(/\D/g, "");
    const integerPart = clean.slice(0, decimalIndex).replace(/[.,]/g, "");

    if (decimalPart.length >= 1 && decimalPart.length <= 2) {
      const parsed = Number(`${integerPart}.${decimalPart}`);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const whole = Number(clean.replace(/[.,]/g, ""));
    return Number.isFinite(whole) ? whole : null;
  }

  if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const idx = clean.lastIndexOf(sep);
    const decimals = clean.slice(idx + 1).replace(/\D/g, "");

    if (decimals.length >= 1 && decimals.length <= 2) {
      const integerPart = clean.slice(0, idx).replace(/[.,]/g, "");
      const parsed = Number(`${integerPart}.${decimals}`);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const whole = Number(clean.replace(/[.,]/g, ""));
    return Number.isFinite(whole) ? whole : null;
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractAmountsFromLine = (linea) => {
  const matches = (linea || "").match(/(?:\d{1,3}(?:[.\s,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g);
  if (!matches?.length) return [];

  return matches
    .map((token) => parseAmountToken(token))
    .filter((n) => Number.isFinite(n) && n > 100);
};

const extractAmountFromLine = (linea) => {
  const amounts = extractAmountsFromLine(linea);
  if (!amounts.length) return "";
  return formatAmount(Math.max(...amounts));
};

const containsAny = (text, words) => words.some((word) => text.includes(word));

const lineWeightForTotal = (linea) => {
  const upper = normalizeLine(linea);
  const hasKeyword = /(TOTAL|A PAGAR|IMPORTE|SALDO)/.test(upper);
  if (!hasKeyword) return 0;

  let score = 0;

  if (upper.includes("TOTAL A PAGAR") || upper.includes("IMPORTE A PAGAR")) score += 140;
  if (upper.includes("IMPORTE TOTAL")) score += 90;
  if (upper.includes("TOTAL")) score += 60;
  if (upper.startsWith("TOTAL")) score += 40;
  if (upper.startsWith("SALDO")) score += 35;

  // Penaliza conceptos de impuestos/tributos para evitar falsos "totales".
  if (containsAny(upper, ["OTROS TRIBUT", "TRIBUT", "IMPUEST", "IVA", "ALICUOT", "PERCEPC", "RETENC", "SUBTOTAL"])) {
    score -= 140;
  }

  // Penaliza líneas de forma de pago; suelen no ser el total fiscal principal.
  if (containsAny(upper, ["EFECTIVO", "TARJETA", "VUELTO", "CUOTA", "SUS PAGOS"])) {
    score -= 25;
  }

  return score;
};

const extractBestTotal = (lineas) => {
  const candidatos = [];

  for (let i = 0; i < lineas.length; i++) {
    const actual = lineas[i];
    const weight = lineWeightForTotal(actual);
    if (weight <= 0) continue;

    const enLinea = extractAmountsFromLine(actual);
    const enSiguiente = extractAmountsFromLine(lineas[i + 1] || "");
    const valores = [...enLinea, ...enSiguiente];
    if (!valores.length) continue;

    candidatos.push({
      amount: Math.max(...valores),
      weight,
      index: i,
    });
  }

  if (candidatos.length) {
    candidatos.sort((a, b) => (b.weight - a.weight) || (b.amount - a.amount) || (b.index - a.index));
    return formatAmount(candidatos[0].amount);
  }

  const todos = lineas.flatMap((linea) => extractAmountsFromLine(linea));
  if (!todos.length) return "";
  return formatAmount(Math.max(...todos));
};

const isSubtotalLine = (linea) => {
  const upper = normalizeLine(linea);
  return /(SUB\s*\.?\s*TOTAL|SUBTOT\.?|\bSUB\.|PRECIO\s*SIN\s*IMP\.?|RECIO\s*SIN\s*IMP\.?|SIN\s*IMP\.?|IMP\.?\s*NETO\s*GRAVADO|NETO\s*GRAVADO)/.test(upper);
};

const formatCuit = (raw) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return "";
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const getHeaderLines = (lineas) => lineas.slice(0, 25);

const extractCuit = (lineas, texto) => {
  const headerLines = getHeaderLines(lineas);

  for (const linea of headerLines) {
    const cuitWithDash = linea.match(/\b\d{2}-\d{8}-\d\b/);
    if (cuitWithDash?.[0]) return formatCuit(cuitWithDash[0]);

    if (linea.toUpperCase().includes("CUIT")) {
      const elevenDigits = linea.match(/\d{11}/);
      if (elevenDigits?.[0]) return formatCuit(elevenDigits[0]);
    }
  }

  const textoInicial = (texto || "").slice(0, 1200);
  const cuitAnywhere = textoInicial.match(/\b\d{11}\b/);
  return cuitAnywhere?.[0] ? formatCuit(cuitAnywhere[0]) : "";
};

const cleanProveedor = (linea) => {
  if (!linea) return "";
  return linea
    .replace(/(RAZON\s*SOCIAL|RAZON\s*SOCIAl|PROVEEDOR|EMISOR)\s*:?/i, "")
    .replace(/\bC\.?\s*U\.?\s*I\.?\s*T\b.*$/i, "")
    .replace(/\bNRO\.?\b.*$/i, "")
    .replace(/\b(IVA\s+RESPONSABLE\s+INSCRIPTO|RESPONSABLE\s+INSCRIPTO)\b.*$/i, "")
    .replace(/\b\d{2}-\d{8}-\d\b/g, "")
    .replace(/\d{5,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const isValidProveedor = (value) => {
  if (!value) return false;
  const clean = value.trim();
  if (clean.length < 4) return false;
  if (!/[A-Z]/i.test(clean)) return false;

  const blocked = ["TOTAL", "SUBTOTAL", "IVA", "IMPUEST", "TICKET", "FACTURA", "ALICUOT", "TRIBUT"];
  const upper = clean.toUpperCase();
  return !blocked.some((w) => upper.includes(w));
};

const scoreProveedorCandidate = (value) => {
  if (!isValidProveedor(value)) return Number.NEGATIVE_INFINITY;

  const upper = value.toUpperCase();
  let score = 0;

  if (/(\bS\.?\s*A\b|\bS\.?\s*R\.?\s*L\b|\bSAS\b|\bSOCIEDAD\b)/.test(upper)) score += 80;
  if (/\d/.test(upper)) score -= 40;
  if (/(RUTA|CALLE|DOMICILIO|AV\.|AVENIDA|KM\b|CP\b|COD\.|NRO\.|N\b)/.test(upper)) score -= 80;

  return score;
};

const extractProveedor = (lineas) => {
  const headerLines = getHeaderLines(lineas);
  const blockedWords = ["CUIT", "TOTAL", "SUBTOTAL", "IVA", "IMPUEST", "FACTURA", "TICKET"];
  const razonSocialTokens = [
    " S.A",
    " SA",
    " S A",
    " S.R.L",
    " SRL",
    " S R L",
    " SAS",
    " S.H",
    " SH",
    " SOCIEDAD",
  ];

  for (const linea of headerLines) {
    const upper = linea.toUpperCase();
    if (upper.includes("RAZON SOCIAL") || upper.includes("PROVEEDOR") || upper.includes("EMISOR")) {
      const cleaned = cleanProveedor(linea);
      if (isValidProveedor(cleaned)) return cleaned;
    }
  }

  // Si CUIT viene en la misma linea que el proveedor, toma el texto previo a CUIT.
  for (let i = 0; i < headerLines.length; i++) {
    const upper = headerLines[i].toUpperCase();
    if (!/C\.?\s*U\.?\s*I\.?\s*T/.test(upper)) continue;

    const candidatos = [];
    const beforeCuit = headerLines[i].split(/C\.?\s*U\.?\s*I\.?\s*T/i)[0] || "";
    candidatos.push(cleanProveedor(beforeCuit));

    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      candidatos.push(cleanProveedor(headerLines[j] || ""));
    }

    candidatos.sort((a, b) => scoreProveedorCandidate(b) - scoreProveedorCandidate(a));
    if (scoreProveedorCandidate(candidatos[0]) > Number.NEGATIVE_INFINITY) {
      return candidatos[0];
    }
  }

  // Prioriza razon social en el encabezado por sufijos comerciales.
  for (const linea of headerLines.slice(0, 10)) {
    const upper = linea.toUpperCase();
    const hasCompanyToken = razonSocialTokens.some((token) => upper.includes(token));
    const hasBlockedWord = blockedWords.some((w) => upper.includes(w));
    const hasEnoughText = linea.replace(/[^A-Z\s.]/g, "").trim().length >= 6;
    if (hasCompanyToken && !hasBlockedWord && hasEnoughText) {
      const cleaned = cleanProveedor(linea);
      if (isValidProveedor(cleaned)) return cleaned;
    }
  }

  // Fallback: primeras lineas con texto util que no parezcan importes o metadatos.
  for (const linea of headerLines.slice(0, 8)) {
    const upper = linea.toUpperCase();
    const hasBlockedWord = blockedWords.some((w) => upper.includes(w));
    const hasDigits = /\d/.test(linea);
    if (!hasBlockedWord && !hasDigits && linea.length > 3) {
      const cleaned = cleanProveedor(linea);
      if (isValidProveedor(cleaned)) return cleaned;
    }
  }

  return "";
};

export const extraerDatos = (texto) => {
  const lineas = texto
    .split("\n")
    .map((l) => normalizeLine(l))
    .filter(Boolean);

  let total = extractBestTotal(lineas);
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

    if (!subtotal && isSubtotalLine(upper)) {
      subtotal = amountOnLineOrNext(i);
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

  const cuit = extractCuit(lineas, texto);
  const proveedor = extractProveedor(lineas);

  return { total, subtotal, impuestos, cuit, proveedor, concepto: "" };
};
