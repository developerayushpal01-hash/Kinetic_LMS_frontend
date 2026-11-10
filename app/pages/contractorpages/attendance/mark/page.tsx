"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Status = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY"
type Site = { _id: string; siteName: string; siteCode?: string; status: string }
type Labour = { _id: string; labourCode: string; name: string; mobile: string; status: string; skillId: { skillName: string } | null; site: Site | null }
type Entry = { _id: string; labourId: string | { _id: string } | null; attendanceDate: string; status: Status; overtimeHours?: number; overtimeAmount?: number | null }
type OtDraft = { hours: string }
type Api<T> = { success: boolean; data?: T; message?: string }

const options: { status: Status; label: string; short: string; activeClass: string; idleClass: string }[] = [
  { status: "PRESENT", label: "Present", short: "P", activeClass: "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30", idleClass: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  { status: "HALF_DAY", label: "Half Day", short: "HD", activeClass: "bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30", idleClass: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  { status: "ABSENT", label: "Absent", short: "A", activeClass: "bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30", idleClass: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  { status: "LEAVE", label: "Leave", short: "L", activeClass: "bg-sky-600 text-white shadow-sm ring-2 ring-sky-600/30", idleClass: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  { status: "HOLIDAY", label: "Holiday", short: "PH", activeClass: "bg-violet-600 text-white shadow-sm ring-2 ring-violet-600/30", idleClass: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
]

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const labourIdOf = (entry: Entry) =>
  typeof entry.labourId === "string" ? entry.labourId : entry.labourId?._id || ""

export default function MarkAttendancePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [date, setDate] = useState(localDate(new Date()))
  const [labours, setLabours] = useState<Labour[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [draft, setDraft] = useState<Record<string, Status>>({})
  const [otDraft, setOtDraft] = useState<Record<string, OtDraft>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [siteId, setSiteId] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const selectedDateObj = new Date(date + "T00:00:00")
      const month = selectedDateObj.getMonth() + 1
      const year = selectedDateObj.getFullYear()
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

      const dayEntries = (attendanceResult.data || []).filter((entry) => entry.attendanceDate.slice(0, 10) === date)
      setLabours((labourResult.data || []).filter((labour) => labour.status === "ACTIVE"))
      setSites((siteResult.data || []).filter((site) => site.status === "ACTIVE"))
      setEntries(dayEntries)
      setDraft({})
      setSelected(new Set())
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance data could not be loaded.", "error")
    } finally {
      setLoading(false)
    }
  }, [date, showToast])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    const markedLabourIds = new Set(entries.map((entry) => labourIdOf(entry)))
    return labours.filter((labour) => {
      const matchesSite = !siteId || labour.site?._id === siteId
      const matchesText = !text || [labour.name, labour.labourCode, labour.mobile].some((value) => value.toLowerCase().includes(text))
      return !markedLabourIds.has(labour._id) && matchesSite && matchesText
    })
  }, [entries, labours, query, siteId])

  const counts = useMemo(() => {
    const result = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, HOLIDAY: 0, PENDING: 0 }
    const savedByLabour = new Map(entries.map((entry) => [labourIdOf(entry), entry.status]))
    visible.forEach((labour) => {
      const status = draft[labour._id] || savedByLabour.get(labour._id)
      if (status) result[status]++
      else result.PENDING++
    })
    return result
  }, [draft, entries, visible])

  const toggleAll = () =>
    setSelected((current) => (current.size === visible.length ? new Set() : new Set(visible.map((l) => l._id))))

  const bulkSet = (status: Status) => {
    const ids = selected.size ? selected : new Set(visible.map((l) => l._id))
    setDraft((current) => {
      const next = { ...current }
      ids.forEach((id) => {
        next[id] = status
      })
      return next
    })
  }

  const toggleStatus = (labourId: string, status: Status) => {
    setDraft((current) => {
      const next = { ...current }
      if (next[labourId] === status) delete next[labourId]
      else next[labourId] = status
      return next
    })
  }

  const submit = async () => {
    const labourById = new Map(labours.map((labour) => [labour._id, labour]))
    const existingByLabour = new Map(entries.map((entry) => [labourIdOf(entry), entry]))
    const pendingLabourIds = Object.keys(draft)

    if (!pendingLabourIds.length) {
      showToast("Please mark attendance status for at least one worker before submitting.", "info")
      return
    }

    setSaving(true)
    try {
      const results = await Promise.all(
        pendingLabourIds.map(async (labourId) => {
          const labour = labourById.get(labourId)!
          const existing = existingByLabour.get(labourId)
          const status = draft[labourId]
          const overtime = otDraft[labourId] || { hours: "" }

          if (!status && existing) {
            const response = await fetch(apiUrl(`/attendance/delete/${existing._id}`), {
              method: "DELETE",
              credentials: "include",
            })
            const result = (await response.json()) as Api<unknown>
            if (!response.ok || !result.success) throw new Error(result.message || `${labour.name}: attendance removal failed.`)
            return { labourId, deleted: true as const }
          }

          const response = await fetch(apiUrl(existing ? `/attendance/update/${existing._id}` : "/attendance/mark"), {
            method: existing ? "PUT" : "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              existing
                ? { status, overtimeHours: Number(overtime.hours || 0), overtimeAmount: null }
                : {
                    labourId,
                    siteId: labour.site?._id,
                    attendanceDate: date,
                    status,
                    overtimeHours: Number(overtime.hours || 0),
                    overtimeAmount: null,
                    remarks: status === "HOLIDAY" ? "Paid holiday" : "",
                  }
            ),
          })
          const result = (await response.json()) as Api<Entry>
          if (!response.ok || !result.success || !result.data) throw new Error(result.message || `${labour.name}: attendance save failed.`)
          return { labourId, deleted: false as const, entry: { ...result.data, labourId } }
        })
      )

      setDraft({})
      setOtDraft({})
      setSelected(new Set())
      showToast(`${results.length} worker attendance saved successfully.`, "success")
      router.replace("/pages/contractorpages/attendance")
      router.refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance submission failed.", "error")
      await load()
    } finally {
      setSaving(false)
    }
  }

  const selectedDateObj = new Date(date + "T00:00:00")
  const formattedDate = selectedDateObj.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />

        {/* Scrollable Main Area */}
        <main className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4 sm:px-6 sm:py-6 pb-28 md:pb-12">
          <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
            {/* Header Card (App Style) */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                      Attendance &bull; Daily Mark
                    </p>
                  </div>
                  <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    Daily Attendance
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500">
                    {formattedDate}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <Link
                    href="/pages/contractorpages/attendance"
                    className="flex-1 sm:flex-initial text-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    View History
                  </Link>
                  <Link
                    href="/pages/contractorpages/attendance/scan"
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition"
                  >
                    <span>📷</span>
                    <span>Scan QR</span>
                  </Link>
                </div>
              </div>

              {/* Date & Site Filter (Mobile Clean Bar) */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">Select Date</label>
                    <input
                      type="date"
                      max={localDate(new Date())}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">Site Filter</label>
                    <select
                      value={siteId}
                      onChange={(e) => {
                        setSiteId(e.target.value)
                        setSelected(new Set())
                      }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="">All Sites ({sites.length})</option>
                      {sites.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.siteName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Metric Cards (Grid of 6 on desktop, 3x2 on mobile) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
              {[
                { label: "Labours", count: visible.length, color: "text-slate-900", bg: "bg-slate-100", dot: "bg-slate-400" },
                { label: "Present", count: counts.PRESENT, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
                { label: "Half Day", count: counts.HALF_DAY, color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
                { label: "Absent", count: counts.ABSENT, color: "text-rose-600", bg: "bg-rose-50", dot: "bg-rose-500" },
                { label: "Holiday", count: counts.HOLIDAY, color: "text-violet-600", bg: "bg-violet-50", dot: "bg-violet-500" },
                { label: "Pending", count: counts.PENDING, color: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-sm flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} />
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {stat.label}
                    </p>
                  </div>
                  <strong className={`mt-2 text-xl sm:text-2xl font-bold ${stat.color}`}>
                    {stat.count}
                  </strong>
                </div>
              ))}
            </div>

            {/* Quick Actions & Search Bar */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-sm space-y-3">
              {/* Search input */}
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search labour name, code or mobile..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              {/* Quick Bulk Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1"
                >
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && selected.size === visible.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Select All ({visible.length})</span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => bulkSet("PRESENT")}
                    className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSet("ABSENT")}
                    className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    All Absent
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSet("HOLIDAY")}
                    className="rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100 transition"
                  >
                    Paid Holiday
                  </button>
                </div>
              </div>
            </div>

            {/* Labour Cards List (App style responsive cards) */}
            <div className="space-y-3">
              {loading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
                  Loading labours and attendance data...
                </div>
              )}

              {!loading && !visible.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
                  No pending labours found for this date or filter.
                </div>
              )}

              {!loading &&
                visible.map((labour) => {
                  const isChecked = selected.has(labour._id)
                  const currentStatus = draft[labour._id]
                  const otVal = otDraft[labour._id]?.hours || ""

                  return (
                    <div
                      key={labour._id}
                      className={`rounded-2xl border bg-white p-3.5 sm:p-4 shadow-sm transition-all ${
                        currentStatus ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200/90"
                      }`}
                    >
                      {/* Top Row: Info + Selection Checkbox */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelected((curr) => {
                                const next = new Set(curr)
                                if (next.has(labour._id)) next.delete(labour._id)
                                else next.add(labour._id)
                                return next
                              })
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />

                          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-800 text-sm">
                            {labour.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">
                              {labour.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {labour.labourCode} &bull; {labour.mobile}
                            </p>
                          </div>
                        </div>

                        {/* Skill Badge */}
                        <div className="text-right">
                          <span className="inline-block rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {labour.skillId?.skillName || "Unskilled"}
                          </span>
                          <p className="mt-0.5 text-[11px] text-slate-400 truncate max-w-[120px]">
                            {labour.site?.siteName || "No Site"}
                          </p>
                        </div>
                      </div>

                      {/* Middle Row: Status Action Buttons (Pill Bar) */}
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-5 gap-1.5">
                        {options.map((opt) => {
                          const isActive = currentStatus === opt.status
                          return (
                            <button
                              key={opt.status}
                              type="button"
                              onClick={() => toggleStatus(labour._id, opt.status)}
                              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 ${
                                isActive ? opt.activeClass : opt.idleClass
                              }`}
                            >
                              <span className="text-[10px] sm:text-xs font-black">{opt.short}</span>
                              <span className="hidden sm:inline text-xs">{opt.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Bottom Row: OT Quick Presets / Input */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500">Overtime (OT):</span>
                        <div className="flex items-center gap-1.5">
                          {["0", "0.5", "1", "1.5", "2"].map((val) => {
                            const isOtActive = otVal === val || (val === "0" && !otVal)
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  setOtDraft((curr) => ({
                                    ...curr,
                                    [labour._id]: { hours: val === "0" ? "" : val },
                                  }))
                                  if (!draft[labour._id]) {
                                    setDraft((curr) => ({ ...curr, [labour._id]: "PRESENT" }))
                                  }
                                }}
                                className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                                  isOtActive
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {val === "0" ? "0h" : `${val}h`}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </main>

        {/* Floating Bottom Sticky Bar (App Style Submission Bar) */}
        <div className="fixed bottom-0 sm:bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 sm:px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold text-sm">
                {Object.keys(draft).length}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {Object.keys(draft).length} of {visible.length} Labours Marked
                </p>
                <p className="text-[11px] text-slate-400">
                  {date === localDate(new Date()) ? "For Today" : `For ${date}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={saving || loading || Object.keys(draft).length === 0}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95 transition disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <span>Submit Attendance</span>
                    <span className="text-xs font-normal opacity-80">({Object.keys(draft).length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
