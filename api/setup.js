import bcrypt from "bcryptjs";
import { getDb } from "./_db.js";

// One-time setup endpoint. Protected by SETUP_SECRET env var.
// Call: GET /api/setup?key=<SETUP_SECRET>
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const rawKey = req.query?.key;
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  const secret = process.env.SETUP_SECRET;

  if (!secret) {
    return res.status(500).json({ error: "SETUP_SECRET no configurada en Vercel" });
  }

  if (!key) {
    return res.status(400).json({ error: "Falta ?key= en la URL" });
  }

  if (key !== secret.trim()) {
    return res.status(403).json({ error: "Clave de setup invalida" });
  }

  try {
    const sql = getDb();

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        username   TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nombre     TEXT NOT NULL,
        role       TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        username   TEXT NOT NULL,
        role       TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS gastos (
        id            TEXT PRIMARY KEY,
        usuario       TEXT NOT NULL,
        usuario_nombre TEXT,
        fecha         TEXT,
        fecha_iso     TEXT,
        tipo_gasto    TEXT,
        total         TEXT,
        subtotal      TEXT,
        impuestos     TEXT,
        cuit          TEXT,
        proveedor     TEXT,
        concepto      TEXT,
        texto_ocr     TEXT,
        imagen_url    TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
      )
    `;

    // Seed initial users (idempotent — ON CONFLICT DO NOTHING)
    const seedUsers = [
      { username: "admin",  password: "admin123",  nombre: "Administrador",    role: "admin" },
      { username: "juan",   password: "juan123",   nombre: "Juan Garcia",      role: "user"  },
      { username: "maria",  password: "maria123",  nombre: "Maria Lopez",      role: "user"  },
      { username: "carlos", password: "carlos123", nombre: "Carlos Rodriguez", role: "user"  },
    ];

    const results = [];
    for (const u of seedUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      await sql`
        INSERT INTO users (username, password_hash, nombre, role)
        VALUES (${u.username}, ${hash}, ${u.nombre}, ${u.role})
        ON CONFLICT (username) DO NOTHING
      `;
      results.push(u.username);
    }

    return res.status(200).json({
      ok: true,
      message: "Setup completado",
      tables: ["users", "sessions", "gastos"],
      users_seeded: results,
    });
  } catch (err) {
    console.error("[setup]", err);
    return res.status(500).json({ error: err.message });
  }
}
