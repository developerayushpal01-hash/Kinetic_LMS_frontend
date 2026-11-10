const configuredApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "")

export const apiUrl = (endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  // 1. If an explicit production API URL is set in .env (e.g. Render / Railway / Domain), use it first!
  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalizedEndpoint}`
  }

  // 2. If running locally or on local WiFi network, dynamically use the device/laptop IP
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host) {
      return `http://${host}:3000/api${normalizedEndpoint}`
    }
  }

  return `http://localhost:3000/api${normalizedEndpoint}`
}

export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token")
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
  }
  return headers
}

/**
 * Universal authenticated fetch helper for LMS.
 * Automatically injects credentials: "include" and Authorization: Bearer <token>.
 */
export const authFetch = async (endpointOrUrl: string, init?: RequestInit): Promise<Response> => {
  const url = endpointOrUrl.startsWith("http://") || endpointOrUrl.startsWith("https://")
    ? endpointOrUrl
    : apiUrl(endpointOrUrl)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const headers = new Headers(init?.headers || {})
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  return fetch(url, {
    credentials: "include",
    ...init,
    headers,
  })
}

// Auto-patch window.fetch in the browser so ALL existing page fetch calls automatically include auth tokens!
if (typeof window !== "undefined" && !(window as any).__LMS_FETCH_PATCHED__) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem("token")
    const customInit: RequestInit = {
      credentials: "include",
      ...(init || {}),
    }

    if (token) {
      const headers = new Headers(customInit.headers || {})
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`)
      }
      customInit.headers = headers
    }

    return originalFetch(input, customInit)
  }
  ;(window as any).__LMS_FETCH_PATCHED__ = true
}