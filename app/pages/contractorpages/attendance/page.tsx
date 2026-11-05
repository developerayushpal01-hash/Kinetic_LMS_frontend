"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Status = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY"
type Site = { _id: string; siteName: string; siteCode?: string }
type Labour = { _id: string; labourCode: string; name: string; mobile: string; status: string; isPFApplicable?: boolean; pfUanNumber?: string | null; isESICApplicable?: boolean; esicIpNumber?: string | null; site: Site | null }
type Entry = { _id: string; labourId: string | { _id: string; name?: string } | null; attendanceDate: string; status: Status; overtimeHours?: number; overtimeAmount?: number | null }
type Api<T> = { success: boolean; data?: T; message?: string }

const statusMeta: Record<Status, { short: string; label: string; className: string }> = {
  PRESENT: { short: "P", label: "Present", className: "bg-emerald-500 text-white" },
  ABSENT: { short: "A", label: "Absent", className: "bg-red-500 text-white" },
  HALF_DAY: { short: "HD", label: "Half Day", className: "bg-amber-500 text-white" },
  LEAVE: { short: "L", label: "Leave", className: "bg-sky-500 text-white" },
  HOLIDAY: { short: "H", label: "Paid Holiday", className: "bg-violet-600 text-white" },
}
const statuses: Status[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]
const pad = (value: number) => String(value).padStart(2, "0")
const labourIdOf = (entry: Entry) => typeof entry.labourId === "string" ? entry.labourId : entry.labourId?._id || ""
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [labourResponse, siteResponse, attendanceResponse] = await Promise.all([
        fetch(apiUrl("/labours/get-labours"), { credentials: "include" }),
        fetch(apiUrl("/sites/get-sites"), { credentials: "include" }),
        fetch(apiUrl(`/attendance/monthly?month=${month}&year=${year}`), { credentials: "include" }),
      ])
      const labourResult = await labourResponse.json() as Api<Labour[]>
      const siteResult = await siteResponse.json() as Api<Site[]>
      const attendanceResult = await attendanceResponse.json() as Api<Entry[]>
      if (!labourResponse.ok || !labourResult.success) throw new Error(labourResult.message || "Labours could not be loaded.")
      if (!attendanceResponse.ok || !attendanceResult.success) throw new Error(attendanceResult.message || "Attendance could not be loaded.")
      setLabours(labourResult.data || [])
      setSites(siteResult.data || [])
      setEntries(attendanceResult.data || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance could not be loaded.", "error")
    } finally { setLoading(false) }
  }, [month, year, showToast])

  useEffect(() => {
    // Initial and month-based API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const days = new Date(year, month, 0).getDate()
  const dayList = useMemo(() => Array.from({ length: days }, (_, index) => index + 1), [days])
  const entryMap = useMemo(() => new Map(entries.filter((entry) => labourIdOf(entry)).map((entry) => [`${labourIdOf(entry)}-${dateKey(entry.attendanceDate)}`, entry])), [entries])
  const visibleLabours = useMemo(() => {
    const text = query.trim().toLowerCase()
    return labours.filter((labour) => {
      const matchesSite = !siteId || labour.site?._id === siteId
      const matchesText = !text || [labour.name, labour.labourCode, labour.mobile].some((value) => value.toLowerCase().includes(text))
      return matchesSite && matchesText
    })
  }, [labours, query, siteId])

  const totals = useMemo(() => {
    const count = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, HOLIDAY: 0 }
    const visibleIds = new Set(visibleLabours.map((labour) => labour._id))
    entries.forEach((entry) => { if (visibleIds.has(labourIdOf(entry))) count[entry.status]++ })
    return count
  }, [entries, visibleLabours])
  const marked = Object.values(totals).reduce((sum, value) => sum + value, 0)
  const totalOvertimeHours = entries.reduce((sum, entry) => sum + Number(entry.overtimeHours || 0), 0)
  const presentRate = marked ? Math.round(((totals.PRESENT + totals.HALF_DAY * 0.5 + totals.HOLIDAY) / marked) * 1000) / 10 : 0

  const saveStatus = async (labour: Labour, day: number, status: Status) => {
    if (!labour.site?._id) { showToast("Assign this labour to a site before marking attendance.", "error"); return }
    const attendanceDate = `${year}-${pad(month)}-${pad(day)}`
    const key = `${labour._id}-${attendanceDate}`
    const existing = entryMap.get(key)
    setSavingKey(key)
    try {
      const response = await fetch(apiUrl(existing ? `/attendance/update/${existing._id}` : "/attendance/mark"), {
        method: existing ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing ? { status } : { labourId: labour._id, siteId: labour.site._id, attendanceDate, status, remarks: status === "HOLIDAY" ? "Paid holiday" : "" }),
      })
      const result = await response.json() as Api<Entry>
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Attendance could not be saved.")
      const saved = { ...result.data, labourId: labour._id }
      setEntries((current) => existing ? current.map((item) => item._id === existing._id ? saved : item) : [...current, saved])
      showToast(`${labour.name}: ${statusMeta[status].label} saved.`, "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance could not be saved.", "error")
    } finally { setSavingKey("") }
  }

  const saveOvertime = async (entry: Entry, rawValue: string) => {
    const value = Number(rawValue || 0)
    if (value !== null && (!Number.isFinite(value) || value < 0)) { showToast("OT value cannot be negative.", "error"); return }
    setSavingKey(`ot-${entry._id}`)
    try {
      const response = await fetch(apiUrl(`/attendance/update/${entry._id}`), { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overtimeHours: value, overtimeAmount: null }) })
      const result = await response.json() as Api<Entry>
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Overtime could not be saved.")
      setEntries((current) => current.map((item) => item._id === entry._id ? { ...result.data!, labourId: labourIdOf(item) } : item))
      showToast("Overtime updated.", "success")
    } catch (error) { showToast(error instanceof Error ? error.message : "Overtime could not be saved.", "error") } finally { setSavingKey("") }
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
      anchor.href = url; anchor.download = `Attendance_${year}_${pad(month)}.xlsx`; anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) { showToast(error instanceof Error ? error.message : "Export failed.", "error") } finally { setExporting(false) }
  }

  const setSelectedMonth = (value: string) => {
    const [nextYear, nextMonth] = value.split("-").map(Number)
    setLoading(true); setYear(nextYear); setMonth(nextMonth)
  }

  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar />
    <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Dashboard / <span className="font-semibold text-indigo-600">Attendance History</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Contractor Attendance History</h1><p className="mt-1 text-sm text-slate-500">Monthly attendance, paid holidays and workforce totals for every labour.</p></div><div className="flex flex-wrap gap-2"><a href="/pages/contractorpages/attendance/scan" className="flex h-10 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">&#128247; Scan QR Attendance</a><button onClick={exportAttendance} disabled={exporting} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">{exporting ? "Exporting..." : "Export Excel"}</button></div></header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[["Present Rate", `${presentRate}%`, "text-emerald-600"], ["Total Present", totals.PRESENT, "text-emerald-600"], ["Total Absent", totals.ABSENT, "text-red-600"], ["Total Half Day", totals.HALF_DAY, "text-amber-600"], ["Paid Holidays", totals.HOLIDAY, "text-violet-600"], ["OT Hours", totalOvertimeHours, "text-cyan-600"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><strong className={`mt-2 block text-2xl ${color}`}>{value}</strong></div>)}
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search worker name, code or mobile..." className="h-10 min-w-64 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" />
          <input type="month" value={`${year}-${pad(month)}`} onChange={(e) => setSelectedMonth(e.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="">All Sites</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.siteName}</option>)}</select>
          <div className="flex flex-wrap gap-2 text-[10px]">{statuses.map((status) => <span key={status} className="flex items-center gap-1"><i className={`h-2.5 w-2.5 rounded-full ${statusMeta[status].className.split(" ")[0]}`} />{statusMeta[status].short}</span>)}<span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-slate-200" />Not marked</span></div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-max border-collapse text-left">
            <thead className="bg-slate-50 text-[9px] uppercase text-slate-500"><tr><th className="sticky left-0 z-20 min-w-48 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Worker Name</th><th className="sticky left-48 z-20 min-w-24 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center">Type</th>{dayList.map((day) => { const isSunday = new Date(year, month - 1, day).getDay() === 0; return <th key={day} className={`h-12 w-11 border-b border-r border-slate-200 text-center ${isSunday ? "bg-rose-100 text-rose-700" : ""}`}>{day}<span className={`block text-[7px] font-semibold ${isSunday ? "text-rose-600" : "text-slate-400"}`}>{new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" })}</span></th> })}<th className="border-b border-l border-slate-200 px-3 text-center">Days</th><th className="border-b border-l border-slate-200 px-3 text-center text-emerald-600 whitespace-nowrap">Present</th><th className="border-b border-l border-slate-200 px-3 text-center text-red-600 whitespace-nowrap">Absent</th><th className="border-b border-l border-slate-200 px-3 text-center text-amber-600 whitespace-nowrap">Half Day</th><th className="border-b border-l border-slate-200 px-3 text-center text-sky-600 whitespace-nowrap">Leave</th><th className="border-b border-l border-slate-200 px-3 text-center text-violet-600 whitespace-nowrap">Paid Holiday</th><th className="border-b border-l border-slate-200 px-3 text-center text-cyan-600 whitespace-nowrap">OT Hours</th><th className="border-b border-l border-slate-200 px-3 text-center text-indigo-600 whitespace-nowrap">PF / UAN</th><th className="border-b border-l border-slate-200 px-3 text-center text-sky-600 whitespace-nowrap">ESIC / IP</th></tr></thead>
            <tbody>{visibleLabours.map((labour) => {
              const rowEntries = entries.filter((entry) => labourIdOf(entry) === labour._id)
              const row = (status: Status) => rowEntries.filter((entry) => entry.status === status).length
              const rowOvertimeHours = rowEntries.reduce((sum, entry) => sum + Number(entry.overtimeHours || 0), 0)
              const summaryCells = <><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold">{days}</td><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-emerald-600">{row("PRESENT")}</td><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-red-600">{row("ABSENT")}</td><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-amber-600">{row("HALF_DAY")}</td><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-sky-600">{row("LEAVE")}</td><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-violet-600">{row("HOLIDAY")}</td><td rowSpan={2} className="border-l border-b border-slate-200 px-3 text-center text-xs font-bold text-cyan-600">{rowOvertimeHours}</td><td rowSpan={2} className="min-w-28 border-l border-b border-slate-200 px-3 text-center text-[9px] font-semibold text-indigo-700">{labour.pfUanNumber || "-"}</td><td rowSpan={2} className="min-w-28 border-l border-b border-slate-200 px-3 text-center text-[9px] font-semibold text-sky-700">{labour.esicIpNumber || "-"}</td></>
              return <Fragment key={labour._id}>
                <tr className="hover:bg-slate-50">
                  <td rowSpan={2} className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-4 py-3 align-middle"><strong className="block text-xs text-slate-800">{labour.name}</strong><span className="text-[9px] text-slate-400">{labour.labourCode} {labour.site ? `- ${labour.site.siteName}` : "- No site"}</span></td><td className="sticky left-48 z-10 min-w-24 border-r border-b border-slate-200 bg-white px-3 text-center text-[9px] font-bold uppercase text-slate-500">Attendance</td>
                  {dayList.map((day) => {
                    const key = `${labour._id}-${year}-${pad(month)}-${pad(day)}`
                    const entry = entryMap.get(key)
                    const isFuture = new Date(year, month - 1, day) > new Date()
                    const isSunday = new Date(year, month - 1, day).getDay() === 0
                    return <td key={day} className={`border-r border-b border-slate-200 p-1 text-center ${isSunday ? "bg-rose-50" : ""}`}>{isFuture
                      ? <span aria-label={`${labour.name}, day ${day}, future date`} className="inline-flex h-8 w-9 items-center justify-center rounded-full bg-slate-50 text-[9px] text-slate-300">-</span>
                      : <select aria-label={`${labour.name}, day ${day}`} disabled={savingKey === key} value={entry?.status || ""} onChange={(event) => saveStatus(labour, day, event.target.value as Status)} className={`h-8 w-9 cursor-pointer appearance-none rounded-full border-0 text-center text-[9px] font-bold outline-none disabled:opacity-50 ${entry ? statusMeta[entry.status].className : "bg-slate-100 text-slate-400"}`}><option value="" className="bg-white text-slate-500">-</option>{statuses.map((status) => <option key={status} value={status} className={statusMeta[status].className}>{statusMeta[status].short}</option>)}</select>
                    }</td>
                  })}
                  {summaryCells}
                </tr>
                <tr className="border-b border-slate-200 bg-cyan-50/30"><td className="sticky left-48 z-10 min-w-24 border-r border-t border-slate-200 bg-cyan-50 px-3 text-center text-[9px] font-bold uppercase text-cyan-700">OT Hours</td>
                  {dayList.map((day) => {
                    const key = `${labour._id}-${year}-${pad(month)}-${pad(day)}`
                    const entry = entryMap.get(key)
                    const isFuture = new Date(year, month - 1, day) > new Date()
                    const isSunday = new Date(year, month - 1, day).getDay() === 0
                    return <td key={day} className={`h-8 border-r border-slate-100 p-1 text-center ${isSunday ? "bg-rose-50" : ""}`}>{isFuture || !entry
                      ? <span className="text-[8px] text-slate-300">-</span>
                      : <input aria-label={`${labour.name}, day ${day}, OT hours`} title="OT Hours" type="number" min="0" step="0.5" defaultValue={entry.overtimeHours || ""} disabled={savingKey === `ot-${entry._id}`} onBlur={(event) => saveOvertime(entry, event.target.value)} placeholder="0" className="h-6 w-10 rounded border border-cyan-200 bg-white px-0.5 text-center text-[8px] font-semibold text-cyan-700 outline-none focus:border-cyan-500" />
                    }</td>
                  })}
                </tr>
              </Fragment>
            })}</tbody>
          </table>
          {loading && <div className="p-12 text-center text-sm text-slate-500">Loading attendance...</div>}
          {!loading && !visibleLabours.length && <div className="p-12 text-center text-sm text-slate-500">No labours found for these filters.</div>}
        </div>
      </section>
      <p className="mt-3 text-[10px] text-slate-500">Select a status in any date cell to create or update attendance. Paid Holiday (PH) counts as a full paid day in payroll.</p>
    </main>
  </div></div>
}





