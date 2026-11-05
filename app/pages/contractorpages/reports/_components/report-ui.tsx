"use client"

import { ReactNode, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

export type ChartItem = { label: string; value: number; color?: string }
export const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
export const number = new Intl.NumberFormat("en-IN")
export const pad = (value: number) => String(value).padStart(2, "0")

export function ReportPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar /><main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
    <header><p className="text-xs text-slate-500">Dashboard / Reports / <span className="font-semibold text-indigo-600">{title}</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></header>
    <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3 text-sm">{[["Overview","/pages/contractorpages/reports"],["Attendance","/pages/contractorpages/reports/attendance"],["Salary","/pages/contractorpages/reports/salary"],["Payments","/pages/contractorpages/reports/payments"],["Workforce","/pages/contractorpages/reports/workforce"],["GST Details","/pages/contractorpages/reports/gst"]].map(([label,href]) => <Link key={href} href={href} className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700">{label}</Link>)}</nav>
    {children}
  </main></div></div>
}


export function ReportActions({ title, fileName, tableId }: { title: string; fileName: string; tableId: string }) {
  const { showToast } = useToast()
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("")
  const exportReport = async (format: "xlsx" | "pdf") => {
    const table = document.getElementById(tableId) as HTMLTableElement | null
    if (!table) { showToast("Export table is not available.", "error"); return }
    const headers = Array.from(table.querySelectorAll("thead th")).map((cell) => cell.textContent?.trim() || "Column")
    const columns = headers.map((label, index) => ({ key: `column${index}`, label }))
    const rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => Object.fromEntries(Array.from(row.querySelectorAll("td")).map((cell, index) => [`column${index}`, cell.textContent?.trim() || ""])))
    setExporting(format)
    try {
      const response = await fetch(apiUrl(`/export/report/${format}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, fileName, columns, rows }) })
      if (!response.ok) { const result = await response.json().catch(() => null) as { message?: string } | null; throw new Error(result?.message || "Report export failed.") }
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${fileName}.${format}`; anchor.click(); URL.revokeObjectURL(url)
      showToast(`${format === "xlsx" ? "Excel" : "PDF"} report exported.`, "success")
    } catch (error) { showToast(error instanceof Error ? error.message : "Report export failed.", "error") } finally { setExporting("") }
  }
  return <div className="flex gap-2 lg:ml-auto"><button onClick={() => exportReport("xlsx")} disabled={Boolean(exporting)} className="h-10 rounded-md border border-emerald-300 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 disabled:opacity-50">{exporting === "xlsx" ? "Exporting..." : "Export Excel"}</button><button onClick={() => exportReport("pdf")} disabled={Boolean(exporting)} className="h-10 rounded-md border border-red-300 bg-red-50 px-4 text-xs font-bold text-red-700 disabled:opacity-50">{exporting === "pdf" ? "Exporting..." : "Export PDF"}</button></div>
}

export type Site = { _id: string; siteName: string; siteCode?: string }
export type Labour = { _id: string; labourCode: string; name: string; mobile: string; status: string; gender?: string; dailyWage?: number | null; finalDailyWage?: number; isPFApplicable?: boolean; pfUanNumber?: string | null; isESICApplicable?: boolean; esicIpNumber?: string | null; site: Site | null; skillId?: { skillName: string } | null }
export type Attendance = { _id: string; labourId: string | { _id: string; name?: string; mobile?: string } | null; siteId: string | Site | null; attendanceDate: string; status: "PRESENT"|"ABSENT"|"HALF_DAY"|"LEAVE"|"HOLIDAY"; overtimeHours?: number; overtimeAmount?: number; wageAtThatDay?: number }
export type Salary = { labourId: string; name: string; mobile: string; presentDays: number; halfDays: number; absentDays: number; holidayDays: number; overtimeHours: number; grossSalary: number; netSalary: number; ctc: number; paidAmount: number; balanceAmount: number; pfWage: number; pfEmployee: number; pfEmployer: number; esicEmployee: number; esicEmployer: number; status: string }
export type Payment = { _id: string; labourId: string | { _id: string; labourCode?: string; name?: string; mobile?: string; status?: string; site?: Site | null } | null; amount: number; paymentType: string; paymentMode: string; paymentDate: string; remarks?: string }

export function Filters({ month, setMonth, siteId, setSiteId, sites, children }: { month: string; setMonth: (value: string) => void; siteId: string; setSiteId: (value: string) => void; sites: Site[]; children?: ReactNode }) {
  return <section className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500" /><select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500"><option value="">All Sites</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.siteName}</option>)}</select>{children}</section>
}

export function Stat({ label, value, hint, tone = "text-indigo-700" }: { label: string; value: ReactNode; hint?: string; tone?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><strong className={`mt-2 block text-xl ${tone}`}>{value}</strong>{hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}</div>
}

export function BarChart({ title, items, format = number.format }: { title: string; items: ChartItem[]; format?: (value: number) => string }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-800">{title}</h2><div className="mt-5 space-y-4">{items.map((item) => <div key={item.label}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">{item.label}</span><strong className="text-slate-800">{format(item.value)}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color || "bg-indigo-500"}`} style={{ width: `${item.value ? Math.max(3, item.value / max * 100) : 0}%` }} /></div></div>)}</div></section>
}

export function DonutChart({ title, items, format = number.format }: { title: string; items: ChartItem[]; format?: (value: number) => string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const segments = items.map((item, index) => ({ item, size: total ? item.value / total * 100 : 0, start: total ? items.slice(0, index).reduce((sum, previous) => sum + previous.value / total * 100, 0) : 0 }))
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-800">{title}</h2><div className="mt-5 flex flex-col items-center gap-5 sm:flex-row"><div className="relative h-36 w-36 shrink-0"><svg className="-rotate-90" viewBox="0 0 42 42">{total === 0 && <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="6" />}{segments.map(({ item, size, start }) => <circle key={item.label} cx="21" cy="21" r="15.9" fill="none" stroke={item.color || "#6366f1"} strokeWidth="6" strokeDasharray={`${size} ${100-size}`} strokeDashoffset={-start} />)}</svg><div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-lg">{format(total)}</strong><span className="text-[9px] uppercase text-slate-400">Total</span></div></div><div className="w-full space-y-2">{items.map((item) => <div key={item.label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-500"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || "#6366f1" }} />{item.label}</span><strong>{format(item.value)}</strong></div>)}</div></div></section>
}
export const refId = (value: string | { _id: string } | null | undefined) => typeof value === "string" ? value : value?._id || ""





