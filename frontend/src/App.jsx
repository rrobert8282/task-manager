import { useState, useEffect } from "react"
import axios from "axios"
import { loadFonts, applyTheme, spriteUrl } from "./theme"
import Store from "./Store"
import "./theme.css"
import Buddy from "./Buddy"
import TaskComments from "./TaskComments"
import Auth from "./Auth"
import Profile from "./Profile"

import { API, warmBackend } from "./network"
import {
  loadCachedState,
  saveCachedSection,
  clearCachedState,
} from "./offline/cache"

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

const MOBILE_BREAKPOINT = 640

function ColumnTabs({ activeColumnType, setActiveColumnType }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {COLUMNS.map(col => (
        <button
          key={col.type}
          onClick={() => setActiveColumnType(col.type)}
          style={{
            flex: 1, padding: "8px 4px", fontSize: 13, borderRadius: 8,
            border: "1px solid var(--border)",
            background: activeColumnType === col.type ? "var(--app-accent)" : "var(--surface)",
            color: activeColumnType === col.type ? "white" : "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {col.icon} {col.label}
        </button>
      ))}
    </div>
  )
}

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
          {(task.task_type === "daily" || task.task_type === "weekly") && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              {task.repeats ? `🔁 repeats ${task.task_type}` : "one-time"}
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
      {(columnType === "daily" || columnType === "weekly") && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 6, color: "var(--text-primary)" }}>
          <input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} />
          {columnType === "daily" ? "Repeats daily" : "Repeats weekly"}
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
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )
  const [activeColumnType, setActiveColumnType] = useState("daily")

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])
  const [equippedSprites, setEquippedSprites]   = useState({})
  const [syncStatus, setSyncStatus] = useState("idle")
  const userKey = user?.email || user?.username || null

  function handleLogin(data) {
    localStorage.setItem("token", data.access_token)
    localStorage.setItem("user", JSON.stringify({ username: data.username, email: data.email }))
    setUser({ username: data.username, email: data.email })
  }

  function handleLogout() {
  if (userKey) {
    clearCachedState(userKey).catch(console.error)
  }

  localStorage.removeItem("token")
  localStorage.removeItem("user")

  setUser(null)
  setTasks([])
  setBuddyTasks([])
  setBuddySharedTasks([])
  setCoins(0)
  setEquippedSprites({})
  setSyncStatus("idle")
}

function applyAppState(appState) {
  if (!appState) return

  const {
    coins: cachedCoins,
    equipped,
    storeItems,
  } = appState

  setCoins(cachedCoins ?? 0)

  const sprites = {}

  SPRITE_KEYS.forEach(key => {
    if (equipped?.[key]) {
      sprites[key] = equipped[key]
    }
  })

  setEquippedSprites(sprites)

  const equippedItems = {}

  Object.entries(equipped || {}).forEach(([type, value]) => {
    if (SPRITE_KEYS.has(type)) {
      equippedItems[type] = value
    } else {
      const found = (storeItems || []).find(
        item => item.id === value
      )

      if (found) {
        equippedItems[type] = found
      }
    }
  })

  applyTheme(equippedItems)
}

async function hydrateFromCache() {
  if (!userKey) return false

  try {
    const cached = await loadCachedState(userKey)

    if (!cached) {
      return false
    }

    if (cached.tasks) {
      setTasks(cached.tasks)
    }

    if (cached.buddyTasks) {
      setBuddyTasks(cached.buddyTasks)
    }

    if (cached.buddySharedTasks) {
      setBuddySharedTasks(cached.buddySharedTasks)
    }

    if (cached.appState) {
      applyAppState(cached.appState)
    }

    setSyncStatus("cached")

    return true
  } catch (error) {
    console.error("Could not load offline cache", error)
    return false
  }
}


async function fetchAppState() {
  try {
    const [stateRes, itemsRes] = await Promise.all([
      axios.get(`${API}/state`),
      axios.get(`${API}/store/items`),
    ])

    const appState = {
      coins: stateRes.data.coins,
      equipped: stateRes.data.equipped || {},
      storeItems: itemsRes.data,
    }

    applyAppState(appState)

    await saveCachedSection(
      userKey,
      "appState",
      appState
    )

    return true
  } catch (error) {
    console.error("Could not refresh app state", error)
    return false
  }
}

