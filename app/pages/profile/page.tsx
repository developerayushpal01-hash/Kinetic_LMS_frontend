"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react"
import Navbar from "@/app/components/navbar"
import Sidebar from "@/app/components/sidebar"
import { useToast } from "@/app/components/toast-provider"
import { apiUrl } from "@/lib/api"

type Address = { street: string; city: string; state: string; pincode: string; country: string }
type Company = {
  companyCode?: string
  companyName: string
  ownerName: string
  email: string
  mobile: string
  gstNumber?: string
  logo?: string | null
  status?: string
  address: Address
}
type User = {
  id?: string
  name: string
  email: string
  mobile?: string
  employeeCode?: string
  role: string
  createdAt?: string
  company?: {
    companyName: string
    companyCode?: string
    ownerName?: string
  } | null
}
type Api<T> = { success: boolean; company?: T; user?: User; message?: string }

const emptyCompany: Company = {
  companyName: "",
  ownerName: "",
  email: "",
  mobile: "",
  gstNumber: "",
  logo: null,
  address: { street: "", city: "", state: "", pincode: "", country: "India" },
}

export default function ProfilePage() {
  const { showToast } = useToast()
  const [company, setCompany] = useState<Company>(emptyCompany)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const userResponse = await fetch(apiUrl("/auth/me"), { credentials: "include" })
      const userResult = (await userResponse.json()) as Api<Company>

      if (userResult.success && userResult.user) {
        setUser(userResult.user)

        // Only fetch company profile if contractor
        if (userResult.user.role === "CONTRACTOR") {
          const companyResponse = await fetch(apiUrl("/company/profile"), { credentials: "include" })
          const companyResult = (await companyResponse.json()) as Api<Company>
          if (companyResponse.ok && companyResult.success && companyResult.company) {
            setCompany({
              ...emptyCompany,
              ...companyResult.company,
              address: { ...emptyCompany.address, ...companyResult.company.address },
            })
          }
        }
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Profile could not be loaded.", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const update = (key: keyof Omit<Company, "address">, value: any) =>
    setCompany((current) => ({ ...current, [key]: value }))

  const updateAddress = (key: keyof Address, value: string) =>
    setCompany((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }))

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      showToast("Logo image size must be under 2MB.", "error")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setCompany((prev) => ({ ...prev, logo: base64 }))
      showToast("Logo selected. Click 'Save Profile' to apply.", "info")
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setCompany((prev) => ({ ...prev, logo: null }))
  }

  const saveCompany = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(apiUrl("/company/profile"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      })
      const result = (await response.json()) as Api<Company>
      if (!response.ok || !result.success || !result.company) {
        throw new Error(result.message || "Profile update failed.")
      }
      setCompany({
        ...emptyCompany,
        ...result.company,
        address: { ...emptyCompany.address, ...result.company.address },
      })
      setIsEditing(false)
      showToast("Company profile updated successfully.", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Profile update failed.", "error")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast("New password and confirm password do not match.", "error")
      return
    }
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters long.", "error")
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await fetch(apiUrl("/auth/change-password"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to change password.")
      }
      showToast("Password changed successfully!", "success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      showToast(err.message || "Failed to change password.", "error")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar />
          <main className="p-7 text-sm text-slate-500">Loading profile...</main>
        </div>
      </div>
    )
  }

  const isSupervisor = user?.role === "SUPERVISOR"

  // 1. SUPERVISOR PERSONAL PROFILE VIEW
  if (isSupervisor) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f7f8fc] pb-24">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl p-5">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Supervisor Profile</h1>
            <p className="text-xs text-slate-500">Apni personal details aur account credentials manage karein</p>
          </div>

          {/* Supervisor Identity Card */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-2xl font-black text-white shadow-md">
                {(user?.name || "S").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-xl font-bold text-slate-900">{user?.name}</h2>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    SUPERVISOR
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: <span className="font-mono font-semibold text-slate-800">{user?.employeeCode || "—"}</span>
                </p>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mobile Number</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{user?.mobile || "—"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 truncate">{user?.email || "—"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Associated Contractor Firm</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {user?.company?.companyName || "Contractor Firm"}
                  {user?.company?.companyCode && (
                    <span className="ml-2 font-mono text-xs text-slate-500 font-normal">
                      (#{user.company.companyCode})
                    </span>
                  )}
                </p>
                {user?.company?.ownerName && (
                  <p className="text-[11px] text-slate-500 mt-0.5">Contractor Owner: {user.company.ownerName}</p>
                )}
              </div>
            </div>
          </section>

          {/* Change Password Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="text-base">🔒</span>
              <h2 className="text-base font-bold text-slate-900">Change Password</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className={input}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={input}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition-all"
              >
                {isChangingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          </section>
        </main>
      </div>
    )
  }

  // 2. CONTRACTOR / COMPANY PROFILE VIEW
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <header>
            <p className="text-xs text-slate-500">
              Dashboard / <span className="font-semibold text-indigo-600">Profile</span>
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Contractor &amp; Company Profile</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your contractor logo, company credentials, GST and ID card branding.
            </p>
          </header>

          <section className="mt-5 grid gap-5 lg:grid-cols-3">
            {/* Left Preview Card */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-6 lg:col-span-1 shadow-sm">
              <div className="flex flex-col items-center text-center">
                {/* Logo Display */}
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-4 ring-indigo-200">
                  {company.logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={company.logo}
                      alt="Contractor Logo"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-3xl font-extrabold text-indigo-700">
                      {(company.companyName || "C").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-xl font-extrabold text-slate-900">
                  {company.companyName || "Contractor Firm"}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-indigo-700">
                  {company.companyCode ? `Code: #${company.companyCode}` : "Contractor Account"}
                </p>
                <span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-bold text-emerald-800">
                  {company.status || "ACTIVE"}
                </span>
              </div>

              <div className="mt-6 space-y-3.5 border-t border-indigo-100 pt-5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Contractor / Owner:</span>
                  <strong className="text-slate-800">{company.ownerName || "-"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account User:</span>
                  <strong className="text-slate-800">{user?.name || "-"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile:</span>
                  <strong className="text-slate-800 font-mono">{company.mobile || "-"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-800 font-medium truncate max-w-[160px]">
                    {company.email || "-"}
                  </span>
                </div>
              </div>

              {/* ID Card Logo Note */}
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
                <strong className="block font-bold">Worker ID Card Branding:</strong>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Yahan upload kiya gaya Contractor Logo sabhi worker ID cards ke top ribbon par automatically show hoga.
                </p>
              </div>
            </div>

            {/* Right Profile Form */}
            <form
              onSubmit={saveCompany}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"
            >
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Contractor &amp; Company Details</h2>
                  <p className="text-xs text-slate-500">Edit business profile &amp; upload contractor logo.</p>
                </div>
                {isEditing ? (
                  <span className="text-xs text-slate-400">Fields marked * are required</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-md bg-indigo-700 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-800 shadow-sm"
                  >
                    Edit Profile &amp; Logo
                  </button>
                )}
              </div>

              {/* CONTRACTOR LOGO UPLOAD SECTION */}
              <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <label className="block text-xs font-bold uppercase tracking-wide text-indigo-950">
                  Contractor / Firm Logo (For ID Cards)
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Yeh logo har labour ke ID card ke top header par print hoga (PNG / JPG, max 2MB).
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {company.logo && (
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={company.logo} alt="Logo Preview" className="h-full w-full object-contain p-1" />
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs">
                        {company.logo ? "Change Logo" : "Upload Logo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {company.logo && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Company Name *</label>
                  <input
                    disabled={!isEditing}
                    value={company.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Owner / Contractor Name *</label>
                  <input
                    disabled={!isEditing}
                    value={company.ownerName}
                    onChange={(e) => update("ownerName", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    disabled={!isEditing}
                    value={company.email}
                    onChange={(e) => update("email", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Mobile Number *</label>
                  <input
                    disabled={!isEditing}
                    value={company.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                    className={input}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">GST Number</label>
                  <input
                    disabled={!isEditing}
                    value={company.gstNumber || ""}
                    onChange={(e) => update("gstNumber", e.target.value)}
                    className={input}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Street Address</label>
                  <input
                    disabled={!isEditing}
                    value={company.address.street}
                    onChange={(e) => updateAddress("street", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">City</label>
                  <input
                    disabled={!isEditing}
                    value={company.address.city}
                    onChange={(e) => updateAddress("city", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">State</label>
                  <input
                    disabled={!isEditing}
                    value={company.address.state}
                    onChange={(e) => updateAddress("state", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Pincode</label>
                  <input
                    disabled={!isEditing}
                    value={company.address.pincode}
                    onChange={(e) => updateAddress("pincode", e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Country</label>
                  <input
                    disabled={!isEditing}
                    value={company.address.country}
                    onChange={(e) => updateAddress("country", e.target.value)}
                    className={input}
                  />
                </div>
              </div>

              {isEditing && (
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      load()
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-indigo-700 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Profile & Logo"}
                  </button>
                </div>
              )}
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
