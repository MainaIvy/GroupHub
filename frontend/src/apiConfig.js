const fallbackBase = 'http://localhost:8000'

export const API_BASE = import.meta.env.VITE_API_URL || fallbackBase

export function wsUrl(path) {
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const protocol = isSecure ? 'wss:' : 'ws:'

  let host
  try {
    host = new URL(import.meta.env.VITE_API_URL || fallbackBase).host
  } catch {
    host = 'localhost:8000'
  }

  return `${protocol}//${host}${path}`
}
