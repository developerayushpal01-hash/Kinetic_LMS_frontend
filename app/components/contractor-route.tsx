"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { apiUrl } from "@/lib/api"

type AuthResponse = {
  success: boolean
  user?: {
    role: string
  }
}

type ContractorRouteProps = {
  children: ReactNode
}

const ContractorRoute = ({ children }: ContractorRouteProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const verifyAccess = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
          signal: controller.signal,
        })
        const result = (await response.json()) as AuthResponse

        if (!response.ok || !result.success || !result.user) {
          router.replace(`/pages/login?next=${encodeURIComponent(pathname)}`)
          return
        }

        if (result.user.role !== "CONTRACTOR") {
          router.replace("/pages/unauthorized")
          return
        }

        setIsAuthorized(true)
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          router.replace(`/pages/login?next=${encodeURIComponent(pathname)}`)
        }
      }
    }

    verifyAccess()

    return () => controller.abort()
  }, [pathname, router])

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        <span className="sr-only">Checking access...</span>
      </main>
    )
  }

  return children
}

export default ContractorRoute