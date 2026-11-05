"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Skill = {
  _id: string
  skillName: string
  defaultDailyWage?: number
}

type Site = {
  _id: string
  siteName: string
  siteCode?: string
  location?: string
  status: "ACTIVE" | "INACTIVE" | "COMPLETED"
}

type Labour = {
  _id: string
  labourCode: string
  name: string
  mobile: string
  gender: "MALE" | "FEMALE" | "OTHER"
  address?: string
  dob?: string | null
  dailyWage?: number | null
  finalDailyWage: number
  isPFApplicable?: boolean
  pfUanNumber?: string | null
  isESICApplicable?: boolean
  esicIpNumber?: string | null
  status: "ACTIVE" | "INACTIVE" | "BLOCKED"
  skillId: Skill | null
  site: Site | null
  createdAt: string
}

type AttendanceEntry = {
  _id: string
  labourId: string | { _id: string }
  attendanceDate: string
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY"
  wageAtThatDay: number
  overtimeAmount?: number
  remarks?: string
}

type PaymentEntry = {
  _id: string
  paymentDate: string
  month: number
  year: number
  amount: number
  paymentType: "ADVANCE" | "SALARY" | "BONUS" | "DEDUCTION" | "INCENTIVE"
  paymentMode: "CASH" | "BANK" | "UPI"
  remarks?: string
}

type AssignmentEntry = {
  _id: string
  assignedFrom: string
  assignedTo?: string | null
  status: "ACTIVE" | "COMPLETED" | "REMOVED"
  siteId: Site | null
}

type ListResponse<T> = {
  success: boolean
  data?: T[]
  message?: string
}

type LabourResponse = {
  success: boolean
  data?: Labour[] | Labour
  message?: string
}

type SkillResponse = {
  success: boolean
  data?: Skill[]
}

type SiteResponse = {
  success: boolean
  data?: Site[]
}

type LabourForm = {
  name: string
  mobile: string
  gender: Labour["gender"]
  skillId: string
  siteId: string
  address: string
  dailyWage: string
}

const PAGE_SIZE = 10
const emptyForm: LabourForm = { name: "", mobile: "", gender: "MALE", skillId: "", siteId: "", address: "", dailyWage: "" }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" })

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")

