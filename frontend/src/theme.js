const FONTS = [
  "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
  "https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap",
  "https://fonts.googleapis.com/css2?family=Space+Mono&display=swap",
  "https://fonts.googleapis.com/css2?family=Pacifico&display=swap",
]

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
      // PNG, GIF, WebP, WebM poster
      root.style.setProperty("--app-bg-image", val)
    } else {
      // CSS gradient
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
}

export function saveEquipped(equipped) {
  localStorage.setItem("equipped", JSON.stringify(equipped))
}

export function loadEquipped() {
  try { return JSON.parse(localStorage.getItem("equipped")) || {} }
  catch { return {} }
}