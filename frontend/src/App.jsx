import { useState, useEffect } from "react"
import axios from "axios"
import { loadFonts, applyTheme, loadEquipped } from "./theme"
import Store from "./Store"
import "./theme.css"

const API = "http://127.0.0.1:8000"

const COLUMNS = [
  { type: "daily",  label: "Daily",  icon: "🌅" },
  { type: "weekly", label: "Weekly", icon: "📅" },
  { type: "date",   label: "Dates",  icon: "📆" },
]

function TaskCard({ task, onToggle, onDelete }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 8,
      opacity: task.done ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <p style={{
            margin: 0,
            fontWeight: 500,
            fontSize: 14,
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
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          <button onClick={() => onToggle(task)} style={{ fontSize: 12, padding: "2px 8px" }}>
            {task.done ? "Undo" : "Done"}
          </button>
          <button onClick={() => onDelete(task.id)} style={{ fontSize: 12, padding: "2px 8px", color: "#ef4444" }}>
            ✕
          </button>
        </div>
      </div>
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

function Column({ col, tasks, onAdd, onToggle, onDelete }) {
  return (
    <div style={{
      flex: 1,
      background: "var(--column-bg)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 14,
      minWidth: 0,
    }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
        {col.icon} {col.label}
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>
          {tasks.length}
        </span>
      </h2>
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}
      {tasks.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: "20px 0" }}>
          No tasks yet
        </p>
      )}
      <AddTaskForm columnType={col.type} onAdd={onAdd} />
    </div>
  )
}

export default function App() {
  const [tasks, setTasks]     = useState([])
  const [showStore, setStore] = useState(false)
  const [coins, setCoins]     = useState(() => parseInt(localStorage.getItem("coins") || "0"))

  useEffect(() => {
  loadFonts()
  fetchTasks()
  axios.get(`${API}/state`).then(res => {
    setCoins(res.data.coins)
    const equippedIds = res.data.equipped
    axios.get(`${API}/store/items`).then(itemsRes => {
      const equippedItems = {}
      Object.entries(equippedIds).forEach(([type, id]) => {
        const found = itemsRes.data.find(i => i.id === id)
        if (found) equippedItems[type] = found
      })
      applyTheme(equippedItems)
    })
  })
}, [])

  function addCoins(n) {
    setCoins(prev => { const next = prev + n; localStorage.setItem("coins", next); return next })
  }

  function spendCoins(n) {
    setCoins(prev => { const next = Math.max(0, prev - n); localStorage.setItem("coins", next); return next })
  }

  async function fetchTasks() {
    const res = await axios.get(`${API}/tasks`)
    setTasks(res.data)
  }

  async function addTask(data) {
    await axios.post(`${API}/tasks`, data)
    fetchTasks()
  }

  async function toggleDone(task) {
    const res = await axios.patch(`${API}/tasks/${task.id}/complete`)
    if (!task.done) addCoins(res.data.coins_earned)
    fetchTasks()
  }

  async function deleteTask(id) {
    await axios.delete(`${API}/tasks/${id}`)
    fetchTasks()
  }

  const byType = (type, shared) => tasks.filter(t => t.task_type === type && t.is_shared === shared)

  return (
  <div style={{
    minHeight: "100vh",
    backgroundColor: "var(--app-bg)",          // color only
    backgroundImage: "var(--app-bg-image)",    // image only — never conflict
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    fontFamily: "var(--app-font)",
  }}>
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: "var(--app-accent)" }}>Task Manager</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>🪙 {coins}</span>
          <button onClick={() => setStore(true)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer" }}>
            🛍️ Store
          </button>
        </div>
      </div>

      {/* My Tasks */}
      <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        My Tasks
      </h2>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 32 }}>
        {COLUMNS.map(col => (
          <Column key={col.type} col={col}
            tasks={byType(col.type, false)}
            onAdd={data => addTask({ ...data, is_shared: false })}
            onToggle={toggleDone}
            onDelete={deleteTask}
          />
        ))}
      </div>

      {/* Shared Tasks */}
      <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        🤝 Shared with Buddy
      </h2>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {COLUMNS.map(col => (
          <Column key={`shared-${col.type}`} col={col}
            tasks={byType(col.type, true)}
            onAdd={data => addTask({ ...data, is_shared: true })}
            onToggle={toggleDone}
            onDelete={deleteTask}
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