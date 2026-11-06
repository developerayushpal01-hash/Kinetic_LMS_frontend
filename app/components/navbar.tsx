"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { apiUrl } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"

type AuthenticatedUser = {
  id: string
  name: string
  email: string
  role: string
  company: {
    companyName: string
  } | null
}

type SiteItem = {
  _id: string
  siteName: string
  siteCode?: string
}

type MeResponse = {
  success: boolean
  user?: AuthenticatedUser
  message?: string
}

const Navbar = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = useToast()
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState("")
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [selectedPayroll, setSelectedPayroll] = useState("May 2025 Payroll")
  const [isPayrollMenuOpen, setIsPayrollMenuOpen] = useState(false)
  const [sites, setSites] = useState<SiteItem[]>([])
  const [selectedSite, setSelectedSite] = useState<string>("All Sites")
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false)
  const siteMenuRef = useRef<HTMLDivElement>(null)

  const payrollOptions = [
    "May 2025 Payroll",
    "Apr 2025 Payroll",
    "Mar 2025 Payroll",
    "Feb 2025 Payroll",
    "Jan 2025 Payroll",
  ]

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
      if (siteMenuRef.current && !siteMenuRef.current.contains(event.target as Node)) {
        setIsSiteMenuOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false)
        setIsPayrollMenuOpen(false)
        setIsSiteMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", closeMenu)
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.removeEventListener("mousedown", closeMenu)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadUser = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
          signal: controller.signal,
        })
        const result = (await response.json()) as MeResponse

        if (!response.ok || !result.success || !result.user) {
          return
        }

        setUser(result.user)
      } catch {
        // Silently keep default UI
      }
    }

    loadUser()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadSites = async () => {
      try {
        const response = await fetch(apiUrl("/sites/get-sites"), {
          credentials: "include",
          signal: controller.signal,
        })
        const result = await response.json()

        if (response.ok && result.success && Array.isArray(result.data)) {
          setSites(result.data)
        }
      } catch {
        // Silently fail if not logged in
      }
    }

    loadSites()

    return () => controller.abort()
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLogoutError("")

    try {
      const response = await fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || result.success === false) {
        throw new Error(result.message ?? "Logout failed.")
      }

      showToast("Logged out successfully.", "success")
      setIsProfileMenuOpen(false)
      router.push("/pages/login")
      router.refresh()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Logout failed."
      setLogoutError(message)
      showToast(message, "error")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const getPageTitle = () => {
    if (pathname.includes("/labours")) return "Employees"
    if (pathname.includes("/wage-categories")) return "Wage Categories"
    if (pathname.includes("/payroll/settings")) return "Pay Components"
    if (pathname.includes("/payroll/payments")) return "Reimbursements"
    if (pathname.includes("/payroll")) return "Payroll"
    if (pathname.includes("/attendance/mark")) return "Leave Management"
    if (pathname.includes("/attendance/scan")) return "QR Attendance"
    if (pathname.includes("/attendance")) return "Attendance"
    if (pathname.includes("/sites")) return "Sites"
    if (pathname.includes("/invoices")) return "Claims & Invoices"
    if (pathname.includes("/reports")) return "Compliance & Reports"
    if (pathname.includes("/profile")) return "Profile"
    if (pathname.includes("/settings")) return "Settings"
    if (pathname.includes("/users")) return "User Management"
    if (pathname.includes("/notifications")) return "Notifications"
    return "Dashboard"
  }

  const displayName =
    user?.role === "CONTRACTOR"
      ? user.company?.companyName || user.name
      : user?.name || "LMS Admin"

  const displayRole = user?.role
    ? user.role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Contractor"

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "K"

  const isSupervisor = user?.role === "SUPERVISOR"

  // 1. MOBILE APP STYLE HEADER FOR SUPERVISOR
  if (isSupervisor) {
    return (
      <header className="sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-4 sm:px-6 shadow-xs">
        {/* Left: Kinetic LMS Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#07162b] text-white shadow-xs">
            <span className="text-base font-extrabold text-emerald-400">K</span>
          </div>
          <div>
            <span className="text-sm font-extrabold tracking-wider text-[#07162b] uppercase">
              Kinetic <span className="text-emerald-600">LMS</span>
            </span>
            <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-widest -mt-0.5">
              Supervisor
            </span>
          </div>
        </div>

        {/* Right: Notifications Button + Profile Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Notification Button */}
          <Link
            href="/pages/notifications"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-xs">
              3
            </span>
          </Link>

          {/* Profile Avatar without dropdown arrow */}
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-emerald-500/30 transition-all"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white text-xs shadow-xs">
                {initials}
              </div>
            </button>

            {isProfileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-50"
              >
                <div className="border-b border-slate-100 px-4 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-xs text-emerald-600 font-medium">Supervisor</p>
                </div>

                <Link
                  href="/pages/notifications"
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  Notifications
                </Link>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  role="menuitem"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
                  </svg>
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    )
  }

  // 2. STANDARD DESKTOP HEADER FOR CONTRACTOR / ADMIN
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-6 shadow-xs">
      {/* Left: Hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Toggle Navigation"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" x2="21" y1="6" y2="6" />
            <line x1="3" x2="21" y1="12" y2="12" />
            <line x1="3" x2="21" y1="18" y2="18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{getPageTitle()}</h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Site Selector Dropdown */}
        <div ref={siteMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSiteMenuOpen(!isSiteMenuOpen)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
              <line x1="9" x2="9" y1="9" y2="9" />
              <line x1="9" x2="9" y1="13" y2="13" />
            </svg>
            <span className="max-w-[130px] truncate">{selectedSite}</span>
            <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {isSiteMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg z-50">
              <button
                type="button"
                onClick={() => {
                  setSelectedSite("All Sites")
                  setIsSiteMenuOpen(false)
                }}
                className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-slate-50 flex items-center justify-between ${
                  selectedSite === "All Sites" ? "font-bold text-emerald-600 bg-emerald-50/60" : "text-slate-700"
                }`}
              >
                <span>All Sites</span>
                <span className="text-[10px] text-slate-400">{sites.length} sites</span>
              </button>

              <div className="border-t border-slate-100 my-1" />

              {sites.length > 0 ? (
                sites.map((st) => (
                  <button
                    key={st._id}
                    type="button"
                    onClick={() => {
                      setSelectedSite(st.siteName)
                      setIsSiteMenuOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-slate-50 flex items-center justify-between ${
                      selectedSite === st.siteName ? "font-bold text-emerald-600 bg-emerald-50/60" : "text-slate-700"
                    }`}
                  >
                    <span className="truncate">{st.siteName}</span>
                    {st.siteCode && <span className="text-[10px] text-slate-400 shrink-0 ml-1">({st.siteCode})</span>}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-slate-400 text-center">
                  No sites found
                </div>
              )}

              <div className="border-t border-slate-100 mt-1 pt-1 px-2">
                <Link
                  href="/pages/contractorpages/sites"
                  onClick={() => setIsSiteMenuOpen(false)}
                  className="block text-center py-1 text-[11px] font-semibold text-emerald-600 hover:underline"
                >
                  Manage Sites →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Month Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPayrollMenuOpen(!isPayrollMenuOpen)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            <span>{selectedPayroll}</span>
            <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {isPayrollMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg z-50">
              {payrollOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSelectedPayroll(opt)
                    setIsPayrollMenuOpen(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-slate-50 ${
                    selectedPayroll === opt ? "font-bold text-emerald-600 bg-emerald-50/60" : "text-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Icon with count 3 */}
        <Link
          href="/pages/notifications"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="absolute 1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-xs">
            3
          </span>
        </Link>

        {/* Settings Icon */}
        <Link
          href="/pages/settings"
          aria-label="Settings"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>

        {/* User Profile Avatar with dropdown */}
        <div ref={profileMenuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 font-bold text-white text-xs shadow-xs">
              {initials}
            </div>
            <div className="hidden text-left text-xs sm:block">
              <p className="max-w-32 truncate font-semibold text-slate-800">{displayName}</p>
              <p className="text-[10px] text-slate-400">{displayRole}</p>
            </div>
            <svg
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {isProfileMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-50"
            >
              <div className="border-b border-slate-100 px-4 py-2 sm:hidden">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">{displayRole}</p>
              </div>

              <Link
                href="/pages/profile"
                role="menuitem"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Company Profile
              </Link>

              <Link
                href="/pages/settings"
                role="menuitem"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                role="menuitem"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
                </svg>
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>

              {logoutError && <p className="px-4 py-1.5 text-[10px] text-red-600">{logoutError}</p>}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
