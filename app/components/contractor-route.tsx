"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { apiUrl, getAuthHeaders } from "@/lib/api"
import Sidebar from "@/app/components/sidebar"
import Navbar from "@/app/components/navbar"

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
  const [mounted, setMounted] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem("token")
    const role = localStorage.getItem("userRole")
    if (token && role) {
      if (role === "SUPERVISOR") {
        const supervisorAllowed = [
          "/pages/contractorpages/labours",
          "/pages/contractorpages/attendance",
        ]
        setIsAuthorized(supervisorAllowed.some((prefix) => pathname.startsWith(prefix)))
      } else if (role === "CONTRACTOR") {
        setIsAuthorized(true)
      }
    }
  }, [pathname])

  useEffect(() => {
    const controller = new AbortController()

    const verifyAccess = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
          headers: getAuthHeaders(),
          signal: controller.signal,
        })
        const result = (await response.json()) as AuthResponse

        if (!response.ok || !result.success || !result.user) {
          router.replace(`/pages/login?next=${encodeURIComponent(pathname)}`)
          return
        }

        if (result.user.role === "SUPERVISOR") {
          // Allowed supervisor routes
          const supervisorAllowed = [
            "/pages/contractorpages/labours",
            "/pages/contractorpages/attendance",
          ]
          const isAllowed = supervisorAllowed.some((prefix) => pathname.startsWith(prefix))

          if (!isAllowed) {
            router.replace("/pages/contractorpages/attendance")
            return
          }

          setIsAuthorized(true)
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

  if (!mounted || !isAuthorized) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
        {/* Keep Sidebar visible so page doesn't flash empty white screen */}
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Navbar />
          <main className="flex min-h-0 flex-1 items-center justify-center p-6" aria-live="polite">
            <div className="flex flex-col items-center gap-3">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
              <span className="text-xs font-medium text-slate-500">Loading...</span>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return children
}

export default ContractorRoute