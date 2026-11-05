"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import QRCode from "qrcode"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Site = { _id: string; siteName: string; siteCode?: string; location?: string }
type Skill = { _id: string; skillName: string }
type Contractor = { _id: string; name: string; email?: string; mobile?: string }
type Company = { _id: string; companyName: string; companyCode?: string; ownerName?: string }

type Labour = {
  _id: string
  labourCode: string
  name: string
  mobile: string
  gender: string
  dob?: string | null
  address?: string
  dailyWage?: number | null
  finalDailyWage: number
  isPFApplicable?: boolean
  pfUanNumber?: string | null
  isESICApplicable?: boolean
  esicIpNumber?: string | null
  status: string
  skillId: Skill | null
  site: Site | null
  contractorId?: Contractor | null
  companyId?: Company | null
  createdAt: string
}
type Api<T> = { success: boolean; data?: T; message?: string }
type UserMe = { name: string; company?: { companyName: string } | null; role: string }

export default function LabourIdCardPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const [labour, setLabour] = useState<Labour | null>(null)
  const [contractorName, setContractorName] = useState<string>("Contractor Operations")
  const [companyName, setCompanyName] = useState<string>("Labour Management System")
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetch(apiUrl(`/labours/get-labour/${id}`), { credentials: "include", signal: controller.signal }),
      fetch(apiUrl("/auth/me"), { credentials: "include", signal: controller.signal }).catch(() => null),
    ])
      .then(async ([labourRes, meRes]) => {
        const result = (await labourRes.json()) as Api<Labour>
        if (!labourRes.ok || !result.success || !result.data) {
          throw new Error(result.message || "Failed to load labour.")
        }
        setLabour(result.data)

        let currentUser: UserMe | null = null
        if (meRes && meRes.ok) {
          const meData = await meRes.json()
          if (meData?.user) currentUser = meData.user
        }

        // Determine Contractor & Company name dynamically
        const resolvedContractor =
          result.data.contractorId?.name ||
          (currentUser?.role === "CONTRACTOR" ? currentUser.name : currentUser?.name) ||
          "Authorized Contractor"
        const resolvedCompany =
          result.data.companyId?.companyName ||
          currentUser?.company?.companyName ||
          "Labour Management System"

        setContractorName(resolvedContractor)
        setCompanyName(resolvedCompany)

        // QR Code Payload
        const qrPayload = JSON.stringify({
          type: "LMS_LABOUR_ATTENDANCE",
          labourId: result.data._id,
          labourCode: result.data.labourCode,
          name: result.data.name,
          mobile: result.data.mobile,
          contractor: resolvedContractor,
          siteId: result.data.site?._id || "",
        })

        const url = await QRCode.toDataURL(qrPayload, {
          width: 320,
          margin: 1,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        })
        setQrDataUrl(url)
      })
      .catch((err) => {
        if (err.name !== "AbortError") showToast(err.message, "error")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [id, showToast])

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadQR = () => {
    if (!qrDataUrl || !labour) return
    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `QR_${labour.labourCode}_${labour.name.replace(/\s+/g, "_")}.png`
    a.click()
  }

  // Generate clean Contractor Logo Initials
  const contractorInitials = contractorName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CT"

  return (
    <div className="flex min-h-screen bg-[#f7f8fc]">
      {/* Hide sidebar/navbar on print */}
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="min-w-0 flex-1">
        <div className="print:hidden">
          <Navbar />
        </div>
        <main className="mx-auto max-w-5xl p-5 lg:p-7">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
            <div>
              <p className="text-xs text-slate-500">
                Workforce / Labours / <span className="font-semibold text-indigo-600">Landscape ID Card</span>
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Worker Identity Card (Landscape)</h1>
              <p className="mt-1 text-sm text-slate-500">
                Authorized badge featuring Contractor Branding, Logo &amp; Attendance QR Code.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pages/contractorpages/labours"
                className="flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back to Labours
              </Link>
              <button
                type="button"
                onClick={handleDownloadQR}
                disabled={!qrDataUrl}
                className="flex h-10 items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                Download QR Code
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!labour}
                className="flex h-10 items-center gap-2 rounded-md bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                Print Landscape Card
              </button>
            </div>
          </header>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-500">
              Loading worker landscape ID card...
            </div>
          ) : !labour ? (
            <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-500">
              Worker not found.
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-8 py-4">
              {/* LANDSCAPE PRINTABLE ID CARD (Standard CR80 Horizontal) */}
              <div
                ref={cardRef}
                className="relative w-full max-w-[650px] overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-2xl print:m-0 print:w-[130mm] print:border print:shadow-none"
              >
                {/* Card Top Brand Ribbon with Contractor Logo & Name */}
                <div className="relative bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-5 py-3 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Contractor Brand Logo Shield / Icon */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-indigo-500 to-indigo-600 p-0.5 shadow-md">
                        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 font-black text-xs text-amber-300">
                          {contractorInitials}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-black tracking-wide text-white uppercase">
                          {contractorName}
                        </h2>
                        <p className="truncate text-[10px] font-medium tracking-wider text-indigo-300 uppercase">
                          WORKER IDENTITY CARD
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {labour.labourCode}
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-400/30">
                        {labour.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Main Horizontal Body */}
                <div className="grid grid-cols-12 gap-5 p-5">
                  {/* Left Column: Photo & Core Profile */}
                  <div className="col-span-4 flex flex-col items-center justify-center border-r border-slate-200 pr-4 text-center">
                    <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-3xl font-black text-white shadow-md ring-4 ring-indigo-50">
                      {labour.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                      <span className="mt-1 text-[8px] font-bold tracking-widest text-indigo-200">PHOTO</span>
                    </div>

                    <h3 className="mt-2.5 line-clamp-1 w-full text-base font-extrabold text-slate-900">
                      {labour.name}
                    </h3>
                    <span className="mt-1 inline-block rounded-md bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                      {labour.skillId?.skillName || "General Labour"}
                    </span>
                    <p className="mt-1 font-mono text-[11px] font-semibold text-slate-600">
                      Mob: {labour.mobile}
                    </p>
                  </div>

                  {/* Middle Column: Detailed Attributes */}
                  <div className="col-span-5 flex flex-col justify-between space-y-2 py-0.5">
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Gender</span>
                        <strong className="text-xs text-slate-800">{labour.gender}</strong>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">Daily Wage</span>
                        <strong className="text-xs text-indigo-700">
                          &#8377;{Number(labour.finalDailyWage || labour.dailyWage || 0).toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-left">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">Assigned Site</span>
                      <strong className="line-clamp-1 text-xs text-slate-800">
                        {labour.site?.siteName || "Unassigned Site"}
                      </strong>
                      <span className="text-[9px] text-slate-500">{labour.site?.siteCode || "Active Location"}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">UAN (PF)</span>
                        <strong className="line-clamp-1 font-mono text-[10px] text-slate-700">
                          {labour.pfUanNumber || "-"}
                        </strong>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">ESIC IP</span>
                        <strong className="line-clamp-1 font-mono text-[10px] text-slate-700">
                          {labour.esicIpNumber || "-"}
                        </strong>
                      </div>
                    </div>

                    {labour.address && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-1.5 text-left text-[10px] text-slate-600">
                        <span className="font-semibold text-slate-500">Address: </span>
                        <span className="truncate">{labour.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Attendance QR Code */}
                  <div className="col-span-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-2.5 text-center">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-900">
                      SCAN FOR ATTENDANCE
                    </span>

                    <div className="mt-1.5 rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
                      {qrDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={qrDataUrl}
                          alt={`QR for ${labour.name}`}
                          className="h-24 w-24 object-contain"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center text-[10px] text-slate-400">
                          Generating QR...
                        </div>
                      )}
                    </div>

                    <p className="mt-1 font-mono text-[10px] font-black tracking-wide text-slate-800">
                      {labour.labourCode}
                    </p>
                    <span className="text-[8px] text-indigo-600">Supervisor Scan</span>
                  </div>
                </div>

                {/* Card Bottom Strip with Contractor Verification */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-100 px-6 py-2 text-[9px] text-slate-500">
                  <span>Official LMS Identity Card &bull; Non-transferable</span>
                  <span>Issued By: <strong className="text-slate-700">{contractorName}</strong></span>
                </div>
              </div>

              {/* Action Guides */}
              <div className="w-full max-w-[650px] rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 shadow-sm print:hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Landscape Badge Ready for Print &amp; Lamination</h4>
                    <p className="mt-0.5 text-slate-500">Authorized with contractor logo and identity credentials.</p>
                  </div>
                  <Link
                    href="/pages/contractorpages/attendance/scan"
                    className="flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Open Camera Scanner
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
