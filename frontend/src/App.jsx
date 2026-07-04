import { useState, useEffect } from "react"
import axios from "axios"
import { loadFonts, applyTheme, spriteUrl } from "./theme"
import Store from "./Store"
import "./theme.css"
import Buddy from "./Buddy"
import TaskComments from "./TaskComments"
import Auth from "./Auth"
import Profile from "./Profile"

const API = "http://127.0.0.1:8000"

const SPRITE_KEYS = new Set(["card_sprite", "column_sprite", "bg_overlay_sprite", "profile_sprite"])

axios.interceptors.request.use(config => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const COLUMNS = [
  { type: "daily",  label: "Daily",  icon: "🌅" },
  { type: "weekly", label: "Weekly", icon: "📅" },
  { type: "date",   label: "Dates",  icon: "📆" },
]

function SectionLabel({ icon, label, sublabel }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
      <h2 style={{
        margin: 0, fontSize: 14, fontWeight: 600,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>
        {icon} {label}
      </h2>
      {sublabel && (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— {sublabel}</span>
      )}
    </div>
  )
}

function TaskCard({ task, onToggle, onDelete, readOnly = false, cardSprite = null }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 8,
      opacity: task.done ? 0.5 : 1,
      position: "relative",
    }}>
      {/* Card sprite badge — bottom right corner */}
      {cardSprite && (
        <img
          src={cardSprite}
          alt=""
          style={{
            position: "absolute",
            bottom: 8, right: 8,
            width: 28, height: 28,
            objectFit: "contain",
            pointerEvents: "none",
            opacity: 0.85,
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <p style={{
            margin: 0, fontWeight: 500, fontSize: 14,
            color: "var(--text-primary)",
            textDecoration: task.done ? "line-through" : "none",
          }}>
            {task.is_private ? "🔒 " : ""}{task.title}
          </p>
          {task.description && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              {task.description}
            </p>
          )}
          {task.due_date && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              📅 {task.due_date}
            </p>
          )}
          {task.task_type === "daily" && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              {task.repeats ? "🔁 repeats daily" : "one-time"}
            </p>
          )}
        </div>
        {!readOnly && (
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {!task.done && (
            <button onClick={() => onToggle(task)} style={{ fontSize: 12, padding: "2px 8px" }}>
              Done
            </button>
          )}
            <button onClick={() => onDelete(task.id)} style={{ fontSize: 12, padding: "2px 8px", color: "#ef4444" }}>
              ✕
            </button>
          </div>
        )}
      </div>
      <TaskComments taskId={task.id} canComment={readOnly} />
    </div>
  )
}

function AddTaskForm({ columnType, onAdd }) {
  const [open, setOpen]         = useState(false)
  const [title, setTitle]       = useState("")
  const [desc, setDesc]         = useState("")
  const [repeats, setRepeats]   = useState(false)
  const [dueDate, setDueDate]   = useState("")
  const [isPrivate, setPrivate] = useState(false)

  async function submit() {
    if (!title.trim()) return
    await onAdd({ title, description: desc, task_type: columnType, repeats, due_date: dueDate || null, is_private: isPrivate })
    setTitle(""); setDesc(""); setRepeats(false); setDueDate(""); setPrivate(false); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ width: "100%", marginTop: 8, padding: "6px 0", fontSize: 13 }}>
      + Add task
    </button>
  )

  return (
    <div style={{ background: "var(--form-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 8 }}>
      <input placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 6, padding: "5px 8px", fontSize: 13 }} />
      <input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 6, padding: "5px 8px", fontSize: 13 }} />
      {columnType === "date" && (
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 6, padding: "5px 8px", fontSize: 13 }} />
      )}
      {columnType === "daily" && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 6, color: "var(--text-primary)" }}>
          <input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} />
          Repeats daily
        </label>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 8, color: "var(--text-primary)" }}>
        <input type="checkbox" checked={isPrivate} onChange={e => setPrivate(e.target.checked)} />
        Private 🔒
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={submit} style={{ fontSize: 13, padding: "4px 12px" }}>Add</button>
        <button onClick={() => setOpen(false)} style={{ fontSize: 13, padding: "4px 12px" }}>Cancel</button>
      </div>
    </div>
  )
}

