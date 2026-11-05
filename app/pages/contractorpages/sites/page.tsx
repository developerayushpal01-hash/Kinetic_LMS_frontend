"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type SiteStatus = "ACTIVE" | "INACTIVE" | "COMPLETED"

type Site = {
  _id: string
  siteName: string
  siteCode?: string
  clientName?: string
  contactMobile?: string
  contactEmail?: string
  projectValue?: number
  location?: string
  clientGstNumber?: string
  addressLine?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
  billingCycleStartDay?: number
  billingCycleEndDay?: number
  startDate?: string | null
  endDate?: string | null
  status: SiteStatus
  createdAt: string
}

type SiteResponse = {
  success: boolean
  data?: Site[] | Site
  message?: string
}

type SiteForm = {
  siteName: string
  clientName: string
  contactMobile: string
  contactEmail: string
  clientGstNumber: string
  addressLine: string
  city: string
  district: string
  state: string
  pincode: string
  billingCycleStartDay: string
  billingCycleEndDay: string
  projectValue: string
  location: string
  startDate: string
  endDate: string
  status: SiteStatus
}

const emptyForm: SiteForm = {
  siteName: "", clientName: "", contactMobile: "", contactEmail: "", clientGstNumber: "", addressLine: "", city: "", district: "", state: "", pincode: "", billingCycleStartDay: "1", billingCycleEndDay: "0", projectValue: "", location: "", startDate: "", endDate: "", status: "ACTIVE",
}
const PAGE_SIZE = 8
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const compactCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
})

const statusStyle: Record<SiteStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETED: "border-slate-200 bg-slate-100 text-slate-600",
}

const toDateInput = (value?: string | null) => value ? value.slice(0, 10) : ""

