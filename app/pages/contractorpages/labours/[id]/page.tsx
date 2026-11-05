"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Site = { _id: string; siteName: string; siteCode?: string; location?: string }
type Labour = { _id: string; labourCode: string; name: string; mobile: string; gender: string; address?: string; dailyWage?: number | null; finalDailyWage: number; isPFApplicable?: boolean; pfUanNumber?: string | null; isESICApplicable?: boolean; esicIpNumber?: string | null; status: string; skillId: { skillName: string } | null; site: Site | null; createdAt: string }
type Attendance = { labourId: string | { _id: string }; status: string; wageAtThatDay: number; overtimeAmount?: number }
type Payment = { amount: number; paymentType: string; month: number; year: number }
type Api<T> = { success: boolean; data?: T; message?: string }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })

export default function LabourDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const [labour, setLabour] = useState<Labour | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    const now = new Date()
    Promise.all([
      fetch(apiUrl("/labours/get-labour/" + id), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl("/attendance/monthly?month=" + (now.getMonth() + 1) + "&year=" + now.getFullYear()), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl("/labour-payments/labour/" + id), { credentials: "include", signal: controller.signal }),
    ]).then(async ([labourResponse, attendanceResponse, paymentResponse]) => {
      const labourResult = await labourResponse.json() as Api<Labour>
      const attendanceResult = await attendanceResponse.json() as Api<Attendance[]>
      const paymentResult = await paymentResponse.json() as Api<Payment[]>
      if (!labourResponse.ok || !labourResult.success || !labourResult.data) throw new Error(labourResult.message || "Labour details could not be loaded.")
      setLabour(labourResult.data)
      setAttendance((attendanceResult.data || []).filter((entry) => (typeof entry.labourId === "string" ? entry.labourId : entry.labourId?._id) === id))
      setPayments(paymentResult.data || [])
    }).catch((error) => { if (error.name !== "AbortError") showToast(error.message, "error") }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [id, showToast])
  const present = attendance.filter((entry) => entry.status === "PRESENT").length
  const half = attendance.filter((entry) => entry.status === "HALF_DAY").length
  const rate = attendance.length ? Math.round(((present + half * 0.5) / attendance.length) * 100) : 0
  const currentDate = new Date()
  const currentPayments = payments.filter((item) => item.month === currentDate.getMonth() + 1 && item.year === currentDate.getFullYear())
  const earnings = currentPayments.filter((item) => item.paymentType !== "ADVANCE" && item.paymentType !== "DEDUCTION").reduce((sum, item) => sum + item.amount, 0)
  const advances = currentPayments.filter((item) => item.paymentType === "ADVANCE").reduce((sum, item) => sum + item.amount, 0)

  return <div className="flex min-h-screen bg-[#f7f8fc]"><Sidebar /><div className="min-w-0 flex-1"><Navbar /><main className="mx-auto max-w-6xl p-5 lg:p-7">
    {loading ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Loading labour details...</div> : !labour ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Labour not found.</div> : <>
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Labours / <span className="text-indigo-600">Labour Details</span></p><div className="mt-2 flex items-baseline gap-2"><h1 className="text-2xl font-bold text-slate-950">{labour.name}</h1><span className="text-xs text-slate-400">#{labour.labourCode}</span></div></div><div className="flex flex-wrap gap-2"><Link href="/pages/contractorpages/labours" className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600">Back</Link><Link href={"/pages/contractorpages/labours/" + id + "/id-card"} className="rounded-md border border-emerald-300 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">&#129665; View ID Card &amp; QR</Link><Link href={"/pages/contractorpages/labours/" + id + "/edit"} className="rounded-md bg-indigo-700 px-5 py-2 text-sm font-semibold text-white">Edit Profile</Link></div></header>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-400 text-2xl font-bold text-white">{labour.name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</div><h2 className="mt-3 text-center font-bold">{labour.name}</h2><div className="mt-2 text-center"><span className="rounded-full bg-emerald-100 px-3 py-1 text-[9px] font-bold text-emerald-700">{labour.status}</span></div><dl className="mt-5 divide-y text-xs"><div className="flex justify-between py-3"><dt className="text-slate-400">Joining Date</dt><dd className="font-semibold">{date.format(new Date(labour.createdAt))}</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Skill</dt><dd className="font-semibold text-indigo-600">{labour.skillId?.skillName || "-"}</dd></div><div className="flex justify-between gap-3 py-3"><dt className="text-slate-400">Current Site</dt><dd className="text-right font-semibold">{labour.site?.siteName || "Not assigned"}</dd></div></dl></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold">Worker Information</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-[10px] uppercase text-slate-400">Mobile</p><p className="mt-2 text-sm font-semibold">{labour.mobile}</p></div><div><p className="text-[10px] uppercase text-slate-400">Gender</p><p className="mt-2 text-sm font-semibold">{labour.gender}</p></div><div><p className="text-[10px] uppercase text-slate-400">Daily Wage</p><p className="mt-2 text-lg font-bold text-indigo-700">{money.format(labour.finalDailyWage || 0)}</p></div><div><p className="text-[10px] uppercase text-slate-400">Wage Type</p><p className="mt-2 text-sm font-semibold">{labour.dailyWage == null ? "SKILL BASED" : "CUSTOM"}</p></div><div className="sm:col-span-2"><p className="text-[10px] uppercase text-slate-400">Address</p><p className="mt-2 rounded-md bg-slate-50 p-4 text-sm">{labour.address || "Address not added"}</p></div><div className="sm:col-span-2"><p className="text-[10px] uppercase text-slate-400">Work Location</p><p className="mt-2 rounded-md bg-slate-50 p-4 text-sm">{labour.site?.location || "Site location not available"}</p></div></div></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold">Statutory Details</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className={`rounded-lg border p-4 ${labour.isPFApplicable && labour.pfUanNumber ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><p className="text-[10px] font-bold uppercase text-slate-400">Provident Fund (PF)</p><strong className={`mt-2 block text-sm ${labour.isPFApplicable && labour.pfUanNumber ? "text-indigo-700" : "text-slate-500"}`}>{labour.isPFApplicable && labour.pfUanNumber ? "Applicable" : "Not Applicable"}</strong><span className="mt-1 block text-xs text-slate-600">UAN: {labour.pfUanNumber || "-"}</span></div><div className={`rounded-lg border p-4 ${labour.isESICApplicable && labour.esicIpNumber ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50"}`}><p className="text-[10px] font-bold uppercase text-slate-400">ESIC</p><strong className={`mt-2 block text-sm ${labour.isESICApplicable && labour.esicIpNumber ? "text-sky-700" : "text-slate-500"}`}>{labour.isESICApplicable && labour.esicIpNumber ? "Applicable" : "Not Applicable"}</strong><span className="mt-1 block text-xs text-slate-600">IP Number: {labour.esicIpNumber || "-"}</span></div></div></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] uppercase text-slate-400">Attendance This Month</p><strong className="mt-3 block text-3xl text-emerald-600">{rate}%</strong><p className="mt-2 text-xs text-slate-500">{present} present records</p></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] uppercase text-slate-400">Earnings This Month</p><strong className="mt-3 block text-2xl text-indigo-700">{money.format(earnings)}</strong><p className="mt-2 text-xs text-slate-500">Live payment API data</p></section>
        <section className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-sm"><p className="text-[10px] uppercase text-indigo-100">Advance This Month</p><strong className="mt-3 block text-2xl">{money.format(advances)}</strong><p className="mt-2 text-xs text-indigo-100">{currentPayments.filter((item) => item.paymentType === "ADVANCE").length} entries</p></section>
      </div>
    </>}
  </main></div></div>
}

