"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Skill = { _id: string; skillName: string; defaultDailyWage?: number; gender?: string }
type Site = { _id: string; siteName: string; siteCode?: string; status: string }
type Api<T> = { success: boolean; data?: T; message?: string }
type Form = { name: string; mobile: string; gender: string; dob: string; aadhaar: string; address: string; skillId: string; siteId: string; dailyWage: string; isPFApplicable: boolean; pfUanNumber: string; isESICApplicable: boolean; esicIpNumber: string }
const initial: Form = { name: "", mobile: "", gender: "", dob: "", aadhaar: "", address: "", skillId: "", siteId: "", dailyWage: "", isPFApplicable: false, pfUanNumber: "", isESICApplicable: false, esicIpNumber: "" }
const input = "mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"

function Title({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <h2 className="flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-bold text-slate-900"><span className="text-indigo-600">{icon}</span>{children}</h2>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-slate-700">{label}{children}</label>
}

export default function CreateLabourPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [form, setForm] = useState<Form>(initial)
  const [skills, setSkills] = useState<Skill[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(apiUrl("/skills/get-skilles"), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl("/sites/get-sites"), { credentials: "include", signal: controller.signal }),
    ]).then(async ([skillResponse, siteResponse]) => {
      const skillResult = await skillResponse.json() as Api<Skill[]>
      const siteResult = await siteResponse.json() as Api<Site[]>
      if (!skillResponse.ok || !skillResult.success) throw new Error(skillResult.message || "Skills could not be loaded.")
      if (!siteResponse.ok || !siteResult.success) throw new Error(siteResult.message || "Sites could not be loaded.")
      setSkills(skillResult.data || [])
      setSites((siteResult.data || []).filter((site) => site.status === "ACTIVE"))
    }).catch((error) => {
      if (error instanceof Error && error.name !== "AbortError") showToast(error.message, "error")
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [showToast])

  const changeSkill = (skillId: string) => {
    const wage = skills.find((skill) => skill._id === skillId)?.defaultDailyWage
    setForm((current) => ({ ...current, skillId, dailyWage: wage?.toString() || "" }))
  }

  // Filter skills based on selected labour gender
  const filteredSkills = useMemo(() => {
    if (!form.gender) return skills
    return skills.filter(
      (skill) => !skill.gender || skill.gender === "ALL" || skill.gender === form.gender
    )
  }, [skills, form.gender])

  const handleGenderChange = (gender: string) => {
    setForm((current) => {
      // If currently selected skill doesn't match the new gender, reset it
      const currentSkill = skills.find((s) => s._id === current.skillId)
      const isStillValid =
        !currentSkill ||
        !currentSkill.gender ||
        currentSkill.gender === "ALL" ||
        currentSkill.gender === gender

      return {
        ...current,
        gender,
        skillId: isStillValid ? current.skillId : "",
        dailyWage: isStillValid ? current.dailyWage : "",
      }
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(apiUrl("/labours/create"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), mobile: form.mobile, gender: form.gender, dob: form.dob || null, address: form.address.trim(), skillId: form.skillId, siteId: form.siteId, dailyWage: form.dailyWage === "" ? null : Number(form.dailyWage), isPFApplicable: form.isPFApplicable, pfUanNumber: form.isPFApplicable ? form.pfUanNumber : null, isESICApplicable: form.isESICApplicable, esicIpNumber: form.isESICApplicable ? form.esicIpNumber : null }),
      })
      const result = await response.json() as Api<unknown>
      if (!response.ok || !result.success) throw new Error(result.message || "Labour could not be registered.")
      showToast(result.message || "Labour registered successfully.", "success")
      router.push("/pages/contractorpages/labours")
      router.refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Labour could not be registered.", "error")
    } finally { setSaving(false) }
  }

  return <div className="flex min-h-screen bg-[#f7f8fc]"><Sidebar /><div className="min-w-0 flex-1"><Navbar />
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-7">
      <header className="mb-5"><p className="text-[11px] text-slate-500">Dashboard / Labours / <span className="font-semibold text-indigo-600">Add New Labour</span></p><h1 className="mt-2 text-2xl font-bold text-slate-950">Add New Labour Registration</h1><p className="mt-1 text-sm text-slate-500">Register a new worker into the system to track attendance and payroll.</p></header>
      <form onSubmit={submit} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-7 p-5 sm:p-7">
          <section><Title icon="o">Personal Details</Title>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><Field label="Labour Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" className={input} /></Field><Field label="Mobile Number"><input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" className={input} /></Field></div>
            <div className="mt-5 grid gap-5 md:grid-cols-3"><Field label="Gender"><select required value={form.gender} onChange={(e) => handleGenderChange(e.target.value)} className={input}><option value="">Select Gender</option><option value="MALE">Male (पुरुष)</option><option value="FEMALE">Female (महिला)</option><option value="OTHER">Other</option></select></Field><Field label="Date of Birth"><input type="date" max={new Date().toISOString().split("T")[0]} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className={input} /></Field><Field label="Aadhaar Number (UIDAI) - optional"><input inputMode="numeric" maxLength={12} value={form.aadhaar} onChange={(e) => setForm({ ...form, aadhaar: e.target.value.replace(/\D/g, "") })} placeholder="0000 0000 0000" className={input} /></Field></div>
            <div className="mt-5"><Field label="Address - optional"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Enter residential address" className={input} /></Field></div>
          </section>
          <section><Title icon="[]">Employment &amp; Payroll</Title>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><Field label="Site / Location"><select required disabled={loading} value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} className={input}><option value="">{loading ? "Loading sites..." : "Select Active Site"}</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.siteName}{site.siteCode ? ` (${site.siteCode})` : ""}</option>)}</select></Field><Field label="Skill / Wage Type"><select required disabled={loading} value={form.skillId} onChange={(e) => changeSkill(e.target.value)} className={input}><option value="">{!form.gender ? "Select Gender first" : loading ? "Loading skills..." : "Select Labour Skill"}</option>{filteredSkills.map((skill) => <option key={skill._id} value={skill._id}>{skill.skillName} - ₹{skill.defaultDailyWage}/day</option>)}</select></Field><Field label="Wage Amount (INR)"><input type="number" min="0" value={form.dailyWage} onChange={(e) => setForm({ ...form, dailyWage: e.target.value })} placeholder="Enter amount" className={input} /></Field><Field label="Payroll Basis"><div className="mt-2 grid h-11 grid-cols-2 gap-2"><span className="flex items-center justify-center rounded-md border-2 border-indigo-500 bg-indigo-50 text-xs font-semibold text-indigo-700">Daily Wage</span><span className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-400">Monthly Salary</span></div></Field></div>
          </section>
          <section><Title icon="%">PF &amp; ESIC Applicability</Title>
            <p className="mt-3 text-[11px] text-slate-500">Enable only the statutory deductions applicable to this labour. Enabled benefits require their registration number.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className={`rounded-lg border p-4 ${form.isPFApplicable ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-800">Provident Fund (PF)</h3><p className="mt-1 text-[10px] text-slate-500">Employee and employer PF will be calculated.</p></div><button type="button" role="switch" aria-checked={form.isPFApplicable} onClick={() => setForm((current) => ({ ...current, isPFApplicable: !current.isPFApplicable, pfUanNumber: current.isPFApplicable ? "" : current.pfUanNumber }))} className={`relative h-6 w-11 rounded-full transition ${form.isPFApplicable ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${form.isPFApplicable ? "left-6" : "left-1"}`} /></button></div>
                {form.isPFApplicable && <Field label="UAN Number *"><input required inputMode="numeric" pattern="[0-9]{12}" minLength={12} maxLength={12} value={form.pfUanNumber} onChange={(e) => setForm({ ...form, pfUanNumber: e.target.value.replace(/\D/g, "").slice(0, 12) })} placeholder="Enter 12-digit UAN" className={input} /><span className="mt-1 block text-[10px] text-slate-400">Exactly 12 digits required.</span></Field>}
              </div>
              <div className={`rounded-lg border p-4 ${form.isESICApplicable ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-800">ESIC</h3><p className="mt-1 text-[10px] text-slate-500">Employee and employer ESIC will be calculated.</p></div><button type="button" role="switch" aria-checked={form.isESICApplicable} onClick={() => setForm((current) => ({ ...current, isESICApplicable: !current.isESICApplicable, esicIpNumber: current.isESICApplicable ? "" : current.esicIpNumber }))} className={`relative h-6 w-11 rounded-full transition ${form.isESICApplicable ? "bg-sky-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${form.isESICApplicable ? "left-6" : "left-1"}`} /></button></div>
                {form.isESICApplicable && <Field label="ESIC IP Number *"><input required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} value={form.esicIpNumber} onChange={(e) => setForm({ ...form, esicIpNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="Enter 10-digit IP number" className={input} /><span className="mt-1 block text-[10px] text-slate-400">Exactly 10 digits required.</span></Field>}
              </div>
            </div>
          </section>
          <section><Title icon="[+]">Verification Documents <small className="font-normal text-slate-400">(optional)</small></Title>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-indigo-300 bg-slate-50 p-6 text-center hover:bg-indigo-50"><input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2097152) { showToast("Photo must be smaller than 2 MB.", "error"); e.target.value = ""; return } setPhoto(file.name) }} /><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-600">[+]</span><strong className="mt-4 text-xs">{photo || "Upload Labour Photo"}</strong><span className="mt-2 text-[10px] leading-5 text-slate-500">Click to browse or drag and drop<br />Max size: 2MB, JPG/PNG</span></label><div className="relative flex min-h-52 overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 via-slate-500 to-indigo-300 p-6 text-white"><div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/20 blur-2xl" /><div className="relative m-auto text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-white/40 bg-white/10 text-xl">ID</span><strong className="mt-4 block text-xs">Verify Identity via KYC</strong><span className="mt-1 block text-[10px] text-white/70">Document verification coming soon</span></div></div></div>
            <p className="mt-3 text-[10px] text-slate-400">Photo and Aadhaar are not uploaded until document storage is enabled.</p>
          </section>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7"><Link href="/pages/contractorpages/labours" className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium text-slate-600">Cancel</Link><button disabled={saving || loading} className="h-10 rounded-md bg-indigo-700 px-6 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{saving ? "Saving..." : "Save Registration"}</button></div>
      </form>
      <section className="mt-5 grid gap-4 md:grid-cols-3">{[{ title: "Secure Data", text: "Labour information follows strict privacy protocols.", color: "bg-emerald-100 text-emerald-700" }, { title: "Fast Processing", text: "Attendance and payroll are ready after saving.", color: "bg-amber-100 text-amber-700" }, { title: "Cloud Sync", text: "Data is available across sites and headquarters.", color: "bg-blue-100 text-blue-700" }].map((item) => <div key={item.title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.color}`}>*</span><div><h2 className="text-xs font-bold">{item.title}</h2><p className="mt-1 text-[10px] text-slate-500">{item.text}</p></div></div>)}</section>
    </main>
  </div></div>
}

