"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type SkillCategory = {
  _id: string
  skillName: string
  skillCode?: string
  gender?: "ALL" | "MALE" | "FEMALE" | "OTHER"
  defaultDailyWage: number
  shiftHours?: number
  otRatePerHour: number
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
}

export default function WageCategoriesPage() {
  const { showToast } = useToast()
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [loading, setLoading] = useState(true)

  const loadCategories = async () => {
    try {
      setLoading(true)
      const res = await fetch(apiUrl("/skills/get-skilles"), {
        credentials: "include",
      })
      const result = await res.json()
      if (res.ok && result.success && Array.isArray(result.data)) {
        setCategories(result.data)
      } else {
        throw new Error(result.message || "Failed to load wage categories")
      }
    } catch (err: any) {
      showToast(err.message || "Could not fetch categories", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return

    try {
      const res = await fetch(apiUrl(`/skills/delete/${id}`), {
        method: "DELETE",
        credentials: "include",
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Delete failed")
      }
      showToast("Category deleted successfully", "success")
      loadCategories()
    } catch (err: any) {
      showToast(err.message || "Failed to delete category", "error")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Daily Wage Categories
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Define worker categories with default daily wages and hourly overtime rates.
                </p>
              </div>
              <Link
                href="/pages/contractorpages/wage-categories/create"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Category
              </Link>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Total Categories</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{categories.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Active Categories</span>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {categories.filter((c) => c.status === "ACTIVE").length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Avg. Default Wage</span>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  ₹{" "}
                  {categories.length > 0
                    ? Math.round(
                        categories.reduce((acc, c) => acc + (c.defaultDailyWage || 0), 0) /
                          categories.length
                      ).toLocaleString("en-IN")
                    : 0}
                  <span className="text-xs font-normal text-slate-400"> / day</span>
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">All Wage Categories</h3>
                <span className="text-xs text-slate-400">{categories.length} entries</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-slate-600">No wage categories created yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click "Add Category" button to create categories like Skilled, Semi-Skilled, Helper, etc.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-6 font-medium">Category Name</th>
                        <th className="py-3 px-6 font-medium">Gender</th>
                        <th className="py-3 px-6 font-medium">Code (Auto)</th>
                        <th className="py-3 px-6 font-medium">Default Daily Wage</th>
                        <th className="py-3 px-6 font-medium">Shift Duration</th>
                        <th className="py-3 px-6 font-medium">OT Rate / Hour</th>
                        <th className="py-3 px-6 font-medium text-center">Status</th>
                        <th className="py-3 px-6 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((cat) => (
                        <tr key={cat._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-6 font-semibold text-slate-900">
                            {cat.skillName}
                          </td>
                          <td className="py-3.5 px-6">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                cat.gender === "MALE"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : cat.gender === "FEMALE"
                                  ? "bg-pink-50 text-pink-700 border border-pink-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {cat.gender === "MALE"
                                ? "Male (पुरुष)"
                                : cat.gender === "FEMALE"
                                ? "Female (महिला)"
                                : "All (General)"}
                            </span>
                          </td>
                          <td className="py-3.5 px-6">
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                              {cat.skillCode || "-"}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-bold text-emerald-700">
                            ₹ {(cat.defaultDailyWage || 0).toLocaleString("en-IN")} / day
                          </td>
                          <td className="py-3.5 px-6 text-slate-700 font-medium">
                            {cat.shiftHours || 8} Hours
                          </td>
                          <td className="py-3.5 px-6 text-slate-700">
                            ₹ {(cat.otRatePerHour || 0).toLocaleString("en-IN")} / hr
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                cat.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {cat.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Link
                                href={`/pages/contractorpages/wage-categories/${cat._id}/edit`}
                                className="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(cat._id)}
                                className="rounded-md border border-rose-200 px-2.5 py-1 text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
