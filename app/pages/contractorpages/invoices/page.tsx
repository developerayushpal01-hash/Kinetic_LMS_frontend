"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Site = { _id: string; siteName: string }
type InvoiceLine = { description: string; hsnSacCode: string; quantity: number; rate: number; amount: number }
type Invoice = {
  _id: string
  invoiceNumber: string
  siteId: Site | string
  siteName: string
  siteCode: string
  clientName: string
  billingFrom: string
  billingTo: string
  issueDate: string
  dueDate: string
  lines: InvoiceLine[]
  baseAmount: number
  serviceChargePercent: number
  serviceChargeAmount: number
  adjustmentAmount: number
  taxableAmount: number
  gstPercent: number
  gstAmount: number
  cgstEnabled?: boolean
  cgstPercent?: number
  cgstAmount?: number
  sgstEnabled?: boolean
  sgstPercent?: number
  sgstAmount?: number
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  status: string
  notes?: string
  declarationEnabled?: boolean
  declarationText?: string
  supplierGstNumber?: string
  buyerGstNumber?: string
}
type Api<T> = { success: boolean; data?: T; message?: string }

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })
const invoiceDate=(value:string)=>new Date(value).toLocaleDateString("en-GB")
const invoiceAmount=new Intl.NumberFormat("en-IN",{maximumFractionDigits:2})
const billMonth=(value:string)=>new Date(value).toLocaleDateString("en-US",{month:"short",year:"numeric"})
const compactInvoiceNumber=(value:string)=>value.replace(/^INV-\d{2}(\d{2})-(\d{2})-(.+)$/,"$1-$2/$3")
const invoiceNumberSize=(value:string)=>{const length=`Invoice No. GST/${compactInvoiceNumber(value)}`.length;return length<=26?12:length<=31?10:8}
const amountInWords=(value:number)=>{
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
  const belowHundred=(n:number)=>n<20?ones[n]:`${tens[Math.floor(n/10)]}${n%10?` ${ones[n%10]}`:""}`
  const belowThousand=(n:number)=>n>=100?`${ones[Math.floor(n/100)]} Hundred${n%100?` ${belowHundred(n%100)}`:""}`:belowHundred(n)
  const integerWords=(n:number)=>{if(n===0)return "Zero";const parts:string[]=[];for(const [label,size] of [["Crore",10000000],["Lakh",100000],["Thousand",1000]] as const){const count=Math.floor(n/size);if(count){parts.push(`${belowHundred(count)} ${label}`);n%=size}}if(n)parts.push(belowThousand(n));return parts.join(" ")}
  const rupees=Math.floor(Math.abs(value)),paise=Math.round((Math.abs(value)-rupees)*100)
  return `${value<0?"Minus ":""}${integerWords(rupees)} Rupees${paise?` and ${integerWords(paise)} Paise`:""} Only`
}

