"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

export default function CreateWageCategoryPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    skillName: "",
    gender: "ALL",
    defaultDailyWage: "",
    shiftHours: "8",
    otRatePerHour: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  })

  // Recalculate OT rate whenever wage or shift hours change
  const updateRates = (wage: string, hours: string) => {
    const numWage = Number(wage)
    const numHours = Number(hours) || 8
    const calculatedOt = numWage > 0 && numHours > 0
      ? String(Math.round((numWage / numHours) * 10) / 10)
      : ""

    setForm((prev) => ({
      ...prev,
      defaultDailyWage: wage,
      shiftHours: hours,
      otRatePerHour: calculatedOt,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.skillName.trim() || !form.defaultDailyWage) {
      showToast("Category name and default daily wage are required", "error")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(apiUrl("/skills/create"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: form.skillName.trim(),
          gender: form.gender,
          defaultDailyWage: Number(form.defaultDailyWage),
          shiftHours: Number(form.shiftHours || 8),
          otRatePerHour: Number(form.otRatePerHour || 0),
          status: form.status,
        }),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to create category")
      }

      showToast("Wage category created successfully", "success")
      router.push("/pages/contractorpages/wage-categories")
      router.refresh()
    } catch (err: any) {
      showToast(err.message || "Failed to save category", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Breadcrumb & Header */}
            <div>
              <p className="text-xs text-slate-500">
                Dashboard / Wage Categories /{" "}
                <span className="font-semibold text-emerald-600">Add New Category</span>
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Create Wage Category
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Worker category create karein jisme shift hours ke hisab se hourly overtime rate automatically calculate hoga.
              </p>
            </div>

            {/* Dedicated Form Card */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Category &amp; Wage Details
                </h3>
              </div>

              <div className="space-y-5">
                {/* Category Name & Applicable Gender Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Category Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mason / Carpenter / Helper / Unskilled"
                      value={form.skillName}
                      onChange={(e) => setForm({ ...form, skillName: e.target.value })}
                      className="w-full h-11 rounded-lg border border-slate-300 px-3.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Category code system dwara automatically generate kiya jayega.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Applicable Gender <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="ALL">All (General)</option>
                      <option value="MALE">Male (पुरुष)</option>
                      <option value="FEMALE">Female (महिला)</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Male/Female specific wage rate.
                    </p>
                  </div>
                </div>

                {/* Daily Wage & Shift Hours Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Default Daily Wage (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 600"
                      value={form.defaultDailyWage}
                      onChange={(e) => updateRates(e.target.value, form.shiftHours)}
                      className="w-full h-11 rounded-lg border border-slate-300 px-3.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Shift Duration (Hours) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.shiftHours}
                      onChange={(e) => updateRates(form.defaultDailyWage, e.target.value)}
                      className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="6">6 Hours Shift</option>
                      <option value="8">8 Hours Shift (Standard)</option>
                      <option value="9">9 Hours Shift</option>
                      <option value="10">10 Hours Shift</option>
                      <option value="12">12 Hours Shift</option>
                    </select>
                  </div>
                </div>

                {/* Auto Calculated Overtime Hourly Rate */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">
                        Overtime Rate (OT per Hour)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Formula: Daily Wage (₹ {form.defaultDailyWage || 0}) ÷ Shift ({form.shiftHours} hrs)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-700">
                        ₹ {form.otRatePerHour || "0"}
                      </span>
                      <span className="text-[11px] text-emerald-600 block">/ hour</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Custom OT Rate (Optional override)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={`Calculated: ₹ ${form.otRatePerHour || "0"}`}
                      value={form.otRatePerHour}
                      onChange={(e) => setForm({ ...form, otRatePerHour: e.target.value })}
                      className="w-full h-9 rounded-md border border-emerald-200 bg-white px-3 text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Category Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })
                    }
                    className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <Link
                  href="/pages/contractorpages/wage-categories"
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
