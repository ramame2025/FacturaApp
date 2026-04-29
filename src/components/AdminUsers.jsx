import { useState, useEffect } from "react";
import { apiGetUsers, apiCreateUser, apiDeleteUser, apiResetPassword } from "../utils/api";

const EMPTY_FORM = { username: "", password: "", nombre: "", role: "user" };

function AdminUsers({ onUsersChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // { id, username }
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGetUsers();
      setUsers(data);
      onUsersChange?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiCreateUser(form);
      flash(`Usuario "${form.username}" creado`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      load();
    } catch (e) {
      flash(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`¿Eliminar a ${user.nombre} (@${user.username})?\nSus gastos se conservan.`)) return;
    try {
      await apiDeleteUser(user.id);
      flash(`Usuario "${user.username}" eliminado`);
      load();
    } catch (e) {
      flash(e.message, true);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiResetPassword(resetTarget.id, newPassword);
      flash(`Contraseña de "${resetTarget.username}" actualizada`);
      setResetTarget(null);
      setNewPassword("");
    } catch (e) {
      flash(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel slide-in">
      <h2>Gestión de usuarios</h2>

      {error   && <div className="status" style={{ color: "#b91c1c", marginBottom: "10px" }}>{error}</div>}
      {success && <div className="status" style={{ color: "#166534", marginBottom: "10px" }}>{success}</div>}

      {loading ? (
        <div className="hint">Cargando usuarios...</div>
      ) : (
        <div className="admin-user-grid">
          {users.map((u) => (
            <div key={u.id} className="admin-user-card" style={{ cursor: "default" }}>
              <strong>{u.nombre}</strong>
              <span>@{u.username}</span>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                {u.role === "admin" ? "Admin" : "Usuario"}
              </span>
              <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                <button
                  className="btn btn-accent"
                  style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                  onClick={() => { setResetTarget({ id: u.id, username: u.username }); setNewPassword(""); }}
                  type="button"
                >
                  🔑 Reset pass
                </button>
                {u.role !== "admin" && (
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                    onClick={() => handleDelete(u)}
                    type="button"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset password form */}
      {resetTarget && (
        <form
          onSubmit={handleReset}
          style={{ marginTop: "14px", display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div className="field" style={{ flex: 1, minWidth: "200px" }}>
            <label>Nueva contraseña para @{resetTarget.username}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setResetTarget(null)}
            style={{ background: "#e5e0d8", color: "#5a4f42" }}
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Create user */}
      <div style={{ marginTop: "16px" }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          style={{ marginBottom: "10px" }}
        >
          {showCreate ? "Cancelar" : "+ Agregar usuario"}
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} className="grid-2" style={{ marginTop: "4px" }}>
            <div className="field">
              <label>Nombre completo</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                required
                placeholder="Ej: Ana Gómez"
              />
            </div>
            <div className="field">
              <label>Usuario (login)</label>
              <input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase().trim() }))}
                required
                placeholder="Ej: ana"
              />
            </div>
            <div className="field">
              <label>Contraseña inicial</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="field">
              <label>Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="user">Usuario</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="actions" style={{ gridColumn: "1 / -1" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

export default AdminUsers;
