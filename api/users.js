import bcrypt from "bcryptjs";
import { getDb, validateToken } from "./_db.js";

export default async function handler(req, res) {
  let session;
  try {
    session = await validateToken(req);
  } catch (err) {
    console.error("[users] validateToken", err);
    return res.status(500).json({ error: "Error interno" });
  }

  if (!session) return res.status(401).json({ error: "No autenticado" });
  if (session.role !== "admin") return res.status(403).json({ error: "Acceso denegado" });

  const sql = getDb();
  const { method } = req;

  try {
    // GET /api/users — list all users
    if (method === "GET") {
      const rows = await sql`
        SELECT id, username, nombre, role, created_at
        FROM users ORDER BY created_at ASC
      `;
      return res.status(200).json({ users: rows });
    }

    // POST /api/users — create user
    if (method === "POST") {
      const { username, password, nombre, role = "user" } = req.body || {};
      if (!username || !password || !nombre) {
        return res.status(400).json({ error: "Faltan campos: username, password, nombre" });
      }
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Rol invalido" });
      }
      const hash = await bcrypt.hash(password, 10);
      await sql`
        INSERT INTO users (username, password_hash, nombre, role)
        VALUES (${username.trim()}, ${hash}, ${nombre.trim()}, ${role})
      `;
      return res.status(201).json({ ok: true });
    }

    // DELETE /api/users?id=X — delete user (keeps their gastos)
    if (method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Falta id" });

      // Prevent deleting the calling admin
      if (String(id) === String(session.id)) {
        return res.status(400).json({ error: "No podes eliminarte a vos mismo" });
      }

      // Fetch username to invalidate sessions
      const found = await sql`SELECT username, role FROM users WHERE id = ${id}`;
      if (!found[0]) return res.status(404).json({ error: "Usuario no encontrado" });
      if (found[0].role === "admin") {
        return res.status(400).json({ error: "No se puede eliminar un admin" });
      }

      await sql`DELETE FROM sessions WHERE username = ${found[0].username}`;
      await sql`DELETE FROM users WHERE id = ${id} AND role != 'admin'`;
      return res.status(200).json({ ok: true });
    }

    // PATCH /api/users?id=X — reset password
    if (method === "PATCH") {
      const { id } = req.query;
      const { password } = req.body || {};
      if (!id || !password) return res.status(400).json({ error: "Faltan datos" });
      if (password.length < 6) return res.status(400).json({ error: "Contrasena minimo 6 caracteres" });

      const hash = await bcrypt.hash(password, 10);
      const result = await sql`
        UPDATE users SET password_hash = ${hash} WHERE id = ${id}
      `;
      if (result.count === 0) return res.status(404).json({ error: "Usuario no encontrado" });

      // Invalidate existing sessions for security
      const found = await sql`SELECT username FROM users WHERE id = ${id}`;
      if (found[0]) {
        await sql`DELETE FROM sessions WHERE username = ${found[0].username}`;
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Metodo no permitido" });
  } catch (err) {
    console.error("[users]", err);
    return res.status(500).json({ error: "Error interno" });
  }
}
