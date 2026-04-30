const BASE = "/api";

// ─── Session helpers ────────────────────────────────────────────────────────

const SESSION_KEY = "authSession";

export const saveSession = (token, user) =>
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));

export const clearSession = () => localStorage.removeItem(SESSION_KEY);

export const loadSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
};

const getToken = () => loadSession()?.token || null;

const authHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
};

// ─── Auth ───────────────────────────────────────────────────────────────────

export const apiLogin = async (username, password) => {
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res); // { token, user }
};

// ─── Gastos ─────────────────────────────────────────────────────────────────

export const apiGetGastos = async () => {
  const res = await fetch(`${BASE}/gastos`, { headers: authHeaders() });
  const data = await handleResponse(res);
  return data.gastos;
};

/**
 * Upload image file directly to Vercel Blob from the browser.
 * Returns the public URL, or null if Blob is not configured.
 */
export const apiUploadImagen = async (gastoId, dataUrl) => {
  if (!dataUrl) return null;
  try {
    const { upload } = await import("@vercel/blob/client");
    const token = getToken();

    // Convert dataUrl to Blob file
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type === "application/pdf" ? "pdf" : "jpg";

    const result = await upload(`tickets/${gastoId}.${ext}`, blob, {
      access: "private",
      handleUploadUrl: `${BASE}/upload-token`,
      clientPayload: token,
    });
    return result.url;
  } catch (err) {
    console.warn("[apiUploadImagen] failed, proceeding without image:", err.message);
    return null;
  }
};

export const apiSaveGasto = async (gasto) => {
  const res = await fetch(`${BASE}/gastos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ gasto }),
  });
  return handleResponse(res); // { ok }
};

export const apiDeleteGasto = async (id) => {
  const res = await fetch(`${BASE}/gastos?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
};

// ─── Users (admin only) ──────────────────────────────────────────────────────

export const apiGetUsers = async () => {
  const res = await fetch(`${BASE}/users`, { headers: authHeaders() });
  const data = await handleResponse(res);
  return data.users;
};

export const apiCreateUser = async ({ username, password, nombre, role }) => {
  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username, password, nombre, role }),
  });
  return handleResponse(res);
};

export const apiDeleteUser = async (id) => {
  const res = await fetch(`${BASE}/users?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
};

export const apiResetPassword = async (id, password) => {
  const res = await fetch(`${BASE}/users?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });
  return handleResponse(res);
};
