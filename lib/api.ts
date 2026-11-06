const configuredApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api"

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "")

export const apiUrl = (endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  if (typeof window !== "undefined") {
    const host = window.location.hostname
    // If accessing from phone via LAN IP (e.g. 192.168.x.x), use same host with backend port 3000
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:3000/api${normalizedEndpoint}`
    }
  }

  return `${API_BASE_URL}${normalizedEndpoint}`
}