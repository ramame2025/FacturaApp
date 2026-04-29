import { neon } from "@neondatabase/serverless";

export const getDb = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada");
  return neon(url);
};

/**
 * Validates the Bearer token from the Authorization header.
 * Returns { username, role } or null if invalid/expired.
 */
export const validateToken = async (req) => {
  const auth = req.headers?.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const sql = getDb();
  const rows = await sql`
    SELECT username, role FROM sessions
    WHERE token = ${token} AND expires_at > NOW()
  `;
  return rows[0] || null;
};