export default function InvoiceManagementPage() {
  const { showToast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [siteId, setSiteId] = useState("")
  const [status, setStatus] = useState("")
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [paid, setPaid] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async () => {
      setLoading(true)
      try {
        const [ir, sr] = await Promise.all([
          fetch(apiUrl("/site-invoices"), { credentials: "include" }),
          fetch(apiUrl("/sites/get-sites"), { credentials: "include" }),
        ])
        const [ix, sx] = (await Promise.all([ir.json(), sr.json()])) as [Api<Invoice[]>, Api<Site[]>]
        if (!ir.ok || !ix.success) throw new Error(ix.message || "Invoices could not be loaded.")
        setInvoices(ix.data || [])
        setSites(sx.data || [])
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Invoices could not be loaded.", "error")
      } finally {
        setLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (!siteId || (typeof i.siteId === "string" ? i.siteId : i.siteId?._id) === siteId) &&
          (!status || i.status === status) &&
          (!query.trim() || [i.invoiceNumber, i.siteName, i.clientName].some((v) => v.toLowerCase().includes(query.toLowerCase())))
      ),
    [invoices, query, siteId, status]
  )

  const total = (key: "totalAmount" | "paidAmount" | "balanceAmount") =>
    rows.reduce((s, i) => s + Number(i[key] || 0), 0)

  const open = (i: Invoice) => {
    setSelected(i)
    setPaid(String(i.paidAmount || 0))
  }

  const updatePayment = async () => {
    if (!selected) return
    const paidAmount = Number(paid)
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > Number(selected.totalAmount)) {
      showToast("Received amount must be between zero and the invoice total.", "error")
      return
    }
    setSaving(true)
    try {
      const r = await fetch(apiUrl(`/site-invoices/${selected._id}/payment`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount }),
      })
      const x = (await r.json()) as Api<Invoice>
      if (!r.ok || !x.success || !x.data) throw new Error(x.message || "Payment update failed.")
      setInvoices((c) => c.map((i) => (i._id === x.data!._id ? x.data! : i)))
      setSelected(x.data)
      setPaid(String(x.data.paidAmount || 0))
      showToast("Invoice payment updated.", "success")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Payment update failed.", "error")
    } finally {
      setSaving(false)
    }
  }

  const badge = (s: string) =>
    s === "PAID"
      ? "bg-emerald-100 text-emerald-700"
      : s === "PARTIALLY_PAID"
        ? "bg-amber-100 text-amber-700"
        : s === "CANCELLED"
          ? "bg-slate-200 text-slate-600"
          : "bg-indigo-100 text-indigo-700"

  const downloadPDF = async (invoice: Invoice) => {
    try {
      const element = document.getElementById(`invoice-${invoice._id}`)
      if (!element) return showToast("Invoice element not found", "error")
      const html2pdf = (await import("html2pdf.js")).default
      await html2pdf().set({ margin:[52,14,8,14], filename:`Invoice-${invoice.invoiceNumber}.pdf`, image:{type:"png",quality:1}, html2canvas:{scale:4,useCORS:true,backgroundColor:"#ffffff",logging:false}, jsPDF:{unit:"mm",format:"a4",orientation:"portrait"} }).from(element).save()
      showToast("Invoice PDF downloaded", "success")
    } catch (e) { console.error("PDF Download Error:",e); showToast("Failed to download PDF","error") }
  }
  const downloadExcel = async (invoice: Invoice) => {
    try {
      const response = await fetch(apiUrl(`/site-invoices/${invoice._id}/excel`), { credentials: "include" })
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || "Excel export failed") }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `Invoice-${invoice.invoiceNumber}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      showToast("Formatted invoice downloaded as Excel", "success")
    } catch (e) {
      console.error("Excel Download Error:", e)
      showToast(e instanceof Error ? e.message : "Failed to download Excel", "error")
    }
  }
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">
                Dashboard / <span className="font-semibold text-indigo-600">Invoices</span>
              </p>
              <h1 className="mt-2 text-2xl font-bold">Site Invoice Management</h1>
              <p className="mt-1 text-sm text-slate-500">Track site billing, GST, received payments and outstanding balance.</p>
            </div>
            <Link
              href="/pages/contractorpages/invoices/generate"
              className="rounded-md bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white"
            >
              + Generate Invoice
            </Link>
          </header>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Invoices", String(rows.length), "text-indigo-700"],
              ["Total Billed", money.format(total("totalAmount")), "text-violet-700"],
              ["Received", money.format(total("paidAmount")), "text-emerald-700"],
              ["Outstanding", money.format(total("balanceAmount")), "text-red-600"],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase text-slate-400">{l}</p>
                <strong className={`mt-2 block text-xl ${c}`}>{v}</strong>
              </div>
            ))}
          </section>

          <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search invoice, site or client..."
                className="h-10 min-w-64 flex-1 rounded-md border border-slate-300 px-3 text-sm"
              />
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">All Sites</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">All Status</option>
                {["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] uppercase text-slate-500">
                  <tr>
                    {["Invoice", "Site / Client", "Billing Period", "Issue Date", "Due Date", "Total", "Paid", "Balance", "Status", "Action"].map(
                      (h) => (
                        <th key={h} className="border-b px-4 py-3">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i._id} className="text-xs hover:bg-slate-50">
                      <td className="border-b px-4 py-3 font-bold text-indigo-700">{i.invoiceNumber}</td>
                      <td className="border-b px-4">
                        <strong>{i.siteName}</strong>
                        <span className="block text-[9px] text-slate-400">{i.clientName}</span>
                      </td>
                      <td className="border-b px-4">
                        {date.format(new Date(i.billingFrom))} - {date.format(new Date(i.billingTo))}
                      </td>
                      <td className="border-b px-4">{date.format(new Date(i.issueDate))}</td>
                      <td className="border-b px-4">{date.format(new Date(i.dueDate))}</td>
                      <td className="border-b px-4 font-bold">{money.format(i.totalAmount)}</td>
                      <td className="border-b px-4 text-emerald-700">{money.format(i.paidAmount)}</td>
                      <td className="border-b px-4 font-bold text-red-600">{money.format(i.balanceAmount)}</td>
                      <td className="border-b px-4">
                        <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${badge(i.status)}`}>{i.status}</span>
                      </td>
                      <td className="border-b px-4">
                        <button
                          onClick={() => open(i)}
                          className="rounded bg-indigo-600 px-2.5 py-1 text-[9px] font-semibold text-white hover:bg-indigo-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected && (
            <div
              className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSelected(null)
              }}
            >
              <div className="mx-auto max-w-5xl">
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => downloadPDF(selected)}
                    className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >                    Download PDF
                  </button>
                  <button
                    onClick={() => downloadExcel(selected)}
                    className="flex-1 rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >                    Download Excel
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Close
                  </button>
                </div>

                <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Site Payment Tracking</h2>
                      <p className="text-xs text-slate-500">This is only for payment management and is not included in the PDF invoice.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(selected.status)}`}>{selected.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">Invoice Total</div><div className="mt-1 font-bold text-slate-900">{money.format(selected.totalAmount)}</div></div>
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-3"><div className="text-xs text-emerald-700">Received</div><div className="mt-1 font-bold text-emerald-800">{money.format(selected.paidAmount || 0)}</div></div>
                    <div className="rounded border border-red-200 bg-red-50 p-3"><div className="text-xs text-red-700">Outstanding</div><div className="mt-1 font-bold text-red-700">{money.format(selected.balanceAmount || 0)}</div></div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex-1 text-sm font-semibold text-slate-700">Total payment received from site
                      <input type="number" min="0" max={selected.totalAmount} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} disabled={selected.status === "CANCELLED"} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500" placeholder="0.00" />
                    </label>
                    <button type="button" onClick={updatePayment} disabled={saving || selected.status === "CANCELLED"} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? "Updating..." : "Update Received Payment"}
                    </button>
                  </div>
                </section>

                <div
                  className="bg-white"
                  id={`invoice-${selected._id}`}
                  style={{
                    border: "none",
                    padding: "0",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    pageBreakAfter: "avoid",
                    pageBreakInside: "avoid",
                  }}
                >
                  <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed",fontSize:"12px",color:"#000"}}>
                    <colgroup><col style={{width:"40%"}}/><col style={{width:"24%"}}/><col style={{width:"36%"}}/></colgroup>
                    <tbody>
                      <tr><th colSpan={3} style={{border:"1px solid #000",padding:"5px",fontSize:"20px",lineHeight:"24px",textAlign:"center",fontWeight:"bold"}}>Invoice</th></tr>
                      <tr><td colSpan={2} style={{border:"1px solid #000",padding:"4px",fontWeight:"bold"}}>Bill Month :- {billMonth(selected.billingFrom)}</td><td style={{border:"1px solid #000",padding:"4px",fontWeight:"bold",whiteSpace:"nowrap"}}>Bill Period : {invoiceDate(selected.billingFrom)} to {invoiceDate(selected.billingTo)}</td></tr>
                      <tr><td rowSpan={6} style={{border:"1px solid #000",padding:"4px",verticalAlign:"top",lineHeight:"1.65"}}><strong>AL Gosar Enterprises</strong><br/>Bairagi Colony , Ward No.10 , Pithampur<br/>Dist : Dhar ( M.P.) 454775<br/>GST No. {selected.supplierGstNumber || "23CFVPG6126B1ZN"}<br/>PAN No: CFVPG6126B<br/>State : Madhya Pradesh<br/>E- Mail : gosarenterprises8@gmail.com</td><td style={{border:"1px solid #000",padding:"3px",whiteSpace:"nowrap",overflow:"hidden",fontSize:`${invoiceNumberSize(selected.invoiceNumber)}px`,letterSpacing:"-0.2px",fontWeight:"bold"}}>Invoice No. GST/{compactInvoiceNumber(selected.invoiceNumber)}</td><td style={{border:"1px solid #000",padding:"3px",whiteSpace:"nowrap"}}>Date : {invoiceDate(selected.issueDate)}</td></tr>
                      <tr><td style={{border:"1px solid #000",padding:"3px"}}>Deliver Note</td><td style={{border:"1px solid #000",padding:"3px"}}>Mode / Terms of Payment</td></tr>
                      <tr><td style={{border:"1px solid #000",padding:"3px"}}>Supplier&apos;s Ref.</td><td style={{border:"1px solid #000",padding:"3px"}}>Dated</td></tr>
                      <tr><td style={{border:"1px solid #000",padding:"3px"}}>Vender Code</td><td style={{border:"1px solid #000",padding:"3px"}}>422045</td></tr>
                      <tr><td style={{border:"1px solid #000",padding:"3px"}}>Buyer&apos;s order No.</td><td style={{border:"1px solid #000",padding:"3px",whiteSpace:"nowrap"}}>Destination : PITHAMPUR</td></tr>
                      <tr><td style={{border:"1px solid #000",padding:"3px"}}>LUT No.</td><td style={{border:"1px solid #000",padding:"3px"}}>AD230425013203T</td></tr>
                      <tr><td style={{border:"1px solid #000",padding:"4px",verticalAlign:"top",lineHeight:"1.65"}}><strong>Buyers &amp; Consignee</strong><br/><strong>{selected.clientName}</strong><br/>{selected.siteName}<br/>GSTIN : {selected.buyerGstNumber || "N/A"}</td><td colSpan={2} style={{border:"1px solid #000",padding:"4px",verticalAlign:"top"}}>Terms Of Delivery :- 10 days after invoice</td></tr>
                    </tbody>
                  </table>
                  {/* Items Table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#fff", borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "left", fontWeight: "bold" }}>S.No.</th>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "left", fontWeight: "bold" }}>Description of Goods</th>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "center", fontWeight: "bold" }}>HSN / SAC</th>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "center", fontWeight: "bold" }}>Quantity</th>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "center", fontWeight: "bold" }}>Rate</th>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "center", fontWeight: "bold" }}>Per</th>
                        <th style={{ border: "1px solid #000", padding: "8px", textAlign: "right", fontWeight: "bold" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lines.map((l, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #000" }}>
                          <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ border: "1px solid #000", padding: "8px" }}>{l.description}</td>
                          <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{l.hsnSacCode || "-"}</td>
                          <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{l.quantity || "-"}</td>
                          <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>{l.rate}</td>
                          <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>-</td>
                          <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right", fontWeight: "bold" }}>{l.amount}</td>
                        </tr>
                      ))}
                      <tr><td colSpan={6} style={{border:"1px solid #000",padding:"6px",textAlign:"right",fontWeight:"bold"}}>AMOUNT</td><td style={{border:"1px solid #000",padding:"6px",textAlign:"right",fontWeight:"bold"}}>{invoiceAmount.format(selected.baseAmount)}</td></tr>
                      {selected.serviceChargeAmount>0&&<tr><td colSpan={6} style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>Service Charges {selected.serviceChargePercent}%</td><td style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>{invoiceAmount.format(selected.serviceChargeAmount)}</td></tr>}
                      {selected.adjustmentAmount!==0&&<tr><td colSpan={6} style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>Adjustment</td><td style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>{invoiceAmount.format(selected.adjustmentAmount)}</td></tr>}
                      <tr><td colSpan={6} style={{border:"1px solid #000",padding:"6px",textAlign:"right",fontWeight:"bold"}}>Total Amount</td><td style={{border:"1px solid #000",padding:"6px",textAlign:"right",fontWeight:"bold"}}>{invoiceAmount.format(selected.taxableAmount)}</td></tr>
                      {(selected.cgstAmount??0)>0&&<tr><td colSpan={6} style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>CGST {selected.cgstPercent??0}%</td><td style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>{invoiceAmount.format(selected.cgstAmount??0)}</td></tr>}
                      {(selected.sgstAmount??0)>0&&<tr><td colSpan={6} style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>SGST {selected.sgstPercent??0}%</td><td style={{border:"1px solid #000",padding:"6px",textAlign:"right"}}>{invoiceAmount.format(selected.sgstAmount??0)}</td></tr>}
                      <tr><td colSpan={6} style={{border:"1px solid #000",padding:"7px",textAlign:"right",fontWeight:"bold"}}>NET PAYABLE AMOUNT</td><td style={{border:"1px solid #000",padding:"7px",textAlign:"right",fontWeight:"bold"}}>{invoiceAmount.format(selected.totalAmount)}</td></tr>
                    </tbody>
                  </table>

                  {/* Amount in Words */}
                  <div style={{ border: "1px solid #000", borderTop: "0", padding: "7px 3px", fontSize: "12px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "3px" }}>Amount Chargeble in ( Words )</div>
                    <div style={{ fontWeight: "bold" }}>{amountInWords(selected.totalAmount)}</div>
                  </div>

                  {/* Declaration */}
                  {selected.declarationEnabled!==false&&<div style={{ border: "1px solid #000", borderTop: "0", padding: "6px 8px", fontSize: "12px", backgroundColor: "#fff" }}>
                    <div style={{ textAlign: "center", fontWeight: "bold", textDecoration:"underline", fontSize:"16px", marginBottom: "5px" }}>Declaration</div>
                    <div style={{ textAlign: "center", fontSize: "11px", lineHeight:"1.35", whiteSpace:"pre-wrap" }}>{selected.declarationText||"Supply & service MEANT for Export/Supply to SEZ Developer for authorised operations under bond or letter undertaking without payment of IGST AD230425013203T Dated :-22/04/2025 Valid till :-31/03/2026"}</div>
                  </div>}
                  {/* Remarks & Bank Details */}
                  <div style={{ display: "grid", gridTemplateColumns: "55% 45%", alignItems:"stretch", border:"1px solid #000", borderTop:"0", fontSize: "12px", overflow:"visible" }}>
                    <div style={{display:"flex",flexDirection:"column",justifyContent:"center",minHeight:"130px",padding:"8px 8px 12px",lineHeight:"1.5",boxSizing:"border-box"}}>
                      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Remarks</div>
                      <div>AL Gosar Enterprises</div>
                      <div style={{ marginTop: "8px", fontWeight: "bold" }}>Bank Details :-</div>
                      <div>Account Name : A.L Gosar Enterprises</div>
                      <div>Account No : 5020004929512</div>
                      <div>IFSC Code : HDFC0001291</div>
                      <div>Branch : Pithampur</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", alignItems:"flex-end", minHeight:"130px", textAlign:"right", padding:"10px 12px 12px 4px", lineHeight:"1.5", boxSizing:"border-box" }}>
                      <div style={{ fontWeight: "bold" }}>For :- AL Gosar Enterprises</div>
                      <div style={{ flex:"1" }}></div>
                      <div style={{ fontWeight: "bold" }}>Authorised Signatory</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

