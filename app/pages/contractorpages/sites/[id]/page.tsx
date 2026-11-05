"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Site = { _id: string; siteName: string; siteCode?: string; clientName?: string; contactMobile?: string; contactEmail?: string; projectValue?: number; location?: string; startDate?: string | null; endDate?: string | null; status: "ACTIVE" | "INACTIVE" | "COMPLETED"; createdAt: string }
type Response = { success: boolean; data?: Site; message?: string }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "-"

export default function SiteDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const [site, setSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fetch(apiUrl("/sites/get-site/" + id), { credentials: "include", signal: controller.signal }).then(async (response) => {
      const result = await response.json() as Response
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Site details could not be loaded.")
      setSite(result.data)
    }).catch((error) => { if (error.name !== "AbortError") showToast(error.message, "error") }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [id, showToast])

  return <div className="flex min-h-screen bg-[#f7f8fc]"><Sidebar /><div className="min-w-0 flex-1"><Navbar /><main className="mx-auto max-w-6xl p-5 lg:p-7">
    {loading ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Loading site details...</div> : !site ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Site not found.</div> : <>
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Sites / <span className="text-indigo-600">Site Details</span></p><div className="mt-2 flex items-baseline gap-2"><h1 className="text-2xl font-bold text-slate-950">{site.siteName}</h1><span className="text-xs text-indigo-600">#{site.siteCode || "-"}</span></div><p className="mt-1 text-sm text-slate-500">{site.location || "Location not added"}</p></div><div className="flex gap-2"><Link href="/pages/contractorpages/sites" className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600">Back</Link><Link href={"/pages/contractorpages/sites/" + id + "/edit"} className="rounded-md bg-indigo-700 px-5 py-2 text-sm font-semibold text-white">Edit Site</Link></div></header>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><div className="flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-400 text-3xl font-bold text-white">{site.siteName.split(/\s+/).map((word) => word[0]).slice(0, 3).join("").toUpperCase()}</div><h2 className="mt-4 text-center text-lg font-bold">{site.siteName}</h2><p className="mt-1 text-center text-xs text-indigo-600">{site.siteCode}</p><div className="mt-4 text-center"><span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-700">{site.status}</span></div><dl className="mt-5 divide-y text-xs"><div className="flex justify-between py-3"><dt className="text-slate-400">Created</dt><dd className="font-semibold">{date(site.createdAt)}</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Project value</dt><dd className="font-semibold text-indigo-700">{money.format(site.projectValue || 0)}</dd></div></dl></section>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold">Project Information</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><div><dt className="text-[10px] uppercase text-slate-400">Client Name</dt><dd className="mt-2 text-sm font-semibold">{site.clientName || "-"}</dd></div><div><dt className="text-[10px] uppercase text-slate-400">Contact Mobile</dt><dd className="mt-2 text-sm font-semibold">{site.contactMobile || "-"}</dd></div><div><dt className="text-[10px] uppercase text-slate-400">Contact Email</dt><dd className="mt-2 text-sm font-semibold">{site.contactEmail || "-"}</dd></div><div><dt className="text-[10px] uppercase text-slate-400">Project Value</dt><dd className="mt-2 text-sm font-semibold text-indigo-700">{money.format(site.projectValue || 0)}</dd></div><div><dt className="text-[10px] uppercase text-slate-400">Start Date</dt><dd className="mt-2 text-sm font-semibold">{date(site.startDate)}</dd></div><div><dt className="text-[10px] uppercase text-slate-400">End Date</dt><dd className="mt-2 text-sm font-semibold">{date(site.endDate)}</dd></div><div className="sm:col-span-2"><dt className="text-[10px] uppercase text-slate-400">Work Location</dt><dd className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">{site.location || "-"}</dd></div></dl></section>
      </div>
    </>}
  </main></div></div>
}
