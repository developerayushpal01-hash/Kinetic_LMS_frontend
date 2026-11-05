"use client"

import { useMemo, useState } from "react"
import { BarChart, DonutChart, Filters, money, ReportActions, number, pad, refId, ReportPage, Stat } from "./_components/report-ui"
import { useReportData } from "./_components/use-report-data"

export default function ReportsOverviewPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth()+1)}`)
  const [siteId, setSiteId] = useState("")
  const { attendance, salaries, labours, sites, payments, labourMap, loading } = useReportData(month)
  const filteredAttendance = useMemo(() => attendance.filter((entry) => !siteId || refId(entry.siteId) === siteId), [attendance, siteId])
  const filteredSalaries = useMemo(() => salaries.filter((salary) => !siteId || labourMap.get(salary.labourId)?.site?._id === siteId), [salaries, labourMap, siteId])
  const filteredLabours = useMemo(() => labours.filter((labour) => !siteId || labour.site?._id === siteId), [labours, siteId])
  const filteredPayments = useMemo(() => payments.filter((payment) => { const embedded = typeof payment.labourId === "object" ? payment.labourId : null; return !siteId || (labourMap.get(refId(payment.labourId)) || embedded)?.site?._id === siteId }), [payments, labourMap, siteId])
  const count = (status: string) => filteredAttendance.filter((entry) => entry.status === status).length
  const sumSalary = (key: "netSalary"|"paidAmount"|"balanceAmount"|"ctc") => filteredSalaries.reduce((sum,row) => sum + Number(row[key]||0),0)
  const paymentTotal = filteredPayments.reduce((sum,row) => sum + Number(row.amount||0),0)
  const siteBars = sites.map((site) => ({ label: site.siteName, value: labours.filter((labour) => labour.site?._id === site._id).length, color: "bg-indigo-500" }))
  return <ReportPage title="Reports Overview" description="Attendance, payroll, payments and workforce ka combined monthly snapshot.">
    <Filters month={month} setMonth={setMonth} siteId={siteId} setSiteId={setSiteId} sites={sites}><span className="ml-auto text-xs text-slate-400">{loading ? "Loading live data..." : "Live API data"}</span><ReportActions title="Reports Overview" fileName={"Reports_Overview_"+month} tableId="overview-export-table" /></Filters>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Stat label="Workforce" value={number.format(filteredLabours.length)} hint="Assigned labours" /><Stat label="Attendance Records" value={number.format(filteredAttendance.length)} tone="text-sky-700" /><Stat label="Net Salary" value={money.format(sumSalary("netSalary"))} tone="text-emerald-700" /><Stat label="Paid Salary" value={money.format(sumSalary("paidAmount"))} tone="text-indigo-700" /><Stat label="Balance" value={money.format(sumSalary("balanceAmount"))} tone="text-red-600" /><Stat label="Transactions" value={money.format(paymentTotal)} tone="text-violet-700" /></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-2"><DonutChart title="Attendance Mix" items={[{label:"Present",value:count("PRESENT"),color:"#10b981"},{label:"Absent",value:count("ABSENT"),color:"#ef4444"},{label:"Half Day",value:count("HALF_DAY"),color:"#f59e0b"},{label:"Leave",value:count("LEAVE"),color:"#0ea5e9"},{label:"Holiday",value:count("HOLIDAY"),color:"#8b5cf6"}]} /><BarChart title="Payroll Position" format={money.format} items={[{label:"CTC",value:sumSalary("ctc"),color:"bg-violet-500"},{label:"Net Salary",value:sumSalary("netSalary"),color:"bg-emerald-500"},{label:"Paid",value:sumSalary("paidAmount"),color:"bg-indigo-500"},{label:"Balance",value:sumSalary("balanceAmount"),color:"bg-red-500"}]} /><BarChart title="Labours by Site" items={siteBars} /><DonutChart title="Payment Types" format={money.format} items={["SALARY","ADVANCE","BONUS","INCENTIVE","DEDUCTION"].map((type,index)=>({label:type,value:filteredPayments.filter((p)=>p.paymentType===type).reduce((s,p)=>s+Number(p.amount||0),0),color:["#4f46e5","#f59e0b","#10b981","#06b6d4","#ef4444"][index]}))} /></section>
<table id="overview-export-table" className="hidden"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody><tr><td>Workforce</td><td>{filteredLabours.length}</td></tr><tr><td>Attendance Records</td><td>{filteredAttendance.length}</td></tr><tr><td>Net Salary</td><td>{sumSalary("netSalary")}</td></tr><tr><td>Paid Salary</td><td>{sumSalary("paidAmount")}</td></tr><tr><td>Balance</td><td>{sumSalary("balanceAmount")}</td></tr><tr><td>Payment Transactions</td><td>{paymentTotal}</td></tr></tbody></table>
  </ReportPage>
}


