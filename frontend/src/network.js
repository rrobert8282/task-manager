export const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

let warmupInFlight = null

export function warmBackend() {
  if (warmupInFlight) {
    return warmupInFlight
  }

  warmupInFlight = fetch(`${API}/health`, {
    method: "GET",
    cache: "no-store",
  })
    .then(response => response.ok)
    .catch(() => false)
    .finally(() => {
      warmupInFlight = null
    })

  return warmupInFlight
}

export function isWarmBackendRunning() {
  return !!warmupInFlight
}