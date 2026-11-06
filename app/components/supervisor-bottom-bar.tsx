"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { apiUrl } from "@/lib/api"

export default function SupervisorBottomBar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    fetch(apiUrl("/auth/me"), { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (json?.user?.role) {
          setRole(json.user.role)
        }
      })
      .catch(() => {})
  }, [])

  // Only render for SUPERVISOR
  if (role !== "SUPERVISOR") {
    return null
  }

  const isAttendanceActive =
    pathname === "/pages/contractorpages/attendance" ||
    (pathname.startsWith("/pages/contractorpages/attendance") &&
      !pathname.includes("/scan") &&
      !pathname.includes("/mark"))

  const isLeaveActive = pathname.startsWith("/pages/contractorpages/attendance/mark")
  const isScanActive = pathname.startsWith("/pages/contractorpages/attendance/scan")
  const isWorkersActive = pathname.startsWith("/pages/contractorpages/labours")
  const isProfileActive = pathname.startsWith("/pages/profile")

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between px-3">
        {/* 1. Attendance */}
        <Link
          href="/pages/contractorpages/attendance"
          className={`flex flex-1 flex-col items-center justify-center gap-1 transition-all ${
            isAttendanceActive ? "font-bold text-emerald-600" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isAttendanceActive ? "bg-emerald-50 text-emerald-600 scale-105" : ""
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <span className="text-[10px] tracking-tight leading-none">Attendance</span>
        </Link>

        {/* 2. Leave */}
        <Link
          href="/pages/contractorpages/attendance/mark"
          className={`flex flex-1 flex-col items-center justify-center gap-1 transition-all ${
            isLeaveActive ? "font-bold text-emerald-600" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isLeaveActive ? "bg-emerald-50 text-emerald-600 scale-105" : ""
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <span className="text-[10px] tracking-tight leading-none">Leave</span>
        </Link>

        {/* 3. Center Scanner Floating Elevated Button */}
        <div className="relative -top-5 flex flex-1 flex-col items-center justify-center">
          <Link
            href="/pages/contractorpages/attendance/scan"
            aria-label="Scan QR Attendance"
            className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all transform active:scale-95 ${
              isScanActive
                ? "bg-emerald-700 text-white ring-4 ring-emerald-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/30"
            }`}
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <path d="M14 14h3v3h-3z" />
              <path d="M20 14v3h-3" />
              <path d="M14 20h7" />
            </svg>
          </Link>
          <span
            className={`mt-1 text-[10px] font-bold tracking-tight leading-none ${
              isScanActive ? "text-emerald-700 font-extrabold" : "text-emerald-600"
            }`}
          >
            Scan QR
          </span>
        </div>

        {/* 4. Workers */}
        <Link
          href="/pages/contractorpages/labours"
          className={`flex flex-1 flex-col items-center justify-center gap-1 transition-all ${
            isWorkersActive ? "font-bold text-emerald-600" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isWorkersActive ? "bg-emerald-50 text-emerald-600 scale-105" : ""
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="text-[10px] tracking-tight leading-none">Workers</span>
        </Link>

        {/* 5. Profile */}
        <Link
          href="/pages/profile"
          className={`flex flex-1 flex-col items-center justify-center gap-1 transition-all ${
            isProfileActive ? "font-bold text-emerald-600" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isProfileActive ? "bg-emerald-50 text-emerald-600 scale-105" : ""
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-[10px] tracking-tight leading-none">Profile</span>
        </Link>
      </div>
    </div>
  )
}
