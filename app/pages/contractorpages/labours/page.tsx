"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
  data?: Labour | Labour[]
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

const LaboursPage = () => {
  const router = useRouter()
  const { showToast } = useToast()
  const [labours, setLabours] = useState<Labour[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("userRole") || "CONTRACTOR"
    }
    return "CONTRACTOR"
  })
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

  // Load user role to toggle mobile supervisor view
  useEffect(() => {
    const cachedRole = localStorage.getItem("userRole")
    if (cachedRole) setUserRole(cachedRole)

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
      const matchesQuery =
        !normalizedQuery ||
        [labour.name, labour.mobile, labour.labourCode, labour.address].some((value) =>
          value?.toLowerCase().includes(normalizedQuery)
        )
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
  }

  const openView = async (labour: Labour) => {
    if (labour._id) {
      router.push("/pages/contractorpages/labours/" + labour._id)
      return
    }
  }

  const handleDelete = async (labour: Labour) => {
    setDeletingId(labour._id)
    try {
      const response = await fetch(apiUrl(`/labours/delete/${labour._id}`), {
        method: "DELETE",
        credentials: "include",
      })
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
        const result = (await response.json().catch(() => null)) as { message?: string } | null
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

  const isSupervisor = userRole === "SUPERVISOR"

  return (
    <div className="flex min-h-screen bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-24">
        <Navbar />

        <main className="mx-auto w-full max-w-7xl p-3 sm:p-5 lg:p-7">
          {/* ========================================================= */}
          {/* 1. SUPERVISOR MOBILE APP WORKFORCE VIEW                   */}
          {/* ========================================================= */}
          {isSupervisor ? (
            <div className="space-y-4">
              {/* App-like Top Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-[#07162b] to-[#122844] p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                      Workforce Directory
                    </span>
                    <h1 className="text-xl font-black tracking-tight text-white">Labours &amp; Workers</h1>
                    <p className="text-xs text-slate-300">
                      {labours.length} Total Workers enrolled under your contractor
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="flex h-11 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
                  >
                    <span className="text-base font-bold">+</span>
                    <span>Add Labour</span>
                  </button>
                </div>

                {/* Quick App Metric Pills */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => changeFilter("ALL")}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      activeFilter === "ALL" ? "border-emerald-400 bg-white/20 shadow-sm" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-[9px] uppercase font-bold text-slate-300">All Labours</p>
                    <p className="text-base font-black text-white">{labours.length}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => changeFilter("ACTIVE")}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      activeFilter === "ACTIVE" ? "border-emerald-400 bg-white/20 shadow-sm" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-[9px] uppercase font-bold text-emerald-400">Active</p>
                    <p className="text-base font-black text-emerald-400">{activeCount}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => changeFilter("INACTIVE")}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      activeFilter === "INACTIVE" ? "border-amber-400 bg-white/20 shadow-sm" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-[9px] uppercase font-bold text-amber-300">Inactive</p>
                    <p className="text-base font-black text-amber-300">{inactiveCount + blockedCount}</p>
                  </button>
                </div>
              </div>

              {/* Mobile Search & Site Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Search name, code or mobile..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-emerald-500 shadow-xs"
                  />
                  <span className="absolute left-3 top-3 text-sm text-slate-400">🔍</span>
                </div>

                <select
                  value={siteFilter}
                  onChange={(e) => {
                    setSiteFilter(e.target.value)
                    setCurrentPage(1)
                  }}
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

              {/* Mobile Worker Cards List */}
              <div className="space-y-3">
                {isLoading && (
                  <div className="rounded-2xl bg-white p-8 text-center text-xs text-slate-400">Loading workforce...</div>
                )}

                {!isLoading && filteredLabours.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <p className="text-sm font-bold text-slate-700">No workers found</p>
                    <p className="mt-1 text-xs text-slate-400">Search ya filter change karke dekhein.</p>
                  </div>
                )}

                {!isLoading &&
                  filteredLabours.map((labour) => (
                    <div
                      key={labour._id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md transition-all"
                    >
                      {/* Top Row: Avatar, Name, Status Badge */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 font-black text-white text-base shadow-sm">
                            {initials(labour.name)}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 leading-tight">{labour.name}</h3>
                            <span className="font-mono text-xs font-bold text-emerald-600">{labour.labourCode}</span>
                            <p className="text-[11px] text-slate-500">
                              {labour.skillId?.skillName ?? "General Worker"}{" "}
                              {labour.site ? `• ${labour.site.siteName}` : ""}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            labour.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : labour.status === "INACTIVE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {labour.status}
                        </span>
                      </div>

                      {/* Middle Details Box */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Mobile Number</span>
                          <p className="font-mono font-semibold text-slate-800 mt-0.5">{labour.mobile}</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400">Daily Wage</span>
                          <p className="font-mono font-bold text-slate-900 mt-0.5">
                            {money.format(labour.finalDailyWage || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons: ID Card, Details, Edit */}
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        {/* ID Card & QR Badge Button */}
                        <Link
                          href={`/pages/contractorpages/labours/${labour._id}/id-card`}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="16" rx="3" />
                            <circle cx="9" cy="10" r="2" />
                            <path d="M15 8h2m-2 4h2M6 16c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5" />
                          </svg>
                          <span>ID Card / QR</span>
                        </Link>

                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => openView(labour)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-600 hover:bg-slate-50 transition-colors"
                          title="View Details"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                        </button>

                        {/* Edit Worker Button */}
                        <button
                          type="button"
                          onClick={() => openEdit(labour)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                          title="Edit Worker"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14.5 5.5l4 4M4 20l3.8-.8L19 8a1.8 1.8 0 000-2.5l-.5-.5A1.8 1.8 0 0016 5L4.8 16.2 4 20Z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* 2. CONTRACTOR DESKTOP LABOURS VIEW (PRESERVED)            */
            /* ========================================================= */
            <>
              <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    Dashboard / Workforce / <strong className="text-slate-700">Labours</strong>
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-slate-900">Labours Management</h1>
                  <p className="mt-1 text-sm text-slate-500">Manage, track and verify your workforce across active sites.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilter((current) => !current)}
                    className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span className="text-base">&#8801;</span> Filter
                  </button>
                  <button
                    type="button"
                    onClick={exportExcel}
                    disabled={isExporting}
                    className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span aria-hidden="true">&#8681;</span> {isExporting ? "Exporting..." : "Export Excel"}
                  </button>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="h-10 rounded-md bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800"
                  >
                    + Add Labour
                  </button>
                </div>
              </header>

              {showFilter && (
                <div className="mt-4 grid gap-3 border-y border-slate-200 bg-white px-4 py-3 md:grid-cols-3">
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Search name, mobile, code or address"
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                  <select
                    value={siteFilter}
                    onChange={(event) => {
                      setSiteFilter(event.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">All sites</option>
                    {sites.map((site) => (
                      <option key={site._id} value={site._id}>
                        {site.siteName}
                        {site.siteCode ? ` (${site.siteCode})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    value={skillFilter}
                    onChange={(event) => {
                      setSkillFilter(event.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">All skills</option>
                    {skills.map((skill) => (
                      <option key={skill._id} value={skill._id}>
                        {skill.skillName}
                      </option>
                    ))}
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
                    <div className={`flex h-9 min-w-9 w-fit items-center justify-center rounded px-2 text-xs font-bold ${card.color}`}>
                      {card.icon}
                    </div>
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
                      <button
                        key={filter}
                        type="button"
                        onClick={() => changeFilter(filter)}
                        className={`h-10 whitespace-nowrap border-b-2 px-1 text-xs font-semibold ${
                          activeFilter === filter
                            ? "border-indigo-600 text-indigo-700"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {filter === "ALL" ? "All Labours" : filter.charAt(0) + filter.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">
                    Showing {filteredLabours.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-
                    {Math.min(currentPage * PAGE_SIZE, filteredLabours.length)} of {filteredLabours.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1350px] text-left">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="px-5 py-3">#</th>
                        <th className="px-5 py-3">Labour Code</th>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Site</th>
                        <th className="px-5 py-3">Mobile</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Daily Wage</th>
                        <th className="px-5 py-3">PF / UAN</th>
                        <th className="px-5 py-3">ESIC / IP</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleLabours.map((labour, index) => (
                        <tr key={labour._id} className="text-sm hover:bg-slate-50">
                          <td className="px-5 py-4 text-xs text-slate-500">
                            {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(3, "0")}
                          </td>
                          <td className="px-5 py-4 text-xs font-semibold text-indigo-600">{labour.labourCode}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">
                                {initials(labour.name)}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-800">{labour.name}</p>
                                <p className="text-xs text-slate-500">{labour.skillId?.skillName ?? "Skill not assigned"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs font-medium text-slate-700">
                              {labour.site?.siteName ?? "Site not assigned"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">{labour.site?.siteCode ?? ""}</p>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-700">{labour.mobile}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                labour.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : labour.status === "INACTIVE"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {labour.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-800">
                            {money.format(labour.finalDailyWage || 0)}
                          </td>
                          <td className="px-5 py-4 text-xs font-semibold text-indigo-700">{labour.pfUanNumber || "-"}</td>
                          <td className="px-5 py-4 text-xs font-semibold text-sky-700">{labour.esicIpNumber || "-"}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Worker ID Card & QR"
                                onClick={() => router.push(`/pages/contractorpages/labours/${labour._id}/id-card`)}
                                className="flex h-9 w-9 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50"
                              >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                  <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
                                  <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" />
                                  <path d="M15 8h2m-2 4h2M6 16c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="View labour"
                                onClick={() => openView(labour)}
                                className="flex h-9 w-9 items-center justify-center rounded text-indigo-600 hover:bg-indigo-50"
                              >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                  <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8" />
                                  <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Edit labour"
                                onClick={() => openEdit(labour)}
                                className="flex h-9 w-9 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
                              >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                  <path d="M14.5 5.5l4 4M4 20l3.8-.8L19 8a1.8 1.8 0 000-2.5l-.5-.5A1.8 1.8 0 0016 5L4.8 16.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!isLoading && !visibleLabours.length && (
                    <div className="px-5 py-14 text-center text-sm text-slate-500">No labours found.</div>
                  )}
                  {isLoading && (
                    <div className="px-5 py-14 text-center text-sm text-slate-500">Loading labours...</div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-slate-500">Rows per page: {PAGE_SIZE}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((page) => page - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40"
                    >
                      &lt;
                    </button>
                    {paginationItems.map((item) =>
                      typeof item === "number" ? (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          className={`flex h-8 min-w-8 items-center justify-center rounded px-2 text-xs ${
                            currentPage === item ? "bg-indigo-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {item}
                        </button>
                      ) : (
                        <span key={item} className="px-1 text-slate-500">
                          ...
                        </span>
                      )
                    )}
                    <button
                      type="button"
                      disabled={currentPage === pageCount}
                      onClick={() => setCurrentPage((page) => page + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default LaboursPage
