import { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const ok = await onLogin(username.trim(), password);
    setLoading(false);
    if (!ok) {
      setError("Credenciales invalidas. Proba nuevamente.");
    }
  };

  return (
    <main className="layout">
      <section className="panel login-card slide-in">
        <h1>FacturaAPP</h1>
        <p className="hint">Inicia sesion para continuar</p>

        <form className="login-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin o usuario"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="status status-error">{error}</div> : null}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="hint">
          Demo admin: admin / admin123 · Demo usuario: usuario / usuario123
        </div>
      </section>
    </main>
  );
}

export default Login;
