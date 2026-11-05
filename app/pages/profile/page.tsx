"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Address = { street: string; city: string; state: string; pincode: string; country: string }
type Company = { companyCode?: string; companyName: string; ownerName: string; email: string; mobile: string; gstNumber?: string; status?: string; address: Address }
type User = { name: string; email: string; mobile?: string; role: string }
type Api<T> = { success: boolean; company?: T; user?: User; message?: string }
const emptyCompany: Company = { companyName: "", ownerName: "", email: "", mobile: "", gstNumber: "", address: { street: "", city: "", state: "", pincode: "", country: "India" } }

export default function ProfilePage() {
  const { showToast } = useToast()
  const [company, setCompany] = useState<Company>(emptyCompany)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [companyResponse, userResponse] = await Promise.all([
        fetch(apiUrl("/company/profile"), { credentials: "include" }),
        fetch(apiUrl("/auth/me"), { credentials: "include" }),
      ])
      const [companyResult, userResult] = await Promise.all([companyResponse.json(), userResponse.json()]) as [Api<Company>, Api<Company>]
      if (!companyResponse.ok || !companyResult.success || !companyResult.company) throw new Error(companyResult.message || "Profile could not be loaded.")
      setCompany({ ...emptyCompany, ...companyResult.company, address: { ...emptyCompany.address, ...companyResult.company.address } })
      if (userResult.success && userResult.user) setUser(userResult.user)
    } catch (error) { showToast(error instanceof Error ? error.message : "Profile could not be loaded.", "error") } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { load() }, [load])
  const update = (key: keyof Omit<Company, "address">, value: string) => setCompany((current) => ({ ...current, [key]: value }))
  const updateAddress = (key: keyof Address, value: string) => setCompany((current) => ({ ...current, address: { ...current.address, [key]: value } }))
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch(apiUrl("/company/profile"), { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(company) })
      const result = await response.json() as Api<Company>
      if (!response.ok || !result.success || !result.company) throw new Error(result.message || "Profile update failed.")
      setCompany({ ...emptyCompany, ...result.company, address: { ...emptyCompany.address, ...result.company.address } })
      setIsEditing(false)
      showToast("Company profile updated successfully.", "success")
    } catch (error) { showToast(error instanceof Error ? error.message : "Profile update failed.", "error") } finally { setSaving(false) }
  }
  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
  if (loading) return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col"><Navbar /><main className="p-7 text-sm text-slate-500">Loading profile...</main></div></div>
  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar /><main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
    <header><p className="text-xs text-slate-500">Dashboard / <span className="font-semibold text-indigo-600">Profile</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Company Profile</h1><p className="mt-1 text-sm text-slate-500">Manage company, GST and registered address details.</p></header>
    <section className="mt-5 grid gap-4 lg:grid-cols-3"><div className="rounded-lg border border-indigo-100 bg-indigo-50 p-5 lg:col-span-1"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">{(company.companyName || "C").slice(0, 1).toUpperCase()}</div><h2 className="mt-4 text-lg font-bold text-slate-900">{company.companyName || "Your Company"}</h2><p className="mt-1 text-sm text-slate-600">{company.companyCode ? `Company Code: ${company.companyCode}` : "Contractor account"}</p><div className="mt-5 space-y-3 text-sm"><div><span className="block text-xs text-slate-500">Owner</span><strong>{company.ownerName || "-"}</strong></div><div><span className="block text-xs text-slate-500">Account user</span><strong>{user?.name || "-"}</strong><span className="block text-xs text-slate-500">{user?.email || ""}</span></div><div><span className="block text-xs text-slate-500">Account status</span><strong className="text-emerald-700">{company.status || "ACTIVE"}</strong></div></div></div>
      <form onSubmit={save} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold text-slate-900">Company & GST Details</h2>{isEditing ? <span className="text-xs text-slate-400">Fields marked * are required</span> : <button type="button" onClick={() => setIsEditing(true)} className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Edit Profile</button>}</div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700">Company Name *<input required value={company.companyName} onChange={(e) => update("companyName", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">Owner Name *<input required value={company.ownerName} onChange={(e) => update("ownerName", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">Company Email *<input type="email" required value={company.email} onChange={(e) => update("email", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">Mobile Number *<input required value={company.mobile} onChange={(e) => update("mobile", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700 md:col-span-2">GST Number<input value={company.gstNumber || ""} onChange={(e) => update("gstNumber", e.target.value.toUpperCase())} maxLength={15} placeholder="e.g. 23ABCDE1234F1Z5" disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label></div><h3 className="mt-7 border-t pt-5 text-sm font-bold text-slate-900">Registered Address</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-slate-700 md:col-span-2">Address / Street *<input required value={company.address.street} onChange={(e) => updateAddress("street", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">City *<input required value={company.address.city} onChange={(e) => updateAddress("city", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">State *<input required value={company.address.state} onChange={(e) => updateAddress("state", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">PIN Code *<input required value={company.address.pincode} onChange={(e) => updateAddress("pincode", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label><label className="text-sm font-medium text-slate-700">Country<input value={company.address.country} onChange={(e) => updateAddress("country", e.target.value)} disabled={!isEditing} className={`${input} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label></div>{isEditing && <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setIsEditing(false); load() }} disabled={saving} className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button><button disabled={saving} className="rounded-md bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save Profile"}</button></div>}</form></section>
  </main></div></div>
}