const SitesPage = () => {
  const router = useRouter()
  const { showToast } = useToast()
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | SiteStatus>("ALL")
  const [sortBy, setSortBy] = useState<"NEWEST" | "NAME" | "VALUE">("NEWEST")
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [form, setForm] = useState<SiteForm>(emptyForm)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadSites = async () => {
      try {
        const response = await fetch(apiUrl("/sites/get-sites"), {
          credentials: "include",
          signal: controller.signal,
        })
        const result = await response.json() as SiteResponse
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.message ?? "Sites could not be loaded.")
        }
        setSites(result.data)
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          showToast(error.message, "error")
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadSites()
    return () => controller.abort()
  }, [showToast])

  const filteredSites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = sites.filter((site) => {
      const matchesStatus = statusFilter === "ALL" || site.status === statusFilter
      const matchesQuery = !normalizedQuery || [
        site.siteName,
        site.siteCode,
        site.location,
        site.clientName,
        site.contactMobile,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))

      return matchesStatus && matchesQuery
    })

    return [...result].sort((a, b) => {
      if (sortBy === "NAME") return a.siteName.localeCompare(b.siteName)
      if (sortBy === "VALUE") return (b.projectValue || 0) - (a.projectValue || 0)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [query, sites, sortBy, statusFilter])

  const activeSites = sites.filter((site) => site.status === "ACTIVE").length
  const totalValue = sites.reduce((total, site) => total + (site.projectValue || 0), 0)
  const today = new Date()
  const urgentSites = sites.filter((site) => {
    if (site.status !== "ACTIVE" || !site.endDate) return false
    const daysLeft = (new Date(site.endDate).getTime() - today.getTime()) / 86400000
    return daysLeft >= 0 && daysLeft <= 30
  }).length

  const pageCount = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE))
  const visibleSites = filteredSites.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openCreate = () => {
    setEditingSite(null)
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  const openEdit = (site: Site) => {
    if (site._id) {
      router.push("/pages/contractorpages/sites/" + site._id + "/edit")
      return
    }
    setEditingSite(site)
    setForm({
      siteName: site.siteName,
      clientName: site.clientName ?? "",
      contactMobile: site.contactMobile ?? "",
      contactEmail: site.contactEmail ?? "",
      clientGstNumber: site.clientGstNumber ?? "",
      addressLine: site.addressLine ?? "",
      city: site.city ?? "",
      district: site.district ?? "",
      state: site.state ?? "",
      pincode: site.pincode ?? "",
      billingCycleStartDay: String(site.billingCycleStartDay ?? 1),
      billingCycleEndDay: String(site.billingCycleEndDay ?? 0),
      projectValue: site.projectValue?.toString() ?? "",
      location: site.location ?? "",
      startDate: toDateInput(site.startDate),
      endDate: toDateInput(site.endDate),
      status: site.status,
    })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSubmitting) return
    setIsFormOpen(false)
    setEditingSite(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const endpoint = editingSite ? `/sites/update/${editingSite._id}` : "/sites/create"
      const response = await fetch(apiUrl(endpoint), {
        method: editingSite ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          location: [form.addressLine, form.city, form.district, form.state, form.pincode].filter(Boolean).join(", ") || form.location,
          billingCycleStartDay: Number(form.billingCycleStartDay || 1),
          billingCycleEndDay: Number(form.billingCycleEndDay || 0),
          projectValue: form.projectValue ? Number(form.projectValue) : 0,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      })
      const result = await response.json() as SiteResponse

      if (!response.ok || !result.success || !result.data || Array.isArray(result.data)) {
        throw new Error(result.message ?? "Site could not be saved.")
      }

      const savedSite = result.data
      setSites((current) => editingSite
        ? current.map((site) => site._id === savedSite._id ? savedSite : site)
        : [savedSite, ...current])
      showToast(result.message ?? "Site saved successfully.", "success")
      setIsFormOpen(false)
      setEditingSite(null)
      setForm(emptyForm)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Site could not be saved.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (site: Site) => {
    setDeletingId(site._id)

    try {
      const response = await fetch(apiUrl(`/sites/delete/${site._id}`), {
        method: "DELETE",
        credentials: "include",
      })
      const result = await response.json() as SiteResponse
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Site could not be deleted.")
      }
      setSites((current) => current.filter((item) => item._id !== site._id))
      setCurrentPage(1)
      setSiteToDelete(null)
      showToast(result.message ?? "Site deleted successfully.", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Site deletion failed.", "error")
    } finally {
      setDeletingId(null)
    }
  }

  const cycleSort = () => {
    setSortBy((current) => current === "NEWEST" ? "NAME" : current === "NAME" ? "VALUE" : "NEWEST")
    setCurrentPage(1)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">Dashboard / Projects / <strong className="text-slate-700">Sites</strong></p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">Site Directory</h1>
              <p className="mt-1 text-sm text-slate-500">Manage active infrastructure projects and workforce allocation.</p>
            </div>
            <button type="button" onClick={openCreate} className="h-10 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">
              + Add New Site
            </button>
          </header>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Sites", value: sites.length, note: "All registered projects", icon: "S", color: "bg-indigo-50 text-indigo-700" },
              { label: "Active Progress", value: activeSites, note: "Projects in progress", icon: "A", color: "bg-amber-50 text-amber-600" },
              { label: "Total Value", value: compactCurrency.format(totalValue), note: "Combined project value", icon: "Rs", color: "bg-emerald-50 text-emerald-700" },
              { label: "Urgent Alerts", value: urgentSites, note: "Ending within 30 days", icon: "!", color: "bg-red-50 text-red-600" },
            ].map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
                    <strong className="mt-4 block text-2xl text-slate-950">{isLoading ? "--" : card.value}</strong>
                  </div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${card.color}`}>{card.icon}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{card.note}</p>
              </article>
            ))}
          </section>

          <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowFilters((current) => !current)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Filter</button>
                <button type="button" onClick={cycleSort} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sort: {sortBy.toLowerCase()}</button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Search sites..." className="h-9 w-full rounded-md border border-slate-300 px-3 text-xs outline-none focus:border-indigo-500 sm:w-64" />
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] text-slate-500">Showing {filteredSites.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filteredSites.length)} of {filteredSites.length}</span>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                {(["ALL", "ACTIVE", "INACTIVE", "COMPLETED"] as const).map((status) => (
                  <button key={status} type="button" onClick={() => { setStatusFilter(status); setCurrentPage(1) }} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${statusFilter === status ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                    {status === "ALL" ? "All Sites" : status}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Name & Location</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSites.map((site, index) => (
                    <tr key={site._id} className="text-sm hover:bg-slate-50">
                      <td className="px-5 py-4 text-xs text-slate-500">{String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-lg text-white shadow-sm">S</span>
                          <div>
                            <p className="font-semibold text-slate-900">{site.siteName}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{site.location || "Location not added"}</p>
                            {site.siteCode && <p className="mt-0.5 text-[10px] font-medium text-indigo-600">{site.siteCode}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-medium text-slate-800">{site.clientName || "-"}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{site.contactMobile || "-"}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{site.contactEmail || ""}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${statusStyle[site.status]}`}>{site.status}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" aria-label="View site" title="View site" onClick={() => router.push("/pages/contractorpages/sites/" + site._id)} className="flex h-9 w-9 items-center justify-center rounded text-indigo-600 hover:bg-indigo-50"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg></button>
                          <button type="button" aria-label="Edit site" title="Edit site" onClick={() => openEdit(site)} className="flex h-9 w-9 items-center justify-center rounded text-slate-600 hover:bg-slate-100"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M14.5 5.5l4 4M4 20l3.8-.8L19 8a1.8 1.8 0 000-2.5l-.5-.5A1.8 1.8 0 0016 5L4.8 16.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                          <button type="button" aria-label="Delete site" title="Delete site" disabled={deletingId === site._id} onClick={() => setSiteToDelete(site)} className="flex h-9 w-9 items-center justify-center rounded text-red-600 hover:bg-red-50 disabled:opacity-40"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isLoading && <div className="px-5 py-16 text-center text-sm text-slate-500">Loading sites...</div>}
              {!isLoading && !visibleSites.length && <div className="px-5 py-16 text-center text-sm text-slate-500">No sites found.</div>}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <span className="text-[10px] text-slate-500">Showing {visibleSites.length} entries on this page</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="h-8 w-8 rounded border border-slate-300 text-xs disabled:opacity-40">&lt;</button>
                <span className="flex h-8 min-w-8 items-center justify-center rounded bg-indigo-700 px-2 text-xs font-semibold text-white">{currentPage}</span>
                <button type="button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)} className="h-8 w-8 rounded border border-slate-300 text-xs disabled:opacity-40">&gt;</button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="site-form-title">
          <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-xl bg-[#f7f8fc] shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div><p className="text-[10px] text-slate-500">Dashboard / Sites / <span className="font-semibold text-indigo-600">{editingSite ? "Edit Site" : "Add New Site"}</span></p><h2 id="site-form-title" className="mt-1 text-xl font-bold text-slate-950">{editingSite ? `Edit ${editingSite.siteName}` : "Register New Construction Site"}</h2><p className="mt-1 text-xs text-slate-500">Establish a new site project, define timelines, and assign core project details.</p></div>
              <div className="flex items-center gap-2"><button type="button" onClick={closeForm} className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button form="site-project-form" type="submit" disabled={isSubmitting} className="h-9 rounded-md bg-indigo-700 px-4 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{isSubmitting ? "Saving..." : editingSite ? "Save Changes" : "Save Project"}</button><button type="button" aria-label="Close" onClick={closeForm} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-xl text-slate-400 hover:text-slate-700">&times;</button></div>
            </div>
            <form id="site-project-form" onSubmit={handleSubmit} className="grid gap-4 p-4 lg:grid-cols-[1fr_300px]">
              <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">i</span><div><h3 className="text-sm font-bold text-slate-900">General Information</h3><p className="text-[10px] text-slate-400">Project, client and contact details</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Site name *<input required value={form.siteName} onChange={(event) => setForm({ ...form, siteName: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Client GST Number<input value={form.clientGstNumber} onChange={(event) => setForm({ ...form, clientGstNumber: event.target.value.toUpperCase() })} placeholder="23ABCDE1234F1Z5" maxLength={15} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Address line *<input required value={form.addressLine} onChange={(event) => setForm({ ...form, addressLine: event.target.value })} placeholder="Building, street, area" className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-600">City *<input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-600">District *<input required value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-600">State *<input required value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label><label className="text-xs font-semibold text-slate-600">PIN Code *<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value.replace(/\D/g, "") })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Billing From Day *<select value={form.billingCycleStartDay} onChange={(event) => setForm({ ...form, billingCycleStartDay: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal">{Array.from({length:31},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Billing To Day *<select value={form.billingCycleEndDay} onChange={(event) => setForm({ ...form, billingCycleEndDay: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal"><option value="0">Month End</option>{Array.from({length:31},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label>              <label className="text-xs font-semibold text-slate-600">Client name *<input required value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Contact mobile *<input required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.contactMobile} onChange={(event) => setForm({ ...form, contactMobile: event.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Contact email *<input required type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">Project value *<input required type="number" min="0" value={form.projectValue} onChange={(event) => setForm({ ...form, projectValue: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-100 text-sky-700">T</span><div><h3 className="text-sm font-bold text-slate-900">Timeline &amp; Status</h3><p className="text-[10px] text-slate-400">Project schedule and operational state</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Start date *<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600">End date<input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Operational status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SiteStatus })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="COMPLETED">Completed</option></select></label>
              </div>
              </section>
              </div>

              <aside className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">O</span><div><h3 className="text-sm font-bold text-slate-900">Project Overview</h3><p className="text-[10px] text-slate-400">Live registration preview</p></div></div>
                  <dl className="mt-4 divide-y divide-slate-100 text-xs">
                    <div className="py-3"><dt className="text-[9px] uppercase tracking-wide text-slate-400">Site name</dt><dd className="mt-1 font-semibold text-slate-700">{form.siteName || "New construction site"}</dd></div>
                    <div className="py-3"><dt className="text-[9px] uppercase tracking-wide text-slate-400">Client</dt><dd className="mt-1 font-semibold text-slate-700">{form.clientName || "Not entered"}</dd></div>
                    <div className="py-3"><dt className="text-[9px] uppercase tracking-wide text-slate-400">Project value</dt><dd className="mt-1 font-semibold text-indigo-700">{form.projectValue ? currency.format(Number(form.projectValue)) : "Not entered"}</dd></div>
                    <div className="py-3"><dt className="text-[9px] uppercase tracking-wide text-slate-400">Status</dt><dd className="mt-1"><span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">{form.status}</span></dd></div>
                  </dl>
                </section>
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400"><span className="rounded-md bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow">Auto-detecting Coordinates...</span></div>
                  <div className="p-4"><h3 className="text-xs font-bold text-slate-900">Geographical Context</h3><p className="mt-2 text-[10px] leading-5 text-slate-500">{form.location || "The site address will be used to estimate project coordinates."}</p></div>
                </section>
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Designer Tip</p><p className="mt-2 text-[10px] leading-5 text-slate-500">Use a clear site name and complete location so workforce reports remain accurate.</p></section>
              </aside>
            </form>
          </div>
        </div>
      )}

      {siteToDelete && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-site-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingId) setSiteToDelete(null) }}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <div><h2 id="delete-site-title" className="text-lg font-bold text-slate-900">Delete site?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Are you sure you want to delete <strong className="text-slate-800">{siteToDelete.siteName}</strong>? This site will be removed from the active site directory.</p></div>
              </div>
              <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">Please confirm carefully. Site deletion may be blocked when active labour or project records are linked to it.</div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" disabled={Boolean(deletingId)} onClick={() => setSiteToDelete(null)} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={Boolean(deletingId)} onClick={() => handleDelete(siteToDelete)} className="flex min-w-28 items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deletingId ? "Deleting..." : "Delete Site"}</button>
            </div>
          </div>
        </div>
      )}

      {selectedSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="site-details-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSite(null) }}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-emerald-400 text-xl text-white">S</span><div><h2 id="site-details-title" className="font-bold text-slate-950">{selectedSite.siteName}</h2><p className="text-xs font-medium text-indigo-600">{selectedSite.siteCode || "No site code"}</p></div></div>
              <button type="button" onClick={() => setSelectedSite(null)} className="text-2xl text-slate-400">&times;</button>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-slate-400">Location</dt><dd className="mt-1 font-medium text-slate-700">{selectedSite.location || "-"}</dd></div>
              <div><dt className="text-xs text-slate-400">Status</dt><dd className="mt-1 font-medium text-slate-700">{selectedSite.status}</dd></div>
              <div><dt className="text-xs text-slate-400">Client</dt><dd className="mt-1 font-medium text-slate-700">{selectedSite.clientName || "-"}</dd></div>
              <div><dt className="text-xs text-slate-400">Project value</dt><dd className="mt-1 font-medium text-slate-700">{currency.format(selectedSite.projectValue || 0)}</dd></div>
              <div><dt className="text-xs text-slate-400">Mobile</dt><dd className="mt-1 font-medium text-slate-700">{selectedSite.contactMobile || "-"}</dd></div>
              <div><dt className="text-xs text-slate-400">Start date</dt><dd className="mt-1 font-medium text-slate-700">{toDateInput(selectedSite.startDate) || "-"}</dd></div>
              <div><dt className="text-xs text-slate-400">End date</dt><dd className="mt-1 font-medium text-slate-700">{toDateInput(selectedSite.endDate) || "-"}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-slate-400">Email</dt><dd className="mt-1 font-medium text-slate-700">{selectedSite.contactEmail || "-"}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default SitesPage