const LaboursPage = () => {
  const router = useRouter()
  const { showToast } = useToast()
  const [labours, setLabours] = useState<Labour[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"ALL" | Labour["status"]>("ALL")
  const [query, setQuery] = useState("")
  const [siteFilter, setSiteFilter] = useState("")
  const [skillFilter, setSkillFilter] = useState("")
  const [showFilter, setShowFilter] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLabour, setSelectedLabour] = useState<Labour | null>(null)
  const [detailAttendance, setDetailAttendance] = useState<AttendanceEntry[]>([])
  const [detailPayments, setDetailPayments] = useState<PaymentEntry[]>([])
  const [detailAssignments, setDetailAssignments] = useState<AssignmentEntry[]>([])
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [editingLabour, setEditingLabour] = useState<Labour | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [labourToDelete, setLabourToDelete] = useState<Labour | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [form, setForm] = useState<LabourForm>(emptyForm)

  useEffect(() => {
    const controller = new AbortController()

    const loadData = async () => {
      try {
        const [labourResponse, skillResponse, siteResponse] = await Promise.all([
          fetch(apiUrl("/labours/get-labours"), { credentials: "include", signal: controller.signal }),
          fetch(apiUrl("/skills/get-skilles"), { credentials: "include", signal: controller.signal }),
          fetch(apiUrl("/sites/get-sites"), { credentials: "include", signal: controller.signal }),
        ])
        const labourResult = (await labourResponse.json()) as LabourResponse
        const skillResult = (await skillResponse.json()) as SkillResponse
        const siteResult = (await siteResponse.json()) as SiteResponse

        if (!labourResponse.ok || !labourResult.success || !Array.isArray(labourResult.data)) {
          throw new Error(labourResult.message ?? "Labours could not be loaded.")
        }

        setLabours(labourResult.data)
        if (skillResponse.ok && skillResult.success && skillResult.data) setSkills(skillResult.data)
        if (siteResponse.ok && siteResult.success && siteResult.data) setSites(siteResult.data)
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") showToast(error.message, "error")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
    return () => controller.abort()
  }, [showToast])

  const filteredLabours = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return labours.filter((labour) => {
      const matchesStatus = activeFilter === "ALL" || labour.status === activeFilter
      const matchesSite = !siteFilter || labour.site?._id === siteFilter
      const matchesSkill = !skillFilter || labour.skillId?._id === skillFilter
      const matchesQuery = !normalizedQuery || [labour.name, labour.mobile, labour.labourCode, labour.address]
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
      return matchesStatus && matchesSite && matchesSkill && matchesQuery
    })
  }, [activeFilter, labours, query, siteFilter, skillFilter])

  const pageCount = Math.max(1, Math.ceil(filteredLabours.length / PAGE_SIZE))
  const visibleLabours = filteredLabours.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const paginationItems = useMemo<(number | string)[]>(() => {
    if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
    if (currentPage <= 3) return [1, 2, 3, "right-gap", pageCount]
    if (currentPage >= pageCount - 2) return [1, "left-gap", pageCount - 2, pageCount - 1, pageCount]
    return [1, "left-gap", currentPage, "right-gap", pageCount]
  }, [currentPage, pageCount])

  const activeCount = labours.filter((labour) => labour.status === "ACTIVE").length
  const inactiveCount = labours.filter((labour) => labour.status === "INACTIVE").length
  const blockedCount = labours.filter((labour) => labour.status === "BLOCKED").length
  const totalDailyWage = labours.reduce((total, labour) => total + (labour.finalDailyWage || 0), 0)

  const changeFilter = (filter: "ALL" | Labour["status"]) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }

  const openCreate = () => {
    router.push("/pages/contractorpages/labours/create")
  }

  const openEdit = (labour: Labour) => {
    if (labour._id) {
      router.push("/pages/contractorpages/labours/" + labour._id + "/edit")
      return
    }
    setEditingLabour(labour)
    setForm({
      name: labour.name,
      mobile: labour.mobile,
      gender: labour.gender,
      skillId: labour.skillId?._id ?? "",
      siteId: labour.site?._id ?? "",
      address: labour.address ?? "",
      dailyWage: labour.dailyWage?.toString() ?? "",
    })
    setIsFormOpen(true)
  }

  const openView = async (labour: Labour) => {
    if (labour._id) {
      router.push("/pages/contractorpages/labours/" + labour._id)
      return
    }
    setSelectedLabour(labour)
    setDetailAttendance([])
    setDetailPayments([])
    setDetailAssignments([])
    setIsDetailLoading(true)

    try {
      const now = new Date()
      const [detailResponse, attendanceResponse, paymentResponse, assignmentResponse] = await Promise.all([
        fetch(apiUrl(`/labours/get-labour/${labour._id}`), { credentials: "include" }),
        fetch(apiUrl(`/attendance/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`), { credentials: "include" }),
        fetch(apiUrl(`/labour-payments/labour/${labour._id}`), { credentials: "include" }),
        fetch(apiUrl(`/labour-site/labour/${labour._id}`), { credentials: "include" }),
      ])

      const detailResult = await detailResponse.json() as LabourResponse
      const attendanceResult = await attendanceResponse.json() as ListResponse<AttendanceEntry>
      const paymentResult = await paymentResponse.json() as ListResponse<PaymentEntry>
      const assignmentResult = await assignmentResponse.json() as ListResponse<AssignmentEntry>

      if (!detailResponse.ok || !detailResult.success || !detailResult.data || Array.isArray(detailResult.data)) {
        throw new Error(detailResult.message ?? "Labour details could not be loaded.")
      }

      const detailedLabour = detailResult.data
      setSelectedLabour((current) => current?._id === labour._id ? detailedLabour : current)
      if (attendanceResponse.ok && attendanceResult.success && attendanceResult.data) {
        setDetailAttendance(attendanceResult.data.filter((entry) => {
          const labourId = typeof entry.labourId === "string" ? entry.labourId : entry.labourId?._id
          return labourId === labour._id
        }))
      }
      if (paymentResponse.ok && paymentResult.success && paymentResult.data) setDetailPayments(paymentResult.data)
      if (assignmentResponse.ok && assignmentResult.success && assignmentResult.data) setDetailAssignments(assignmentResult.data)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Labour details could not be loaded.", "error")
    } finally {
      setIsDetailLoading(false)
    }
  }

  const closeForm = () => {
    if (isSubmitting) return
    setIsFormOpen(false)
    setEditingLabour(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const endpoint = editingLabour ? `/labours/update/${editingLabour._id}` : "/labours/create"
      const response = await fetch(apiUrl(endpoint), {
        method: editingLabour ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLabour
          ? {
              name: form.name,
              mobile: form.mobile,
              gender: form.gender,
              skillId: form.skillId,
              address: form.address,
              dailyWage: form.dailyWage ? Number(form.dailyWage) : null,
              ...(!editingLabour.site && form.siteId ? { siteId: form.siteId } : {}),
            }
          : { ...form, dailyWage: form.dailyWage ? Number(form.dailyWage) : null }),
      })
      const result = (await response.json()) as LabourResponse
      if (!response.ok || !result.success || !result.data || Array.isArray(result.data)) {
        throw new Error(result.message ?? "Labour could not be saved.")
      }

      const savedLabour = result.data as Labour
      setLabours((current) => editingLabour
        ? current.map((item) => item._id === savedLabour._id ? savedLabour : item)
        : [savedLabour, ...current])
      showToast(result.message ?? `Labour ${editingLabour ? "updated" : "added"} successfully.`, "success")
      setIsFormOpen(false)
      setEditingLabour(null)
      setForm(emptyForm)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Labour could not be saved.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (labour: Labour) => {
    setDeletingId(labour._id)
    try {
      const response = await fetch(apiUrl(`/labours/delete/${labour._id}`), { method: "DELETE", credentials: "include" })
      const result = (await response.json()) as LabourResponse
      if (!response.ok || !result.success) throw new Error(result.message ?? "Labour could not be deleted.")
      setLabours((current) => current.filter((item) => item._id !== labour._id))
      setLabourToDelete(null)
      showToast(result.message ?? "Labour deleted successfully.", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Delete failed.", "error")
    } finally {
      setDeletingId(null)
    }
  }

  const exportExcel = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (siteFilter) params.set("siteId", siteFilter)
      if (skillFilter) params.set("skillId", skillFilter)
      if (activeFilter !== "ALL") params.set("status", activeFilter)
      if (query.trim()) params.set("search", query.trim())

      const response = await fetch(apiUrl("/export/labours?" + params.toString()), {
        credentials: "include",
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(result?.message ?? "Labour export failed.")
      }

      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "Labours_Filtered.xlsx"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      showToast("Filtered labour Excel exported.", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Labour export failed.", "error")
    } finally {
      setIsExporting(false)
    }
  }

  const activeAssignment = detailAssignments.find((assignment) => assignment.status === "ACTIVE") ?? detailAssignments[0]
  const markedDays = detailAttendance.filter((entry) => entry.status !== "HOLIDAY")
  const presentUnits = detailAttendance.reduce((total, entry) => {
    if (entry.status === "PRESENT") return total + 1
    if (entry.status === "HALF_DAY") return total + 0.5
    return total
  }, 0)
  const attendanceRate = markedDays.length ? Math.round((presentUnits / markedDays.length) * 100) : 0
  const now = new Date()
  const currentMonthPayments = detailPayments.filter((payment) => payment.month === now.getMonth() + 1 && payment.year === now.getFullYear())
  const monthlyEarnings = currentMonthPayments.reduce((total, payment) => {
    if (payment.paymentType === "DEDUCTION") return total - payment.amount
    if (payment.paymentType === "ADVANCE") return total
    return total + payment.amount
  }, 0)
  const monthlyAdvance = currentMonthPayments
    .filter((payment) => payment.paymentType === "ADVANCE")
    .reduce((total, payment) => total + payment.amount, 0)
  const recentActivity = [
    ...detailAttendance.map((entry) => ({
      id: `attendance-${entry._id}`,
      date: entry.attendanceDate,
      type: "Attendance",
      site: selectedLabour?.site?.siteName ?? "-",
      status: entry.status,
      remark: entry.remarks || `${entry.status.replace("_", " ")} attendance`,
    })),
    ...detailPayments.map((payment) => ({
      id: `payment-${payment._id}`,
      date: payment.paymentDate,
      type: "Payment",
      site: "-",
      status: payment.paymentType,
      remark: payment.remarks || `${payment.paymentType}: ${money.format(payment.amount)} via ${payment.paymentMode}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">Dashboard / Workforce / <strong className="text-slate-700">Labours</strong></p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Labours Management</h1>
              <p className="mt-1 text-sm text-slate-500">Manage, track and verify your workforce across active sites.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowFilter((current) => !current)} className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <span className="text-base">&#8801;</span> Filter
              </button>
              <button type="button" onClick={exportExcel} disabled={isExporting} className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <span aria-hidden="true">&#8681;</span> {isExporting ? "Exporting..." : "Export Excel"}
              </button>
              <button type="button" onClick={openCreate} className="h-10 rounded-md bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800">+ Add Labour</button>
            </div>
          </header>

          {showFilter && (
            <div className="mt-4 grid gap-3 border-y border-slate-200 bg-white px-4 py-3 md:grid-cols-3">
              <label htmlFor="labour-search" className="sr-only">Search labours</label>
              <input id="labour-search" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Search name, mobile, code or address" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              <label className="sr-only" htmlFor="site-filter">Filter by site</label>
              <select id="site-filter" value={siteFilter} onChange={(event) => { setSiteFilter(event.target.value); setCurrentPage(1) }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500">
                <option value="">All sites</option>
                {sites.map((site) => <option key={site._id} value={site._id}>{site.siteName}{site.siteCode ? ` (${site.siteCode})` : ""}</option>)}
              </select>
              <label className="sr-only" htmlFor="skill-filter">Filter by skill</label>
              <select id="skill-filter" value={skillFilter} onChange={(event) => { setSkillFilter(event.target.value); setCurrentPage(1) }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500">
                <option value="">All skills</option>
                {skills.map((skill) => <option key={skill._id} value={skill._id}>{skill.skillName}</option>)}
              </select>
            </div>
          )}

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Labours", value: labours.length, note: `${activeCount} currently active`, color: "bg-indigo-100 text-indigo-700", icon: "L" },
              { label: "Active Workforce", value: activeCount, note: `${labours.length ? Math.round((activeCount / labours.length) * 100) : 0}% of total`, color: "bg-emerald-100 text-emerald-700", icon: "A" },
              { label: "Daily Wage Total", value: money.format(totalDailyWage), note: "Across all labours", color: "bg-sky-100 text-sky-700", icon: "INR" },
              { label: "Action Needed", value: inactiveCount + blockedCount, note: `${blockedCount} blocked accounts`, color: "bg-red-100 text-red-700", icon: "!" },
            ].map((card) => (
              <article key={card.label} className="min-h-36 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`flex h-9 min-w-9 w-fit items-center justify-center rounded px-2 text-xs font-bold ${card.color}`}>{card.icon}</div>
                <p className="mt-4 text-xs font-semibold uppercase text-slate-500">{card.label}</p>
                <strong className="mt-1 block text-xl text-slate-900">{isLoading ? "--" : card.value}</strong>
                <p className="mt-1 text-xs text-slate-400">{card.note}</p>
              </article>
            ))}
          </section>

          <section className="mt-7 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5 overflow-x-auto">
                {(["ALL", "ACTIVE", "INACTIVE", "BLOCKED"] as const).map((filter) => (
                  <button key={filter} type="button" onClick={() => changeFilter(filter)} className={`h-10 whitespace-nowrap border-b-2 px-1 text-xs font-semibold ${activeFilter === filter ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                    {filter === "ALL" ? "All Labours" : filter.charAt(0) + filter.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">Showing {filteredLabours.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filteredLabours.length)} of {filteredLabours.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1350px] text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr><th className="px-5 py-3">#</th><th className="px-5 py-3">Labour Code</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Site</th><th className="px-5 py-3">Mobile</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Daily Wage</th><th className="px-5 py-3">PF / UAN</th><th className="px-5 py-3">ESIC / IP</th><th className="px-5 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleLabours.map((labour, index) => (
                    <tr key={labour._id} className="text-sm hover:bg-slate-50">
                      <td className="px-5 py-4 text-xs text-slate-500">{String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(3, "0")}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-indigo-600">{labour.labourCode}</td>
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">{initials(labour.name)}</span><div><p className="font-semibold text-slate-800">{labour.name}</p><p className="text-xs text-slate-500">{labour.skillId?.skillName ?? "Skill not assigned"}</p></div></div></td>
                      <td className="px-5 py-4"><p className="text-xs font-medium text-slate-700">{labour.site?.siteName ?? "Site not assigned"}</p><p className="mt-1 text-xs text-slate-400">{labour.site?.siteCode ?? ""}</p></td>
                      <td className="px-5 py-4 text-xs text-slate-700">{labour.mobile}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${labour.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : labour.status === "INACTIVE" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{labour.status}</span></td>
                      <td className="px-5 py-4 font-semibold text-slate-800">{money.format(labour.finalDailyWage || 0)}</td><td className="px-5 py-4 text-xs font-semibold text-indigo-700">{labour.pfUanNumber || "-"}</td><td className="px-5 py-4 text-xs font-semibold text-sky-700">{labour.esicIpNumber || "-"}</td>
                      <td className="px-5 py-4"><div className="flex items-center justify-end gap-1">
                        <button type="button" aria-label="Worker ID Card & QR" title="Worker ID Card & QR" onClick={() => router.push(`/pages/contractorpages/labours/${labour._id}/id-card`)} className="flex h-9 w-9 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50">
                          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
                            <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M15 8h2m-2 4h2M6 16c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label="View labour" title="View labour" onClick={() => openView(labour)} className="flex h-9 w-9 items-center justify-center rounded text-indigo-600 hover:bg-indigo-50"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg></button>
                        <button type="button" aria-label="Edit labour" title="Edit labour" onClick={() => openEdit(labour)} className="flex h-9 w-9 items-center justify-center rounded text-slate-600 hover:bg-slate-100"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M14.5 5.5l4 4M4 20l3.8-.8L19 8a1.8 1.8 0 000-2.5l-.5-.5A1.8 1.8 0 0016 5L4.8 16.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                        <button type="button" aria-label="Delete labour" title="Delete labour" disabled={deletingId === labour._id} onClick={() => setLabourToDelete(labour)} className="flex h-9 w-9 items-center justify-center rounded text-red-600 hover:bg-red-50 disabled:opacity-40"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && !visibleLabours.length && <div className="px-5 py-14 text-center text-sm text-slate-500">No labours found.</div>}
              {isLoading && <div className="px-5 py-14 text-center text-sm text-slate-500">Loading labours...</div>}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">Rows per page: {PAGE_SIZE}</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40">&lt;</button>
                {paginationItems.map((item) => typeof item === "number" ? <button key={item} type="button" onClick={() => setCurrentPage(item)} aria-current={currentPage === item ? "page" : undefined} className={`flex h-8 min-w-8 items-center justify-center rounded px-2 text-xs ${currentPage === item ? "bg-indigo-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item}</button> : <span key={item} className="px-1 text-slate-500">...</span>)}
                <button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40">&gt;</button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {isFormOpen && editingLabour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="labour-form-title">
          <div className="w-full max-w-5xl rounded-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><p className="text-[10px] text-slate-500">Labours / <span className="font-semibold text-indigo-600">Edit Labour</span></p><div className="mt-1 flex items-baseline gap-2"><h2 id="labour-form-title" className="text-xl font-bold text-slate-900">Edit {editingLabour.name}</h2><span className="text-xs text-slate-400">#{editingLabour.labourCode}</span></div></div><button type="button" aria-label="Close" onClick={closeForm} className="text-2xl text-slate-400 hover:text-slate-700">&times;</button></div>
            <div className="grid gap-4 bg-[#f7f8fc] p-4 lg:grid-cols-[260px_1fr]">
              <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-400 text-2xl font-bold text-white shadow-md">{initials(form.name || editingLabour.name)}</div>
                  <h3 className="mt-3 font-bold text-slate-950">{form.name || editingLabour.name}</h3>
                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-bold text-emerald-700">{editingLabour.status}</span>
                </div>
                <dl className="mt-5 divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between gap-3 py-3"><dt className="text-[10px] uppercase text-slate-400">Labour Code</dt><dd className="font-semibold text-slate-700">{editingLabour.labourCode}</dd></div>
                  <div className="flex justify-between gap-3 py-3"><dt className="text-[10px] uppercase text-slate-400">Skill</dt><dd className="text-right font-semibold text-indigo-600">{skills.find((skill) => skill._id === form.skillId)?.skillName || "-"}</dd></div>
                  <div className="flex justify-between gap-3 py-3"><dt className="text-[10px] uppercase text-slate-400">Current Site</dt><dd className="text-right font-semibold text-slate-700">{editingLabour.site?.siteName || sites.find((site) => site._id === form.siteId)?.siteName || "Not assigned"}</dd></div>
                </dl>
              </aside>
            <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
              <div className="border-b border-slate-100 pb-3 sm:col-span-2"><h3 className="text-sm font-bold text-slate-900">Worker Information</h3><p className="mt-1 text-[10px] text-slate-400">Update personal, assignment and wage details.</p></div>
              <label className="text-xs font-semibold text-slate-600">Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Mobile<input required type="tel" inputMode="numeric" pattern="[0-9]+" title="Enter numbers only" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value.replace(/\D/g, "") })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Skill<select required value={form.skillId} onChange={(event) => setForm({ ...form, skillId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="">Select skill</option>{skills.map((skill) => <option key={skill._id} value={skill._id}>{skill.skillName}</option>)}</select></label>
              {editingLabour?.site ? (
                <label className="text-xs font-semibold text-slate-600">Assigned site<input readOnly value={editingLabour.site?.siteName ?? "Site not assigned"} className="mt-1 h-10 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-normal text-slate-600" /><span className="mt-1 block text-[11px] font-normal text-slate-400">Site cannot be changed after assignment.</span></label>
              ) : (
                <label className="text-xs font-semibold text-slate-600">Site<select required value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="">Select site</option>{sites.filter((site) => site.status === "ACTIVE").map((site) => <option key={site._id} value={site._id}>{site.siteName}{site.siteCode ? ` (${site.siteCode})` : ""}</option>)}</select>{editingLabour && <span className="mt-1 block text-[11px] font-normal text-slate-400">Once assigned, the site cannot be changed.</span>}</label>
              )}
              <label className="text-xs font-semibold text-slate-600">Gender<select required value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Labour["gender"] })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>
              <label className="text-xs font-semibold text-slate-600">Custom daily wage<input type="number" min="0" value={form.dailyWage} onChange={(event) => setForm({ ...form, dailyWage: event.target.value })} placeholder="Use skill default" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2"><button type="button" onClick={closeForm} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600">Cancel</button><button type="submit" disabled={isSubmitting} className="h-10 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? "Saving..." : "Save Changes"}</button></div>
            </form>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && !editingLabour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="labour-create-title">
          <div className="w-full max-w-xl rounded-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 id="labour-create-title" className="text-lg font-bold text-slate-900">Add Labour</h2><p className="text-xs text-slate-500">Enter workforce and wage details.</p></div><button type="button" aria-label="Close" onClick={closeForm} className="text-2xl text-slate-400 hover:text-slate-700">&times;</button></div>
            <form onSubmit={handleSubmit} className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Mobile<input required type="tel" inputMode="numeric" pattern="[0-9]+" title="Enter numbers only" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value.replace(/\D/g, "") })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Skill<select required value={form.skillId} onChange={(event) => setForm({ ...form, skillId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="">Select skill</option>{skills.map((skill) => <option key={skill._id} value={skill._id}>{skill.skillName}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-600">Site<select required value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="">Select site</option>{sites.filter((site) => site.status === "ACTIVE").map((site) => <option key={site._id} value={site._id}>{site.siteName}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-600">Gender<select required value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Labour["gender"] })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>
              <label className="text-xs font-semibold text-slate-600">Custom daily wage<input type="number" min="0" value={form.dailyWage} onChange={(event) => setForm({ ...form, dailyWage: event.target.value })} placeholder="Use skill default" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2"><button type="button" onClick={closeForm} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600">Cancel</button><button type="submit" disabled={isSubmitting} className="h-10 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? "Saving..." : "Add Labour"}</button></div>
            </form>
          </div>
        </div>
      )}

      {labourToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-labour-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) setLabourToDelete(null)
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h2 id="delete-labour-title" className="text-lg font-bold text-slate-900">Delete labour?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Are you sure you want to delete <strong className="text-slate-800">{labourToDelete.name}</strong>?
                    This labour will be removed from the active workforce directory.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                Attendance and payment history will remain stored, but this labour will no longer appear in active records.
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" disabled={Boolean(deletingId)} onClick={() => setLabourToDelete(null)} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={Boolean(deletingId)} onClick={() => handleDelete(labourToDelete)} className="flex min-w-32 items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                {deletingId ? "Deleting..." : "Delete Labour"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLabour && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="labour-details-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLabour(null) }}>
          <div className="mx-auto min-h-full w-full max-w-6xl rounded-lg bg-[#f7f8fc] shadow-2xl">
            <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] text-slate-500">Labours / <span className="font-semibold text-indigo-600">Labour Details</span></p>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <h2 id="labour-details-title" className="text-xl font-bold text-slate-950">{selectedLabour.name}</h2>
                  <span className="text-xs text-slate-400">#{selectedLabour.labourCode}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { const labour = selectedLabour; setSelectedLabour(null); openEdit(labour) }} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit Profile</button>
                <button type="button" aria-label="Close labour details" onClick={() => setSelectedLabour(null)} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-xl text-slate-500 hover:bg-slate-100">&times;</button>
              </div>
            </header>

            {isDetailLoading && <div className="h-1 overflow-hidden bg-indigo-100"><div className="h-full w-1/2 animate-pulse bg-indigo-600" /></div>}

            <div className="grid gap-4 p-4 lg:grid-cols-3">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-center">
                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-400 text-2xl font-bold text-white shadow-md">
                    {initials(selectedLabour.name)}
                    <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white ${selectedLabour.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"}`} />
                  </div>
                  <h3 className="mt-3 font-bold text-slate-950">{selectedLabour.name}</h3>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[9px] font-bold ${selectedLabour.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : selectedLabour.status === "INACTIVE" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{selectedLabour.status}</span>
                </div>
                <dl className="mt-5 divide-y divide-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[10px] uppercase text-slate-400">Joining Date</dt><dd className="font-semibold text-slate-700">{shortDate.format(new Date(activeAssignment?.assignedFrom || selectedLabour.createdAt))}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[10px] uppercase text-slate-400">Skill</dt><dd className="font-semibold text-indigo-600">{selectedLabour.skillId?.skillName || "-"}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[10px] uppercase text-slate-400">Current Site</dt><dd className="text-right font-semibold text-slate-700">{selectedLabour.site?.siteName || activeAssignment?.siteId?.siteName || "Not assigned"}</dd></div>
                  <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[10px] uppercase text-slate-400">Site Code</dt><dd className="font-semibold text-slate-700">{selectedLabour.site?.siteCode || activeAssignment?.siteId?.siteCode || "-"}</dd></div>
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Worker Information</h3>
                  <span className="text-[9px] text-slate-400">Updated from live API</span>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Contact Details</p>
                    <p className="mt-3 text-xs font-semibold text-slate-800">Mobile: {selectedLabour.mobile}</p>
                    <p className="mt-2 text-xs text-slate-500">Gender: <span className="font-medium text-slate-700">{selectedLabour.gender}</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-indigo-50 p-3"><p className="text-[9px] uppercase text-slate-400">Daily Wage</p><strong className="mt-1 block text-lg text-indigo-700">{money.format(selectedLabour.finalDailyWage || 0)}</strong></div>
                    <div className="rounded-md bg-slate-50 p-3"><p className="text-[9px] uppercase text-slate-400">Wage Type</p><strong className="mt-2 block text-xs text-slate-700">{selectedLabour.dailyWage != null ? "CUSTOM" : "SKILL BASED"}</strong></div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Address</p>
                    <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">{selectedLabour.address || "Address not added"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Work Location</p>
                    <div className="mt-2 flex min-h-16 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 text-center text-xs text-slate-500">{selectedLabour.site?.location || activeAssignment?.siteId?.location || "Site location not available"}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Attendance This Month</p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(#10b981 ${attendanceRate * 3.6}deg, #e2e8f0 0deg)` }}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-800">{attendanceRate}%</div>
                  </div>
                  <div className="text-right"><p className="text-xs font-semibold text-emerald-600">{attendanceRate >= 90 ? "Excellent" : attendanceRate >= 75 ? "Good" : attendanceRate ? "Needs attention" : "No records"}</p><p className="mt-1 text-[10px] text-slate-400">Current month</p></div>
                </div>
                <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-[10px]"><span className="text-slate-400">Present Units</span><strong className="text-slate-700">{presentUnits} / {markedDays.length}</strong></div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Earnings This Month</p>
                <strong className="mt-3 block text-2xl text-indigo-700">{money.format(monthlyEarnings)}</strong>
                <p className="mt-1 text-[10px] text-emerald-600">{currentMonthPayments.filter((payment) => payment.paymentType !== "ADVANCE").length} earning entries</p>
                <div className="mt-5 flex h-12 items-end gap-2" aria-hidden="true">
                  {[35, 55, 42, 75, 58, 90, 62].map((height, index) => <span key={index} className={`flex-1 rounded-t ${index % 2 ? "bg-indigo-600" : "bg-indigo-200"}`} style={{ height: `${height}%` }} />)}
                </div>
              </section>

              <section className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-sm">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-indigo-100">Advance This Month</p>
                <strong className="mt-3 block text-2xl">{money.format(monthlyAdvance)}</strong>
                <p className="mt-2 text-[10px] text-indigo-100">{currentMonthPayments.filter((payment) => payment.paymentType === "ADVANCE").length} advance entries</p>
                <div className="mt-5 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-center text-xs font-semibold">Payment data from API</div>
              </section>

              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-3">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">Recent Activity Log</h3><span className="text-[10px] text-slate-400">Attendance & Payments</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Site</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Remark</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentActivity.map((activity) => (
                        <tr key={activity.id} className="text-xs">
                          <td className="px-5 py-3 text-slate-600">{shortDate.format(new Date(activity.date))}</td>
                          <td className="px-5 py-3 font-medium text-slate-800">{activity.type}</td>
                          <td className="px-5 py-3 text-slate-500">{activity.site}</td>
                          <td className="px-5 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-semibold text-indigo-700">{activity.status.replace("_", " ")}</span></td>
                          <td className="max-w-xs truncate px-5 py-3 text-right text-[10px] text-slate-500">{activity.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!isDetailLoading && !recentActivity.length && <div className="px-5 py-10 text-center text-xs text-slate-500">No attendance or payment activity found for this labour.</div>}
                  {isDetailLoading && <div className="px-5 py-10 text-center text-xs text-slate-500">Loading labour activity...</div>}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LaboursPage

