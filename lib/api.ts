const configuredApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api"

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "")

export const apiUrl = (endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${API_BASE_URL}${normalizedEndpoint}`
}