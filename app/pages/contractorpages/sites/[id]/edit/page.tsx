"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Status = "ACTIVE" | "INACTIVE" | "COMPLETED"
type Site = { _id: string; siteCode?: string; siteName: string; clientName?: string; contactMobile?: string; contactEmail?: string; projectValue?: number; location?: string; startDate?: string | null; endDate?: string | null; status: Status }
type Response = { success: boolean; data?: Site; message?: string }
type Form = { siteName: string; clientName: string; contactMobile: string; contactEmail: string; projectValue: string; location: string; startDate: string; endDate: string; status: Status }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

export default function EditSitePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const [siteCode, setSiteCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Form>({ siteName: "", clientName: "", contactMobile: "", contactEmail: "", projectValue: "", location: "", startDate: "", endDate: "", status: "ACTIVE" })

  useEffect(() => {
    const controller = new AbortController()
    fetch(apiUrl("/sites/get-site/" + id), { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as Response
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Site details could not be loaded.")
        const site = result.data
        setSiteCode(site.siteCode || "")
        setForm({ siteName: site.siteName, clientName: site.clientName || "", contactMobile: site.contactMobile || "", contactEmail: site.contactEmail || "", projectValue: site.projectValue?.toString() || "", location: site.location || "", startDate: site.startDate?.slice(0, 10) || "", endDate: site.endDate?.slice(0, 10) || "", status: site.status })
      })
      .catch((error) => { if (error.name !== "AbortError") showToast(error.message, "error") })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [id, showToast])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(apiUrl("/sites/update/" + id), { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectValue: Number(form.projectValue), startDate: form.startDate || null, endDate: form.endDate || null }) })
      const result = await response.json() as Response
      if (!response.ok || !result.success) throw new Error(result.message || "Site could not be updated.")
      showToast(result.message || "Site updated successfully.", "success")
      router.push("/pages/contractorpages/sites/" + id)
      router.refresh()
    } catch (error) { showToast(error instanceof Error ? error.message : "Site could not be updated.", "error") } finally { setSaving(false) }
  }

  return <div className="flex min-h-screen bg-[#f7f8fc]"><Sidebar /><div className="min-w-0 flex-1"><Navbar /><main className="mx-auto max-w-6xl p-5 lg:p-7">
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Sites / <span className="text-indigo-600">Edit Site</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Edit {form.siteName || "Site"}</h1><p className="mt-1 text-sm text-slate-500">Update project, client, timeline and status details. {siteCode && <strong className="text-indigo-600">#{siteCode}</strong>}</p></div><div className="flex gap-2"><Link href={"/pages/contractorpages/sites/" + id} className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600">Cancel</Link><button form="edit-site" disabled={saving || loading} className="rounded-md bg-indigo-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button></div></header>
    {loading ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Loading site details...</div> :
    <form id="edit-site" onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_300px]"><div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold text-slate-900">General Information</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Site name *<input required value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600">Client name *<input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Location *<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600">Contact mobile *<input required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.contactMobile} onChange={(e) => setForm({ ...form, contactMobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600">Contact email *<input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600">Project value *<input required type="number" min="0" value={form.projectValue} onChange={(e) => setForm({ ...form, projectValue: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
      </div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold text-slate-900">Timeline &amp; Status</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Start date *<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600">End date<input type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="COMPLETED">Completed</option></select></label>
      </div></section>
    </div><aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Project Overview</h2><dl className="mt-4 divide-y text-xs"><div className="py-3"><dt className="text-slate-400">Site Code</dt><dd className="mt-1 font-bold text-indigo-600">{siteCode || "Auto generated"}</dd></div><div className="py-3"><dt className="text-slate-400">Client</dt><dd className="mt-1 font-semibold">{form.clientName || "-"}</dd></div><div className="py-3"><dt className="text-slate-400">Value</dt><dd className="mt-1 font-semibold">{form.projectValue ? money.format(Number(form.projectValue)) : "-"}</dd></div><div className="py-3"><dt className="text-slate-400">Location</dt><dd className="mt-1 leading-5">{form.location || "-"}</dd></div></dl></aside></form>}
  </main></div></div>
}
