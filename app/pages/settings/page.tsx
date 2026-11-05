"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Api = { success: boolean; message?: string }
const SettingCard = ({ title, description, href, action }: { title: string; description: string; href: string; action: string }) => <Link href={href} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900 group-hover:text-indigo-700">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div><span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-indigo-600">→</span></div><span className="mt-5 inline-block text-xs font-bold text-indigo-700">{action}</span></Link>

export default function SettingsPage() {
  const { showToast } = useToast()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  useEffect(() => { const enabled = localStorage.getItem("kinetic-theme") === "dark"; document.documentElement.classList.toggle("dark", enabled); document.documentElement.dataset.theme = enabled ? "dark" : "light"; setDarkMode(enabled) }, [])
  const toggleDarkMode = () => { const next = !darkMode; document.documentElement.classList.toggle("dark", next); document.documentElement.dataset.theme = next ? "dark" : "light"; localStorage.setItem("kinetic-theme", next ? "dark" : "light"); setDarkMode(next) }
  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword.length < 6) return showToast("New password must contain at least 6 characters.", "error")
    if (newPassword !== confirmPassword) return showToast("New password and confirm password do not match.", "error")
    setSaving(true)
    try {
      const response = await fetch(apiUrl("/auth/change-password"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldPassword, newPassword }) })
      const result = await response.json() as Api
      if (!response.ok || !result.success) throw new Error(result.message || "Password could not be changed.")
      setOldPassword(""); setNewPassword(""); setConfirmPassword("")
      showToast("Password changed successfully.", "success")
    } catch (error) { showToast(error instanceof Error ? error.message : "Password could not be changed.", "error") } finally { setSaving(false) }
  }
  const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar /><main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7"><header className="rounded-xl bg-gradient-to-r from-indigo-700 via-indigo-700 to-violet-600 px-6 py-7 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Workspace</p><h1 className="mt-2 text-2xl font-bold">Settings</h1><p className="mt-2 max-w-2xl text-sm text-indigo-100">Manage company information, payroll rules, invoice workflow and account security from one place.</p></header>
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Appearance</h2><p className="mt-1 text-sm text-slate-500">Choose a comfortable display mode for your workspace.</p></div><button type="button" role="switch" aria-checked={darkMode} onClick={toggleDarkMode} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition ${darkMode ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-slate-50 text-slate-700"}`}><span className={`relative h-6 w-11 rounded-full ${darkMode ? "bg-white/30" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${darkMode ? "left-6" : "left-1"}`} /></span>{darkMode ? "Dark Mode" : "Light Mode"}</button></div></section>\n    <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SettingCard title="Company Profile" description="Company name, GST number, owner contact and registered address." href="/pages/profile" action="Manage profile" /><SettingCard title="Payroll Settings" description="PF, ESIC, paid holiday, overtime and salary calculation rules." href="/pages/contractorpages/payroll/settings" action="Configure payroll" /><SettingCard title="Invoices & GST" description="Generate invoices and view GST register with payment status." href="/pages/contractorpages/invoices" action="Open invoices" /></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><form onSubmit={changePassword} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="border-b border-slate-200 pb-4"><h2 className="font-bold text-slate-900">Account Security</h2><p className="mt-1 text-sm text-slate-500">Change your login password. Use a strong password that is not shared with anyone.</p></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold text-slate-700">Current Password<input required type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={input} /></label><label className="text-sm font-semibold text-slate-700">New Password<input required type="password" minLength={6} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} /></label><label className="text-sm font-semibold text-slate-700">Confirm New Password<input required type="password" minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={input} /></label></div><div className="mt-5 flex justify-end"><button disabled={saving} className="rounded-md bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Changing..." : "Change Password"}</button></div></form><aside className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-900">Settings Guide</h2><ul className="mt-4 space-y-3 text-sm leading-5 text-emerald-800"><li>• Update GST and address in Company Profile before making an invoice.</li><li>• Enable paid holiday in Payroll Settings when holidays should count in salary.</li><li>• Site-wise payment received is managed from each invoice view.</li></ul></aside></section>
  </main></div></div>
}