function Column({ col, tasks, onAdd, onToggle, onDelete, readOnly = false, columnSprite = null, cardSprite = null }) {
  return (
    <div style={{
      flex: 1,
      background: "var(--column-bg)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 14,
      minWidth: 0,
    }}>
      {/* Column sprite banner */}
      {columnSprite && (
        <div style={{
          width: "100%", height: 56,
          marginBottom: 10,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}>
          <img
            src={columnSprite}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
        {col.icon} {col.label}
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>
          {tasks.length}
        </span>
      </h2>
      {tasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          readOnly={readOnly}
          cardSprite={cardSprite}
        />
      ))}
      {tasks.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: "20px 0" }}>
          {readOnly ? "Nothing here yet" : "No tasks yet"}
        </p>
      )}
      {!readOnly && <AddTaskForm columnType={col.type} onAdd={onAdd} />}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user")
    return u ? JSON.parse(u) : null
  })
  const [tasks, setTasks]                       = useState([])
  const [showStore, setStore]                   = useState(false)
  const [coins, setCoins]                       = useState(0)
  const [buddyTasks, setBuddyTasks]             = useState([])
  const [buddySharedTasks, setBuddySharedTasks] = useState([])
  const [equippedSprites, setEquippedSprites]   = useState({})

  function handleLogin(data) {
    localStorage.setItem("token", data.access_token)
    localStorage.setItem("user", JSON.stringify({ username: data.username, email: data.email }))
    setUser({ username: data.username, email: data.email })
  }

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
    setTasks([])
    setCoins(0)
    setEquippedSprites({})
  }

  useEffect(() => {
    if (!user) return
    loadFonts()
    fetchTasks()
    fetchBuddyTasks()
    fetchBuddySharedTasks()
    axios.get(`${API}/state`).then(res => {
      setCoins(res.data.coins)
      const eq = res.data.equipped

      // Extract sprite paths into component state
      const sprites = {}
      SPRITE_KEYS.forEach(key => { if (eq[key]) sprites[key] = eq[key] })
      setEquippedSprites(sprites)

      // Build equippedItems for applyTheme
      // Sprite slots are path strings — pass through directly
      // Regular slots are item IDs — look up the full item object
      axios.get(`${API}/store/items`).then(itemsRes => {
        const equippedItems = {}
        Object.entries(eq).forEach(([type, val]) => {
          if (SPRITE_KEYS.has(type)) {
            equippedItems[type] = val
          } else {
            const found = itemsRes.data.find(i => i.id === val)
            if (found) equippedItems[type] = found
          }
        })
        applyTheme(equippedItems)
      })
    })

    const token = localStorage.getItem("token")
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws?token=${token}`)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "tasks_changed") {
          fetchTasks()
          fetchBuddyTasks()
          fetchBuddySharedTasks()
        }
      } catch (e) {
        // ignore malformed messages
      }
    }
    ws.onerror = (e) => {
      console.error("WebSocket error", e)
    }

    return () => {
      ws.close()
    }
  }, [user])

  async function fetchTasks() {
    const res = await axios.get(`${API}/tasks`)
    setTasks(res.data)
  }

  async function fetchBuddyTasks() {
    try {
      const res = await axios.get(`${API}/buddy/tasks`)
      setBuddyTasks(res.data)
    } catch (e) {
      setBuddyTasks([])
    }
  }

  async function fetchBuddySharedTasks() {
    try {
      const res = await axios.get(`${API}/buddy/shared`)
      setBuddySharedTasks(res.data)
    } catch (e) {
      setBuddySharedTasks([])
    }
  }

  async function addTask(data) {
    await axios.post(`${API}/tasks`, data)
    fetchTasks()
    fetchBuddyTasks()
    fetchBuddySharedTasks()
  }
  async function toggleDone(task) {
    const res = await axios.patch(`${API}/tasks/${task.id}/complete`)
    if (!task.done) setCoins(res.data.total_coins)
    fetchTasks()
    fetchBuddyTasks()
    fetchBuddySharedTasks()
  }
  async function deleteTask(id) {
    await axios.delete(`${API}/tasks/${id}`)
    fetchTasks()
    fetchBuddyTasks()
    fetchBuddySharedTasks()
  }
  const byType       = (type, shared) => tasks.filter(t => t.task_type === type && t.is_shared === shared)
  const cardSprite   = equippedSprites.card_sprite        ? spriteUrl(equippedSprites.card_sprite)        : null
  const columnSprite = equippedSprites.column_sprite      ? spriteUrl(equippedSprites.column_sprite)      : null
  const bgOverlay    = equippedSprites.bg_overlay_sprite  ? spriteUrl(equippedSprites.bg_overlay_sprite)  : null

  if (!user) return <Auth onLogin={handleLogin} />

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "var(--app-bg)",
      backgroundImage: "var(--app-bg-image)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      fontFamily: "var(--app-font)",
      position: "relative",
    }}>

      {/* Background overlay sprite — fixed, behind all content */}
      {bgOverlay && (
        <div style={{
          position: "fixed", inset: 0,
          backgroundImage: `url(${bgOverlay})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.2,
          pointerEvents: "none",
          zIndex: 0,
        }} />
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "var(--app-accent)" }}>Task Manager</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>👤 {user.username}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>🪙 {coins}</span>
            <button onClick={() => setStore(true)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer" }}>
              🛍️ Store
            </button>
            <button onClick={handleLogout} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", color: "#ef4444" }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Profile */}
        <Profile user={user} coins={coins} onCoinsUpdate={setCoins} />

        {/* My Tasks */}
        <SectionLabel icon="👤" label="My Tasks" />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 40 }}>
          {COLUMNS.map(col => (
            <Column key={col.type} col={col}
              tasks={byType(col.type, false)}
              onAdd={data => addTask({ ...data, is_shared: false })}
              onToggle={toggleDone}
              onDelete={deleteTask}
              columnSprite={columnSprite}
              cardSprite={cardSprite}
            />
          ))}
        </div>

        {/* Buddy Tasks */}
        <SectionLabel icon="👥" label="Buddy's Tasks" sublabel="read only" />
        <Buddy />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 40 }}>
          {COLUMNS.map(col => (
            <Column
              key={`buddy-${col.type}`}
              col={col}
              tasks={buddyTasks.filter(t => t.task_type === col.type)}
              onToggle={() => {}}
              onDelete={() => {}}
              readOnly
              columnSprite={columnSprite}
              cardSprite={cardSprite}
            />
          ))}
        </div>

        {/* Shared Tasks */}
        <SectionLabel icon="🤝" label="Shared Tasks" sublabel="visible to both you and your buddy" />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {COLUMNS.map(col => (
            <Column
              key={`shared-${col.type}`}
              col={col}
              tasks={[
                ...byType(col.type, true),
                ...buddySharedTasks.filter(t => t.task_type === col.type)
              ]}
              onAdd={data => addTask({ ...data, is_shared: true })}
              onToggle={toggleDone}
              onDelete={deleteTask}
              columnSprite={columnSprite}
              cardSprite={cardSprite}
            />
          ))}
        </div>

      </div>

      {showStore && (
        <Store coins={coins} onClose={() => setStore(false)} onCoinsUpdate={setCoins} />
      )}
    </div>
  )
}