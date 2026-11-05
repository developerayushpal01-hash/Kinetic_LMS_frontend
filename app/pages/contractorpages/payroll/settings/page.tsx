"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Setting = {
  _id: string
  basicPercentage: number
  hraPercentage: number
  allowanceCalculationMode: "REMAINING" | "FIXED" | "PERCENTAGE"
  allowanceValue: number
  overtimeRate: number
  isPFEnabled: boolean
  employeePFPercentage: number
  employerPFPercentage: number
  pfWageCeilingEnabled: boolean
  pfWageCeiling: number
  isESICEnabled: boolean
  employeeESICPercentage: number
  employerESICPercentage: number
  esicWageCeilingEnabled: boolean
  esicWageCeiling: number
  isPaidLeaveEnabled: boolean
  isPaidHolidayEnabled: boolean
  isPaidWeeklyOffEnabled: boolean
  roundOffSalary: boolean
  salaryCycle: "CALENDAR_DAYS" | "FIXED_30_DAYS" | "WORKING_DAYS" | "MONTHLY" | "DAILY" | "WEEKLY"
}
type Api<T> = { success: boolean; data?: T; message?: string }

const defaults: Setting = {
  _id: "", basicPercentage: 40, hraPercentage: 20, allowanceCalculationMode: "REMAINING", allowanceValue: 0, overtimeRate: 120,
  isPFEnabled: true, employeePFPercentage: 12, employerPFPercentage: 12, pfWageCeilingEnabled: false, pfWageCeiling: 15000,
  isESICEnabled: true, employeeESICPercentage: 0.75, employerESICPercentage: 3.25, esicWageCeilingEnabled: false, esicWageCeiling: 21000,
  isPaidLeaveEnabled: false, isPaidHolidayEnabled: false, isPaidWeeklyOffEnabled: false, roundOffSalary: true, salaryCycle: "CALENDAR_DAYS",
}