async function refreshFromServer() {
  if (!userKey) return false

  setSyncStatus("syncing")

  // Best-effort wake-up.
  // Never block normal API requests if /health fails or is blocked.
  warmBackend()

  const results = await Promise.all([
    fetchTasks(),
    fetchBuddyTasks(),
    fetchBuddySharedTasks(),
    fetchAppState(),
  ])

  if (results.every(Boolean)) {
    setSyncStatus("synced")
    return true
  }

  setSyncStatus("offline")
  return false
}


  useEffect(() => {
  if (!userKey) return

  loadFonts()

  // Load the previous local state immediately.
  hydrateFromCache()

  // At the same time, try to obtain fresh server state.
  refreshFromServer()

  function handleOnline() {
    refreshFromServer()
  }

  function handleVisibility() {
    if (document.visibilityState === "visible") {
      refreshFromServer()
    }
  }

  window.addEventListener("online", handleOnline)
  document.addEventListener(
    "visibilitychange",
    handleVisibility
  )

  return () => {
    window.removeEventListener("online", handleOnline)
    document.removeEventListener(
      "visibilitychange",
      handleVisibility
    )
  }
}, [userKey])

  useEffect(() => {
  if (!userKey) return

  let ws = null
  let retryTimer = null
  let stopped = false

  async function connect() {
    if (stopped || !navigator.onLine) {
      return
    }

// Best-effort wake-up only.
  warmBackend()

  if (stopped) {
    return
  }

    const token = localStorage.getItem("token")
    const wsBase = API.replace(/^http/, "ws")

    ws = new WebSocket(
      `${wsBase}/ws?token=${token}`
    )

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === "tasks_changed") {
          refreshFromServer()
        }
      } catch {
        // Ignore malformed messages.
      }
    }

    ws.onerror = error => {
      console.error("WebSocket error", error)
    }

    ws.onclose = () => {
      if (!stopped) {
        retryTimer = setTimeout(connect, 5000)
      }
    }
  }

  function handleOnline() {
    if (
      !ws ||
      ws.readyState === WebSocket.CLOSED
    ) {
      connect()
    }
  }

  connect()

  window.addEventListener("online", handleOnline)

  return () => {
    stopped = true
    clearTimeout(retryTimer)

    window.removeEventListener(
      "online",
      handleOnline
    )

    if (ws) {
      ws.close()
    }
  }
}, [userKey])

  async function fetchTasks() {
  try {
    const res = await axios.get(`${API}/tasks`)

    setTasks(res.data)

    await saveCachedSection(
      userKey,
      "tasks",
      res.data
    )

    return true
  } catch (error) {
    console.error("Could not refresh tasks", error)
    return false
  }
}

async function fetchBuddyTasks() {
  try {
    const res = await axios.get(`${API}/buddy/tasks`)

    setBuddyTasks(res.data)

    await saveCachedSection(
      userKey,
      "buddyTasks",
      res.data
    )

    return true
  } catch (error) {
    if (error.response) {
      setBuddyTasks([])

      await saveCachedSection(
        userKey,
        "buddyTasks",
        []
      )

      return true
    }

    // No response means network/backend unavailable.
    // Preserve the cached buddy tasks.
    return false
  }
}

  async function fetchBuddySharedTasks() {
  try {
    const res = await axios.get(`${API}/buddy/shared`)

    setBuddySharedTasks(res.data)

    await saveCachedSection(
      userKey,
      "buddySharedTasks",
      res.data
    )

    return true
  } catch (error) {
    if (error.response) {
      setBuddySharedTasks([])

      await saveCachedSection(
        userKey,
        "buddySharedTasks",
        []
      )

      return true
    }

    return false
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
        {isMobile && <ColumnTabs activeColumnType={activeColumnType} setActiveColumnType={setActiveColumnType} />}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 40 }}>
          {(isMobile ? COLUMNS.filter(c => c.type === activeColumnType) : COLUMNS).map(col => (
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
          {(isMobile ? COLUMNS.filter(c => c.type === activeColumnType) : COLUMNS).map(col => (
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
          {(isMobile ? COLUMNS.filter(c => c.type === activeColumnType) : COLUMNS).map(col => (
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