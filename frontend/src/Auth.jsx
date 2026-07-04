import { useState } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function Auth({ onLogin }) {
  const [mode, setMode]         = useState("login")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function submit() {
    setError("")
    setLoading(true)
    try {
      if (mode === "register") {
        const res = await axios.post(`${API}/auth/register`, { email, password, username })
        onLogin(res.data)
      } else {
        const form = new URLSearchParams()
        form.append("username", email)
        form.append("password", password)
        const res = await axios.post(`${API}/auth/login`, form)
        onLogin(res.data)
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong")
    }
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === "Enter") submit()
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--app-bg, #f3f4f6)",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "var(--surface, white)",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 12,
        padding: 32,
        width: 360,
      }}>
        {/* Header */}
        <h1 style={{ margin: "0 0 4px", fontSize: 22, color: "var(--text-primary, #111)" }}>
          Task Manager
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--text-muted, #9ca3af)" }}>
          {mode === "login" ? "Sign in to your account" : "Create a new account"}
        </p>

        {/* Toggle */}
        <div style={{ display: "flex", marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border, #e5e7eb)" }}>
          {["login", "register"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError("") }}
              style={{
                flex: 1, padding: "8px 0", fontSize: 13, border: "none",
                background: mode === m ? "var(--app-accent, #3b82f6)" : "var(--surface, white)",
                color: mode === m ? "white" : "var(--text-secondary, #6b7280)",
                cursor: "pointer", fontWeight: mode === m ? 500 : 400,
              }}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Fields */}
        {mode === "register" && (
          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={handleKey}
            style={{ display: "block", width: "100%", marginBottom: 10, padding: "9px 12px", fontSize: 14, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", boxSizing: "border-box" }}
          />
        )}
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={handleKey}
          style={{ display: "block", width: "100%", marginBottom: 10, padding: "9px 12px", fontSize: 14, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", boxSizing: "border-box" }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKey}
          style={{ display: "block", width: "100%", marginBottom: 16, padding: "9px 12px", fontSize: 14, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", boxSizing: "border-box" }}
        />

        {/* Error */}
        {error && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#ef4444" }}>{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: "100%", padding: "10px 0", fontSize: 14, fontWeight: 500,
            borderRadius: 8, border: "none",
            background: "var(--app-accent, #3b82f6)",
            color: "white", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </div>
  )
}