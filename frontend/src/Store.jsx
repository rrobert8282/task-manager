import { useState, useEffect } from "react"
import axios from "axios"
import { applyTheme, spriteUrl } from "./theme"

const API = "http://127.0.0.1:8000"

const TYPE_LABELS = {
  color_scheme: "🎨 Colors",
  font:         "🔤 Fonts",
  app_bg:       "🖼️ Backgrounds",
  column_bg:    "🗂️ Columns",
  task_bg:      "📋 Tasks",
  sprite_pack:  "✨ Sprites",
}

const SPRITE_SLOTS = [
  { key: "card",       label: "🃏 Card" },
  { key: "column",     label: "🗂️ Column" },
  { key: "bg_overlay", label: "🌄 Overlay" },
  { key: "profile",    label: "👤 Profile" },
]

export default function Store({ coins, onClose, onCoinsUpdate }) {
  const [items, setItems]         = useState([])
  const [inventory, setInventory] = useState([])
  const [equipped, setEquipped]   = useState({})
  const [tab, setTab]             = useState("color_scheme")
  const [view, setView]           = useState("store")
  const [message, setMessage]     = useState("")

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [itemsRes, invRes, stateRes] = await Promise.all([
      axios.get(`${API}/store/items`),
      axios.get(`${API}/store/inventory`),
      axios.get(`${API}/state`),
    ])
    setItems(itemsRes.data.map(parseMeta))
    setInventory(invRes.data.map(parseMeta))
    setEquipped(stateRes.data.equipped)
    onCoinsUpdate(stateRes.data.coins)
  }

  function parseMeta(item) {
    try {
      return { ...item, parsedMeta: item.meta ? JSON.parse(item.meta) : null }
    } catch {
      return { ...item, parsedMeta: null }
    }
  }

  function isOwned(item) {
    return item.cost === 0 || inventory.some(i => i.id === item.id)
  }

  // For regular items — checks equipped[item.item_type] === item.id
  function isEquipped(item) {
    return equipped[item.item_type] === item.id
  }

  // For sprite packs — checks if a specific slot is equipped from this pack
  function isSlotEquipped(item, slot) {
    const key = `${slot}_sprite`
    return (
      item.parsedMeta?.sprites?.[slot] &&
      equipped[key] === item.parsedMeta.sprites[slot]
    )
  }

  function flash(msg) {
    setMessage(msg)
    setTimeout(() => setMessage(""), 2500)
  }

  async function buy(item) {
    try {
      const res = await axios.post(`${API}/store/buy/${item.id}`)
      onCoinsUpdate(res.data.coins)
      await fetchAll()
      flash(`✅ Bought ${item.name}!`)
    } catch (e) {
      flash(e.response?.data?.detail || "Purchase failed")
    }
  }

  async function equip(item) {
    try {
      await axios.post(`${API}/store/equip/${item.id}`)
      const stateRes = await axios.get(`${API}/state`)
      setEquipped(stateRes.data.equipped)
      const allItems = await axios.get(`${API}/store/items`)
      const equippedItems = {}
      Object.entries(stateRes.data.equipped).forEach(([type, id]) => {
        const found = allItems.data.find(i => i.id === id)
        if (found) equippedItems[type] = found
      })
      applyTheme(equippedItems)
      flash(`🎨 Equipped ${item.name}!`)
    } catch (e) {
      flash(e.response?.data?.detail || "Equip failed")
    }
  }

  async function equipSprite(item, slot) {
    try {
      const res = await axios.post(`${API}/store/equip-sprite`, {
        pack_id: item.id,
        slot,
      })
      setEquipped(prev => ({ ...prev, ...res.data.equipped }))
      flash(`✨ Equipped ${item.name} → ${slot}!`)
    } catch (e) {
      flash(e.response?.data?.detail || "Equip failed")
    }
  }

  const displayed = view === "store"
    ? items.filter(i => i.item_type === tab)
    : inventory.filter(i => i.item_type === tab)

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "var(--column-bg)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        width: 620,
        maxHeight: "82vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        color: "var(--text-primary)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setView("store")}
              style={{
                fontSize: 14, padding: "5px 14px", borderRadius: 8,
                border: "1px solid var(--border)",
                background: view === "store" ? "var(--app-accent)" : "var(--surface)",
                color: view === "store" ? "white" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              🛍️ Store
            </button>
            <button
              onClick={() => setView("inventory")}
              style={{
                fontSize: 14, padding: "5px 14px", borderRadius: 8,
                border: "1px solid var(--border)",
                background: view === "inventory" ? "var(--app-accent)" : "var(--surface)",
                color: view === "inventory" ? "white" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              🎒 Inventory
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>🪙 {coins}</span>
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: 20,
              cursor: "pointer", color: "var(--text-secondary)",
            }}>✕</button>
          </div>
        </div>

        {/* Flash message */}
        {message && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 12,
            background: "var(--form-bg)", border: "1px solid var(--border)",
            fontSize: 13, color: "var(--text-primary)",
          }}>
            {message}
          </div>
        )}

        {/* Type tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setTab(type)}
              style={{
                padding: "5px 12px", fontSize: 13, borderRadius: 6,
                border: "1px solid var(--border)",
                background: tab === type ? "var(--app-accent)" : "var(--surface)",
                color: tab === type ? "white" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {displayed.length === 0 && (
            <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 40, fontSize: 14 }}>
              {view === "inventory" ? "Nothing owned in this category yet." : "No items here."}
            </p>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: tab === "sprite_pack" ? "1fr" : "1fr 1fr",
            gap: 10,
          }}>
            {displayed.map(item => {
              const owned      = isOwned(item)
              const free       = item.cost === 0
              const affordable = coins >= item.cost

              // ── Sprite pack card ─────────────────────────────────────────
              if (item.item_type === "sprite_pack") {
                return (
                  <div key={item.id} style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8, padding: 14,
                    background: "var(--surface)",
                  }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

                      {/* Preview image */}
                      <div style={{
                        width: 72, height: 72, flexShrink: 0,
                        borderRadius: 8, overflow: "hidden",
                        background: "var(--form-bg)",
                        border: "1px solid var(--border)",
                      }}>
                        {item.parsedMeta?.preview
                          ? <img
                              src={spriteUrl(item.parsedMeta.preview)}
                              alt={item.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✨</div>
                        }
                      </div>

                      {/* Info + actions */}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.name}
                        </p>
                        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)" }}>
                          {item.description}
                        </p>

                        {owned || free ? (
                          // Slot equip buttons
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {SPRITE_SLOTS.map(({ key, label }) => {
                              const active = isSlotEquipped(item, key)
                              return (
                                <button
                                  key={key}
                                  onClick={() => equipSprite(item, key)}
                                  disabled={active}
                                  style={{
                                    fontSize: 11, padding: "3px 10px", borderRadius: 6,
                                    border: "1px solid var(--border)",
                                    background: active ? "var(--app-accent)" : "var(--surface)",
                                    color: active ? "white" : "var(--text-primary)",
                                    cursor: active ? "default" : "pointer",
                                  }}
                                >
                                  {label}{active ? " ●" : ""}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          // Buy button
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                              🪙 {item.cost}
                            </span>
                            <button
                              onClick={() => buy(item)}
                              disabled={!affordable}
                              style={{
                                fontSize: 12, padding: "4px 14px", borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: affordable ? "var(--surface)" : "var(--form-bg)",
                                color: affordable ? "var(--text-primary)" : "var(--text-muted)",
                                cursor: affordable ? "pointer" : "not-allowed",
                              }}
                            >
                              {affordable ? "Buy" : "Not enough coins"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              // ── Regular item card ────────────────────────────────────────
              const equipped_item = isEquipped(item)
              return (
                <div key={item.id} style={{
                  border: equipped_item
                    ? "2px solid var(--app-accent)"
                    : "1px solid var(--border)",
                  borderRadius: 8, padding: 12,
                  background: equipped_item ? "var(--form-bg)" : "var(--surface)",
                }}>
                  <div style={{
                    height: 40, borderRadius: 6, marginBottom: 8,
                    background: item.preview?.startsWith("linear") ? item.preview : item.preview?.startsWith("#") ? item.preview : "var(--form-bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: item.item_type === "font" ? 18 : 13,
                    fontFamily: item.item_type === "font" ? item.css_value : "inherit",
                    color: item.item_type === "font" ? "var(--text-primary)" : "transparent",
                  }}>
                    {item.item_type === "font" ? item.preview : ""}
                  </div>

                  <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {item.name}
                    {equipped_item && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--app-accent)" }}>● active</span>}
                  </p>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-secondary)" }}>{item.description}</p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: free ? "#16a34a" : "var(--text-secondary)" }}>
                      {free ? "Free" : owned ? "Owned" : `🪙 ${item.cost}`}
                    </span>
                    {owned || free ? (
                      <button
                        onClick={() => equip(item)}
                        disabled={equipped_item}
                        style={{
                          fontSize: 12, padding: "3px 10px", borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: equipped_item ? "var(--app-accent)" : "var(--surface)",
                          color: equipped_item ? "white" : "var(--text-primary)",
                          cursor: equipped_item ? "default" : "pointer",
                        }}
                      >
                        {equipped_item ? "Equipped" : "Equip"}
                      </button>
                    ) : (
                      <button
                        onClick={() => buy(item)}
                        disabled={!affordable}
                        style={{
                          fontSize: 12, padding: "3px 10px", borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: affordable ? "var(--surface)" : "var(--form-bg)",
                          color: affordable ? "var(--text-primary)" : "var(--text-muted)",
                          cursor: affordable ? "pointer" : "not-allowed",
                        }}
                      >
                        {affordable ? "Buy" : "Not enough coins"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}