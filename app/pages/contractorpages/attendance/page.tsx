"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Status = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY"
type Site = { _id: string; siteName: string; siteCode?: string }
type Labour = {
  _id: string
  labourCode: string
  name: string
  mobile: string
  status: string
  isPFApplicable?: boolean
  pfUanNumber?: string | null
  isESICApplicable?: boolean
  esicIpNumber?: string | null
  site: Site | null
  trade?: string
  skillId?: { skillName?: string; defaultDailyWage?: number } | null
}
type Entry = {
  _id: string
  labourId: string | { _id: string; name?: string } | null
  attendanceDate: string
  status: Status
  overtimeHours?: number
  overtimeAmount?: number | null
}
type Api<T> = { success: boolean; data?: T; message?: string }
type UserRole = "CONTRACTOR" | "SUPERVISOR" | string

const statusMeta: Record<Status, { short: string; label: string; className: string; bgLight: string; textCol: string }> = {
  PRESENT: { short: "P", label: "Present", className: "bg-emerald-500 text-white", bgLight: "bg-emerald-50 border-emerald-200", textCol: "text-emerald-700" },
  ABSENT: { short: "A", label: "Absent", className: "bg-red-500 text-white", bgLight: "bg-rose-50 border-rose-200", textCol: "text-rose-700" },
  HALF_DAY: { short: "HD", label: "Half Day", className: "bg-amber-500 text-white", bgLight: "bg-amber-50 border-amber-200", textCol: "text-amber-700" },
  LEAVE: { short: "L", label: "Leave", className: "bg-sky-500 text-white", bgLight: "bg-sky-50 border-sky-200", textCol: "text-sky-700" },
  HOLIDAY: { short: "H", label: "Paid Holiday", className: "bg-violet-600 text-white", bgLight: "bg-violet-50 border-violet-200", textCol: "text-violet-700" },
}
const statuses: Status[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]
const pad = (value: number) => String(value).padStart(2, "0")
const labourIdOf = (entry: Entry) => (typeof entry.labourId === "string" ? entry.labourId : entry.labourId?._id || "")
const dateKey = (value: string) => value.slice(0, 10)

