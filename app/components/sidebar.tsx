"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { apiUrl, getAuthHeaders } from "@/lib/api"

type MenuItem = {
  id: string
  label: string
  href: string
  icon: (props: { className?: string }) => React.ReactElement
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "employees",
    label: "Employees",
    href: "/pages/contractorpages/labours",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "wage-categories",
    label: "Wage Categories",
    href: "/pages/contractorpages/wage-categories",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/pages/contractorpages/payroll",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" />
        <line x1="8" x2="16" y1="6" y2="6" />
        <line x1="8" x2="16" y1="10" y2="10" />
        <line x1="8" x2="12" y1="14" y2="14" />
      </svg>
    ),
  },
  {
    id: "pay-components",
    label: "Pay Components",
    href: "/pages/contractorpages/payroll/settings",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/pages/contractorpages/attendance",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <circle cx="8" cy="14" r="1" />
        <circle cx="12" cy="14" r="1" />
        <circle cx="16" cy="14" r="1" />
      </svg>
    ),
  },
  {
    id: "qr-scan-attendance",
    label: "Scan QR Attendance",
    href: "/pages/contractorpages/attendance/scan",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3z" />
        <path d="M20 14v3h-3" />
        <path d="M14 20h7" />
      </svg>
    ),
  },
  {
    id: "leave",
    label: "Leave",
    href: "/pages/contractorpages/attendance/mark",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
  },
  {
    id: "supervisors",
    label: "Supervisors / Users",
    href: "/pages/contractorpages/users",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "sites",
    label: "Sites",
    href: "/pages/contractorpages/sites",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <line x1="9" x2="9" y1="9" y2="9" />
        <line x1="9" x2="9" y1="13" y2="13" />
        <line x1="9" x2="9" y1="17" y2="17" />
      </svg>
    ),
  },
  {
    id: "claims",
    label: "Claims",
    href: "/pages/contractorpages/invoices",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" x2="15" y1="15" y2="15" />
      </svg>
    ),
  },
  {
    id: "reimbursements",
    label: "Reimbursements",
    href: "/pages/contractorpages/payroll/payments",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/pages/contractorpages/reports",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    href: "/pages/contractorpages/reports",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" x2="18" y1="20" y2="10" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="14" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/pages/settings",
    icon: ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

const Sidebar: React.FC = () => {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userRole, setUserRole] = useState<string>("CONTRACTOR")

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved !== null) {
      setCollapsed(saved === "true")
    }

    const cachedRole = localStorage.getItem("userRole")
    if (cachedRole) {
      setUserRole(cachedRole)
    }

    const checkRole = async () => {
      try {
        const res = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
          headers: getAuthHeaders(),
        })
        const json = await res.json()
        if (json?.user?.role) {
          setUserRole(json.user.role)
          localStorage.setItem("userRole", json.user.role)
        }
      } catch {
        // fallback
      }
    }
    checkRole()
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem("sidebar-collapsed", String(next))
  }

  const isItemActive = (item: MenuItem) => {
    if (item.href === "/") {
      return pathname === "/" || pathname === "/pages/contractorpages/dashboard"
    }
    return pathname.startsWith(item.href)
  }

  const filteredMenuItems = menuItems.filter((item) => {
    if (userRole === "SUPERVISOR") {
      // Supervisor can only see Attendance, QR Scan, and Employees
      return ["attendance", "qr-scan-attendance", "leave", "employees"].includes(item.id)
    }
    return true
  })

  if (userRole === "SUPERVISOR") {
    // Supervisor has a bottom bar instead of sidebar
    return null
  }

  return (
    <aside
      className={`sticky top-0 z-30 flex h-screen flex-col shrink-0 bg-[#07162b] text-slate-300 transition-all duration-300 ${
        collapsed ? "w-20" : "w-60"
      }`}
    >
      {/* Brand Logo Box */}
      <div className="flex h-16 items-center px-4 border-b border-[#122844]">
        {collapsed ? (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 font-bold text-white shadow-md">
            L
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-28 items-center justify-center rounded-md bg-white px-2 shadow-xs">
              <span className="font-extrabold tracking-wider text-xs text-[#07162b] uppercase">
                Kinetic <span className="text-emerald-600">LMS</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
        {filteredMenuItems.map((item) => {
          const active = isItemActive(item)
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-[#0b333a] text-emerald-400 font-semibold shadow-xs"
                  : "text-slate-300 hover:bg-[#11243e] hover:text-white"
              } ${collapsed ? "justify-center" : "gap-3"}`}
            >
              <span
                className={`transition-colors ${
                  active ? "text-emerald-400" : "text-slate-400 group-hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer Items */}
      <div className="border-t border-[#122844] p-3 space-y-2">
        <Link
          href="/pages/settings"
          title={collapsed ? "Help & Support" : undefined}
          className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-[#11243e] hover:text-white transition-colors ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          {!collapsed && <span>Help & Support</span>}
        </Link>

        {/* Collapse Button */}
        <div className={`flex ${collapsed ? "justify-center" : "justify-end"} pt-1`}>
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#11243e] text-slate-400 hover:bg-emerald-600 hover:text-white transition-colors shadow-xs"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
