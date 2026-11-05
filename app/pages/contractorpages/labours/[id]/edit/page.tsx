"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Skill = { _id: string; skillName: string; defaultDailyWage?: number; gender?: string }
type Site = { _id: string; siteName: string; siteCode?: string; status: string }
type Labour = { _id: string; labourCode: string; name: string; mobile: string; gender: "MALE" | "FEMALE" | "OTHER"; address?: string; dailyWage?: number | null; finalDailyWage: number; status: string; isPFApplicable?: boolean; pfUanNumber?: string | null; isESICApplicable?: boolean; esicIpNumber?: string | null; skillId: Skill | null; site: Site | null }
type Api<T> = { success: boolean; data?: T; message?: string }
type Form = { name: string; mobile: string; gender: Labour["gender"]; skillId: string; siteId: string; address: string; dailyWage: string; isPFApplicable: boolean; pfUanNumber: string; isESICApplicable: boolean; esicIpNumber: string }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

export default function EditLabourPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const [labour, setLabour] = useState<Labour | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Form>({ name: "", mobile: "", gender: "MALE", skillId: "", siteId: "", address: "", dailyWage: "", isPFApplicable: false, pfUanNumber: "", isESICApplicable: false, esicIpNumber: "" })

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(apiUrl("/labours/get-labour/" + id), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl("/skills/get-skilles"), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl("/sites/get-sites"), { credentials: "include", signal: controller.signal }),
    ]).then(async ([labourResponse, skillResponse, siteResponse]) => {
      const labourResult = await labourResponse.json() as Api<Labour>
      const skillResult = await skillResponse.json() as Api<Skill[]>
      const siteResult = await siteResponse.json() as Api<Site[]>
      if (!labourResponse.ok || !labourResult.success || !labourResult.data) throw new Error(labourResult.message || "Labour details could not be loaded.")
      const item = labourResult.data
      setLabour(item)
      setSkills(skillResult.data || [])
      setSites(siteResult.data || [])
      setForm({ name: item.name, mobile: item.mobile, gender: item.gender, skillId: item.skillId?._id || "", siteId: item.site?._id || "", address: item.address || "", dailyWage: item.dailyWage?.toString() || "", isPFApplicable: Boolean(item.isPFApplicable), pfUanNumber: item.pfUanNumber || "", isESICApplicable: Boolean(item.isESICApplicable), esicIpNumber: item.esicIpNumber || "" })
    }).catch((error) => { if (error.name !== "AbortError") showToast(error.message, "error") }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [id, showToast])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const body = { name: form.name, mobile: form.mobile, gender: form.gender, skillId: form.skillId, address: form.address, dailyWage: form.dailyWage === "" ? null : Number(form.dailyWage), isPFApplicable: form.isPFApplicable, pfUanNumber: form.isPFApplicable ? form.pfUanNumber : null, isESICApplicable: form.isESICApplicable, esicIpNumber: form.isESICApplicable ? form.esicIpNumber : null, ...(!labour?.site && { siteId: form.siteId }) }
      const response = await fetch(apiUrl("/labours/update/" + id), { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = await response.json() as Api<Labour>
      if (!response.ok || !result.success) throw new Error(result.message || "Labour could not be updated.")
      showToast(result.message || "Labour updated successfully.", "success")
      router.push("/pages/contractorpages/labours/" + id)
      router.refresh()
    } catch (error) { showToast(error instanceof Error ? error.message : "Labour could not be updated.", "error") } finally { setSaving(false) }
  }

  const changeSkill = (skillId: string) => {
    const selectedSkill = skills.find((skill) => skill._id === skillId)
    setForm((current) => ({
      ...current,
      skillId,
      dailyWage: selectedSkill?.defaultDailyWage?.toString() || "",
    }))
  }

  // Filter skills based on selected labour gender
  const filteredSkills = useMemo(() => {
    if (!form.gender) return skills
    return skills.filter(
      (skill) => !skill.gender || skill.gender === "ALL" || skill.gender === form.gender
    )
  }, [skills, form.gender])

  const handleGenderChange = (gender: Labour["gender"]) => {
    setForm((current) => {
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

  const displayedWage = form.dailyWage
    ? Number(form.dailyWage)
    : skills.find((skill) => skill._id === form.skillId)?.defaultDailyWage || labour?.finalDailyWage || 0

  return <div className="flex min-h-screen bg-[#f7f8fc]"><Sidebar /><div className="min-w-0 flex-1"><Navbar /><main className="mx-auto max-w-6xl p-5 lg:p-7">
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-slate-500">Labours / <span className="text-indigo-600">Edit Labour</span></p><div className="mt-2 flex items-baseline gap-2"><h1 className="text-2xl font-bold text-slate-950">Edit {form.name || "Labour"}</h1><span className="text-xs text-slate-400">#{labour?.labourCode}</span></div><p className="mt-1 text-sm text-slate-500">Update personal, skill, site and wage information.</p></div><div className="flex gap-2"><Link href={"/pages/contractorpages/labours/" + id} className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600">Cancel</Link><button form="edit-labour" disabled={saving || loading} className="rounded-md bg-indigo-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button></div></header>
    {loading ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Loading labour details...</div> : !labour ? <div className="rounded-lg border bg-white p-16 text-center text-sm text-slate-500">Labour not found.</div> :
    <div className="grid gap-4 lg:grid-cols-[270px_1fr]"><aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-400 text-2xl font-bold text-white">{form.name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</div><h2 className="mt-3 text-center font-bold">{form.name}</h2><p className="mt-1 text-center text-xs text-indigo-600">{labour.labourCode}</p><dl className="mt-5 divide-y text-xs"><div className="flex justify-between py-3"><dt className="text-slate-400">Status</dt><dd className="font-semibold text-emerald-600">{labour.status}</dd></div><div className="flex justify-between gap-3 py-3"><dt className="text-slate-400">Site</dt><dd className="text-right font-semibold">{labour.site?.siteName || sites.find((site) => site._id === form.siteId)?.siteName || "Not assigned"}</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Wage</dt><dd className="font-semibold">{money.format(displayedWage)}</dd></div></dl></aside>
    <form id="edit-labour" onSubmit={submit} className="space-y-4"><section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold">Worker Information</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Full name *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
      <label className="text-xs font-semibold text-slate-600">Mobile number *<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>
      <label className="text-xs font-semibold text-slate-600">Gender *<select required value={form.gender} onChange={(e) => handleGenderChange(e.target.value as Labour["gender"])} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal"><option value="MALE">Male (पुरुष)</option><option value="FEMALE">Female (महिला)</option><option value="OTHER">Other</option></select></label>
      <label className="text-xs font-semibold text-slate-600">Skill *<select required value={form.skillId} onChange={(e) => changeSkill(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal"><option value="">Select skill</option>{filteredSkills.map((skill) => <option key={skill._id} value={skill._id}>{skill.skillName} - ₹{skill.defaultDailyWage}/day</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Address<textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-2 w-full rounded-md border border-slate-300 p-3 text-sm font-normal" /></label>
    </div></section><section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold">Assignment &amp; Wage</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      {labour.site ? <label className="text-xs font-semibold text-slate-600">Assigned site<input readOnly value={labour.site.siteName + (labour.site.siteCode ? " (" + labour.site.siteCode + ")" : "")} className="mt-2 h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-normal" /><span className="mt-2 block text-[10px] text-amber-600">Assigned site cannot be changed.</span></label> : <label className="text-xs font-semibold text-slate-600">Site *<select required value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal"><option value="">Select site</option>{sites.filter((site) => site.status === "ACTIVE").map((site) => <option key={site._id} value={site._id}>{site.siteName}</option>)}</select><span className="mt-2 block text-[10px] text-amber-600">Once assigned, site cannot be changed.</span></label>}
      <label className="text-xs font-semibold text-slate-600">Daily wage<input type="number" min="0" value={form.dailyWage} onChange={(e) => setForm({ ...form, dailyWage: e.target.value })} placeholder="Use skill default" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /><span className="mt-2 block text-[10px] font-normal text-slate-500">Skill change karne par default wage automatically update hoga. Zarurat ho to amount manually change kar sakte hain.</span></label>
    </div></section><section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="border-b border-slate-100 pb-4 text-sm font-bold">PF &amp; ESIC Applicability</h2><p className="mt-3 text-[11px] text-slate-500">Enabled statutory deductions require a valid registration number.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className={`rounded-lg border p-4 ${form.isPFApplicable ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-bold text-slate-800">Provident Fund (PF)</h3><p className="mt-1 text-[10px] text-slate-500">Apply PF deduction</p></div><button type="button" role="switch" aria-checked={form.isPFApplicable} onClick={() => setForm((current) => ({ ...current, isPFApplicable: !current.isPFApplicable, pfUanNumber: current.isPFApplicable ? "" : current.pfUanNumber }))} className={`relative h-6 w-11 rounded-full transition ${form.isPFApplicable ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${form.isPFApplicable ? "left-6" : "left-1"}`} /></button></div>{form.isPFApplicable && <label className="mt-4 block text-xs font-semibold text-slate-600">UAN Number *<input required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={form.pfUanNumber} onChange={(e) => setForm({ ...form, pfUanNumber: e.target.value.replace(/\D/g, "").slice(0, 12) })} placeholder="12-digit UAN" className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal" /></label>}</div>
      <div className={`rounded-lg border p-4 ${form.isESICApplicable ? "border-sky-300 bg-sky-50/50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-bold text-slate-800">ESIC</h3><p className="mt-1 text-[10px] text-slate-500">Apply ESIC deduction</p></div><button type="button" role="switch" aria-checked={form.isESICApplicable} onClick={() => setForm((current) => ({ ...current, isESICApplicable: !current.isESICApplicable, esicIpNumber: current.isESICApplicable ? "" : current.esicIpNumber }))} className={`relative h-6 w-11 rounded-full transition ${form.isESICApplicable ? "bg-sky-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${form.isESICApplicable ? "left-6" : "left-1"}`} /></button></div>{form.isESICApplicable && <label className="mt-4 block text-xs font-semibold text-slate-600">ESIC IP Number *<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.esicIpNumber} onChange={(e) => setForm({ ...form, esicIpNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit IP number" className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal" /></label>}</div>
    </div></section></form></div>}
  </main></div></div>
}