export default function AttendancePage() {
  const { showToast } = useToast()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [labours, setLabours] = useState<Labour[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [query, setQuery] = useState("")
  const [siteId, setSiteId] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState("")
  const [exporting, setExporting] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>("CONTRACTOR")

  // Supervisor Mobile View State
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate())
  const [mobileTab, setMobileTab] = useState<"TODAY" | "MONTHLY">("TODAY")
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status | "UNMARKED">("ALL")

  // Load User Role
  useEffect(() => {
    const cachedRole = localStorage.getItem("userRole")
    if (cachedRole) setUserRole(cachedRole as UserRole)

    fetch(apiUrl("/auth/me"), { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (json?.user?.role) {
          setUserRole(json.user.role)
          localStorage.setItem("userRole", json.user.role)
        }
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [labourResponse, siteResponse, attendanceResponse] = await Promise.all([
        fetch(apiUrl("/labours/get-labours"), { credentials: "include" }),
        fetch(apiUrl("/sites/get-sites"), { credentials: "include" }),
        fetch(apiUrl(`/attendance/monthly?month=${month}&year=${year}`), { credentials: "include" }),
      ])
      const labourResult = (await labourResponse.json()) as Api<Labour[]>
      const siteResult = (await siteResponse.json()) as Api<Site[]>
      const attendanceResult = (await attendanceResponse.json()) as Api<Entry[]>
      if (!labourResponse.ok || !labourResult.success) throw new Error(labourResult.message || "Labours could not be loaded.")
      if (!attendanceResponse.ok || !attendanceResult.success) throw new Error(attendanceResult.message || "Attendance could not be loaded.")
      setLabours(labourResult.data || [])
      setSites(siteResult.data || [])
      setEntries(attendanceResult.data || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance could not be loaded.", "error")
    } finally {
      setLoading(false)
    }
  }, [month, year, showToast])

  useEffect(() => {
    load()
  }, [load])

  const days = new Date(year, month, 0).getDate()
  const dayList = useMemo(() => Array.from({ length: days }, (_, index) => index + 1), [days])
  const entryMap = useMemo(
    () => new Map(entries.filter((entry) => labourIdOf(entry)).map((entry) => [`${labourIdOf(entry)}-${dateKey(entry.attendanceDate)}`, entry])),
    [entries]
  )

  const visibleLabours = useMemo(() => {
    const text = query.trim().toLowerCase()
    return labours.filter((labour) => {
      const matchesSite = !siteId || labour.site?._id === siteId
      const matchesText = !text || [labour.name, labour.labourCode, labour.mobile].some((value) => value.toLowerCase().includes(text))
      return matchesSite && matchesText
    })
  }, [labours, query, siteId])

  // Daily summary for selectedDay
  const dailyDateStr = `${year}-${pad(month)}-${pad(selectedDay)}`
  const dailyEntries = useMemo(() => {
    const map = new Map<string, Entry>()
    entries.forEach((e) => {
      if (dateKey(e.attendanceDate) === dailyDateStr) {
        map.set(labourIdOf(e), e)
      }
    })
    return map
  }, [entries, dailyDateStr])

  const dailyTotals = useMemo(() => {
    let present = 0
    let halfDay = 0
    let absent = 0
    let leave = 0
    let holiday = 0
    let totalOT = 0

    visibleLabours.forEach((l) => {
      const entry = dailyEntries.get(l._id)
      if (entry) {
        if (entry.status === "PRESENT") present++
        else if (entry.status === "HALF_DAY") halfDay++
        else if (entry.status === "ABSENT") absent++
        else if (entry.status === "LEAVE") leave++
        else if (entry.status === "HOLIDAY") holiday++
        totalOT += Number(entry.overtimeHours || 0)
      }
    })

    const totalMarked = present + halfDay + absent + leave + holiday
    const unmarked = Math.max(0, visibleLabours.length - totalMarked)

    return { present, halfDay, absent, leave, holiday, totalOT, totalMarked, unmarked, totalWorkers: visibleLabours.length }
  }, [visibleLabours, dailyEntries])

  // Filtered Labours for Mobile Daily Card View
  const mobileFilteredLabours = useMemo(() => {
    return visibleLabours.filter((l) => {
      const entry = dailyEntries.get(l._id)
      if (statusFilter === "ALL") return true
      if (statusFilter === "UNMARKED") return !entry
      return entry?.status === statusFilter
    })
  }, [visibleLabours, dailyEntries, statusFilter])

  // Monthly totals
  const totals = useMemo(() => {
    const count = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, HOLIDAY: 0 }
    const visibleIds = new Set(visibleLabours.map((labour) => labour._id))
    entries.forEach((entry) => {
      if (visibleIds.has(labourIdOf(entry))) count[entry.status]++
    })
    return count
  }, [entries, visibleLabours])
  const marked = Object.values(totals).reduce((sum, value) => sum + value, 0)
  const totalOvertimeHours = entries.reduce((sum, entry) => sum + Number(entry.overtimeHours || 0), 0)
  const presentRate = marked ? Math.round(((totals.PRESENT + totals.HALF_DAY * 0.5 + totals.HOLIDAY) / marked) * 1000) / 10 : 0

  // Fast Optimistic Attendance Marking (0ms UI lag)
  const saveStatus = async (labour: Labour, day: number, status: Status) => {
    if (!labour.site?._id) {
      showToast("Assign this labour to a site before marking attendance.", "error")
      return
    }
    const attendanceDate = `${year}-${pad(month)}-${pad(day)}`
    const key = `${labour._id}-${attendanceDate}`
    const existing = entryMap.get(key)

    // 1. Instant Optimistic UI Update (Immediate response!)
    const optimisticEntry: Entry = {
      _id: existing?._id || `temp-${Date.now()}`,
      labourId: labour._id,
      attendanceDate,
      status,
      overtimeHours: existing?.overtimeHours || 0,
      overtimeAmount: existing?.overtimeAmount || null,
    }

    setEntries((current) => {
      const idx = current.findIndex((item) => labourIdOf(item) === labour._id && dateKey(item.attendanceDate) === attendanceDate)
      if (idx >= 0) {
        const copy = [...current]
        copy[idx] = { ...copy[idx], status }
        return copy
      }
      return [...current, optimisticEntry]
    })

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(35)
    }

    // 2. Background Network Sync
    setSavingKey(key)
    try {
      const isActualExisting = existing && !existing._id.startsWith("temp-")
      const response = await fetch(apiUrl(isActualExisting ? `/attendance/update/${existing._id}` : "/attendance/mark"), {
        method: isActualExisting ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isActualExisting
            ? { status }
            : {
                labourId: labour._id,
                siteId: labour.site._id,
                attendanceDate,
                status,
                remarks: status === "HOLIDAY" ? "Paid holiday" : "",
              }
        ),
      })
      const result = (await response.json()) as Api<Entry>
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Attendance could not be saved.")
      const saved = { ...result.data, labourId: labour._id }
      setEntries((current) => current.map((item) => (labourIdOf(item) === labour._id && dateKey(item.attendanceDate) === attendanceDate ? saved : item)))
    } catch (error) {
      if (existing) {
        setEntries((current) => current.map((item) => (item._id === existing._id ? existing : item)))
      } else {
        setEntries((current) => current.filter((item) => !(labourIdOf(item) === labour._id && dateKey(item.attendanceDate) === attendanceDate)))
      }
      showToast(error instanceof Error ? error.message : "Attendance could not be saved.", "error")
    } finally {
      setSavingKey("")
    }
  }

  const saveOvertime = async (entry: Entry, rawValue: string) => {
    const value = Number(rawValue || 0)
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      showToast("OT value cannot be negative.", "error")
      return
    }
    setSavingKey(`ot-${entry._id}`)
    try {
      const response = await fetch(apiUrl(`/attendance/update/${entry._id}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overtimeHours: value, overtimeAmount: null }),
      })
      const result = (await response.json()) as Api<Entry>
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Overtime could not be saved.")
      setEntries((current) => current.map((item) => (item._id === entry._id ? { ...result.data!, labourId: labourIdOf(item) } : item)))
      showToast("Overtime updated.", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Overtime could not be saved.", "error")
    } finally {
      setSavingKey("")
    }
  }

  const exportAttendance = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) })
      if (siteId) params.set("siteId", siteId)
      if (query.trim()) params.set("search", query.trim())
      const response = await fetch(apiUrl(`/export/attendance/monthly?${params.toString()}`), { credentials: "include" })
      if (!response.ok) throw new Error("Attendance export failed.")
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `Attendance_${year}_${pad(month)}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Export failed.", "error")
    } finally {
      setExporting(false)
    }
  }

  const setSelectedMonth = (value: string) => {
    const [nextYear, nextMonth] = value.split("-").map(Number)
    setLoading(true)
    setYear(nextYear)
    setMonth(nextMonth)
  }

  const isSupervisor = userRole === "SUPERVISOR"

  return (
    <div className="flex min-h-screen bg-[#f7f8fc]">
      {/* Sidebar (automatically hidden for supervisor via userRole check) */}
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col pb-24">
        <Navbar />

        <main className="mx-auto w-full max-w-7xl p-3 sm:p-5 lg:p-7">
          {/* ========================================================= */}
          {/* 1. SUPERVISOR MOBILE-APP NATIVE UI VIEW                   */}
          {/* ========================================================= */}
          {isSupervisor ? (
            <div className="space-y-4">
              {/* Top Greeting & Date Ribbon */}
              <div className="rounded-2xl bg-gradient-to-r from-[#07162b] to-[#112a4f] p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">Shift Dashboard</span>
                    <h1 className="text-lg font-black tracking-tight text-white">Daily Attendance Log</h1>
                    <p className="text-xs text-slate-300">
                      {new Date(year, month - 1, selectedDay).toLocaleDateString("en-US", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Quick Launcher Buttons */}
                  <div className="flex items-center gap-2">
                    <Link
                      href="/pages/contractorpages/attendance/mark"
                      className="hidden sm:flex h-11 items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3 text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition-all"
                    >
                      <span>📝</span>
                      <span>Mark Sheet</span>
                    </Link>
                    <Link
                      href="/pages/contractorpages/attendance/scan"
                      className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
                    >
                      <span className="text-base">📷</span>
                      <span>Scan QR</span>
                    </Link>
                  </div>
                </div>

                {/* Horizontal Date Picker Carousel */}
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {dayList.map((d) => {
                    const isSelected = d === selectedDay
                    const dayDate = new Date(year, month - 1, d)
                    const isSun = dayDate.getDay() === 0
                    const isFuture = dayDate > now

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDay(d)}
                        className={`flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-xl transition-all ${
                          isSelected
                            ? "bg-emerald-500 font-bold text-white shadow-md scale-105"
                            : isFuture
                            ? "bg-white/5 text-slate-500 opacity-60"
                            : isSun
                            ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                            : "bg-white/10 text-slate-200 hover:bg-white/20"
                        }`}
                      >
                        <span className="text-[9px] uppercase">{dayDate.toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                        <span className="text-base font-black">{d}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mobile Stats Carousel Grid (Compact app cards) */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    statusFilter === "ALL" ? "border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-500/20" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total</p>
                  <strong className="text-lg font-black text-slate-900">{dailyTotals.totalWorkers}</strong>
                  <span className="block text-[8px] text-slate-400">Labour</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("PRESENT")}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    statusFilter === "PRESENT" ? "border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-500/20" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Present</p>
                  <strong className="text-lg font-black text-emerald-600">{dailyTotals.present}</strong>
                  <span className="block text-[8px] text-emerald-600/70">Full Day</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("HALF_DAY")}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    statusFilter === "HALF_DAY" ? "border-amber-500 bg-amber-50 shadow-sm ring-2 ring-amber-500/20" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600">Half</p>
                  <strong className="text-lg font-black text-amber-600">{dailyTotals.halfDay}</strong>
                  <span className="block text-[8px] text-amber-600/70">0.5 Day</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("UNMARKED")}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    statusFilter === "UNMARKED" ? "border-rose-500 bg-rose-50 shadow-sm ring-2 ring-rose-500/20" : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-rose-600">Pending</p>
                  <strong className="text-lg font-black text-rose-600">{dailyTotals.unmarked}</strong>
                  <span className="block text-[8px] text-rose-600/70">Unmarked</span>
                </button>
              </div>

              {/* Search & Site Filter Box */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search labour name or code..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-emerald-500 shadow-xs"
                  />
                  <span className="absolute left-3 top-3 text-sm text-slate-400">🔍</span>
                </div>

                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="h-11 max-w-[130px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none shadow-xs"
                >
                  <option value="">All Sites</option>
                  {sites.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.siteName}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Toggle: Daily Workers vs Full Month View */}
              <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMobileTab("TODAY")}
                  className={`flex-1 rounded-lg py-2 transition-all ${
                    mobileTab === "TODAY" ? "bg-white text-emerald-700 shadow-xs font-black" : "text-slate-600"
                  }`}
                >
                  📱 Worker Attendance Cards ({mobileFilteredLabours.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("MONTHLY")}
                  className={`flex-1 rounded-lg py-2 transition-all ${
                    mobileTab === "MONTHLY" ? "bg-white text-emerald-700 shadow-xs font-black" : "text-slate-600"
                  }`}
                >
                  📊 Full Month Sheet
                </button>
              </div>

              {/* ========================================================= */}
              {/* TAB 1: MOBILE WORKER ATTENDANCE CARDS                     */}
              {/* ========================================================= */}
              {mobileTab === "TODAY" && (
                <div className="space-y-3">
                  {loading && <div className="rounded-2xl bg-white p-8 text-center text-xs text-slate-400">Loading workforce...</div>}

                  {!loading && mobileFilteredLabours.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <p className="text-sm font-bold text-slate-700">No labours found</p>
                      <p className="mt-1 text-xs text-slate-400">Filter ya search query badal kar dekhein.</p>
                    </div>
                  )}

                  {/* Quick info note */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-100/80 px-3.5 py-2.5 text-[11px] text-slate-600 border border-slate-200">
                    <span className="flex items-center gap-1.5 font-medium">
                      🔒 <span>Read-Only Card View (Direct edits disabled)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Link href="/pages/contractorpages/attendance/scan" className="font-bold text-emerald-700 hover:underline">
                        📷 Scan QR
                      </Link>
                      <span>•</span>
                      <Link href="/pages/contractorpages/attendance/mark" className="font-bold text-indigo-700 hover:underline">
                        📝 Mark Attendance
                      </Link>
                    </div>
                  </div>

                  {!loading &&
                    mobileFilteredLabours.map((labour) => {
                      const entry = dailyEntries.get(labour._id)

                      return (
                        <div
                          key={labour._id}
                          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md"
                        >
                          {/* Worker Top Info */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-800 text-sm shadow-xs">
                                {labour.name.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-slate-900 leading-tight">{labour.name}</h3>
                                <p className="text-[11px] font-mono text-emerald-600 font-semibold">{labour.labourCode}</p>
                                <p className="text-[10px] text-slate-400">
                                  {labour.trade || labour.skillId?.skillName || "Worker"} {labour.site ? `• ${labour.site.siteName}` : ""}
                                </p>
                              </div>
                            </div>

                            {/* Current Status Pill */}
                            <div>
                              {entry ? (
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                    statusMeta[entry.status].bgLight
                                  } ${statusMeta[entry.status].textCol}`}
                                >
                                  {statusMeta[entry.status].label}
                                </span>
                              ) : (
                                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                                  Not Marked
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Attendance Status & Overtime Details (Read-Only) */}
                          <div className="mt-3.5 border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                                {entry ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ${
                                      statusMeta[entry.status].bgLight
                                    } ${statusMeta[entry.status].textCol}`}
                                  >
                                    {entry.status === "PRESENT" && "✓ "}
                                    {entry.status === "HALF_DAY" && "½ "}
                                    {entry.status === "ABSENT" && "✕ "}
                                    {statusMeta[entry.status].label}
                                  </span>
                                ) : (
                                  <span className="rounded-lg bg-slate-200/70 px-2.5 py-1 text-xs font-bold text-slate-500">
                                    Not Marked
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-500">Overtime:</span>
                                <span className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-800">
                                  {entry?.overtimeHours ? `${entry.overtimeHours}h` : "0h"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: MONTHLY SHEET (IF SUPERVISOR WANTS TO SEE ALL DAYS)*/}
              {/* ========================================================= */}
              {mobileTab === "MONTHLY" && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Monthly Roster View</span>
                      <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[9px] font-bold text-cyan-700">
                        Includes OT (Overtime)
                      </span>
                    </div>
                    <input
                      type="month"
                      value={`${year}-${pad(month)}`}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="h-8 rounded-lg border border-slate-300 px-2 text-xs font-medium"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-max border-collapse text-left">
                      <thead className="bg-slate-50 text-[9px] uppercase text-slate-500">
                        <tr>
                          <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-3 py-2">Worker</th>
                          {dayList.map((d) => {
                            const dayDate = new Date(year, month - 1, d)
                            const isSun = dayDate.getDay() === 0
                            return (
                              <th
                                key={d}
                                className={`border-b border-r border-slate-200 px-2 py-1 text-center font-bold ${
                                  isSun ? "bg-rose-50 text-rose-600" : ""
                                }`}
                              >
                                {d}
                              </th>
                            )
                          })}
                          <th className="border-b border-l border-slate-200 px-2.5 py-1 text-center font-black text-emerald-700 bg-emerald-50/60">
                            P
                          </th>
                          <th className="border-b border-l border-slate-200 px-2.5 py-1 text-center font-black text-amber-700 bg-amber-50/60">
                            HD
                          </th>
                          <th className="border-b border-l border-slate-200 px-2.5 py-1 text-center font-black text-rose-700 bg-rose-50/60">
                            A
                          </th>
                          <th className="border-b border-l border-slate-200 px-2.5 py-1 text-center font-black text-violet-700 bg-violet-50/60">
                            H
                          </th>
                          <th className="border-b border-l border-slate-200 px-2.5 py-1 text-center font-black text-cyan-700 bg-cyan-50/60">
                            OT
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLabours.map((l) => {
                          const workerEntries = entries.filter((e) => labourIdOf(e) === l._id)
                          const countP = workerEntries.filter((e) => e.status === "PRESENT").length
                          const countHD = workerEntries.filter((e) => e.status === "HALF_DAY").length
                          const countA = workerEntries.filter((e) => e.status === "ABSENT").length
                          const countH = workerEntries.filter((e) => e.status === "HOLIDAY").length
                          const totalOT = workerEntries.reduce((sum, e) => sum + Number(e.overtimeHours || 0), 0)

                          return (
                            <tr key={l._id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800">
                                <div className="leading-tight">{l.name}</div>
                                <div className="text-[9px] font-mono text-emerald-600 font-semibold">{l.labourCode}</div>
                              </td>
                              {dayList.map((d) => {
                                const key = `${l._id}-${year}-${pad(month)}-${pad(d)}`
                                const ent = entryMap.get(key)
                                const ot = Number(ent?.overtimeHours || 0)
                                const dayDate = new Date(year, month - 1, d)
                                const isSun = dayDate.getDay() === 0

                                return (
                                  <td
                                    key={d}
                                    className={`border-r border-slate-100 p-1 text-center align-middle ${
                                      isSun ? "bg-rose-50/30" : ""
                                    }`}
                                  >
                                    {ent ? (
                                      <div className="flex flex-col items-center justify-center py-0.5">
                                        <span
                                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-black ${
                                            statusMeta[ent.status].className
                                          }`}
                                        >
                                          {statusMeta[ent.status].short}
                                        </span>
                                        {ot > 0 && (
                                          <span className="mt-0.5 rounded bg-cyan-600 px-1 text-[8px] font-black text-white leading-tight shadow-xs">
                                            {ot}h
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 text-[10px]">-</span>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="border-l border-slate-200 px-2 py-1 text-center text-xs font-bold text-emerald-700 bg-emerald-50/20">
                                {countP}
                              </td>
                              <td className="border-l border-slate-200 px-2 py-1 text-center text-xs font-bold text-amber-700 bg-amber-50/20">
                                {countHD}
                              </td>
                              <td className="border-l border-slate-200 px-2 py-1 text-center text-xs font-bold text-rose-700 bg-rose-50/20">
                                {countA}
                              </td>
                              <td className="border-l border-slate-200 px-2 py-1 text-center text-xs font-bold text-violet-700 bg-violet-50/20">
                                {countH}
                              </td>
                              <td className="border-l border-slate-200 px-2 py-1 text-center text-xs font-black text-cyan-700 bg-cyan-50/30">
                                {totalOT > 0 ? `${totalOT}h` : <span className="text-slate-300 font-normal">-</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend Footer */}
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Legend:</span>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-[8px] font-black text-white">P</span>
                      <span>Present</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-500 text-[8px] font-black text-white">HD</span>
                      <span>Half Day</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-red-500 text-[8px] font-black text-white">A</span>
                      <span>Absent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-violet-600 text-[8px] font-black text-white">H</span>
                      <span>Holiday</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-cyan-600 px-1.5 text-[8px] font-black text-white">OT</span>
                      <span className="font-semibold text-cyan-800">Overtime (Hours)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================= */
            /* 2. CONTRACTOR DESKTOP ATTENDANCE VIEW (PRESERVED)         */
            /* ========================================================= */
            <>
              <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    Dashboard / <span className="font-semibold text-indigo-600">Attendance History</span>
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-slate-950">Contractor Attendance History</h1>
                  <p className="mt-1 text-sm text-slate-500">Monthly attendance, paid holidays and workforce totals for every labour.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/pages/contractorpages/attendance/scan"
                    className="flex h-10 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    📷 Scan QR Attendance
                  </Link>
                  <button
                    onClick={exportAttendance}
                    disabled={exporting}
                    className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>
                </div>
              </header>

              <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ["Present Rate", `${presentRate}%`, "text-emerald-600"],
                  ["Total Present", totals.PRESENT, "text-emerald-600"],
                  ["Total Absent", totals.ABSENT, "text-red-600"],
                  ["Total Half Day", totals.HALF_DAY, "text-amber-600"],
                  ["Paid Holidays", totals.HOLIDAY, "text-violet-600"],
                  ["OT Hours", totalOvertimeHours, "text-cyan-600"],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    <strong className={`mt-2 block text-2xl ${color}`}>{value}</strong>
                  </div>
                ))}
              </section>

              <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search worker name, code or mobile..."
                    className="h-10 min-w-64 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                  <input
                    type="month"
                    value={`${year}-${pad(month)}`}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  />
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">All Sites</option>
                    {sites.map((site) => (
                      <option key={site._id} value={site._id}>
                        {site.siteName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-max border-collapse text-left">
                    <thead className="bg-slate-50 text-[9px] uppercase text-slate-500">
                      <tr>
                        <th className="sticky left-0 z-20 min-w-48 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Worker Name</th>
                        <th className="sticky left-48 z-20 min-w-24 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center">Type</th>
                        {dayList.map((day) => {
                          const isSunday = new Date(year, month - 1, day).getDay() === 0
                          return (
                            <th
                              key={day}
                              className={`h-12 w-11 border-b border-r border-slate-200 text-center ${isSunday ? "bg-rose-100 text-rose-700" : ""}`}
                            >
                              {day}
                              <span className={`block text-[7px] font-semibold ${isSunday ? "text-rose-600" : "text-slate-400"}`}>
                                {new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                            </th>
                          )
                        })}
                        <th className="border-b border-l border-slate-200 px-3 text-center">Days</th>
                        <th className="border-b border-l border-slate-200 px-3 text-center text-emerald-600 whitespace-nowrap">Present</th>
                        <th className="border-b border-l border-slate-200 px-3 text-center text-red-600 whitespace-nowrap">Absent</th>
                        <th className="border-b border-l border-slate-200 px-3 text-center text-amber-600 whitespace-nowrap">Half Day</th>
                        <th className="border-b border-l border-slate-200 px-3 text-center text-sky-600 whitespace-nowrap">Leave</th>
                        <th className="border-b border-l border-slate-200 px-3 text-center text-violet-600 whitespace-nowrap">Paid Holiday</th>
                        <th className="border-b border-l border-slate-200 px-3 text-center text-cyan-600 whitespace-nowrap">OT Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLabours.map((labour) => {
                        const rowEntries = entries.filter((entry) => labourIdOf(entry) === labour._id)
                        const row = (status: Status) => rowEntries.filter((entry) => entry.status === status).length
                        const rowOvertimeHours = rowEntries.reduce((sum, entry) => sum + Number(entry.overtimeHours || 0), 0)
                        return (
                          <Fragment key={labour._id}>
                            <tr className="hover:bg-slate-50">
                              <td rowSpan={2} className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-4 py-3 align-middle">
                                <strong className="block text-xs text-slate-800">{labour.name}</strong>
                                <span className="text-[9px] text-slate-400">
                                  {labour.labourCode} {labour.site ? `- ${labour.site.siteName}` : "- No site"}
                                </span>
                              </td>
                              <td className="sticky left-48 z-10 min-w-24 border-r border-b border-slate-200 bg-white px-3 text-center text-[9px] font-bold uppercase text-slate-500">
                                Attendance
                              </td>
                              {dayList.map((day) => {
                                const key = `${labour._id}-${year}-${pad(month)}-${pad(day)}`
                                const entry = entryMap.get(key)
                                const isFuture = new Date(year, month - 1, day) > new Date()
                                const isSunday = new Date(year, month - 1, day).getDay() === 0
                                return (
                                  <td key={day} className={`border-r border-b border-slate-200 p-1 text-center ${isSunday ? "bg-rose-50" : ""}`}>
                                    {isFuture ? (
                                      <span className="inline-flex h-8 w-9 items-center justify-center rounded-full bg-slate-50 text-[9px] text-slate-300">
                                        -
                                      </span>
                                    ) : (
                                      <select
                                        disabled={savingKey === key}
                                        value={entry?.status || ""}
                                        onChange={(event) => saveStatus(labour, day, event.target.value as Status)}
                                        className={`h-8 w-9 cursor-pointer appearance-none rounded-full border-0 text-center text-[9px] font-bold outline-none disabled:opacity-50 ${
                                          entry ? statusMeta[entry.status].className : "bg-slate-100 text-slate-400"
                                        }`}
                                      >
                                        <option value="" className="bg-white text-slate-500">
                                          -
                                        </option>
                                        {statuses.map((status) => (
                                          <option key={status} value={status} className={statusMeta[status].className}>
                                            {statusMeta[status].short}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                )
                              })}
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold">
                                {days}
                              </td>
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-emerald-600">
                                {row("PRESENT")}
                              </td>
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-red-600">
                                {row("ABSENT")}
                              </td>
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-amber-600">
                                {row("HALF_DAY")}
                              </td>
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-sky-600">
                                {row("LEAVE")}
                              </td>
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-violet-600">
                                {row("HOLIDAY")}
                              </td>
                              <td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-cyan-600">
                                {rowOvertimeHours}
                              </td>
                            </tr>
                            <tr className="border-b border-slate-200 bg-cyan-50/30">
                              <td className="sticky left-48 z-10 min-w-24 border-r border-t border-slate-200 bg-cyan-50 px-3 text-center text-[9px] font-bold uppercase text-cyan-700">
                                OT Hours
                              </td>
                              {dayList.map((day) => {
                                const key = `${labour._id}-${year}-${pad(month)}-${pad(day)}`
                                const entry = entryMap.get(key)
                                const isFuture = new Date(year, month - 1, day) > new Date()
                                const isSunday = new Date(year, month - 1, day).getDay() === 0
                                return (
                                  <td key={day} className={`h-8 border-r border-slate-100 p-1 text-center ${isSunday ? "bg-rose-50" : ""}`}>
                                    {isFuture || !entry ? (
                                      <span className="text-[8px] text-slate-300">-</span>
                                    ) : (
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        defaultValue={entry.overtimeHours || ""}
                                        disabled={savingKey === `ot-${entry._id}`}
                                        onBlur={(event) => saveOvertime(entry, event.target.value)}
                                        placeholder="0"
                                        className="h-6 w-10 rounded border border-cyan-200 bg-white px-0.5 text-center text-[8px] font-semibold text-cyan-700 outline-none focus:border-cyan-500"
                                      />
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                  {loading && <div className="p-12 text-center text-sm text-slate-500">Loading attendance...</div>}
                  {!loading && !visibleLabours.length && (
                    <div className="p-12 text-center text-sm text-slate-500">No labours found for these filters.</div>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
