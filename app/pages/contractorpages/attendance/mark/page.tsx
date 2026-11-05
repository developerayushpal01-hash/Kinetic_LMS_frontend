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

const options: { status: Status; label: string; short: string; active: string; idle: string }[] = [
  { status: "PRESENT", label: "Present", short: "P", active: "border-emerald-600 bg-emerald-600 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { status: "ABSENT", label: "Absent", short: "A", active: "border-red-600 bg-red-600 text-white", idle: "border-red-200 bg-red-50 text-red-700" },
  { status: "HALF_DAY", label: "Half Day", short: "HD", active: "border-amber-500 bg-amber-500 text-white", idle: "border-amber-200 bg-amber-50 text-amber-700" },
  { status: "LEAVE", label: "Leave", short: "L", active: "border-sky-600 bg-sky-600 text-white", idle: "border-sky-200 bg-sky-50 text-sky-700" },
  { status: "HOLIDAY", label: "Paid Holiday", short: "PH", active: "border-violet-600 bg-violet-600 text-white", idle: "border-violet-200 bg-violet-50 text-violet-700" },
]
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const labourIdOf = (entry: Entry) => typeof entry.labourId === "string" ? entry.labourId : entry.labourId?._id || ""

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
      const selectedDate = new Date(date + "T00:00:00")
      const month = selectedDate.getMonth() + 1
      const year = selectedDate.getFullYear()
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
      const dayEntries = (attendanceResult.data || []).filter((entry) => entry.attendanceDate.slice(0, 10) === date)
      setLabours((labourResult.data || []).filter((labour) => labour.status === "ACTIVE"))
      setSites((siteResult.data || []).filter((site) => site.status === "ACTIVE"))
      setEntries(dayEntries)
      setDraft({})
      setSelected(new Set())
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance data could not be loaded.", "error")
    } finally { setLoading(false) }
  }, [date, showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const toggleAll = () => setSelected((current) => current.size === visible.length ? new Set() : new Set(visible.map((labour) => labour._id)))
  const bulkSet = (status: Status) => {
    const ids = selected.size ? selected : new Set(visible.map((labour) => labour._id))
    setDraft((current) => { const next = { ...current }; ids.forEach((id) => { next[id] = status }); return next })
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
    if (date > localDate(new Date())) {
      showToast("Future date attendance cannot be marked.", "error")
      return
    }
    const labourById = new Map(labours.map((labour) => [labour._id, labour]))
    const existingByLabour = new Map(entries.map((entry) => [labourIdOf(entry), entry]))
    const changes = [...new Set([...Object.keys(draft), ...Object.keys(otDraft)])].filter((labourId) => {
      const existing = existingByLabour.get(labourId)
      const overtime = otDraft[labourId]
      return Boolean(draft[labourId]) && (existing?.status !== draft[labourId] || Number(overtime?.hours || 0) !== Number(existing?.overtimeHours || 0))
    })
    if (!changes.length) { showToast("No attendance changes to submit.", "info"); return }
    const missingSite = changes.find((labourId) => draft[labourId] && !labourById.get(labourId)?.site?._id)
    if (missingSite) { showToast(`${labourById.get(missingSite)?.name || "Labour"} is not assigned to a site.`, "error"); return }

    setSaving(true)
    try {
      const results = await Promise.all(changes.map(async (labourId) => {
        const labour = labourById.get(labourId)!
        const existing = existingByLabour.get(labourId)
        const status = draft[labourId]
        const overtime = otDraft[labourId] || { hours: "" }

        if (!status && existing) {
          const response = await fetch(apiUrl(`/attendance/delete/${existing._id}`), {
            method: "DELETE",
            credentials: "include",
          })
          const result = await response.json() as Api<unknown>
          if (!response.ok || !result.success) throw new Error(result.message || `${labour.name}: attendance removal failed.`)
          return { labourId, deleted: true as const }
        }

        const response = await fetch(apiUrl(existing ? `/attendance/update/${existing._id}` : "/attendance/mark"), {
          method: existing ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing ? { status, overtimeHours: Number(overtime.hours || 0), overtimeAmount: null } : { labourId, siteId: labour.site!._id, attendanceDate: date, status, overtimeHours: Number(overtime.hours || 0), overtimeAmount: null, remarks: status === "HOLIDAY" ? "Paid holiday" : "" }),
        })
        const result = await response.json() as Api<Entry>
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || `${labour.name}: attendance save failed.`)
        return { labourId, deleted: false as const, entry: { ...result.data, labourId } }
      }))

      setEntries((current) => {
        let next = [...current]
        results.forEach((result) => {
          if (result.deleted) {
            next = next.filter((entry) => labourIdOf(entry) !== result.labourId)
            return
          }
          const index = next.findIndex((entry) => labourIdOf(entry) === result.labourId)
          if (index >= 0) next[index] = result.entry
          else next.push(result.entry)
        })
        return next
      })
      setSelected(new Set())
      setDraft({})
      setOtDraft({})
      setSiteId("")
      setQuery("")
      showToast(`${results.length} attendance changes submitted successfully.`, "success")
      router.replace("/pages/contractorpages/attendance")
      router.refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Attendance submission failed.", "error")
      await load()
    } finally { setSaving(false) }
  }

  const selectedDate = new Date(date + "T00:00:00")
  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar />
    <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Attendance / <span className="font-semibold text-indigo-600">Daily Logs</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Daily Attendance Management</h1><p className="mt-1 text-sm text-slate-500">{selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" })}</p></div><div className="flex gap-2"><Link href="/pages/contractorpages/attendance" className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600">View History</Link><button onClick={submit} disabled={saving || loading} className="h-10 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Submitting..." : "Submit Attendance"}</button></div></header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[["Total Labours", visible.length, "text-slate-900"], ["Present", counts.PRESENT, "text-emerald-600"], ["Absent", counts.ABSENT, "text-red-600"], ["Half Day", counts.HALF_DAY, "text-amber-600"], ["Paid Holiday", counts.HOLIDAY, "text-violet-600"], ["Pending", counts.PENDING, "text-orange-600"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><strong className={`mt-2 block text-2xl ${color}`}>{value}</strong></div>)}
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-3 xl:grid-cols-[1fr_180px_180px_auto]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, code or mobile..." className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" />
          <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setSelected(new Set()) }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="">All Sites</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.siteName}{site.siteCode ? ` (${site.siteCode})` : ""}</option>)}</select>
          <input type="date" max={localDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          <div className="flex flex-wrap gap-2"><button onClick={() => bulkSet("PRESENT")} className="h-10 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white">Mark All Present</button><button onClick={() => bulkSet("ABSENT")} className="h-10 rounded-md bg-red-50 px-3 text-xs font-bold text-red-600">Mark All Absent</button><button onClick={() => bulkSet("HOLIDAY")} className="h-10 rounded-md bg-violet-50 px-3 text-xs font-bold text-violet-700">Paid Holiday</button></div>
        </div>

        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={visible.length > 0 && selected.size === visible.length} onChange={toggleAll} /></th><th className="px-4 py-3">Labour Information</th><th className="px-4 py-3">Site &amp; Role</th><th className="px-4 py-3">Attendance Status</th><th className="min-w-32 px-4 py-3 text-center">OT Hours</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((labour) => <tr key={labour._id} className="hover:bg-slate-50"><td className="px-4 py-4"><input type="checkbox" checked={selected.has(labour._id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(labour._id)) next.delete(labour._id); else next.add(labour._id); return next })} /></td><td className="px-4 py-4"><strong className="block text-xs text-slate-900">{labour.name}</strong><span className="text-[9px] text-slate-400">{labour.labourCode} - {labour.mobile}</span></td><td className="px-4 py-4"><strong className="block text-xs text-slate-700">{labour.site?.siteName || "Not assigned"}</strong><span className="text-[9px] font-medium text-indigo-600">{labour.skillId?.skillName || "No skill"}</span></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{options.map((option) => <button key={option.status} onClick={() => toggleStatus(labour._id, option.status)} className={`min-w-20 rounded-md border px-3 py-2 text-[9px] font-bold transition ${draft[labour._id] === option.status ? option.active : option.idle}`}><span className="mr-1">{option.short}</span>{option.label}</button>)}</div></td><td className="px-4 py-4 text-center"><input aria-label={`${labour.name} OT hours`} type="number" min="0" step="0.5" value={otDraft[labour._id]?.hours || ""} onChange={(event) => { setOtDraft((current) => ({ ...current, [labour._id]: { hours: event.target.value } })); setDraft((current) => current[labour._id] ? current : { ...current, [labour._id]: "PRESENT" }) }} placeholder="0" className="h-9 w-24 rounded-md border border-cyan-200 px-2 text-center text-xs text-cyan-700 outline-none focus:border-cyan-500" /></td></tr>)}</tbody></table></div>
        {loading && <div className="p-12 text-center text-sm text-slate-500">Loading site labours and attendance...</div>}
        {!loading && !visible.length && <div className="p-12 text-center text-sm text-slate-500">No pending labours found. Attendance is already marked for this date or no active labour matches the filters.</div>}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] text-slate-500">Showing {visible.length} pending labours. Workers disappear after attendance is submitted and return automatically on the next date.</div>
      </section>
    </main>
  </div></div>
}
