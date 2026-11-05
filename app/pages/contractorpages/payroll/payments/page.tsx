"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Site = { _id: string; siteName: string }
type Labour = { _id: string; labourCode: string; name: string; mobile: string; status: string; site: Site | null }
type Salary = { _id?: string; labourId: string | { _id: string; name: string; labourCode: string } | null; month: number; year: number; dailyWage?: number; wageBasis?: string; presentDays?: number; halfDays?: number; absentDays?: number; leaveDays?: number; holidayDays?: number; overtimeHours?: number; attendanceEarnings?: number; basic?: number; basicSalary?: number; hra?: number; allowance?: number; otherAllowance?: number; bonus?: number; incentive?: number; overtime?: number; overtimeAmount?: number; grossSalary?: number; employeePF?: number; pfEmployee?: number; employeeESIC?: number; esicEmployee?: number; advance?: number; otherDeduction?: number; totalDeduction?: number; employerPF?: number; pfEmployer?: number; employerESIC?: number; esicEmployer?: number; ctc?: number; finalNetSalary: number; netSalary: number; paidAmount: number; balanceAmount: number; excessPaidAmount?: number; status: string; isFinalized: boolean }
type Payment = { _id: string; paymentType?: string; paymentMode: string; paymentDate: string; amount?: number; paidAmount?: number; remarks?: string }
type Api<T> = { success: boolean; data?: T; message?: string }

const pad = (value: number) => String(value).padStart(2, "0")
const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const salaryLabourId = (salary: Salary) => typeof salary.labourId === "string" ? salary.labourId : salary.labourId?._id || ""

