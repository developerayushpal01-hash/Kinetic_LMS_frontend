"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Filters, money, ReportActions, ReportPage, Site, Stat } from "../_components/report-ui"
import { apiUrl } from "@/lib/api"

type Invoice = {
  _id: string; invoiceNumber: string; siteId: Site | string; siteName: string; clientName: string
  issueDate: string; billingFrom: string; billingTo: string; taxableAmount: number; totalAmount: number
  cgstAmount?: number; cgstPercent?: number; sgstAmount?: number; sgstPercent?: number; gstAmount?: number; gstPercent?: number; status: string
}
type Api<T> = { success: boolean; data?: T; message?: string }
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })
const refId = (value: Site | string) => typeof value === "string" ? value : value?._id

export default function GstReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  const [siteId, setSiteId] = useState("")
  const [status, setStatus] = useState("")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invoiceResponse, siteResponse] = await Promise.all([
        fetch(apiUrl("/site-invoices"), { credentials: "include" }),
        fetch(apiUrl("/sites/get-sites"), { credentials: "include" }),
      ])
      const [invoiceResult, siteResult] = await Promise.all([invoiceResponse.json(), siteResponse.json()]) as [Api<Invoice[]>, Api<Site[]>]
      if (!invoiceResponse.ok || !invoiceResult.success) throw new Error(invoiceResult.message || "GST details could not be loaded.")
      setInvoices(invoiceResult.data || [])
      setSites(siteResult.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  const rows = useMemo(() => invoices.filter((invoice) => {
    const issueMonth = new Date(invoice.issueDate).toISOString().slice(0, 7)
    return issueMonth === month && (!siteId || refId(invoice.siteId) === siteId) && (!status || invoice.status === status) && invoice.status !== "CANCELLED"
  }), [invoices, month, siteId, status])
  const total = (key: "taxableAmount" | "totalAmount" | "cgstAmount" | "sgstAmount" | "gstAmount") => rows.reduce((sum, invoice) => sum + Number(invoice[key] || 0), 0)
  const cgst = total("cgstAmount")
  const sgst = total("sgstAmount")
  const legacyGst = total("gstAmount")
  const gst = cgst + sgst + legacyGst

  return <ReportPage title="GST Details" description="Invoice-wise GST register: taxable amount, CGST, SGST and total tax payable.">
    <Filters month={month} setMonth={setMonth} siteId={siteId} setSiteId={setSiteId} sites={sites}>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 min-w-40 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500">
        <option value="">All Status</option>
        <option value="DRAFT">Draft</option>
        <option value="ISSUED">Issued</option>
        <option value="PARTIALLY_PAID">Partially Paid</option>
        <option value="PAID">Paid</option>
      </select>
      <span className="ml-auto text-xs text-slate-400">{loading ? "Loading GST data..." : `${rows.length} invoices`}</span>
      <ReportActions title="GST Details" fileName={`GST_Details_${month}${status ? `_${status}` : ""}`} tableId="gst-export-table" />
    </Filters>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Taxable Amount" value={money.format(total("taxableAmount"))} tone="text-indigo-700" />
      <Stat label="CGST" value={money.format(cgst)} tone="text-sky-700" />
      <Stat label="SGST" value={money.format(sgst)} tone="text-violet-700" />
      <Stat label="Total GST" value={money.format(gst)} tone="text-amber-700" />
      <Stat label="Invoice Total" value={money.format(total("totalAmount"))} tone="text-emerald-700" />
    </section>
    <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b px-4 py-3 text-sm text-slate-600">GST register for issued and paid invoices. Cancelled invoices are excluded.</div>
      <div className="overflow-x-auto"><table id="gst-export-table" className="w-full min-w-[950px] text-left text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Invoice No.", "Site / Client", "Invoice Date", "Billing Period", "Taxable Amount", "CGST", "SGST", "Total GST", "Invoice Total", "Status"].map((label) => <th key={label} className="border-b px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{rows.map((invoice) => { const rowCgst = Number(invoice.cgstAmount || 0); const rowSgst = Number(invoice.sgstAmount || 0); const rowLegacy = Number(invoice.gstAmount || 0); return <tr key={invoice._id} className="hover:bg-slate-50"><td className="border-b px-4 py-3 font-bold text-indigo-700">{invoice.invoiceNumber}</td><td className="border-b px-4 py-3"><strong>{invoice.siteName}</strong><span className="block text-[10px] text-slate-400">{invoice.clientName}</span></td><td className="border-b px-4 py-3">{date.format(new Date(invoice.issueDate))}</td><td className="border-b px-4 py-3">{date.format(new Date(invoice.billingFrom))} - {date.format(new Date(invoice.billingTo))}</td><td className="border-b px-4 py-3 font-semibold">{money.format(invoice.taxableAmount || 0)}</td><td className="border-b px-4 py-3 text-sky-700">{money.format(rowCgst)}</td><td className="border-b px-4 py-3 text-violet-700">{money.format(rowSgst)}</td><td className="border-b px-4 py-3 font-bold text-amber-700">{money.format(rowCgst + rowSgst + rowLegacy)}</td><td className="border-b px-4 py-3 font-bold">{money.format(invoice.totalAmount || 0)}</td><td className="border-b px-4 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{invoice.status.replaceAll("_", " ")}</span></td></tr> })}</tbody>
      </table></div>
      {!loading && rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No GST invoices found for the selected month and site.</p>}
    </section>
  </ReportPage>
}