const Toggle = ({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) => <label className={`flex items-center justify-between gap-4 rounded-lg border p-4 ${checked ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white"}`}><span><strong className="block text-xs text-slate-800">{label}</strong><span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span></span><button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></button></label>

export default function PayrollSettingsPage() {
  const { showToast } = useToast()
  const [setting, setSetting] = useState<Setting>(defaults)
  const [draft, setDraft] = useState<Setting>(defaults)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(apiUrl("/payroll-settings/get-payrollsetting"), { credentials: "include" })
      const result = await response.json() as Api<Setting>
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Payroll settings could not be loaded.")
      const normalized = { ...defaults, ...result.data }
      setSetting(normalized); setDraft(normalized)
    } catch (error) { showToast(error instanceof Error ? error.message : "Payroll settings could not be loaded.", "error") } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const number = (key: keyof Setting, value: string) => setDraft((current) => ({ ...current, [key]: Number(value) }))
  const toggle = (key: keyof Setting, value: boolean) => setDraft((current) => ({ ...current, [key]: value }))
  const cancel = () => { setDraft(setting); setEditing(false) }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.basicPercentage < 0 || draft.basicPercentage > 100 || draft.hraPercentage < 0 || draft.hraPercentage > 100) { showToast("Basic and HRA percentages must be between 0 and 100.", "error"); return }
    setSaving(true)
    try {
      const response = await fetch(apiUrl(`/payroll-settings/${setting._id}`), { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([key]) => key !== "_id"))) })
      const result = await response.json() as Api<Setting>
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Payroll settings could not be saved.")
      const saved = { ...defaults, ...result.data }; setSetting(saved); setDraft(saved); setEditing(false)
      showToast("Payroll settings updated successfully.", "success")
    } catch (error) { showToast(error instanceof Error ? error.message : "Payroll settings could not be saved.", "error") } finally { setSaving(false) }
  }

  const inputClass = `mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500`
  return <div className="flex h-screen overflow-hidden bg-[#f7f8fc]"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Navbar />
    <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Payroll / <span className="font-semibold text-indigo-600">Settings</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Payroll Settings</h1><p className="mt-1 text-sm text-slate-500">Configure salary breakup, statutory deductions, overtime and payable attendance rules.</p></div><div className="flex gap-2"><Link href="/pages/contractorpages/payroll" className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600">Back to Payroll</Link>{editing ? <><button type="button" onClick={cancel} disabled={saving} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600">Cancel</button><button form="payroll-setting-form" type="submit" disabled={saving} className="h-10 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Settings"}</button></> : <button type="button" onClick={() => setEditing(true)} disabled={loading} className="h-10 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white disabled:opacity-50">Edit Settings</button>}</div></header>

      {loading ? <div className="mt-5 rounded-lg border border-slate-200 bg-white p-16 text-center text-sm text-slate-500">Loading payroll settings...</div> : <form id="payroll-setting-form" onSubmit={save} className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 pb-3"><div><h2 className="text-sm font-bold text-slate-900">Salary Structure</h2><p className="mt-1 text-[10px] text-slate-500">Attendance earnings are split into Basic, HRA and Allowance without double calculation.</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-[9px] font-bold text-indigo-700">CORE</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <label className="text-[10px] font-semibold text-slate-500">Basic (% of attendance earnings)<input disabled={!editing} type="number" min="0" max="100" step="0.01" value={draft.basicPercentage} onChange={(event) => number("basicPercentage", event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-500">HRA (% of Basic)<input disabled={!editing} type="number" min="0" max="100" step="0.01" value={draft.hraPercentage} onChange={(event) => number("hraPercentage", event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-500">Salary Cycle<select disabled={!editing} value={draft.salaryCycle} onChange={(event) => setDraft({ ...draft, salaryCycle: event.target.value as Setting["salaryCycle"] })} className={inputClass}><option value="CALENDAR_DAYS">Calendar Days</option><option value="FIXED_30_DAYS">Fixed 30 Days</option><option value="WORKING_DAYS">Working Days</option><option value="MONTHLY">Monthly (Legacy)</option></select></label>
            <label className="text-[10px] font-semibold text-slate-500">Allowance Mode<select disabled={!editing} value={draft.allowanceCalculationMode} onChange={(event) => setDraft({ ...draft, allowanceCalculationMode: event.target.value as Setting["allowanceCalculationMode"] })} className={inputClass}><option value="REMAINING">Remaining Balance</option><option value="FIXED">Fixed Monthly</option><option value="PERCENTAGE">Percentage</option></select></label>
            <label className="text-[10px] font-semibold text-slate-500">Allowance Value<input disabled={!editing || draft.allowanceCalculationMode === "REMAINING"} type="number" min="0" step="0.01" value={draft.allowanceValue} onChange={(event) => number("allowanceValue", event.target.value)} className={inputClass} /></label>
          </div></section>

          <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between border-b pb-3"><h2 className="text-sm font-bold">Provident Fund (PF)</h2><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${draft.isPFEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{draft.isPFEnabled ? "ENABLED" : "DISABLED"}</span></div><div className="mt-4 space-y-4"><Toggle label="Enable PF" description="Apply employee and employer PF on Basic/PF Wage." checked={draft.isPFEnabled} disabled={!editing} onChange={(value) => toggle("isPFEnabled", value)} /><div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-semibold text-slate-500">Employee PF %<input disabled={!editing || !draft.isPFEnabled} type="number" min="0" step="0.01" value={draft.employeePFPercentage} onChange={(event) => number("employeePFPercentage", event.target.value)} className={inputClass} /></label><label className="text-[10px] font-semibold text-slate-500">Employer PF %<input disabled={!editing || !draft.isPFEnabled} type="number" min="0" step="0.01" value={draft.employerPFPercentage} onChange={(event) => number("employerPFPercentage", event.target.value)} className={inputClass} /></label></div><Toggle label="PF Wage Ceiling" description="Limit PF wage to configured ceiling." checked={draft.pfWageCeilingEnabled} disabled={!editing || !draft.isPFEnabled} onChange={(value) => toggle("pfWageCeilingEnabled", value)} /><label className="block text-[10px] font-semibold text-slate-500">PF Ceiling Amount<input disabled={!editing || !draft.isPFEnabled || !draft.pfWageCeilingEnabled} type="number" min="0" value={draft.pfWageCeiling} onChange={(event) => number("pfWageCeiling", event.target.value)} className={inputClass} /></label></div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between border-b pb-3"><h2 className="text-sm font-bold">Employee State Insurance (ESIC)</h2><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${draft.isESICEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{draft.isESICEnabled ? "ENABLED" : "DISABLED"}</span></div><div className="mt-4 space-y-4"><Toggle label="Enable ESIC" description="Apply employee and employer ESIC contribution." checked={draft.isESICEnabled} disabled={!editing} onChange={(value) => toggle("isESICEnabled", value)} /><div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-semibold text-slate-500">Employee ESIC %<input disabled={!editing || !draft.isESICEnabled} type="number" min="0" step="0.01" value={draft.employeeESICPercentage} onChange={(event) => number("employeeESICPercentage", event.target.value)} className={inputClass} /></label><label className="text-[10px] font-semibold text-slate-500">Employer ESIC %<input disabled={!editing || !draft.isESICEnabled} type="number" min="0" step="0.01" value={draft.employerESICPercentage} onChange={(event) => number("employerESICPercentage", event.target.value)} className={inputClass} /></label></div><Toggle label="ESIC Wage Ceiling" description="Apply ESIC only within configured gross limit." checked={draft.esicWageCeilingEnabled} disabled={!editing || !draft.isESICEnabled} onChange={(value) => toggle("esicWageCeilingEnabled", value)} /><label className="block text-[10px] font-semibold text-slate-500">ESIC Ceiling Amount<input disabled={!editing || !draft.isESICEnabled || !draft.esicWageCeilingEnabled} type="number" min="0" value={draft.esicWageCeiling} onChange={(event) => number("esicWageCeiling", event.target.value)} className={inputClass} /></label></div></div></section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="border-b pb-3 text-sm font-bold">Paid Attendance &amp; Rounding</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle label="Paid Leave" description="LEAVE records count as payable days." checked={draft.isPaidLeaveEnabled} disabled={!editing} onChange={(value) => toggle("isPaidLeaveEnabled", value)} /><Toggle label="Paid Holiday" description="HOLIDAY records count as payable days." checked={draft.isPaidHolidayEnabled} disabled={!editing} onChange={(value) => toggle("isPaidHolidayEnabled", value)} /><Toggle label="Paid Weekly Off" description="WEEKLY_OFF records count as payable days." checked={draft.isPaidWeeklyOffEnabled} disabled={!editing} onChange={(value) => toggle("isPaidWeeklyOffEnabled", value)} /><Toggle label="Round Final Salary" description="Round final net salary to nearest rupee." checked={draft.roundOffSalary} disabled={!editing} onChange={(value) => toggle("roundOffSalary", value)} /></div></section>
        </div>

        <aside className="space-y-5"><section className="rounded-lg bg-gradient-to-br from-indigo-700 to-violet-600 p-5 text-white shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Current Formula</p><div className="mt-4 space-y-3 text-xs"><div className="rounded-md bg-white/10 p-3"><span className="text-indigo-100">Basic</span><strong className="float-right">{draft.basicPercentage}%</strong></div><div className="rounded-md bg-white/10 p-3"><span className="text-indigo-100">HRA on Basic</span><strong className="float-right">{draft.hraPercentage}%</strong></div><div className="rounded-md bg-white/10 p-3"><span className="text-indigo-100">Overtime (OT)</span><strong className="float-right text-emerald-200">Auto (Daily Wage / Shift Hours)</strong></div></div><div className="mt-4 rounded-md border border-white/20 bg-white/10 p-3 text-[10px] leading-5 text-indigo-50">Attendance Earnings = Basic + HRA + Allowance. OT is calculated automatically from worker&apos;s Wage Category shift rate.</div></section><section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800"><strong className="block">Important</strong><p className="mt-1">Saved settings apply to new salary calculations. Finalized salary records remain locked.</p></section><section className="rounded-lg border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-500"><h2 className="font-bold text-slate-800">View &amp; Edit</h2><p className="mt-2">View mode prevents accidental changes. Use Edit Settings, review values, then Save Settings.</p></section></aside>
      </form>}
    </main>
  </div></div>
}