export default function PaymentEntryPage() {
  const { showToast } = useToast()
  const now = new Date()
  const [labours, setLabours] = useState<Labour[]>([])
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [history, setHistory] = useState<Payment[]>([])
  const [salaryPreview, setSalaryPreview] = useState<Salary | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [type, setType] = useState<"SALARY" | "ADVANCE">("SALARY")
  const [labourId, setLabourId] = useState("")
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [amount, setAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK" | "UPI">("CASH")
  const [paymentDate, setPaymentDate] = useState(localDate())
  const [remarks, setRemarks] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [labourResponse, salaryResponse] = await Promise.all([
        fetch(apiUrl("/labours/get-labours"), { credentials: "include" }),
        fetch(apiUrl(`/salary?month=${month}&year=${year}&limit=100`), { credentials: "include" }),
      ])
      const labourResult = await labourResponse.json() as Api<Labour[]>
      const salaryResult = await salaryResponse.json() as Api<Salary[]>
      if (!labourResponse.ok || !labourResult.success) throw new Error(labourResult.message || "Labours could not be loaded.")
      setLabours((labourResult.data || []).filter((labour) => labour.status === "ACTIVE"))
      setSalaries(salaryResponse.ok && salaryResult.success ? (salaryResult.data || []).filter((salary) => salaryLabourId(salary)) : [])
    } catch (error) { showToast(error instanceof Error ? error.message : "Payment data could not be loaded.", "error") } finally { setLoading(false) }
  }, [month, year, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!labourId) { setHistory([]); setSalaryPreview(null); return }
    const controller = new AbortController()
    setPreviewLoading(true)
    Promise.all([
      fetch(apiUrl(`/labour-payments/labour/${labourId}`), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl(`/salary/labour/${labourId}?month=${month}&year=${year}`), { credentials: "include", signal: controller.signal }),
    ]).then(async ([historyResponse, previewResponse]) => {
      const historyResult = await historyResponse.json() as Api<Payment[]>
      const previewResult = await previewResponse.json() as Api<Salary>
      if (historyResponse.ok && historyResult.success) setHistory((historyResult.data || []).slice(0, 5))
      setSalaryPreview(previewResponse.ok && previewResult.success ? previewResult.data || null : null)
    }).catch(() => undefined).finally(() => setPreviewLoading(false))
    return () => controller.abort()
  }, [labourId, month, year])

  const selectedLabour = labours.find((labour) => labour._id === labourId)
  const selectedSalary = salaries.find((salary) => salaryLabourId(salary) === labourId)
  const salaryDetails = selectedSalary || salaryPreview
  const netSalary = Number(salaryDetails?.finalNetSalary ?? salaryDetails?.netSalary ?? 0)
  const paidAmount = Number(selectedSalary?.paidAmount ?? salaryDetails?.paidAmount ?? 0)
  const balance = Number(selectedSalary?.balanceAmount ?? Math.max(netSalary - paidAmount, 0))
  const maxAmount = type === "SALARY" ? balance : undefined
  const salaryAmount = (...values: Array<number | undefined>) => Number(values.find((value) => value !== undefined) || 0)
  const attendanceBreakdown = [["Present", salaryDetails?.presentDays || 0], ["Half Day", salaryDetails?.halfDays || 0], ["Absent", salaryDetails?.absentDays || 0], ["Leave", salaryDetails?.leaveDays || 0], ["Holiday", salaryDetails?.holidayDays || 0], ["OT Hours", salaryDetails?.overtimeHours || 0]]
  const earningBreakdown = [["Attendance Earnings", salaryDetails?.attendanceEarnings || 0], ["Basic", salaryAmount(salaryDetails?.basic, salaryDetails?.basicSalary)], ["HRA", salaryDetails?.hra || 0], ["Allowance", salaryAmount(salaryDetails?.allowance, salaryDetails?.otherAllowance)], ["Bonus", salaryDetails?.bonus || 0], ["Incentive", salaryDetails?.incentive || 0], ["Overtime", salaryAmount(salaryDetails?.overtime, salaryDetails?.overtimeAmount)], ["Gross Salary", salaryDetails?.grossSalary || 0]] as const
  const deductionBreakdown = [["Employee PF", salaryAmount(salaryDetails?.employeePF, salaryDetails?.pfEmployee)], ["Employee ESIC", salaryAmount(salaryDetails?.employeeESIC, salaryDetails?.esicEmployee)], ["Advance", salaryDetails?.advance || 0], ["Other Deduction", salaryDetails?.otherDeduction || 0], ["Total Deduction", salaryDetails?.totalDeduction || 0]] as const

  useEffect(() => {
    if (type === "SALARY" && balance > 0) setAmount(String(balance))
    else setAmount("")
  }, [balance, type])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!labourId) { showToast("Please select a labour.", "error"); return }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { showToast("Amount must be greater than zero.", "error"); return }
    if (type === "SALARY" && numericAmount > balance) { showToast(`Amount cannot exceed balance ${money.format(balance)}.`, "error"); return }
    setSaving(true)
    try {
      let salaryRecord = selectedSalary
      if (type === "SALARY" && (!salaryRecord || !salaryRecord.isFinalized)) {
        const salaryResponse = await fetch(apiUrl("/salary/calculate"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labourId, month, year, isFinalized: true }) })
        const salaryResult = await salaryResponse.json() as Api<Salary>
        if (!salaryResponse.ok || !salaryResult.success || !salaryResult.data) throw new Error(salaryResult.message || "Salary could not be prepared.")
        salaryRecord = salaryResult.data
      }
      if (type === "SALARY" && (!salaryRecord?._id || ["CANCELLED", "PAID"].includes(salaryRecord.status))) throw new Error("This salary does not have a payable balance.")
      const endpoint = type === "SALARY" ? `/salary/${salaryRecord!._id}/pay` : "/labour-payments/create"
      const body = type === "SALARY"
        ? { amount: numericAmount, paymentMode, paymentDate, remarks }
        : { labourId, month, year, amount: numericAmount, paymentType: "ADVANCE", paymentMode, paymentDate, remarks }
      const response = await fetch(apiUrl(endpoint), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = await response.json() as Api<unknown>
      if (!response.ok || !result.success) throw new Error(result.message || "Payment could not be saved.")
      showToast(type === "SALARY" ? "Salary calculated and payment recorded successfully." : "Advance payment recorded successfully.", "success")
      setAmount(""); setRemarks("")
      await load()
    } catch (error) { showToast(error instanceof Error ? error.message : "Payment could not be saved.", "error") } finally { setSaving(false) }
  }
  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar />
    <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Payroll / <span className="font-semibold text-indigo-600">Payment Entry</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Salary &amp; Advance Payment</h1><p className="mt-1 text-sm text-slate-500">Record salary settlements and worker advances from one place.</p></div><Link href="/pages/contractorpages/payroll" className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600">Back to Payroll</Link></header>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900">Payment Basics</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-semibold text-slate-500">Transaction Type<select value={type} onChange={(event) => setType(event.target.value as "SALARY" | "ADVANCE")} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><option value="SALARY">Salary Payment</option><option value="ADVANCE">Advance Payment</option></select></label>
            <label className="text-[10px] font-semibold text-slate-500">Labour<select required value={labourId} onChange={(event) => setLabourId(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="">Select labour</option>{labours.map((labour) => <option key={labour._id} value={labour._id}>{labour.name} ({labour.labourCode})</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-500">Payroll Month<input type="month" value={`${year}-${pad(month)}`} onChange={(event) => { const [nextYear, nextMonth] = event.target.value.split("-").map(Number); setYear(nextYear); setMonth(nextMonth) }} className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-[9px] font-semibold uppercase text-slate-400">Working Site</span><strong className="mt-1 block text-sm text-slate-700">{selectedLabour?.site?.siteName || "Not selected"}</strong></div>
          </div></section>

          {type === "SALARY" && labourId && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Complete Salary Calculation</h2><p className="mt-1 text-[10px] text-slate-500">{selectedLabour?.name} - {pad(month)}/{year} - {salaryDetails?.wageBasis?.replace("_", " ") || "Wage basis"}</p></div><span className={`rounded-full px-3 py-1 text-[9px] font-bold ${selectedSalary?.isFinalized ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{selectedSalary?.isFinalized ? "FINALIZED" : previewLoading ? "CALCULATING..." : "LIVE PREVIEW"}</span></div>
            {previewLoading ? <div className="p-10 text-center text-xs text-slate-500">Calculating complete salary...</div> : salaryDetails ? <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{attendanceBreakdown.map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center"><span className="text-[9px] uppercase text-slate-400">{label}</span><strong className="mt-1 block text-base text-slate-800">{value}</strong></div>)}</div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-md border border-emerald-100"><h3 className="bg-emerald-50 px-4 py-3 text-[10px] font-bold uppercase text-emerald-700">Earnings</h3><dl className="divide-y divide-slate-100">{earningBreakdown.map(([label, value]) => <div key={label} className={`flex justify-between px-4 py-2.5 text-xs ${label === "Gross Salary" ? "bg-emerald-50/50 font-bold text-emerald-700" : ""}`}><dt className={label === "Gross Salary" ? "" : "text-slate-500"}>{label}</dt><dd className="font-semibold">{money.format(Number(value))}</dd></div>)}</dl></div>
                <div className="overflow-hidden rounded-md border border-red-100"><h3 className="bg-red-50 px-4 py-3 text-[10px] font-bold uppercase text-red-700">Employee Deductions</h3><dl className="divide-y divide-slate-100">{deductionBreakdown.map(([label, value]) => <div key={label} className={`flex justify-between px-4 py-2.5 text-xs ${label === "Total Deduction" ? "bg-red-50/50 font-bold text-red-700" : ""}`}><dt className={label === "Total Deduction" ? "" : "text-slate-500"}>{label}</dt><dd className="font-semibold">{money.format(Number(value))}</dd></div>)}</dl><div className="grid grid-cols-2 gap-px bg-slate-200"><div className="bg-white p-3"><span className="text-[9px] text-slate-400">Employer PF</span><strong className="block text-xs">{money.format(salaryAmount(salaryDetails.employerPF, salaryDetails.pfEmployer))}</strong></div><div className="bg-white p-3"><span className="text-[9px] text-slate-400">Employer ESIC</span><strong className="block text-xs">{money.format(salaryAmount(salaryDetails.employerESIC, salaryDetails.esicEmployer))}</strong></div></div></div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-md bg-indigo-50 p-4"><span className="text-[9px] uppercase text-indigo-500">Net Salary</span><strong className="mt-1 block text-lg text-indigo-700">{money.format(netSalary)}</strong></div><div className="rounded-md bg-slate-50 p-4"><span className="text-[9px] uppercase text-slate-400">Already Paid</span><strong className="mt-1 block text-lg text-slate-700">{money.format(paidAmount)}</strong></div><div className="rounded-md bg-amber-50 p-4"><span className="text-[9px] uppercase text-amber-600">Pay Now</span><strong className="mt-1 block text-lg text-amber-700">{money.format(Number(amount || 0))}</strong></div><div className="rounded-md bg-emerald-50 p-4"><span className="text-[9px] uppercase text-emerald-600">Remaining After Pay</span><strong className="mt-1 block text-lg text-emerald-700">{money.format(Math.max(balance - Number(amount || 0), 0))}</strong></div></div>
            </div> : <div className="p-10 text-center text-xs text-slate-500">Salary calculation is not available for this labour and month.</div>}
          </section>}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900">Payment Details</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-semibold text-slate-500">Amount<input required type="number" min="0.01" max={maxAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500" /></label>
            <label className="text-[10px] font-semibold text-slate-500">Payment Date<input required type="date" max={localDate()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
            <div className="sm:col-span-2"><p className="text-[10px] font-semibold text-slate-500">Payment Mode</p><div className="mt-2 grid grid-cols-3 gap-3">{(["CASH", "BANK", "UPI"] as const).map((mode) => <label key={mode} className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border text-xs font-semibold ${paymentMode === mode ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}><input type="radio" className="accent-indigo-600" checked={paymentMode === mode} onChange={() => setPaymentMode(mode)} />{mode}</label>)}</div></div>
            <label className="text-[10px] font-semibold text-slate-500 sm:col-span-2">Remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={4} placeholder="Payment reference or notes..." className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500" /></label>
          </div><div className="mt-5 flex justify-end"><button type="submit" disabled={saving || loading || !labourId || (type === "SALARY" && balance <= 0)} className="h-11 min-w-44 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : type === "SALARY" ? "Record Salary Payment" : "Add Advance"}</button></div></section>
        </form>

        <aside className="space-y-5">
          <section className="rounded-lg bg-gradient-to-br from-indigo-700 to-violet-600 p-5 text-white shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Settlement Overview</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-md bg-white/10 p-3"><span className="text-[9px] text-indigo-100">Net Salary</span><strong className="mt-1 block text-lg">{money.format(netSalary)}</strong></div><div className="rounded-md bg-white/10 p-3"><span className="text-[9px] text-indigo-100">Paid</span><strong className="mt-1 block text-lg">{money.format(paidAmount)}</strong></div></div><div className="mt-3 rounded-md bg-white/15 p-4"><span className="text-[9px] uppercase text-indigo-100">Balance Payable</span><strong className="mt-1 block text-2xl">{money.format(balance)}</strong></div><span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[9px] font-bold">{salaryDetails?.status || "NO SALARY SELECTED"}</span></section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Recent Worker Payments</h2><div className="mt-3 divide-y divide-slate-100">{history.map((payment) => <div key={payment._id} className="flex items-center justify-between gap-3 py-3"><div><strong className="block text-xs text-slate-700">{payment.paymentType || "SALARY"}</strong><span className="text-[9px] text-slate-400">{new Date(payment.paymentDate).toLocaleDateString("en-IN")} - {payment.paymentMode}</span></div><strong className="text-xs text-indigo-700">{money.format(Number(payment.amount ?? payment.paidAmount ?? 0))}</strong></div>)}{!history.length && <p className="py-6 text-center text-xs text-slate-400">No recent payment entries.</p>}</div></section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-500"><h2 className="mb-3 font-bold text-slate-800">Guidelines</h2><p>Salary payment save karte waqt payroll automatically calculate aur finalize hota hai.</p><p className="mt-2">Advance salary earning nahi hai; selected month ke payroll mein deduction hoga.</p><p className="mt-2">Payment date aur mode actual transaction ke according select karein.</p></section>
        </aside>
      </div>
    </main>
  </div></div>
}
