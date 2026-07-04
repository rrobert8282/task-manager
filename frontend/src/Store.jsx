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

const PACK_DISCOUNT = 0.8 // 20% off — mirrors backend SPRITE_PACK_DISCOUNT

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

  // For a sprite piece — checks if its slot currently points at this piece's path
  function isPieceEquipped(piece) {
    const key = `${piece.parsedMeta?.slot}_sprite`
    return piece.parsedMeta?.path && equipped[key] === piece.parsedMeta.path
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

  async function equipSprite(piece) {
    try {
      const res = await axios.post(`${API}/store/equip-sprite`, {
        item_id: piece.id,
      })
      setEquipped(prev => ({ ...prev, ...res.data.equipped }))
      flash(`✨ Equipped ${piece.name}!`)
    } catch (e) {
      flash(e.response?.data?.detail || "Equip failed")
    }
  }

  // Build { packKey: { pack: StoreItem, pieces: [StoreItem, ...] } } from
  // whichever list (store items or inventory) is currently displayed.
  function buildPackGroups(list) {
    const groups = {}
    list.forEach(item => {
      const packKey = item.parsedMeta?.pack
      if (!packKey) return
      if (!groups[packKey]) groups[packKey] = { pack: null, pieces: [] }
      if (item.item_type === "sprite_pack") groups[packKey].pack = item
      else if (item.item_type === "sprite_piece") groups[packKey].pieces.push(item)
    })
    return groups
  }

  const sourceList = view === "store" ? items : inventory

  const displayed = tab === "sprite_pack"
    ? [] // handled separately below via packGroups
    : sourceList.filter(i => i.item_type === tab)

  // Always compute pack groups from the FULL items list (not just inventory)
  // so we can show pieces the user doesn't own yet alongside owned ones.
  const packGroups = tab === "sprite_pack" ? buildPackGroups(items) : {}

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

          {/* ── Sprites tab: grouped by pack, mix-and-match pieces ────────── */}
          {tab === "sprite_pack" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Object.entries(packGroups).map(([packKey, group]) => {
                const { pack, pieces } = group
                if (!pack) return null

                // In inventory view, only show packs where the user owns
                // at least one piece or the pack itself.
                const ownsAnyPiece = pieces.some(p => inventory.some(i => i.id === p.id))
                const packOwned = inventory.some(i => i.id === pack.id)
                if (view === "inventory" && !ownsAnyPiece && !packOwned) return null

                const missingPieces = pieces.filter(p => !isOwned(p))
                const livePackPrice = Math.round(
                  missingPieces.reduce((sum, p) => sum + p.cost, 0) * PACK_DISCOUNT
                )
                const affordablePack = coins >= livePackPrice

                return (
                  <div key={packKey} style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8, padding: 14,
                    background: "var(--surface)",
                  }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

                      {/* Preview image */}
                      <div style={{
                        width: 64, height: 64, flexShrink: 0,
                        borderRadius: 8, overflow: "hidden",
                        background: "var(--form-bg)",
                        border: "1px solid var(--border)",
                      }}>
                        {pack.parsedMeta?.preview
                          ? <img
                              src={spriteUrl(pack.parsedMeta.preview)}
                              alt={pack.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✨</div>
                        }
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {pack.name}
                          {packOwned && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: "#16a34a" }}>✓ Complete</span>
                          )}
                        </p>
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-secondary)" }}>
                          {pack.description}
                        </p>

                        {!packOwned && missingPieces.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              Buy remaining {missingPieces.length} piece{missingPieces.length > 1 ? "s" : ""}:
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                              🪙 {livePackPrice}
                            </span>
                            <button
                              onClick={() => buy(pack)}
                              disabled={!affordablePack}
                              style={{
                                fontSize: 12, padding: "3px 12px", borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: affordablePack ? "var(--app-accent)" : "var(--form-bg)",
                                color: affordablePack ? "white" : "var(--text-muted)",
                                cursor: affordablePack ? "pointer" : "not-allowed",
                              }}
                            >
                              Buy Pack (20% off)
                            </button>
                          </div>
                        )}

                        {/* Individual piece slots */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {SPRITE_SLOTS.map(({ key, label }) => {
                            const piece = pieces.find(p => p.parsedMeta?.slot === key)
                            if (!piece) return null
                            const owned = isOwned(piece)
                            const active = isPieceEquipped(piece)
                            const affordablePiece = coins >= piece.cost

                            return (
                              <div key={key} style={{
                                display: "flex", flexDirection: "column", alignItems: "center",
                                gap: 4, minWidth: 64,
                              }}>
                                <div style={{
                                  width: 40, height: 40, borderRadius: 6,
                                  overflow: "hidden",
                                  border: active ? "2px solid var(--app-accent)" : "1px solid var(--border)",
                                  background: "var(--form-bg)",
                                }}>
                                  <img
                                    src={spriteUrl(piece.parsedMeta.path)}
                                    alt={label}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                                {owned ? (
                                  <button
                                    onClick={() => equipSprite(piece)}
                                    disabled={active}
                                    style={{
                                      fontSize: 10, padding: "2px 8px", borderRadius: 5,
                                      border: "1px solid var(--border)",
                                      background: active ? "var(--app-accent)" : "var(--surface)",
                                      color: active ? "white" : "var(--text-primary)",
                                      cursor: active ? "default" : "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {active ? "Equipped" : label}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => buy(piece)}
                                    disabled={!affordablePiece}
                                    style={{
                                      fontSize: 10, padding: "2px 8px", borderRadius: 5,
                                      border: "1px solid var(--border)",
                                      background: affordablePiece ? "var(--form-bg)" : "var(--column-bg)",
                                      color: affordablePiece ? "var(--text-secondary)" : "var(--text-muted)",
                                      cursor: affordablePiece ? "pointer" : "not-allowed",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    🪙{piece.cost}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Regular item tabs (unchanged) ─────────────────────────────── */}
          {tab !== "sprite_pack" && (
            <>
              {displayed.length === 0 && (
                <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 40, fontSize: 14 }}>
                  {view === "inventory" ? "Nothing owned in this category yet." : "No items here."}
                </p>
              )}

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}>
                {displayed.map(item => {
                  const owned      = isOwned(item)
                  const free       = item.cost === 0
                  const affordable = coins >= item.cost
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
                        color: item.item_type === "font" ? "var(--text-primary)" :"transparent",
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
