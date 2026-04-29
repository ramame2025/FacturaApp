import { getDb, validateToken } from "./_db.js";

const normalizeRow = (row) => ({
  id: row.id,
  fecha: row.fecha,
  fechaISO: row.fecha_iso,
  usuario: row.usuario,
  usuarioNombre: row.usuario_nombre,
  tipoGasto: row.tipo_gasto,
  total: row.total,
  subtotal: row.subtotal,
  impuestos: row.impuestos,
  cuit: row.cuit,
  proveedor: row.proveedor,
  concepto: row.concepto,
  textoOCR: row.texto_ocr,
  imagen_url: row.imagen_url,
});

export default async function handler(req, res) {
  let session;
  try {
    session = await validateToken(req);
  } catch (err) {
    console.error("[gastos] validateToken", err);
    return res.status(500).json({ error: "Error interno" });
  }

  if (!session) return res.status(401).json({ error: "No autenticado" });

  const sql = getDb();
  const { method } = req;

  try {
    // GET /api/gastos — list gastos (admin sees all, users see their own)
    if (method === "GET") {
      let rows;
      if (session.role === "admin") {
        rows = await sql`
          SELECT * FROM gastos
          WHERE expires_at > NOW()
          ORDER BY created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT * FROM gastos
          WHERE usuario = ${session.username} AND expires_at > NOW()
          ORDER BY created_at DESC
        `;
      }
      return res.status(200).json({ gastos: rows.map(normalizeRow) });
    }

    // POST /api/gastos — create gasto
    if (method === "POST") {
      const { gasto } = req.body || {};
      if (!gasto?.id) return res.status(400).json({ error: "Datos invalidos" });

      // imagen_url is already a Vercel Blob URL — uploaded client-side via /api/upload-token
      const imagen_url = gasto.imagen_url || null;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await sql`
        INSERT INTO gastos (
          id, usuario, usuario_nombre, fecha, fecha_iso,
          tipo_gasto, total, subtotal, impuestos, cuit,
          proveedor, concepto, texto_ocr, imagen_url, expires_at
        ) VALUES (
          ${gasto.id},
          ${session.username},
          ${gasto.usuarioNombre || ""},
          ${gasto.fecha || ""},
          ${gasto.fechaISO || ""},
          ${gasto.tipoGasto || ""},
          ${gasto.total || ""},
          ${gasto.subtotal || ""},
          ${gasto.impuestos || ""},
          ${gasto.cuit || ""},
          ${gasto.proveedor || ""},
          ${gasto.concepto || ""},
          ${gasto.textoOCR || ""},
          ${imagen_url},
          ${expiresAt.toISOString()}
        )
      `;

      return res.status(201).json({ ok: true, imagen_url });
    }

    // DELETE /api/gastos?id=X — delete gasto
    if (method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Falta id" });

      const found = await sql`SELECT usuario FROM gastos WHERE id = ${id}`;
      if (!found[0]) return res.status(404).json({ error: "No encontrado" });
      if (session.role !== "admin" && found[0].usuario !== session.username) {
        return res.status(403).json({ error: "No autorizado" });
      }

      await sql`DELETE FROM gastos WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Metodo no permitido" });
  } catch (err) {
    console.error("[gastos]", err);
    return res.status(500).json({ error: "Error interno" });
  }
}
