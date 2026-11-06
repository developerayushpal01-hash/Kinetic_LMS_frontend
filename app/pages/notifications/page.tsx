"use client"

import React, { useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"

type NotificationItem = {
  id: string
  title: string
  message: string
  time: string
  type: "attendance" | "system" | "worker"
  read: boolean
}

const mockNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Shift Attendance Active",
    message: "Morning shift attendance window is open. Please verify all labour check-ins.",
    time: "10 mins ago",
    type: "attendance",
    read: false,
  },
  {
    id: "2",
    title: "New Labour Onboarded",
    message: "A new labour has been registered under your contractor.",
    time: "2 hours ago",
    type: "worker",
    read: false,
  },
  {
    id: "3",
    title: "Daily Attendance Sync",
    message: "Yesterday's attendance logs have been approved and saved to payroll.",
    time: "1 day ago",
    type: "system",
    read: true,
  },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications)

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <Navbar />
      <main className="mx-auto max-w-3xl p-5 pb-24">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
            <p className="text-xs text-slate-500">Stay updated with shift and workforce alerts</p>
          </div>
          <button
            onClick={markAllRead}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Mark all as read
          </button>
        </div>

        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3.5 rounded-xl border p-4 transition-all ${
                item.read
                  ? "border-slate-200 bg-white"
                  : "border-emerald-200 bg-emerald-50/40 shadow-xs"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  item.type === "attendance"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.type === "worker"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.type === "attendance" ? "📋" : item.type === "worker" ? "👷" : "🔔"}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  <span className="text-[10px] text-slate-400">{item.time}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.message}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

