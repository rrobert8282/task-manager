const FONTS = [
  "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
  "https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap",
  "https://fonts.googleapis.com/css2?family=Space+Mono&display=swap",
  "https://fonts.googleapis.com/css2?family=Pacifico&display=swap",
]

// Base path for all sprite files in frontend/public/sprites/
export const SPRITES_BASE = "/sprites"

// Convert a stored path like "forest/card.gif" → "/sprites/forest/card.gif"
export function spriteUrl(path) {
  if (!path) return null
  return `${SPRITES_BASE}/${path}`
}

export function loadFonts() {
  FONTS.forEach(href => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = href
      document.head.appendChild(link)
    }
  })
}

export function applyTheme(equipped) {
  const root = document.documentElement

  // Color scheme — only sets color variables, never touches background image
  if (equipped.color_scheme) {
    try {
      const vars = JSON.parse(equipped.color_scheme.css_value)
      Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    } catch {}
  }

  // Font
  if (equipped.font) {
    root.style.setProperty("--app-font", equipped.font.css_value)
  }

  // App background image — completely independent from color scheme
  if (equipped.app_bg) {
    const val = equipped.app_bg.css_value
    if (val === "none") {
      root.style.setProperty("--app-bg-image", "none")
    } else if (val.startsWith("url(")) {
      root.style.setProperty("--app-bg-image", val)
    } else {
      root.style.setProperty("--app-bg-image", val)
    }
  }

  // Column background decoration
  if (equipped.column_bg) {
    root.style.setProperty("--column-bg-image", equipped.column_bg.css_value)
    root.style.setProperty("--column-bg-size", equipped.column_bg.is_animated ? "cover" : "cover")
  }

  // Task row background decoration
  if (equipped.task_bg) {
    root.style.setProperty("--task-bg-image", equipped.task_bg.css_value)
  }

// ── Sprite slots ───────────────────────────────────────────────────────────
  // Sprite values are stored as path strings (e.g. "forest/card.gif"),
  // not item IDs. Each slot gets its own CSS variable.
  const spriteSlots = {
    card_sprite:    "--card-sprite-url",
    column_sprite:  "--column-sprite-url",
    bg_overlay_sprite:     "--bg-overlay-url",
    profile_sprite: "--profile-sprite-url",
  }
  Object.entries(spriteSlots).forEach(([key, cssVar]) => {
    if (equipped[key]) {
      root.style.setProperty(cssVar, `url(${SPRITES_BASE}/${equipped[key]})`)
    } else {
      root.style.setProperty(cssVar, "none")
    }
  })

  // Sprites take visual precedence over the matching color-scheme background —
  // when a sprite is equipped in a slot, blank out its background counterpart
  // so the two don't render layered/overlapping.
  const spriteOverridesBg = {
    card_sprite:       "--task-bg-image",
    column_sprite:     "--column-bg-image",
    bg_overlay_sprite: "--app-bg-image",
  }
  Object.entries(spriteOverridesBg).forEach(([spriteKey, bgVar]) => {
    if (equipped[spriteKey]) {
      root.style.setProperty(bgVar, "none")
    }
  })
}


export function saveEquipped(equipped) {
  localStorage.setItem("equipped", JSON.stringify(equipped))
}

export function loadEquipped() {
  try { return JSON.parse(localStorage.getItem("equipped")) || {} }
  catch { return {} }
}