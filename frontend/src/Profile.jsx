import { useState, useEffect } from "react"
import axios from "axios"
import { spriteUrl } from "./theme"

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function Profile({ user, coins }) {
  const [profileSprite, setProfileSprite]     = useState(null)
  const [ownedProfilePieces, setOwnedPieces]  = useState([])
  const [buddy, setBuddy]                     = useState(null)
  const [picking, setPicking]                 = useState(false)
  const [stats, setStats]                     = useState({ total: 0, completed: 0 })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const [stateRes, invRes, tasksRes, buddyRes] = await Promise.all([
        axios.get(`${API}/state`),
        axios.get(`${API}/store/inventory`),
        axios.get(`${API}/tasks`),
        axios.get(`${API}/buddy`),
      ])

      const eq = stateRes.data.equipped
      if (eq.profile_sprite) setProfileSprite(spriteUrl(eq.profile_sprite))

      const pieces = invRes.data
        .filter(i => i.item_type === "sprite_piece")
        .map(i => {
          try { return { ...i, parsedMeta: JSON.parse(i.meta) } }
          catch { return { ...i, parsedMeta: null } }
        })
        .filter(i => i.parsedMeta?.slot === "profile")
      setOwnedPieces(pieces)

      const tasks = tasksRes.data
      setStats({ total: tasks.length, completed: tasks.filter(t => t.done).length })

      setBuddy(buddyRes.data.buddy)
    } catch (e) {
      console.error(e)
    }
  }

  async function equipProfileSprite(pieceId) {
    try {
      const res = await axios.post(`${API}/store/equip-sprite`, {
        item_id: pieceId,
      })
      setProfileSprite(spriteUrl(res.data.equipped.profile_sprite))
      setPicking(false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{
      background: "var(--column-bg)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 20,
      marginBottom: 40,
      display: "flex",
      alignItems: "center",
      gap: 20,
      position: "relative",
    }}>

      {/* Avatar — click to open sprite picker */}
      <div
        onClick={() => setPicking(!picking)}
        title="Click to change profile sprite"
        style={{
          width: 80, height: 80,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          overflow: "hidden",
          background: "var(--surface)",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, cursor: "pointer",
        }}
      >
        {profileSprite
          ? <img
              src={profileSprite}
              alt="profile"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          : "👤"
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>
          {user.username}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
          {user.email}
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap"}}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🪙 {coins}coins</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ✅ {stats.completed} / {stats.total} tasks done
          </span>
          {buddy && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              👥 Buddy: <strong>{buddy.username}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Sprite picker dropdown */}
      {picking && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)", left: 0,
          zIndex: 200,
          background: "var(--column-bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 12,
          display: "flex",
          gap: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}>
          {ownedProfilePieces.length === 0
            ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)",whiteSpace: "nowrap" }}>
                No profile sprites owned yet — buy one in the Store!
              </p>
            )
            : ownedProfilePieces.map(piece => (
              <div
                key={piece.id}
                onClick={() => equipProfileSprite(piece.id)}
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  minWidth: 72,
                }}
              >
                {piece.parsedMeta?.path
                  ? <img
                      src={spriteUrl(piece.parsedMeta.path)}
                      alt={piece.name}
                      style={{
                        width: 48, height: 48,
                        objectFit: "cover",
                        borderRadius: 6,
                        display: "block",
                        margin: "0 auto",
                      }}
                    />
                  : <div style={{
                      width: 48, height: 48,
                      background: "var(--form-bg)",
                      borderRadius: 6,
                      margin: "0 auto",
                    }} />
                }
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
                  {piece.name}
                </p>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}