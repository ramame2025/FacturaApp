import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Faltan credenciales" });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, username, password_hash, nombre, role
      FROM users WHERE username = ${username}
    `;
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
    }

    const token = randomUUID();
    await sql`
      INSERT INTO sessions (token, username, role, expires_at)
      VALUES (${token}, ${user.username}, ${user.role}, NOW() + INTERVAL '7 days')
    `;

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[auth]", err);
    return res.status(500).json({ error: "Error interno" });
  }
}
