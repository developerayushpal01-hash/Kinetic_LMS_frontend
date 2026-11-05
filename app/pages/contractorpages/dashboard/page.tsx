"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { apiUrl } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"

// Formatter utilities
const formatINR = (val: number) => {
  return "₹ " + (val || 0).toLocaleString("en-IN")
}

type SalaryItem = {
  name: string
  amount: number
  percent: number
  color: string
}

type ComplianceItem = {
  id: string
  name: string
  period: string
  status: string
}

type RecentRun = {
  month: string
  totalEmployees: number
  totalSalaryCost: number
  netPayout: number
  status: string
  completedOn: string
}

type DeductionItem = {
  label: string
  value: string
  heightPercent: number
  amount: number
}

const ContractorDashboard = () => {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [viewAsSummary, setViewAsSummary] = useState<"Amount" | "Percentage">("Amount")
  const [viewAsDeduction, setViewAsDeduction] = useState<"Amount" | "Percentage">("Amount")

  // Dynamic state initialized with 0
  const [data, setData] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    employeesDelta: "0",
    totalSalaryCost: 0,
    salaryCostGrowth: "-",
    salaryCostSubtitle: "Current Payroll",
    netPayout: 0,
    netPayoutGrowth: "-",
    netPayoutSubtitle: "Current Payroll",
    avgCtc: 0,
    avgCtcGrowth: "-",

    salaryBreakdown: [] as SalaryItem[],
    costSummaryTotal: 0,

    complianceList: [] as ComplianceItem[],

    payslip: {
      generated: 0,
      inProgress: 0,
      yetToStart: 0,
      total: 0,
      percentage: 0,
    },

    recentRuns: [] as RecentRun[],

    deductions: [] as DeductionItem[],
  })

  // Load real backend metrics
  useEffect(() => {
    let isMounted = true
    const loadBackend = async () => {
      try {
        setLoading(true)
        const res = await fetch(apiUrl("/dashboard/contractor"), {
          credentials: "include",
        })
        const result = await res.json()
        if (isMounted && result?.success && result?.data) {
          const d = result.data
          const k = d.kpis || {}
          const s = d.salaryCostSummary || {}
          const p = d.payslipProgress || {}
          const dec = d.deductionsOverview || {}

          const totalCostVal = s.totalCost || 0
          const items: SalaryItem[] = (s.items || []).map((it: any) => ({
            name: it.label || it.name,
            amount: it.amount || 0,
            percent: totalCostVal > 0 ? Math.round(((it.amount || 0) / totalCostVal) * 1000) / 10 : 0,
            color: it.color || "#1d4ed8",
          }))

          const maxDeduction = Math.max(...(dec.items || []).map((m: any) => m.amount || 0), 1)
          const deductionItems: DeductionItem[] = (dec.items || []).map((it: any) => ({
            label: it.label,
            value: it.formattedAmount || `₹ ${(it.amount || 0).toLocaleString("en-IN")}`,
            heightPercent: it.amount > 0 ? Math.max(6, Math.round(((it.amount || 0) / maxDeduction) * 85)) : 4,
            amount: it.amount || 0,
          }))

          setData({
            totalEmployees: k.totalEmployees?.value ?? d.totalLabour ?? 0,
            activeEmployees: d.activeLabour ?? 0,
            employeesDelta: k.totalEmployees?.delta || "0",
            totalSalaryCost: k.totalSalaryCost?.value ?? 0,
            salaryCostGrowth: k.totalSalaryCost?.delta || "-",
            salaryCostSubtitle: k.totalSalaryCost?.subtitle || "Payroll",
            netPayout: k.netPayout?.value ?? 0,
            netPayoutGrowth: k.netPayout?.delta || "-",
            netPayoutSubtitle: k.netPayout?.subtitle || "Payroll",
            avgCtc: k.avgCtc?.value ?? 0,
            avgCtcGrowth: k.avgCtc?.delta || "-",

            salaryBreakdown: items,
            costSummaryTotal: totalCostVal,

            complianceList: (d.statutoryCompliance || []).map((c: any) => ({
              id: c.id,
              name: c.title || c.name,
              period: c.period,
              status: c.status,
            })),

            payslip: {
              total: p.total ?? 0,
              generated: p.generated ?? 0,
              inProgress: p.inProgress ?? 0,
              yetToStart: p.yetToStart ?? 0,
              percentage: p.percentage ?? 0,
            },

            recentRuns: (d.recentPayrollRuns || []).map((r: any) => ({
              month: r.payrollMonth || r.month,
              totalEmployees: r.totalEmployees || 0,
              totalSalaryCost: r.totalSalaryCost || 0,
              netPayout: r.netPayout || 0,
              status: r.status || "Completed",
              completedOn: r.completedOn || "-",
            })),

            deductions: deductionItems,
          })
        }
      } catch (err: any) {
        showToast(err?.message || "Failed to load dashboard data", "error")
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadBackend()
    return () => {
      isMounted = false
    }
  }, [showToast])

  // Donut chart calculation helper
  const totalCost = data.costSummaryTotal || 1
  let cumulativeDashoffset = 0
  const circumference = 2 * Math.PI * 38 // 238.76

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Employees */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Employees</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                {data.totalEmployees.toLocaleString("en-IN")}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {data.activeEmployees} Active Employees
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-semibold text-emerald-600">
              {data.employeesDelta}
            </span>
            <p className="text-[10px] text-slate-400">Status</p>
          </div>
        </div>

        {/* Card 2: Total Salary Cost */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="text-xl font-bold">₹</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Salary Cost</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                {formatINR(data.totalSalaryCost)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{data.salaryCostSubtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-semibold text-emerald-600">
              {data.salaryCostGrowth}
            </span>
            <p className="text-[10px] text-slate-400">Growth</p>
          </div>
        </div>

        {/* Card 3: Net Payout */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Net Payout</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                {formatINR(data.netPayout)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{data.netPayoutSubtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-semibold text-emerald-600">
              {data.netPayoutGrowth}
            </span>
            <p className="text-[10px] text-slate-400">Growth</p>
          </div>
        </div>

        {/* Card 4: Avg. CTC */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="16" height="20" x="4" y="2" rx="2" />
                <line x1="8" x2="16" y1="6" y2="6" />
                <line x1="8" x2="16" y1="10" y2="10" />
                <line x1="8" x2="12" y1="14" y2="14" />
                <line x1="16" x2="16" y1="14" y2="14" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Avg. CTC</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                {formatINR(data.avgCtc)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Per Employee</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-semibold text-emerald-600">
              {data.avgCtcGrowth}
            </span>
            <p className="text-[10px] text-slate-400">Ratio</p>
          </div>
        </div>
      </div>

      {/* Middle Row: Salary Cost Summary (Donut Chart) + Statutory Compliance + Payslip Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Box 1: Salary Cost Summary (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-slate-900">Salary Cost Summary</h4>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <span>View as:</span>
                <select
                  value={viewAsSummary}
                  onChange={(e) => setViewAsSummary(e.target.value as "Amount" | "Percentage")}
                  className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
                >
                  <option value="Amount">Amount</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Dynamic Donut Chart with SVG */}
              <div className="md:col-span-5 flex items-center justify-center relative">
                <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 100 100">
                  {data.costSummaryTotal > 0 ? (
                    data.salaryBreakdown.map((item, idx) => {
                      const segmentLength = (item.amount / totalCost) * circumference
                      const dashOffset = cumulativeDashoffset
                      cumulativeDashoffset -= segmentLength

                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="14"
                          strokeDasharray={`${segmentLength} ${circumference}`}
                          strokeDashoffset={dashOffset}
                        />
                      )
                    })
                  ) : (
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#e2e8f0"
                      strokeWidth="14"
                    />
                  )}
                </svg>
                {/* Center text of donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                  <span className="text-sm font-bold text-slate-900 leading-tight">
                    {formatINR(data.costSummaryTotal)}
                  </span>
                  <span className="text-[11px] text-slate-400">Total Cost</span>
                </div>
              </div>

              {/* Breakdown Legend and Values */}
              <div className="md:col-span-7 space-y-2 text-xs">
                {data.salaryBreakdown.length > 0 ? (
                  data.salaryBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-normal text-slate-700 truncate max-w-[110px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">
                          {formatINR(item.amount)}
                        </span>
                        <span className="text-[11px] text-slate-400 w-10 text-right">
                          {item.percent}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No salary component data</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: Statutory Compliance (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-bold text-slate-900">Statutory Compliance</h4>
              <Link href="/pages/contractorpages/reports" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {data.complianceList.length > 0 ? (
                data.complianceList.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" x2="8" y1="13" y2="13" />
                          <line x1="16" x2="8" y1="17" y2="17" />
                          <line x1="10" x2="8" y1="9" y2="9" />
                        </svg>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-slate-800">{item.name}</h5>
                        <p className="text-[11px] text-slate-400">{item.period}</p>
                      </div>
                    </div>

                    <div>
                      {item.status === "Paid" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-0.5 rounded-md">
                          Paid
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50/70 border border-amber-200/60 px-2.5 py-0.5 rounded-md">
                          Pending
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" x2="12" y1="8" y2="12" />
                            <line x1="12" x2="12.01" y1="16" y2="16" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No compliance items available</p>
              )}
            </div>
          </div>
        </div>

        {/* Box 3: Payslip Progress (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-slate-900 mb-2">Payslip Progress</h4>

            {/* Circular Gauge / Percentage Indicator */}
            <div className="flex flex-col items-center justify-center my-3 relative">
              <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                {/* Progress Ring: circumference = 2 * PI * 40 = 251.3 */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#22c55e"
                  strokeWidth="8"
                  strokeDasharray={`${(data.payslip.percentage / 100) * 251.3} 251.3`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-slate-900">{data.payslip.percentage}%</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {data.payslip.generated.toLocaleString()} / {data.payslip.total.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">Generated</span>
              </div>
            </div>

            {/* Bottom 3 counter stats */}
            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
              <div>
                <p className="text-sm font-bold text-emerald-600">{data.payslip.generated.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">Generated</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-600">{data.payslip.inProgress}</p>
                <p className="text-[10px] text-slate-400">In Progress</p>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">{data.payslip.yetToStart}</p>
                <p className="text-[10px] text-slate-400">Yet to Start</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/pages/contractorpages/payroll"
              className="block w-full text-center py-2 px-3 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg transition-colors"
            >
              View Payslip Status
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Payroll Runs Table (7 cols) + Deductions Overview Bar Chart (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Table: Recent Payroll Runs (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs">
          <h4 className="text-base font-bold text-slate-900 mb-4">Recent Payroll Runs</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium pb-2">
                  <th className="pb-3 font-medium">Payroll Month</th>
                  <th className="pb-3 font-medium text-center">Total Employees</th>
                  <th className="pb-3 font-medium">Total Salary Cost</th>
                  <th className="pb-3 font-medium">Net Payout</th>
                  <th className="pb-3 font-medium text-center">Status</th>
                  <th className="pb-3 font-medium text-right">Completed On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentRuns.length > 0 ? (
                  data.recentRuns.map((run, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-medium text-slate-800">{run.month}</td>
                      <td className="py-3 text-center text-slate-700">{run.totalEmployees.toLocaleString()}</td>
                      <td className="py-3 font-medium text-slate-800">{formatINR(run.totalSalaryCost)}</td>
                      <td className="py-3 font-medium text-slate-800">{formatINR(run.netPayout)}</td>
                      <td className="py-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-emerald-700 bg-emerald-50">
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-500">{run.completedOn}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                      No payroll runs recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bar Chart: Deductions Overview (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-slate-900">Deductions Overview</h4>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <span>View as:</span>
                <select
                  value={viewAsDeduction}
                  onChange={(e) => setViewAsDeduction(e.target.value as "Amount" | "Percentage")}
                  className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
                >
                  <option value="Amount">Amount</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>
            </div>

            {/* Custom Bar Chart Canvas */}
            <div className="relative pt-6 pb-2">
              {/* Y Axis Grid Lines */}
              <div className="absolute inset-y-6 left-10 right-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400">
                <div className="border-b border-slate-100 flex items-center justify-between">
                  <span className="-translate-y-2.5 -translate-x-10 w-8 text-right">Max</span>
                </div>
                <div className="border-b border-slate-100 flex items-center justify-between">
                  <span className="-translate-y-2.5 -translate-x-10 w-8 text-right">75%</span>
                </div>
                <div className="border-b border-slate-100 flex items-center justify-between">
                  <span className="-translate-y-2.5 -translate-x-10 w-8 text-right">50%</span>
                </div>
                <div className="border-b border-slate-100 flex items-center justify-between">
                  <span className="-translate-y-2.5 -translate-x-10 w-8 text-right">25%</span>
                </div>
                <div className="border-b border-slate-200 flex items-center justify-between">
                  <span className="-translate-y-2.5 -translate-x-10 w-8 text-right">0</span>
                </div>
              </div>

              {/* Vertical Y-axis label */}
              <div className="absolute left-0 top-1/2 -rotate-90 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
                Amount (₹)
              </div>

              {/* Bars Area */}
              <div className="ml-12 h-52 flex items-end justify-between gap-2 pt-2 px-3">
                {data.deductions.length > 0 ? (
                  data.deductions.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      {/* Floating Amount Label above bar */}
                      <span className="text-[10px] font-semibold text-slate-600 mb-1 truncate max-w-[48px] text-center">
                        {item.value}
                      </span>
                      {/* The bar pill */}
                      <div
                        className="w-full max-w-[34px] bg-cyan-600 rounded-t-sm transition-all duration-500 hover:brightness-110"
                        style={{ height: `${item.heightPercent}%` }}
                      />
                      {/* X-axis Label below bar */}
                      <span className="text-[10px] text-slate-600 font-medium mt-2 whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="w-full flex items-center justify-center text-xs text-slate-400 h-full">
                    No deduction records found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default ContractorDashboard
