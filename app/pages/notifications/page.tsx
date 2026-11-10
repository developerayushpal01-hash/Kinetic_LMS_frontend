"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { apiUrl, getAuthHeaders } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"

type NotificationItem = {
  _id: string
  title: string
  message: string
  createdAt: string
  type: "ATTENDANCE" | "LABOUR" | "SYSTEM" | "ALERT"
  read: boolean
  url?: string
}

function timeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "Just now"
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export default function NotificationsPage() {
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("CONTRACTOR")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("userRole")
      if (cached) setUserRole(cached)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/notifications"), {
        credentials: "include",
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (res.ok && json.success && Array.isArray(json.data)) {
        setNotifications(json.data)
      }
    } catch {
      // silently fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    try {
      await fetch(apiUrl("/notifications/mark-all-read"), {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
      })
      showToast("All notifications marked as read", "success")
    } catch {}
  }

  const markSingleRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item._id === id ? { ...item, read: true } : item))
    )
    try {
      await fetch(apiUrl(`/notifications/${id}/read`), {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
      })
    } catch {}
  }

  const isSupervisor = userRole === "SUPERVISOR"

  // 1. SUPERVISOR MOBILE VIEW (UNCHANGED, Clean Mobile App)
  if (isSupervisor) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] pb-24">
        <Navbar />
        <main className="mx-auto max-w-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
              <p className="text-xs text-slate-500">Your recent updates and shift alerts</p>
            </div>
            {notifications.some((n) => !n.read) && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
                No notifications right now.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  onClick={() => markSingleRead(item._id)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                    item.read
                      ? "border-slate-200 bg-white"
                      : "border-emerald-300 bg-emerald-50/50 shadow-sm"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${
                      item.type === "ATTENDANCE"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.type === "LABOUR"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.type === "ATTENDANCE" ? "📋" : item.type === "LABOUR" ? "👷" : "🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.title}</h3>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    )
  }

  // 2. CONTRACTOR FULL WEB VIEW (With Desktop Sidebar, Top Navbar & Web Layout matching screenshot)
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />

        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Header Section (Exactly like screenshot) */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Notifications
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Stay updated with shift and workforce alerts
                </p>
              </div>

              {notifications.some((n) => !n.read) && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification List Cards */}
            <div className="space-y-3.5">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
                  No notifications found. Realtime alerts will appear here.
                </div>
              ) : (
                notifications.map((item) => {
                  const isUnread = !item.read

                  return (
                    <div
                      key={item._id}
                      onClick={() => markSingleRead(item._id)}
                      className={`group flex items-start gap-4 rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer ${
                        isUnread
                          ? "border-emerald-300 bg-emerald-50/40 shadow-xs hover:border-emerald-400"
                          : "border-slate-200/90 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Icon Container matching screenshot styling */}
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                          item.type === "ATTENDANCE"
                            ? "bg-emerald-100/90 text-emerald-800"
                            : item.type === "LABOUR"
                            ? "bg-amber-100/90 text-amber-800"
                            : "bg-blue-100/90 text-blue-800"
                        }`}
                      >
                        {item.type === "ATTENDANCE" ? (
                          <span role="img" aria-label="attendance">📋</span>
                        ) : item.type === "LABOUR" ? (
                          <span role="img" aria-label="labour">👷</span>
                        ) : (
                          <span role="img" aria-label="alert">🔔</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">
                              {item.title}
                            </h3>
                            {isUnread && (
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">
                            {timeAgo(item.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {item.message}
                        </p>

                        {item.url && (
                          <div className="mt-2">
                            <Link
                              href={item.url}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                              View details &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
